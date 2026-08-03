import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { BookMarked, Search } from "lucide-react";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { listarLivros } from "@/lib/biblioteca";

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
  const { data: livros = [], isLoading } = useQuery({
    queryKey: ["livros"],
    queryFn: listarLivros,
  });

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return livros;
    return livros.filter((l) =>
      [l.titulo, l.autor, l.categoria, l.codigo].join(" ").toLowerCase().includes(termo),
    );
  }, [livros, busca]);

  const disponiveis = livros.reduce((soma, l) => soma + l.disponiveis, 0);
  const exemplares = livros.reduce((soma, l) => soma + l.quantidade, 0);

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <main className="mx-auto max-w-6xl px-4 py-10">
        <h1 className="text-4xl font-semibold">Catálogo de livros</h1>
        <p className="mt-2 text-muted-foreground">
          Tudo que a biblioteca tem hoje, em tempo real.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          <Estatistica valor={livros.length} rotulo="Títulos" />
          <Estatistica valor={exemplares} rotulo="Exemplares" />
          <Estatistica valor={disponiveis} rotulo="Disponíveis" destaque />
        </div>

        <div className="relative mt-8">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Pesquisar por título, autor, categoria ou código..."
            className="h-12 pl-10"
          />
        </div>

        {isLoading ? (
          <p className="mt-10 text-muted-foreground">Carregando acervo...</p>
        ) : filtrados.length === 0 ? (
          <div className="mt-10 surface-paper rounded-xl p-10 text-center">
            <BookMarked className="mx-auto size-8 text-muted-foreground" />
            <p className="mt-3 font-medium">Nenhum livro encontrado</p>
            <p className="text-sm text-muted-foreground">
              Cadastre livros pelo painel administrativo tirando uma foto da capa.
            </p>
          </div>
        ) : (
          <ul className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filtrados.map((livro) => (
              <li
                key={livro.id}
                className="surface-paper flex gap-4 overflow-hidden rounded-xl p-4 transition-shadow hover:shadow-[var(--shadow-lift)]"
              >
                <div className="h-28 w-20 shrink-0 overflow-hidden rounded-md bg-muted">
                  {livro.capa_url ? (
                    <img
                      src={livro.capa_url}
                      alt={`Capa de ${livro.titulo}`}
                      loading="lazy"
                      className="size-full object-cover"
                    />
                  ) : (
                    <div className="grid size-full place-items-center text-muted-foreground">
                      <BookMarked className="size-6" />
                    </div>
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{livro.titulo}</p>
                  <p className="truncate text-sm text-muted-foreground">
                    {livro.autor || "Autor não informado"}
                  </p>
                  <p className="mt-1 font-mono text-xs text-muted-foreground">{livro.codigo}</p>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {livro.categoria ? <Badge variant="secondary">{livro.categoria}</Badge> : null}
                    <Badge variant={livro.disponiveis > 0 ? "default" : "outline"}>
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
    <div className="surface-paper rounded-xl p-5">
      <p
        className={`font-display text-3xl font-semibold ${destaque ? "text-primary" : "text-foreground"}`}
      >
        {valor}
      </p>
      <p className="text-sm text-muted-foreground">{rotulo}</p>
    </div>
  );
}
