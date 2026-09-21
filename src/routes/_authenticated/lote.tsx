import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Images,
  Loader2,
  RefreshCw,
  Save,
  Tag,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { FolhaEtiquetas } from "@/components/FolhaEtiquetas";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { criarLivrosEmLote, enviarCapa, listarLivros, type Livro } from "@/lib/biblioteca";
import { prepararFoto } from "@/lib/imagem";
import { lerCapaLivro } from "@/lib/ocr.functions";

export const Route = createFileRoute("/_authenticated/lote")({
  head: () => ({
    meta: [
      { title: "Cadastrar livros em lote | Biblioteca Escolar" },
      {
        name: "description",
        content:
          "Envie várias fotos de capas de uma vez, confira os dados lidos automaticamente e cadastre todos os livros juntos com etiquetas para imprimir.",
      },
      { property: "og:title", content: "Cadastrar livros em lote | Biblioteca Escolar" },
      {
        property: "og:description",
        content: "Cadastro de vários livros por fotos com conferência antes de salvar.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lote,
});

type Situacao = "lendo" | "ok" | "conferir" | "repetido" | "falhou";

type LinhaLote = {
  id: string;
  arquivo: string;
  dataUrl: string;
  blob: Blob | null;
  situacao: Situacao;
  erro?: string;
  selecionado: boolean;
  titulo: string;
  autor: string;
  categoria: string;
  isbn: string;
  quantidade: string;
};

const CHAVE_RASCUNHO = "biblioteca:lote-rascunho";

const SELOS: Record<Situacao, { texto: string; classe: string }> = {
  lendo: { texto: "Lendo...", classe: "bg-muted text-muted-foreground" },
  ok: { texto: "Lido", classe: "bg-emerald-100 text-emerald-800" },
  conferir: { texto: "Precisa conferir", classe: "bg-amber-100 text-amber-900" },
  repetido: { texto: "Possível repetido", classe: "bg-sky-100 text-sky-900" },
  falhou: { texto: "Falhou", classe: "bg-red-100 text-red-800" },
};

function Lote() {
  const queryClient = useQueryClient();
  const lerCapa = useServerFn(lerCapaLivro);
  const inputFotos = useRef<HTMLInputElement>(null);
  const inputPasta = useRef<HTMLInputElement>(null);

  const [linhas, setLinhas] = useState<LinhaLote[]>([]);
  const [lidas, setLidas] = useState(0);
  const [total, setTotal] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [categoriaEmMassa, setCategoriaEmMassa] = useState("");
  const [criados, setCriados] = useState<Livro[]>([]);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);

  // Retoma a conferência (só os dados digitados; as fotos precisam ser enviadas de novo).
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_RASCUNHO);
      if (!bruto) return;
      const salvo = JSON.parse(bruto) as LinhaLote[];
      if (Array.isArray(salvo) && salvo.length > 0) {
        setLinhas(salvo.map((l) => ({ ...l, blob: null, dataUrl: "" })));
        toast.info("Retomei a conferência anterior. As fotos precisam ser enviadas de novo.");
      }
    } catch {
      /* rascunho inválido, ignora */
    }
  }, []);

  useEffect(() => {
    try {
      if (linhas.length === 0) localStorage.removeItem(CHAVE_RASCUNHO);
      else
        localStorage.setItem(
          CHAVE_RASCUNHO,
          JSON.stringify(linhas.map((l) => ({ ...l, blob: null, dataUrl: "" }))),
        );
    } catch {
      /* espaço cheio, ignora */
    }
  }, [linhas]);

  function atualizar(id: string, campos: Partial<LinhaLote>) {
    setLinhas((atual) => atual.map((l) => (l.id === id ? { ...l, ...campos } : l)));
  }

  async function classificar(linha: LinhaLote, titulo: string, isbn: string): Promise<Situacao> {
    if (!titulo.trim()) return "conferir";
    try {
      const acervo = await queryClient.ensureQueryData({
        queryKey: ["livros"],
        queryFn: listarLivros,
      });
      const repetido = (acervo as Livro[]).some(
        (l) =>
          l.titulo.trim().toLowerCase() === titulo.trim().toLowerCase() ||
          (!!isbn && l.isbn === isbn),
      );
      if (repetido) return "repetido";
    } catch {
      /* sem acervo em cache, segue */
    }
    const jaNaLista = linhas.some(
      (l) => l.id !== linha.id && l.titulo.trim().toLowerCase() === titulo.trim().toLowerCase(),
    );
    return jaNaLista ? "repetido" : "ok";
  }

  async function lerLinha(linha: LinhaLote) {
    atualizar(linha.id, { situacao: "lendo", erro: undefined });
    try {
      const dados = await lerCapa({ data: { imagemDataUrl: linha.dataUrl } });
      const situacao = await classificar(linha, dados.titulo, dados.isbn);
      atualizar(linha.id, {
        titulo: dados.titulo,
        autor: dados.autor,
        categoria: dados.categoria,
        isbn: dados.isbn,
        situacao,
      });
    } catch (erro) {
      atualizar(linha.id, {
        situacao: "falhou",
        erro: erro instanceof Error ? erro.message : "Não consegui ler esta foto.",
      });
    } finally {
      setLidas((n) => n + 1);
    }
  }

  /** Fila com no máximo 3 leituras ao mesmo tempo, para não travar a tela nem o serviço de leitura. */
  async function processarFila(pendentes: LinhaLote[]) {
    const fila = [...pendentes];
    setProcessando(true);
    const trabalhador = async () => {
      for (;;) {
        const proxima = fila.shift();
        if (!proxima) return;
        await lerLinha(proxima);
      }
    };
    await Promise.all([trabalhador(), trabalhador(), trabalhador()]);
    setProcessando(false);
    toast.success("Leitura concluída. Confira os dados antes de salvar.");
  }

  async function aoEscolherArquivos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []).filter((a) => a.type.startsWith("image/"));
    if (arquivos.length === 0) {
      toast.error("Selecione fotos de capas (imagens).");
      return;
    }

    const novas: LinhaLote[] = [];
    for (const arquivo of arquivos) {
      try {
        const preparada = await prepararFoto(arquivo);
        novas.push({
          id: crypto.randomUUID(),
          arquivo: arquivo.name,
          dataUrl: preparada.dataUrl,
          blob: preparada.blob,
          situacao: "lendo",
          selecionado: true,
          titulo: "",
          autor: "",
          categoria: "",
          isbn: "",
          quantidade: "1",
        });
      } catch {
        toast.error(`Não consegui abrir a foto ${arquivo.name}.`);
      }
    }

    setLinhas((atual) => [...atual, ...novas]);
    setLidas(0);
    setTotal(novas.length);
    void processarFila(novas);
  }

  const selecionadas = linhas.filter((l) => l.selecionado && l.titulo.trim());

  async function salvarTudo() {
    if (selecionadas.length === 0) {
      toast.error("Selecione ao menos um livro com título preenchido.");
      return;
    }
    setSalvando(true);
    try {
      const entradas = [];
      for (const linha of selecionadas) {
        const capa = linha.blob ? await enviarCapa(linha.blob) : null;
        entradas.push({
          titulo: linha.titulo,
          autor: linha.autor,
          categoria: linha.categoria,
          isbn: linha.isbn,
          quantidade: Number(linha.quantidade) || 1,
          capa_url: capa,
        });
      }
      const livros = await criarLivrosEmLote(entradas);
      await queryClient.invalidateQueries({ queryKey: ["livros"] });
      const idsSalvos = new Set(selecionadas.map((l) => l.id));
      setLinhas((atual) => atual.filter((l) => !idsSalvos.has(l.id)));
      setCriados(livros);
      setFolhaAberta(true);
      toast.success(`${livros.length} livro(s) cadastrado(s). Agora imprima as etiquetas.`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não consegui salvar os livros.");
    } finally {
      setSalvando(false);
    }
  }

  const progresso = total > 0 ? Math.round((lidas / total) * 100) : 0;

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-4xl font-semibold">Cadastrar livros em lote</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Envie de uma vez as fotos das capas (ou uma pasta inteira). O site lê cada capa, monta uma
          lista para você conferir e só salva quando você confirmar.
        </p>

        <section
          className="surface-paper mt-8 rounded-xl border border-dashed border-border p-6 text-center"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => {
            e.preventDefault();
            void aoEscolherArquivos(e.dataTransfer.files);
          }}
        >
          <Images className="mx-auto size-8 text-muted-foreground" />
          <p className="mt-3 font-medium">Arraste as fotos aqui</p>
          <p className="text-sm text-muted-foreground">ou escolha pelos botões abaixo</p>

          <input
            ref={inputFotos}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(e) => void aoEscolherArquivos(e.target.files)}
          />
          <input
            ref={inputPasta}
            type="file"
            accept="image/*"
            multiple
            // @ts-expect-error atributo só existe nos navegadores
            webkitdirectory=""
            className="hidden"
            onChange={(e) => void aoEscolherArquivos(e.target.files)}
          />

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button onClick={() => inputFotos.current?.click()} disabled={processando}>
              Escolher várias fotos
            </Button>
            <Button
              variant="secondary"
              onClick={() => inputPasta.current?.click()}
              disabled={processando}
            >
              Escolher uma pasta
            </Button>
          </div>

          {processando ? (
            <div className="mx-auto mt-6 max-w-md">
              <p className="mb-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Lendo {Math.min(lidas + 1, total)} de{" "}
                {total}
              </p>
              <Progress value={progresso} />
            </div>
          ) : null}
        </section>

        {linhas.length > 0 ? (
          <section className="mt-10">
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <h2 className="font-display text-2xl font-semibold">Conferência</h2>
                <p className="text-sm text-muted-foreground">
                  {selecionadas.length} de {linhas.length} selecionados para salvar
                </p>
              </div>

              <div className="ml-auto flex flex-wrap items-end gap-2">
                <div className="grid gap-1.5">
                  <Label htmlFor="cat-massa" className="text-xs">
                    Categoria para os selecionados
                  </Label>
                  <Input
                    id="cat-massa"
                    value={categoriaEmMassa}
                    onChange={(e) => setCategoriaEmMassa(e.target.value)}
                    placeholder="Ex: Literatura"
                    className="h-9 w-44"
                  />
                </div>
                <Button
                  variant="secondary"
                  onClick={() => {
                    if (!categoriaEmMassa.trim()) return;
                    setLinhas((atual) =>
                      atual.map((l) =>
                        l.selecionado ? { ...l, categoria: categoriaEmMassa.trim() } : l,
                      ),
                    );
                    toast.success("Categoria aplicada aos selecionados.");
                  }}
                >
                  Aplicar
                </Button>
                <Button variant="ghost" onClick={() => setConfirmarLimpeza(true)}>
                  <Trash2 className="mr-1.5 size-4" /> Limpar lista
                </Button>
              </div>
            </div>

            <ul className="mt-5 grid gap-3">
              {linhas.map((linha) => (
                <li key={linha.id} className="surface-paper rounded-xl p-4">
                  <div className="flex flex-wrap items-start gap-4">
                    <Checkbox
                      checked={linha.selecionado}
                      onCheckedChange={(v) => atualizar(linha.id, { selecionado: v === true })}
                      aria-label={`Selecionar ${linha.arquivo}`}
                      className="mt-1"
                    />

                    <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                      {linha.dataUrl ? (
                        <img
                          src={linha.dataUrl}
                          alt={`Capa de ${linha.titulo || linha.arquivo}`}
                          className="size-full object-cover"
                        />
                      ) : null}
                    </div>

                    <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                      <div className="sm:col-span-2 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${SELOS[linha.situacao].classe}`}
                        >
                          {linha.situacao === "ok" ? (
                            <CheckCircle2 className="size-3.5" />
                          ) : linha.situacao === "falhou" ? (
                            <XCircle className="size-3.5" />
                          ) : linha.situacao === "lendo" ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <AlertTriangle className="size-3.5" />
                          )}
                          {SELOS[linha.situacao].texto}
                        </span>
                        <span className="truncate text-xs text-muted-foreground">
                          {linha.arquivo}
                        </span>
                        {linha.situacao === "falhou" && linha.dataUrl ? (
                          <Button size="sm" variant="secondary" onClick={() => void lerLinha(linha)}>
                            <RefreshCw className="mr-1.5 size-3.5" /> Tentar de novo
                          </Button>
                        ) : null}
                        <Button
                          size="sm"
                          variant="ghost"
                          className="ml-auto"
                          onClick={() =>
                            setLinhas((atual) => atual.filter((l) => l.id !== linha.id))
                          }
                          aria-label={`Remover ${linha.arquivo}`}
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>

                      <CampoLinha
                        rotulo="Título"
                        valor={linha.titulo}
                        onChange={(v) => atualizar(linha.id, { titulo: v })}
                      />
                      <CampoLinha
                        rotulo="Autor"
                        valor={linha.autor}
                        onChange={(v) => atualizar(linha.id, { autor: v })}
                      />
                      <CampoLinha
                        rotulo="Categoria"
                        valor={linha.categoria}
                        onChange={(v) => atualizar(linha.id, { categoria: v })}
                      />
                      <CampoLinha
                        rotulo="ISBN"
                        valor={linha.isbn}
                        onChange={(v) => atualizar(linha.id, { isbn: v })}
                      />
                      <CampoLinha
                        rotulo="Exemplares"
                        tipo="number"
                        valor={linha.quantidade}
                        onChange={(v) => atualizar(linha.id, { quantidade: v })}
                      />
                      {linha.erro ? (
                        <p className="self-end text-xs text-destructive">{linha.erro}</p>
                      ) : null}
                    </div>
                  </div>
                </li>
              ))}
            </ul>

            <div className="sticky bottom-4 mt-6 flex flex-wrap gap-2">
              <Button
                size="lg"
                onClick={() => void salvarTudo()}
                disabled={salvando || processando || selecionadas.length === 0}
              >
                {salvando ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Salvar os {selecionadas.length} livros selecionados
              </Button>
            </div>
          </section>
        ) : null}

        {criados.length > 0 ? (
          <section className="surface-paper mt-10 rounded-xl p-6">
            <p className="font-medium">
              Últimos {criados.length} livros cadastrados neste lote
              <Badge variant="secondary" className="ml-2">
                prontos para etiquetar
              </Badge>
            </p>
            <Button className="mt-3" variant="secondary" onClick={() => setFolhaAberta(true)}>
              <Tag className="mr-2 size-4" /> Imprimir etiquetas destes livros
            </Button>
          </section>
        ) : null}
      </main>

      <FolhaEtiquetas livros={criados} aberto={folhaAberta} onFechar={() => setFolhaAberta(false)} />

      <AlertDialog open={confirmarLimpeza} onOpenChange={setConfirmarLimpeza}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Limpar a lista de conferência?</AlertDialogTitle>
            <AlertDialogDescription>
              As fotos e os dados lidos serão descartados. Nenhum livro já salvo é afetado.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                setLinhas([]);
                setTotal(0);
                setLidas(0);
              }}
            >
              Limpar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function CampoLinha({
  rotulo,
  valor,
  onChange,
  tipo = "text",
}: {
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
}) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs text-muted-foreground">{rotulo}</Label>
      <Input
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="h-9"
      />
    </div>
  );
}
