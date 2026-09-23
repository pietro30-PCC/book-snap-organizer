import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { BookMarked, LibraryBig, Loader2, Search, Sparkles, Tag, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { EtiquetaLivro } from "@/components/EtiquetaLivro";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { atualizarLivro, listarLivros, type Livro } from "@/lib/biblioteca";
import { gerarDescricaoLivro } from "@/lib/descricao.functions";


export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Catálogo da Biblioteca Escolar" },
      {
        name: "description",
        content:
          "Pesquise os livros da biblioteca da escola, veja quantos exemplares existem e quais estão disponíveis para empréstimo.",
      },
      { property: "og:title", content: "Catálogo da Biblioteca Escolar" },
      {
        property: "og:description",
        content: "Pesquise livros e veja a disponibilidade de exemplares da biblioteca da escola.",
      },
    ],
  }),
  component: Catalogo,
});

function Catalogo() {
  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [selecionado, setSelecionado] = useState<Livro | null>(null);
  const [etiqueta, setEtiqueta] = useState<Livro | null>(null);
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setLogado(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setLogado(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  const { data: livros = [], isLoading } = useQuery({
    queryKey: ["livros"],
    queryFn: listarLivros,
  });

  const categorias = useMemo(() => {
    const set = new Set(livros.map((l) => l.categoria).filter(Boolean));
    return ["Todas", ...Array.from(set).sort()];
  }, [livros]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    return livros.filter((l) => {
      const casaCategoria = categoria === "Todas" || l.categoria === categoria;
      const casaTermo =
        !termo ||
        [l.titulo, l.autor, l.categoria, l.codigo].join(" ").toLowerCase().includes(termo);
      return casaCategoria && casaTermo;
    });
  }, [livros, busca, categoria]);

  const disponiveis = livros.reduce((soma, l) => soma + l.disponiveis, 0);
  const exemplares = livros.reduce((soma, l) => soma + l.quantidade, 0);

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <section className="aurora border-b border-border/60">
        <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:py-24">
          <span className="entra inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3.5 py-1.5 text-xs font-medium tracking-wide text-muted-foreground uppercase backdrop-blur">
            <Sparkles className="size-3.5 text-accent" /> Acervo vivo da escola
          </span>

          <h1 className="entra mt-6 font-display text-5xl leading-[1.05] font-semibold sm:text-7xl">
            Um catálogo que <span className="text-gradient">convida a ler</span>
          </h1>

          <p className="entra mx-auto mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
            Pesquise títulos, veja a disponibilidade em tempo real e descubra o próximo livro da
            estante.
          </p>

          <div className="entra mx-auto mt-10 grid max-w-3xl gap-4 sm:grid-cols-3">
            <Estatistica valor={livros.length} rotulo="Títulos" />
            <Estatistica valor={exemplares} rotulo="Exemplares" />
            <Estatistica valor={disponiveis} rotulo="Disponíveis" destaque />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 py-12">
        <div className="glass sticky top-[4.5rem] z-30 rounded-2xl p-3">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Pesquisar por título, autor, categoria ou código..."
              className="h-12 rounded-xl border-transparent bg-background/70 pl-11 text-base"
            />
          </div>

          {categorias.length > 1 ? (
            <div className="mt-3 flex flex-wrap gap-1.5">
              {categorias.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setCategoria(c)}
                  className={
                    c === categoria
                      ? "rounded-full bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                      : "rounded-full border border-border/70 px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                  }
                >
                  {c}
                </button>
              ))}
            </div>
          ) : null}
        </div>

        {isLoading ? (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <li key={i} className="surface-paper h-40 animate-pulse rounded-2xl opacity-60" />
            ))}
          </ul>
        ) : filtrados.length === 0 ? (
          <div className="surface-paper mt-10 rounded-3xl p-12 text-center">
            <span className="glow-ring mx-auto grid size-16 place-items-center rounded-2xl bg-linear-to-br from-primary to-accent text-primary-foreground">
              <LibraryBig className="size-8" />
            </span>
            <p className="mt-5 font-display text-2xl font-semibold">Nenhum livro por aqui ainda</p>
            <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
              A bibliotecária pode cadastrar livros tirando uma foto da capa — a leitura automática
              preenche o resto.
            </p>
            <Button asChild className="btn-shine mt-6 rounded-full">
              <Link to="/admin">Abrir o painel</Link>
            </Button>
          </div>
        ) : (
          <ul className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((livro) => (
              <li key={livro.id}>
                <button
                  type="button"
                  onClick={() => setSelecionado(livro)}
                  aria-label={`Ver detalhes de ${livro.titulo}`}
                  className="surface-paper card-lift group flex w-full gap-4 overflow-hidden rounded-2xl p-4 text-left"
                >
                <div className="relative h-32 w-22 shrink-0 overflow-hidden rounded-xl bg-muted shadow-[var(--shadow-paper)]">

                  {livro.capa_url ? (
                    <img
                      src={livro.capa_url}
                      alt={`Capa de ${livro.titulo}`}
                      loading="lazy"
                      className="size-full object-cover transition-transform duration-500 group-hover:scale-110"
                    />
                  ) : (
                    <div className="grid size-full place-items-center bg-linear-to-br from-secondary to-muted text-muted-foreground">
                      <BookMarked className="size-6" />
                    </div>
                  )}
                  <span className="absolute inset-y-0 left-0 w-1.5 bg-linear-to-b from-primary/70 to-accent/70" />
                </div>

                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-lg font-semibold">{livro.titulo}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {livro.autor || "Autor não informado"}
                  </p>
                  <p className="mt-1 font-mono text-[11px] tracking-wide text-muted-foreground">
                    {livro.codigo}
                  </p>
                  <div className="mt-2.5 flex flex-wrap gap-1.5">
                    {livro.categoria ? (
                      <Badge variant="secondary" className="rounded-full">
                        {livro.categoria}
                      </Badge>
                    ) : null}
                    <Badge
                      variant={livro.disponiveis > 0 ? "default" : "outline"}
                      className="rounded-full"
                    >
                      {livro.disponiveis > 0
                        ? `${livro.disponiveis} de ${livro.quantidade} disponíveis`
                        : "Emprestado"}
                    </Badge>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  );
}

function Estatistica({
  valor,
  rotulo,
  destaque,
}: {
  valor: number;
  rotulo: string;
  destaque?: boolean;
}) {
  return (
    <div className="glass card-lift rounded-2xl p-5">
      <p
        className={`font-display text-4xl font-semibold ${destaque ? "text-gradient" : "text-foreground"}`}
      >
        {valor}
      </p>
      <p className="mt-1 text-sm text-muted-foreground">{rotulo}</p>
    </div>
  );
}
