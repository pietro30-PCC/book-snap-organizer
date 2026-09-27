import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { Camera, Loader2, Plus, Sparkles, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { EtiquetaLivro } from "@/components/EtiquetaLivro";
import { CodigoBarras } from "@/components/CodigoBarras";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { criarLivro, enviarCapa, listarLivros, removerLivro, type Livro } from "@/lib/biblioteca";
import { prepararFoto } from "@/lib/imagem";
import { lerCapaLivro } from "@/lib/ocr.functions";

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
    ],
  }),
  component: Admin,
});

const VAZIO = { titulo: "", autor: "", categoria: "", isbn: "", quantidade: "1" };

function Admin() {
  const queryClient = useQueryClient();
  const inputFoto = useRef<HTMLInputElement>(null);
  const lerCapa = useServerFn(lerCapaLivro);

  const [form, setForm] = useState(VAZIO);
  const [foto, setFoto] = useState<{ dataUrl: string; blob: Blob } | null>(null);
  const [lendo, setLendo] = useState(false);
  const [etiqueta, setEtiqueta] = useState<Livro | null>(null);

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
        capa_url: capa,
      });
    },
    onSuccess: (livro) => {
      queryClient.invalidateQueries({ queryKey: ["livros"] });
      setForm(VAZIO);
      setFoto(null);
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
      const { lerLivroGratis } = await import("@/lib/leituraGratis");
      const gratis = await lerLivroGratis(preparada.blob);
      const dados =
        gratis?.dados.titulo
          ? gratis.dados
          : await lerCapa({ data: { imagemDataUrl: preparada.dataUrl } });
      setForm((atual) => ({
        titulo: dados.titulo || atual.titulo,
        autor: dados.autor || atual.autor,
        categoria: dados.categoria || atual.categoria,
        isbn: dados.isbn || atual.isbn,
        quantidade: atual.quantidade,
      }));
      toast.success("Dados lidos da capa. Confira antes de salvar.");
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não consegui ler a foto.");
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
          Comece do zero: fotografe a capa, a IA preenche os dados e o sistema gera um código de
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
                onChange={(e) => void aoEscolherFoto(e.target.files?.[0])}
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
                    <Camera className="mr-2 size-4" /> Tirar / escolher foto
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
                    {livro.capa_url ? (
                      <img
                        src={livro.capa_url}
                        alt={`Capa de ${livro.titulo}`}
                        loading="lazy"
                        className="size-full object-cover"
                      />
                    ) : null}
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
