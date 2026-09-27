import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  AlertTriangle,
  CheckCircle2,
  Images,
  Loader2,
  Pause,
  Play,
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
import { Textarea } from "@/components/ui/textarea";
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
import {
  criarLivrosEmLote,
  enviarCapa,
  listarLivros,
  type EntradaLivro,
  type Livro,
} from "@/lib/biblioteca";
import { prepararFotoLeve } from "@/lib/imagem";
import { lerCapaLivro } from "@/lib/ocr.functions";
import { comNovaTentativa, rodarFila, type Fila } from "@/lib/fila";
import { blobParaDataUrl, lerFoto, limparFotos, removerFoto, salvarFoto } from "@/lib/fotosLote";
import { lerLivroGratis } from "@/lib/leituraGratis";

export const Route = createFileRoute("/_authenticated/lote")({
  head: () => ({
    meta: [
      { title: "Cadastrar livros em lote | Biblioteca Escolar" },
      {
        name: "description",
        content:
          "Envie centenas de fotos de capas de uma vez, confira os dados lidos automaticamente e cadastre todos os livros juntos com etiquetas para imprimir.",
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

type Situacao = "aguardando" | "lendo" | "ok" | "conferir" | "repetido" | "falhou";

type LinhaLote = {
  id: string;
  arquivo: string;
  miniatura: string;
  temFoto: boolean;
  situacao: Situacao;
  erro: string;
  selecionado: boolean;
  titulo: string;
  autor: string;
  categoria: string;
  isbn: string;
  descricao: string;
  quantidade: string;
};

const CHAVE_RASCUNHO = "biblioteca:lote-rascunho";
const MAXIMO_ARQUIVOS = 1000;
const POR_PAGINA = 50;
const BLOCO_SALVAMENTO = 20;

const SELOS: Record<Situacao, { texto: string; classe: string }> = {
  aguardando: { texto: "Na fila", classe: "bg-muted text-muted-foreground" },
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
  const filaRef = useRef<Fila | null>(null);
  const linhasRef = useRef<LinhaLote[]>([]);

  const [linhas, setLinhas] = useState<LinhaLote[]>([]);
  const [pagina, setPagina] = useState(0);
  const [preparando, setPreparando] = useState({ feitos: 0, total: 0 });
  const [lidas, setLidas] = useState(0);
  const [total, setTotal] = useState(0);
  const [processando, setProcessando] = useState(false);
  const [pausado, setPausado] = useState(false);
  const [salvando, setSalvando] = useState({ ativo: false, feitos: 0, total: 0 });
  const [categoriaEmMassa, setCategoriaEmMassa] = useState("");
  const [criados, setCriados] = useState<Livro[]>([]);
  const [folhaAberta, setFolhaAberta] = useState(false);
  const [confirmarLimpeza, setConfirmarLimpeza] = useState(false);
  const [usarIA, setUsarIA] = useState(false);
  const usarIARef = useRef(false);

  linhasRef.current = linhas;
  usarIARef.current = usarIA;

  // Retoma a conferência (só os dados digitados; as fotos precisam ser enviadas de novo).
  useEffect(() => {
    try {
      const bruto = localStorage.getItem(CHAVE_RASCUNHO);
      if (!bruto) return;
      const salvo = JSON.parse(bruto) as LinhaLote[];
      if (Array.isArray(salvo) && salvo.length > 0) {
        setLinhas(salvo.map((l) => ({ ...l, miniatura: "", temFoto: false })));
        toast.info("Retomei a conferência anterior. As fotos precisam ser enviadas de novo.");
      }
    } catch {
      /* rascunho inválido, ignora */
    }
  }, []);

  // Rascunho gravado com atraso e sem imagens, para não estourar o espaço do navegador.
  useEffect(() => {
    const tempo = setTimeout(() => {
      try {
        if (linhas.length === 0) {
          localStorage.removeItem(CHAVE_RASCUNHO);
          return;
        }
        localStorage.setItem(
          CHAVE_RASCUNHO,
          JSON.stringify(linhas.map((l) => ({ ...l, miniatura: "", temFoto: false }))),
        );
      } catch {
        /* espaço cheio, ignora */
      }
    }, 800);
    return () => clearTimeout(tempo);
  }, [linhas]);

  useEffect(() => () => filaRef.current?.cancelar(), []);

  const atualizar = useCallback((id: string, campos: Partial<LinhaLote>) => {
    setLinhas((atual) => {
      const i = atual.findIndex((l) => l.id === id);
      if (i < 0) return atual;
      const copia = atual.slice();
      copia[i] = { ...copia[i]!, ...campos };
      return copia;
    });
  }, []);

  async function classificar(id: string, titulo: string, isbn: string): Promise<Situacao> {
    if (!titulo.trim()) return "conferir";
    const alvo = titulo.trim().toLowerCase();
    try {
      const acervo = (await queryClient.ensureQueryData({
        queryKey: ["livros"],
        queryFn: listarLivros,
      })) as Livro[];
      if (acervo.some((l) => l.titulo.trim().toLowerCase() === alvo || (!!isbn && l.isbn === isbn)))
        return "repetido";
    } catch {
      /* sem acervo em cache, segue */
    }
    const jaNaLista = linhasRef.current.some(
      (l) => l.id !== id && l.titulo.trim().toLowerCase() === alvo,
    );
    return jaNaLista ? "repetido" : "ok";
  }

  const lerLinha = useCallback(
    async (id: string) => {
      atualizar(id, { situacao: "lendo", erro: "" });
      try {
        const blob = await lerFoto(id);
        if (!blob) throw new Error("A foto desta linha não está mais no navegador.");
        const gratis = await lerLivroGratis(blob).catch(() => null);
        let dados = gratis?.dados;
        let certo = gratis?.certo ?? false;
        if ((!dados || !dados.titulo) && usarIARef.current) {
          const dataUrl = await blobParaDataUrl(blob);
          dados = await comNovaTentativa(() => lerCapa({ data: { imagemDataUrl: dataUrl } }));
          certo = true;
        }
        if (!dados || (!dados.titulo && !dados.isbn))
          throw new Error("Não reconheci este livro. Digite os dados.");
        let situacao = await classificar(id, dados.titulo, dados.isbn);
        if (situacao === "ok" && (!certo || !dados.titulo)) situacao = "conferir";
        atualizar(id, {
          titulo: dados.titulo,
          autor: dados.autor,
          categoria: dados.categoria,
          isbn: dados.isbn,
          descricao: dados.descricao ?? "",
          situacao,
        });
      } catch (erro) {
        atualizar(id, {
          situacao: "falhou",
          erro: erro instanceof Error ? erro.message : "Não consegui ler esta foto.",
        });
      } finally {
        setLidas((n) => n + 1);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [atualizar, lerCapa],
  );

  /** Fila com no máximo 3 leituras ao mesmo tempo, com pausa e nova tentativa automática. */
  async function processarFila(ids: string[]) {
    if (ids.length === 0) return;
    setLidas(0);
    setTotal(ids.length);
    setProcessando(true);
    setPausado(false);
    const fila = rodarFila(ids, lerLinha, 2);
    filaRef.current = fila;
    await fila.promessa;
    filaRef.current = null;
    setProcessando(false);
    setPausado(false);
    toast.success("Leitura concluída. Confira os dados antes de salvar.");
  }

  async function aoEscolherArquivos(lista: FileList | null) {
    const arquivos = Array.from(lista ?? []).filter((a) => a.type.startsWith("image/"));
    if (arquivos.length === 0) {
      toast.error("Selecione fotos de capas (imagens).");
      return;
    }
    if (arquivos.length > MAXIMO_ARQUIVOS) {
      toast.error(
        `São ${arquivos.length} fotos de uma vez. Envie no máximo ${MAXIMO_ARQUIVOS} por lote para o site não travar.`,
      );
      return;
    }

    setPreparando({ feitos: 0, total: arquivos.length });
    const novas: LinhaLote[] = [];
    let acumulado: LinhaLote[] = [];

    const descarregar = () => {
      if (acumulado.length === 0) return;
      const bloco = acumulado;
      acumulado = [];
      setLinhas((atual) => [...atual, ...bloco]);
    };

    const fila = rodarFila(
      arquivos,
      async (arquivo) => {
        try {
          const { blob, miniatura } = await prepararFotoLeve(arquivo, 2048);
          const id = crypto.randomUUID();
          await salvarFoto(id, blob);
          const linha: LinhaLote = {
            id,
            arquivo: arquivo.name,
            miniatura,
            temFoto: true,
            situacao: "aguardando",
            erro: "",
            selecionado: true,
            titulo: "",
            autor: "",
            categoria: "",
            isbn: "",
            descricao: "",
            quantidade: "1",
          };
          novas.push(linha);
          acumulado.push(linha);
          if (acumulado.length >= 10) descarregar();
        } catch {
          toast.error(`Não consegui abrir a foto ${arquivo.name}.`);
        } finally {
          setPreparando((p) => ({ ...p, feitos: p.feitos + 1 }));
        }
      },
      4,
    );
    await fila.promessa;
    descarregar();
    setPreparando({ feitos: 0, total: 0 });

    await processarFila(novas.map((l) => l.id));
  }

  const contagens = useMemo(() => {
    const base = { ok: 0, conferir: 0, repetido: 0, falhou: 0, pendente: 0 };
    for (const l of linhas) {
      if (l.situacao === "ok") base.ok++;
      else if (l.situacao === "conferir") base.conferir++;
      else if (l.situacao === "repetido") base.repetido++;
      else if (l.situacao === "falhou") base.falhou++;
      else base.pendente++;
    }
    return base;
  }, [linhas]);

  const selecionadas = useMemo(
    () => linhas.filter((l) => l.selecionado && l.titulo.trim()),
    [linhas],
  );

  async function salvarTudo() {
    if (selecionadas.length === 0) {
      toast.error("Selecione ao menos um livro com título preenchido.");
      return;
    }
    setSalvando({ ativo: true, feitos: 0, total: selecionadas.length });
    const salvos: Livro[] = [];
    const idsSalvos = new Set<string>();
    let falhas = 0;

    try {
      for (let i = 0; i < selecionadas.length; i += BLOCO_SALVAMENTO) {
        const bloco = selecionadas.slice(i, i + BLOCO_SALVAMENTO);
        const entradas: EntradaLivro[] = [];

        // Envio das capas com concorrência limitada.
        const capas = new Map<string, string | null>();
        const filaCapas = rodarFila(
          bloco,
          async (linha) => {
            if (!linha.temFoto) return;
            const blob = await lerFoto(linha.id);
            capas.set(linha.id, blob ? await enviarCapa(blob) : null);
          },
          4,
        );
        await filaCapas.promessa;

        for (const linha of bloco) {
          entradas.push({
            titulo: linha.titulo,
            autor: linha.autor,
            categoria: linha.categoria,
            isbn: linha.isbn,
            quantidade: Number(linha.quantidade) || 1,
            capa_url: capas.get(linha.id) ?? null,
            descricao: linha.descricao,
          });
        }

        try {
          const livros = await criarLivrosEmLote(entradas);
          salvos.push(...livros);
          for (const linha of bloco) {
            idsSalvos.add(linha.id);
            void removerFoto(linha.id);
          }
        } catch (erro) {
          falhas += bloco.length;
          console.error("[lote] bloco falhou", erro);
        } finally {
          setSalvando((s) => ({ ...s, feitos: Math.min(s.total, s.feitos + bloco.length) }));
        }
      }

      await queryClient.invalidateQueries({ queryKey: ["livros"] });
      setLinhas((atual) => atual.filter((l) => !idsSalvos.has(l.id)));
      setCriados(salvos);
      if (salvos.length > 0) {
        setFolhaAberta(true);
        toast.success(`${salvos.length} livro(s) cadastrado(s). Agora imprima as etiquetas.`);
      }
      if (falhas > 0)
        toast.error(`${falhas} livro(s) não foram salvos. Eles continuam na lista para tentar de novo.`);
    } finally {
      setSalvando({ ativo: false, feitos: 0, total: 0 });
    }
  }

  const progresso = total > 0 ? Math.round((lidas / total) * 100) : 0;
  const progressoPreparo =
    preparando.total > 0 ? Math.round((preparando.feitos / preparando.total) * 100) : 0;
  const paginas = Math.max(1, Math.ceil(linhas.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, paginas - 1);
  const visiveis = linhas.slice(paginaAtual * POR_PAGINA, paginaAtual * POR_PAGINA + POR_PAGINA);

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="font-display text-4xl font-semibold">Cadastrar livros em lote</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Envie de uma vez as fotos das capas (ou uma pasta inteira, até {MAXIMO_ARQUIVOS} fotos). O
          site lê cada livro de graça, monta uma lista para você conferir e só salva quando você
          confirmar.
        </p>
        <p className="mt-3 max-w-2xl rounded-lg bg-muted px-3 py-2 text-sm">
          Dica: para melhor resultado, fotografe a <strong>contracapa com o código de barras</strong>{" "}
          visível — assim os dados vêm do cadastro oficial do livro.
        </p>
        <label className="mt-3 flex max-w-2xl items-center gap-2 text-sm">
          <Checkbox checked={usarIA} onCheckedChange={(v) => setUsarIA(v === true)} />
          Usar IA nos livros que não forem reconhecidos (gasta créditos)
        </label>

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
            onChange={(e) => {
              void aoEscolherArquivos(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={inputPasta}
            type="file"
            accept="image/*"
            multiple
            // @ts-expect-error atributo só existe nos navegadores
            webkitdirectory=""
            className="hidden"
            onChange={(e) => {
              void aoEscolherArquivos(e.target.files);
              e.target.value = "";
            }}
          />

          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button
              onClick={() => inputFotos.current?.click()}
              disabled={processando || preparando.total > 0}
            >
              Escolher várias fotos
            </Button>
            <Button
              variant="secondary"
              onClick={() => inputPasta.current?.click()}
              disabled={processando || preparando.total > 0}
            >
              Escolher uma pasta
            </Button>
          </div>

          {preparando.total > 0 ? (
            <div className="mx-auto mt-6 max-w-md">
              <p className="mb-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Preparando {preparando.feitos} de{" "}
                {preparando.total} fotos
              </p>
              <Progress value={progressoPreparo} />
            </div>
          ) : null}

          {processando ? (
            <div className="mx-auto mt-6 max-w-md">
              <p className="mb-2 flex items-center justify-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Lendo {Math.min(lidas + 1, total)} de{" "}
                {total}
              </p>
              <Progress value={progresso} />
              <Button
                size="sm"
                variant="secondary"
                className="mt-3"
                onClick={() => {
                  if (pausado) {
                    filaRef.current?.retomar();
                    setPausado(false);
                  } else {
                    filaRef.current?.pausar();
                    setPausado(true);
                  }
                }}
              >
                {pausado ? (
                  <>
                    <Play className="mr-1.5 size-3.5" /> Continuar leitura
                  </>
                ) : (
                  <>
                    <Pause className="mr-1.5 size-3.5" /> Pausar leitura
                  </>
                )}
              </Button>
            </div>
          ) : null}
        </section>

        {linhas.length > 0 ? (
          <section className="mt-10">
            <div className="surface-paper sticky top-[4.5rem] z-20 flex flex-wrap items-center gap-2 rounded-xl px-4 py-3 text-sm">
              <Badge variant="secondary">{linhas.length} fotos</Badge>
              <Badge className="bg-emerald-100 text-emerald-800">{contagens.ok} lidos</Badge>
              <Badge className="bg-amber-100 text-amber-900">
                {contagens.conferir} para conferir
              </Badge>
              <Badge className="bg-sky-100 text-sky-900">{contagens.repetido} repetidos</Badge>
              <Badge className="bg-red-100 text-red-800">{contagens.falhou} falharam</Badge>
              {contagens.falhou > 0 && !processando ? (
                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() =>
                    void processarFila(
                      linhas.filter((l) => l.situacao === "falhou" && l.temFoto).map((l) => l.id),
                    )
                  }
                >
                  <RefreshCw className="mr-1.5 size-3.5" /> Tentar de novo os que falharam
                </Button>
              ) : null}
            </div>

            <div className="mt-5 flex flex-wrap items-end gap-3">
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
              {visiveis.map((linha) => (
                <LinhaConferencia
                  key={linha.id}
                  linha={linha}
                  atualizar={atualizar}
                  onRemover={() => {
                    void removerFoto(linha.id);
                    setLinhas((atual) => atual.filter((l) => l.id !== linha.id));
                  }}
                  onReler={() => void processarFila([linha.id])}
                  ocupado={processando}
                />
              ))}
            </ul>

            {paginas > 1 ? (
              <div className="mt-5 flex items-center justify-center gap-3">
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={paginaAtual === 0}
                  onClick={() => setPagina(paginaAtual - 1)}
                >
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {paginaAtual + 1} de {paginas}
                </span>
                <Button
                  variant="secondary"
                  size="sm"
                  disabled={paginaAtual >= paginas - 1}
                  onClick={() => setPagina(paginaAtual + 1)}
                >
                  Próxima
                </Button>
              </div>
            ) : null}

            <div className="sticky bottom-4 mt-6 flex flex-wrap items-center gap-3">
              <Button
                size="lg"
                onClick={() => void salvarTudo()}
                disabled={salvando.ativo || processando || selecionadas.length === 0}
              >
                {salvando.ativo ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Save className="mr-2 size-4" />
                )}
                Salvar os {selecionadas.length} livros selecionados
              </Button>
              {salvando.ativo ? (
                <span className="text-sm text-muted-foreground">
                  Salvando {salvando.feitos} de {salvando.total}
                </span>
              ) : null}
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
                filaRef.current?.cancelar();
                void limparFotos();
                setLinhas([]);
                setTotal(0);
                setLidas(0);
                setPagina(0);
                setProcessando(false);
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

function LinhaConferencia({
  linha,
  atualizar,
  onRemover,
  onReler,
  ocupado,
}: {
  linha: LinhaLote;
  atualizar: (id: string, campos: Partial<LinhaLote>) => void;
  onRemover: () => void;
  onReler: () => void;
  ocupado: boolean;
}) {
  const selo = SELOS[linha.situacao];
  return (
    <li className="surface-paper rounded-xl p-4">
      <div className="flex flex-wrap items-start gap-4">
        <Checkbox
          checked={linha.selecionado}
          onCheckedChange={(v) => atualizar(linha.id, { selecionado: v === true })}
          aria-label={`Selecionar ${linha.arquivo}`}
          className="mt-1"
        />

        <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
          {linha.miniatura ? (
            <img
              src={linha.miniatura}
              alt={`Capa de ${linha.titulo || linha.arquivo}`}
              loading="lazy"
              className="size-full object-cover"
            />
          ) : null}
        </div>

        <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
          <div className="flex flex-wrap items-center gap-2 sm:col-span-2">
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${selo.classe}`}
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
              {selo.texto}
            </span>
            <span className="truncate text-xs text-muted-foreground">{linha.arquivo}</span>
            {linha.situacao === "falhou" && linha.temFoto && !ocupado ? (
              <Button size="sm" variant="secondary" onClick={onReler}>
                <RefreshCw className="mr-1.5 size-3.5" /> Tentar de novo
              </Button>
            ) : null}
            <Button
              size="sm"
              variant="ghost"
              className="ml-auto"
              onClick={onRemover}
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
          <div className="grid gap-1 sm:col-span-2">
            <Label className="text-xs text-muted-foreground">Descrição</Label>
            <Textarea
              value={linha.descricao}
              onChange={(e) => atualizar(linha.id, { descricao: e.target.value })}
              rows={2}
              placeholder="Resumo curto do livro"
            />
          </div>
          {linha.erro ? <p className="text-xs text-destructive">{linha.erro}</p> : null}
        </div>
      </div>
    </li>
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
