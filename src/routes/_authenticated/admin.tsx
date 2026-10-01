import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Camera, Loader2, Minus, Pencil, Plus, Sparkles, Tag, Trash2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { CapaLivro } from "@/components/CapaLivro";
import { EtiquetaLivro } from "@/components/EtiquetaLivro";
import { CodigoBarras } from "@/components/CodigoBarras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  atualizarQuantidade,
  criarLivro,
  enviarCapa,
  listarLivros,
  removerLivro,
  trocarCapa,
  type Livro,
} from "@/lib/biblioteca";
import { prepararFoto } from "@/lib/imagem";

export const Route = createFileRoute("/_authenticated/admin")({
  head: () => ({
    meta: [
      { title: "Painel do Administrador | Biblioteca Escolar" },
      {
        name: "description",
        content:
          "Cadastre livros por foto com leitura automática da capa, gere etiquetas com código de barras e gerencie o acervo da biblioteca.",
      },
      { property: "og:title", content: "Painel do Administrador | Biblioteca Escolar" },
      {
        property: "og:description",
        content: "Cadastro de livros por foto com OCR e etiquetas com código de barras.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Admin,
});

const VAZIO = { titulo: "", autor: "", categoria: "", isbn: "", quantidade: "1" };

function Admin() {
  const queryClient = useQueryClient();
  const inputFoto = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState(VAZIO);
  const [foto, setFoto] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [etiqueta, setEtiqueta] = useState<Livro | null>(null);
  const [confirmar, setConfirmar] = useState(false);
  const [editando, setEditando] = useState<Livro | null>(null);

  const { data: livros = [] } = useQuery({ queryKey: ["livros"], queryFn: listarLivros });

  const salvar = useMutation({
    mutationFn: async () => {
      const capa = foto ? await enviarCapa(foto.blob) : null;
      return criarLivro({
        titulo: form.titulo,
        autor: form.autor,
        categoria: form.categoria,
        isbn: form.isbn,
        quantidade: Number(form.quantidade) || 1,
        capa_url: capa?.url ?? null,
        capa_arquivo: capa?.arquivo ?? null,
      });
    },
    onSuccess: (livro) => {
      queryClient.invalidateQueries({ queryKey: ["livros"] });
      setForm(VAZIO);
      setFoto(null);
      setConfirmar(false);
      setEtiqueta(livro);
      toast.success(`Livro cadastrado com o código ${livro.codigo}`);
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const excluir = useMutation({
    mutationFn: removerLivro,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["livros"] });
      toast.success("Livro removido do acervo.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  async function aoEscolherFoto(arquivo: File | undefined) {
    if (!arquivo) return;
    try {
      setLendo(true);
      const preparada = await prepararFoto(arquivo, 2048);
      setFoto(preparada);
      setConfirmar(true);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não consegui abrir a foto.");
    } finally {
      setLendo(false);
    }
  }

  const exemplares = livros.reduce((s, l) => s + l.quantidade, 0);

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-4xl font-semibold">Painel administrativo</h1>
        <p className="mt-2 text-muted-foreground">
          Comece do zero: fotografe a capa, confira os dados e o sistema gera um código de
          barras para imprimir.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <div className="surface-paper rounded-xl p-5">
            <p className="font-display text-3xl font-semibold">{livros.length}</p>
            <p className="text-sm text-muted-foreground">Livros cadastrados</p>
          </div>
          <div className="surface-paper rounded-xl p-5">
            <p className="font-display text-3xl font-semibold">{exemplares}</p>
            <p className="text-sm text-muted-foreground">Exemplares</p>
          </div>
        </div>

        <section className="surface-paper mt-8 rounded-xl p-6">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Sparkles className="size-5 text-primary" /> Cadastrar livro por foto
          </h2>

          <div className="mt-5 grid gap-6 md:grid-cols-[220px_1fr]">
            <div>
              <div className="grid aspect-[3/4] place-items-center overflow-hidden rounded-lg border border-dashed border-border bg-muted">
                {foto ? (
                  <img src={foto.dataUrl} alt="Capa capturada" className="size-full object-cover" />
                ) : (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    <Camera className="mx-auto mb-2 size-7" />
                    Foto da capa
                  </div>
                )}
              </div>
              <input
                ref={inputFoto}
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => { void aoEscolherFoto(e.target.files?.[0]); e.target.value = ""; }}
              />
              <Button
                type="button"
                variant="secondary"
                className="mt-3 w-full"
                disabled={lendo}
                onClick={() => inputFoto.current?.click()}
              >
                {lendo ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" /> Lendo capa...
                  </>
                ) : (
                  <>
                    <Camera className="mr-2 size-4" /> Abrir câmera e fotografar
                  </>
                )}
              </Button>
            </div>

            <form
              className="grid gap-4 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                if (!form.titulo.trim()) {
                  toast.error("Informe o título do livro.");
                  return;
                }
                salvar.mutate();
              }}
            >
              <Campo
                id="titulo"
                rotulo="Título"
                valor={form.titulo}
                onChange={(v) => setForm({ ...form, titulo: v })}
              />
              <Campo
                id="autor"
                rotulo="Autor"
                valor={form.autor}
                onChange={(v) => setForm({ ...form, autor: v })}
              />
              <Campo
                id="categoria"
                rotulo="Categoria"
                valor={form.categoria}
                onChange={(v) => setForm({ ...form, categoria: v })}
              />
              <Campo
                id="isbn"
                rotulo="ISBN (opcional)"
                valor={form.isbn}
                onChange={(v) => setForm({ ...form, isbn: v })}
              />
              <Campo
                id="quantidade"
                rotulo="Quantidade de exemplares"
                tipo="number"
                valor={form.quantidade}
                onChange={(v) => setForm({ ...form, quantidade: v })}
              />
              <div className="flex items-end sm:col-span-2">
                <Button type="submit" className="w-full" disabled={salvar.isPending}>
                  {salvar.isPending ? (
                    <Loader2 className="mr-2 size-4 animate-spin" />
                  ) : (
                    <Plus className="mr-2 size-4" />
                  )}
                  Cadastrar e gerar etiqueta
                </Button>
              </div>
            </form>
          </div>

          <Separator className="my-5" />
          <p className="text-sm text-muted-foreground">
            Cada livro recebe um código único (ex: <span className="font-mono">BIB-000001</span>)
            usado no código de barras da etiqueta e na hora de escanear.
          </p>
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Acervo cadastrado</h2>
          {livros.length === 0 ? (
            <p className="mt-3 text-muted-foreground">
              Nenhum livro ainda. Cadastre o primeiro acima.
            </p>
          ) : (
            <ul className="mt-4 grid gap-4 md:grid-cols-2">
              {livros.map((livro) => (
                <li key={livro.id} className="surface-paper flex gap-4 rounded-xl p-4">
                  <div className="h-24 w-16 shrink-0 overflow-hidden rounded-md bg-muted">
                    <CapaLivro livro={livro} pequena />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold">{livro.titulo}</p>
                    <p className="truncate text-sm text-muted-foreground">{livro.autor}</p>
                    <div className="mt-1 flex flex-wrap items-center gap-1.5">
                      <Badge variant="secondary" className="font-mono">
                        {livro.codigo}
                      </Badge>
                      <Badge variant="outline">
                        {livro.disponiveis}/{livro.quantidade} disponíveis
                      </Badge>
                    </div>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" variant="secondary" onClick={() => setEtiqueta(livro)}>
                        <Tag className="mr-1.5 size-3.5" /> Etiqueta
                      </Button>
                      <Button size="sm" variant="secondary" onClick={() => setEditando(livro)}>
                        <Pencil className="mr-1.5 size-3.5" /> Editar
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => excluir.mutate(livro.id)}
                        aria-label={`Remover ${livro.titulo}`}
                      >
                        <Trash2 className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                  <div className="hidden w-24 shrink-0 self-center sm:block">
                    <CodigoBarras valor={livro.codigo} altura={30} largura={1} exibirTexto={false} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <Dialog open={confirmar} onOpenChange={setConfirmar}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Dados do livro</DialogTitle>
            <DialogDescription>Digite o título, o ISBN e o autor, e diga quantos exemplares vocês têm.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-4">
            {foto && (
              <img src={foto.dataUrl} alt="Capa" className="h-32 w-24 rounded-md object-cover" />
            )}
            <div className="grid flex-1 gap-3">
              <Campo id="c-titulo" rotulo="Título" valor={form.titulo} onChange={(v) => setForm({ ...form, titulo: v })} />
              <Campo id="c-isbn" rotulo="ISBN" valor={form.isbn} onChange={(v) => setForm({ ...form, isbn: v })} />
              <Campo id="c-autor" rotulo="Autor" valor={form.autor} onChange={(v) => setForm({ ...form, autor: v })} />
            </div>
          </div>
          <Contador
            valor={Number(form.quantidade) || 1}
            onChange={(n) => setForm({ ...form, quantidade: String(n) })}
          />
          <DialogFooter className="gap-2">
            <Button variant="secondary" onClick={() => inputFoto.current?.click()}>
              <Camera className="mr-2 size-4" /> Tirar outra foto
            </Button>
            <Button
              disabled={salvar.isPending || !form.titulo.trim()}
              onClick={() => salvar.mutate()}
            >
              {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
              Confirmar e gerar etiqueta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <EditarLivro livro={editando} onFechar={() => setEditando(null)} />

      <EtiquetaLivro livro={etiqueta} aberto={!!etiqueta} onFechar={() => setEtiqueta(null)} />
    </div>
  );
}

function Campo({
  id,
  rotulo,
  valor,
  onChange,
  tipo = "text",
}: {
  id: string;
  rotulo: string;
  valor: string;
  onChange: (v: string) => void;
  tipo?: string;
}) {
  return (
    <div className="grid gap-1.5">
      <Label htmlFor={id}>{rotulo}</Label>
      <Input id={id} type={tipo} value={valor} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

function Contador({ valor, onChange }: { valor: number; onChange: (n: number) => void }) {
  return (
    <div className="grid gap-1.5">
      <Label>Quantos exemplares?</Label>
      <div className="flex items-center gap-2">
        <Button type="button" size="icon" variant="secondary" aria-label="Menos" onClick={() => onChange(Math.max(1, valor - 1))}>
          <Minus className="size-4" />
        </Button>
        <Input
          type="number"
          min={1}
          className="w-24 text-center text-lg"
          value={valor}
          onChange={(e) => onChange(Math.max(1, Number(e.target.value) || 1))}
        />
        <Button type="button" size="icon" variant="secondary" aria-label="Mais" onClick={() => onChange(valor + 1)}>
          <Plus className="size-4" />
        </Button>
      </div>
    </div>
  );
}

function EditarLivro({ livro, onFechar }: { livro: Livro | null; onFechar: () => void }) {
  const queryClient = useQueryClient();
  const inputFoto = useRef<HTMLInputElement>(null);
  const [qtd, setQtd] = useState(1);
  const [novaFoto, setNovaFoto] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [ultimo, setUltimo] = useState<string | null>(null);
  if (livro && livro.id !== ultimo) {
    setUltimo(livro.id);
    setQtd(livro.quantidade);
    setNovaFoto(null);
  }

  const salvar = useMutation({
    mutationFn: async () => {
      if (!livro) return;
      if (qtd !== livro.quantidade) await atualizarQuantidade(livro, qtd);
      if (novaFoto) await trocarCapa(livro.id, novaFoto.blob);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["livros"] });
      toast.success("Livro atualizado.");
      setUltimo(null);
      onFechar();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={!!livro} onOpenChange={(a) => { if (!a) { setUltimo(null); onFechar(); } }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Editar livro</DialogTitle>
          <DialogDescription>{livro?.titulo}</DialogDescription>
        </DialogHeader>
        <div className="flex items-start gap-4">
          <div className="h-36 w-26 shrink-0 overflow-hidden rounded-md bg-muted" style={{ width: 104 }}>
            {novaFoto ? (
              <img src={novaFoto.dataUrl} alt="Nova capa" className="size-full object-cover" />
            ) : livro ? (
              <CapaLivro livro={livro} pequena />
            ) : null}
          </div>
          <div className="grid gap-4">
            <input
              ref={inputFoto}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (f) setNovaFoto(await prepararFoto(f, 1280));
                e.target.value = "";
              }}
            />
            <Button type="button" variant="secondary" onClick={() => inputFoto.current?.click()}>
              <Camera className="mr-2 size-4" /> Trocar foto
            </Button>
            <Contador valor={qtd} onChange={setQtd} />
            {livro && (
              <p className="text-xs text-muted-foreground">
                {livro.quantidade - livro.disponiveis} emprestado(s) agora.
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button disabled={salvar.isPending} onClick={() => salvar.mutate()}>
            {salvar.isPending && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar alterações
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
