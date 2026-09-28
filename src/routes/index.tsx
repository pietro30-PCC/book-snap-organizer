import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import {
  ArrowDownWideNarrow,
  BookMarked,
  ChevronRight,
  LayoutGrid,
  LibraryBig,
  List,
  Loader2,
  Search,
  Sparkles,
  Tag,
  Wand2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { EtiquetaLivro } from "@/components/EtiquetaLivro";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
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
import { cn } from "@/lib/utils";

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

type Ordem = "titulo" | "autor" | "novos" | "disponiveis";
type Modo = "grade" | "lista";

const CAPAS = ["capa-a", "capa-b", "capa-c", "capa-d", "capa-e"] as const;

function tomDe(codigo: string) {
  let soma = 0;
  for (let i = 0; i < codigo.length; i += 1) soma += codigo.charCodeAt(i);
  return CAPAS[soma % CAPAS.length];
}

function iniciais(titulo: string) {
  const palavras = titulo
    .replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  const sigla = palavras.slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
  return sigla || "?";
}

function Catalogo() {


  const [busca, setBusca] = useState("");
  const [categoria, setCategoria] = useState("Todas");
  const [ordem, setOrdem] = useState<Ordem>("titulo");
  const [modo, setModo] = useState<Modo>("grade");
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
    const contagem = new Map<string, number>();
    for (const l of livros) {
      const chave = l.categoria?.trim() || "Sem categoria";
      contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
    }
    return Array.from(contagem.entries())
      .sort((a, b) => a[0].localeCompare(b[0], "pt-BR"))
      .map(([nome, total]) => ({ nome, total }));
  }, [livros]);

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    const lista = livros.filter((l) => {
      const nome = l.categoria?.trim() || "Sem categoria";
      const casaCategoria = categoria === "Todas" || nome === categoria;
      const casaTermo =
        !termo ||
        [l.titulo, l.autor, l.categoria, l.codigo, l.isbn].join(" ").toLowerCase().includes(termo);
      return casaCategoria && casaTermo;
    });

    const porTitulo = (a: Livro, b: Livro) => a.titulo.localeCompare(b.titulo, "pt-BR");
    return lista.sort((a, b) => {
      if (ordem === "autor") {
        return (a.autor || "zzz").localeCompare(b.autor || "zzz", "pt-BR") || porTitulo(a, b);
      }
      if (ordem === "novos") {
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
      if (ordem === "disponiveis") {
        return b.disponiveis - a.disponiveis || porTitulo(a, b);
      }
      return porTitulo(a, b);
    });
  }, [livros, busca, categoria, ordem]);

  const grupos = useMemo(() => {
    const termo = busca.trim();
    const deveAgrupar = categoria === "Todas" && !termo && !semCategoria;
    if (!deveAgrupar) return null;

    const mapa = new Map<string, Livro[]>();
    for (const livro of filtrados) {
      const chave = livro.categoria?.trim() || "Sem categoria";
      const bucket = mapa.get(chave);
      if (bucket) bucket.push(livro);
      else mapa.set(chave, [livro]);
    }

    return Array.from(mapa.entries()).sort((a, b) => {
      if (a[0] === "Sem categoria") return 1;
      if (b[0] === "Sem categoria") return -1;
      return a[0].localeCompare(b[0], "pt-BR");
    });
  }, [filtrados, busca, categoria]);

  const disponiveis = livros.reduce((soma, l) => soma + l.disponiveis, 0);
  const exemplares = livros.reduce((soma, l) => soma + l.quantidade, 0);
  const emprestados = exemplares - disponiveis;
  const filtrosAtivos = categoria !== "Todas" || busca.trim().length > 0;

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <section className="aurora border-b border-border/60">
        <div className="mx-auto grid max-w-6xl gap-8 px-4 py-12 sm:py-16 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
          <div className="entra">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border/70 bg-card/70 px-3 py-1 text-[11px] font-semibold tracking-wider text-muted-foreground uppercase backdrop-blur">
              <Sparkles className="size-3 text-accent" /> Acervo da escola
            </span>
            <h1 className="mt-4 font-display text-4xl leading-[1.08] font-semibold sm:text-5xl">
              Catálogo <span className="text-gradient">organizado</span> da biblioteca
            </h1>
            <p className="mt-3 max-w-lg text-sm text-muted-foreground sm:text-base">
              Encontre por título, autor, categoria ou código. Toque em um livro para ver a ficha
              completa e a disponibilidade dos exemplares.
            </p>
          </div>

          <div className="entra grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-2 xl:grid-cols-4">
            <Estatistica valor={livros.length} rotulo="Títulos" />
            <Estatistica valor={exemplares} rotulo="Exemplares" />
            <Estatistica valor={disponiveis} rotulo="Disponíveis" destaque />
            <Estatistica valor={emprestados} rotulo="Emprestados" />
          </div>
        </div>
      </section>

      <main className="mx-auto max-w-6xl px-4 pt-6 pb-16">
        <div className="glass z-20 rounded-2xl p-3 md:sticky md:top-[4.75rem]">
          <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={busca}
                onChange={(e) => setBusca(e.target.value)}
                placeholder="Buscar título, autor, código ou ISBN..."
                className="h-11 rounded-xl border-transparent bg-background/80 pr-9 pl-10 text-sm"
              />
              {busca ? (
                <button
                  type="button"
                  onClick={() => setBusca("")}
                  aria-label="Limpar busca"
                  className="absolute right-2.5 top-1/2 grid size-6 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2">
              <Select value={ordem} onValueChange={(v) => setOrdem(v as Ordem)}>
                <SelectTrigger
                  className="h-11 w-full rounded-xl bg-background/80 text-sm sm:w-[13.5rem]"
                  aria-label="Ordenar por"
                >
                  <ArrowDownWideNarrow className="size-4 text-muted-foreground" />
                  <SelectValue placeholder="Ordenar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="titulo">Título (A-Z)</SelectItem>
                  <SelectItem value="autor">Autor (A-Z)</SelectItem>
                  <SelectItem value="disponiveis">Mais disponíveis</SelectItem>
                  <SelectItem value="novos">Adicionados recentemente</SelectItem>
                </SelectContent>
              </Select>

              <ToggleGroup
                type="single"
                value={modo}
                onValueChange={(v) => v && setModo(v as Modo)}
                className="rounded-xl border border-border/70 bg-background/80 p-1"
              >
                <ToggleGroupItem
                  value="grade"
                  aria-label="Ver em grade"
                  className="h-9 size-9 rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <LayoutGrid className="size-4" />
                </ToggleGroupItem>
                <ToggleGroupItem
                  value="lista"
                  aria-label="Ver em lista"
                  className="h-9 size-9 rounded-lg data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                >
                  <List className="size-4" />
                </ToggleGroupItem>
              </ToggleGroup>
            </div>
          </div>

          {categorias.length > 0 ? (
            <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-3">
              <Chip
                ativo={categoria === "Todas"}
                onClick={() => setCategoria("Todas")}
                rotulo="Todas"
                total={livros.length}
              />
              {categorias.map((c) => (
                <Chip
                  key={c.nome}
                  ativo={categoria === c.nome}
                  onClick={() => setCategoria(c.nome)}
                  rotulo={c.nome}
                  total={c.total}
                />
              ))}
              {filtrosAtivos ? (
                <button
                  type="button"
                  onClick={() => {
                    setCategoria("Todas");
                    setBusca("");
                  }}
                  className="ml-auto inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                >
                  <X className="size-3" /> Limpar filtros
                </button>
              ) : null}
            </div>
          ) : null}
        </div>

        <p className="mt-4 text-xs font-medium tracking-wide text-muted-foreground uppercase">
          {isLoading
            ? "Carregando acervo..."
            : `${filtrados.length} ${filtrados.length === 1 ? "livro" : "livros"} encontrados`}
        </p>

        {isLoading ? (
          <ul className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <li key={i} className="surface-paper animate-pulse overflow-hidden rounded-2xl">
                <div className="aspect-[2/3] w-full bg-muted" />
                <div className="space-y-2 p-3">
                  <div className="h-3 w-4/5 rounded bg-muted" />
                  <div className="h-2.5 w-2/3 rounded bg-muted" />
                </div>
              </li>
            ))}
          </ul>
        ) : filtrados.length === 0 ? (
          <Vazio busca={busca} filtrosAtivos={filtrosAtivos} />
        ) : grupos ? (
          <div className="mt-2">
            {grupos.map(([nome, itens]) => (
              <Secao
                key={nome}
                titulo={nome}
                livros={itens}
                modo={modo}
                onAbrir={setSelecionado}
              />
            ))}
          </div>
        ) : (
          <div className="mt-4">
            {modo === "grade" ? (
              <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
                {filtrados.map((livro) => (
                  <li key={livro.id}>
                    <CardGrade livro={livro} onAbrir={setSelecionado} />
                  </li>
                ))}
              </ul>
            ) : (
              <ul className="space-y-2">
                {filtrados.map((livro) => (
                  <li key={livro.id}>
                    <CardLista livro={livro} onAbrir={setSelecionado} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </main>

      <FichaLivro
        livro={selecionado}
        logado={logado}
        onFechar={() => setSelecionado(null)}
        onEtiqueta={(l) => {
          setSelecionado(null);
          setEtiqueta(l);
        }}
      />
      <EtiquetaLivro livro={etiqueta} aberto={!!etiqueta} onFechar={() => setEtiqueta(null)} />
    </div>
  );
}

function Chip({
  ativo,
  onClick,
  rotulo,
  total,
}: {
  ativo: boolean;
  onClick: () => void;
  rotulo: string;
  total: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium transition-all",
        ativo
          ? "bg-primary text-primary-foreground shadow-[var(--shadow-paper)]"
          : "border border-border/70 text-muted-foreground hover:border-primary/40 hover:bg-secondary/60 hover:text-foreground",
      )}
    >
      {rotulo}
      <span
        className={cn(
          "rounded-full px-1.5 text-[10px] tabular-nums",
          ativo ? "bg-primary-foreground/20" : "bg-secondary text-secondary-foreground",
        )}
      >
        {total}
      </span>
    </button>
  );
}

function SeloDisponibilidade({ livro }: { livro: Livro }) {
  const tem = livro.disponiveis > 0;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold",
        tem ? "bg-primary/12 text-primary" : "bg-muted text-muted-foreground",
      )}
    >
      <span
        className={cn("size-1.5 rounded-full", tem ? "bg-primary" : "bg-muted-foreground/60")}
      />
      {tem ? `Disponível (${livro.disponiveis})` : "Emprestado"}
    </span>
  );
}

function Capa({
  livro,
  className,
  sigla = false,
}: {
  livro: Livro;
  className?: string;
  sigla?: boolean;
}) {
  if (livro.capa_url) {
    return (
      <img
        src={livro.capa_url}
        alt={`Capa de ${livro.titulo}`}
        loading="lazy"
        className={cn("size-full object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn("capa-falsa size-full", tomDe(livro.codigo), sigla ? "text-sm" : "text-3xl", className)}
    >
      {iniciais(livro.titulo)}
    </span>
  );
}

function CardGrade({ livro, onAbrir }: { livro: Livro; onAbrir: (l: Livro) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(livro)}
      aria-label={`Ver detalhes de ${livro.titulo}`}
      className="surface-paper card-lift group flex h-full w-full flex-col overflow-hidden rounded-2xl text-left"
    >
      <div className="relative aspect-[2/3] w-full overflow-hidden bg-muted">
        <span className="block size-full transition-transform duration-500 group-hover:scale-[1.05]">
          <Capa livro={livro} />
        </span>
        <span className="pointer-events-none absolute inset-0 bg-linear-to-t from-black/25 via-transparent to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      </div>

      <div className="flex flex-1 flex-col gap-1 p-3">
        <p className="line-clamp-2 font-display text-[15px] leading-tight font-semibold">
          {livro.titulo}
        </p>
        <p className="line-clamp-1 text-xs text-muted-foreground">
          {livro.autor || "Autor não informado"}
        </p>
        <div className="mt-auto flex items-end justify-between gap-2 pt-2">
          <span className="truncate font-mono text-[10px] tracking-wide text-muted-foreground">
            {livro.codigo}
          </span>
          <SeloDisponibilidade livro={livro} />
        </div>
      </div>
    </button>
  );
}

function CardLista({ livro, onAbrir }: { livro: Livro; onAbrir: (l: Livro) => void }) {
  return (
    <button
      type="button"
      onClick={() => onAbrir(livro)}
      aria-label={`Ver detalhes de ${livro.titulo}`}
      className="surface-paper card-lift group flex w-full items-center gap-3 rounded-xl p-2.5 text-left"
    >
      <div className="h-16 w-11 shrink-0 overflow-hidden rounded-lg bg-muted">
        <Capa livro={livro} sigla />
      </div>

      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-[15px] font-semibold">{livro.titulo}</p>
        <p className="truncate text-xs text-muted-foreground">
          {livro.autor || "Autor não informado"}
        </p>
      </div>

      {livro.categoria ? (
        <Badge variant="secondary" className="hidden rounded-full lg:inline-flex">
          {livro.categoria}
        </Badge>
      ) : null}
      <span className="hidden font-mono text-[11px] text-muted-foreground md:inline">
        {livro.codigo}
      </span>
      <SeloDisponibilidade livro={livro} />
      <ChevronRight className="size-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </button>
  );
}

function Secao({
  titulo,
  livros,
  modo,
  onAbrir,
}: {
  titulo: string;
  livros: Livro[];
  modo: Modo;
  onAbrir: (l: Livro) => void;
}) {
  const livres = livros.filter((l) => l.disponiveis > 0).length;

  return (
    <section className="mt-9 first:mt-4">
      <header className="mb-3 flex items-center gap-3">
        <h2 className="font-display text-lg font-semibold sm:text-xl">{titulo}</h2>
        <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-semibold text-secondary-foreground tabular-nums">
          {livros.length}
        </span>
        <span className="hidden text-xs text-muted-foreground sm:inline">
          {livres} disponíveis
        </span>
        <span className="h-px flex-1 bg-border" />
      </header>

      {modo === "grade" ? (
        <ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
          {livros.map((livro) => (
            <li key={livro.id}>
              <CardGrade livro={livro} onAbrir={onAbrir} />
            </li>
          ))}
        </ul>
      ) : (
        <ul className="space-y-2">
          {livros.map((livro) => (
            <li key={livro.id}>
              <CardLista livro={livro} onAbrir={onAbrir} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Vazio({ busca, filtrosAtivos }: { busca: string; filtrosAtivos: boolean }) {
  return (
    <div className="surface-paper mt-6 rounded-3xl p-10 text-center sm:p-12">
      <span className="glow-ring mx-auto grid size-16 place-items-center rounded-2xl bg-linear-to-br from-primary to-accent text-primary-foreground">
        <LibraryBig className="size-8" />
      </span>
      <p className="mt-5 font-display text-2xl font-semibold">
        {filtrosAtivos ? "Nenhum livro com esses filtros" : "Nenhum livro por aqui ainda"}
      </p>
      <p className="mx-auto mt-2 max-w-sm text-sm text-muted-foreground">
        {filtrosAtivos
          ? `Tente outra palavra${busca ? ` ou remova "${busca}"` : ""}. A busca também encontra o código do livro.`
          : "A bibliotecária pode cadastrar livros tirando uma foto da capa — a leitura automática preenche o resto."}
      </p>
      {filtrosAtivos ? (
        <Button
          variant="secondary"
          className="mt-6 rounded-full"
          onClick={() => window.location.reload()}
        >
          Recomeçar a busca
        </Button>
      ) : (
        <Button asChild className="btn-shine mt-6 rounded-full">
          <Link to="/admin">Abrir o painel</Link>
        </Button>
      )}
    </div>
  );
}

function FichaLivro({
  livro,
  logado,
  onFechar,
  onEtiqueta,
}: {
  livro: Livro | null;
  logado: boolean;
  onFechar: () => void;
  onEtiqueta: (livro: Livro) => void;
}) {
  const queryClient = useQueryClient();
  const gerar = useServerFn(gerarDescricaoLivro);
  const [gerando, setGerando] = useState(false);

  if (!livro) return null;

  const proporcao = livro.quantidade
    ? Math.round((livro.disponiveis / livro.quantidade) * 100)
    : 0;

  async function gerarDescricao() {
    if (!livro) return;
    setGerando(true);
    try {
      const { descricao } = await gerar({
        data: { titulo: livro.titulo, autor: livro.autor, categoria: livro.categoria },
      });
      await atualizarLivro(livro.id, { descricao });
      await queryClient.invalidateQueries({ queryKey: ["livros"] });
      toast.success("Descrição criada.");
      onFechar();
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Não consegui criar a descrição.");
    } finally {
      setGerando(false);
    }
  }

  return (
    <Dialog open onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="font-display text-2xl leading-tight">{livro.titulo}</DialogTitle>
          <DialogDescription>{livro.autor || "Autor não informado"}</DialogDescription>
        </DialogHeader>

        <div className="flex gap-4">
          <div className="h-44 w-30 shrink-0 overflow-hidden rounded-xl bg-muted shadow-[var(--shadow-paper)]">
            <Capa livro={livro} sigla />
          </div>

          <dl className="min-w-0 flex-1 space-y-1.5 text-sm">
            <Info rotulo="Código" valor={livro.codigo} />
            <Info rotulo="Categoria" valor={livro.categoria || "—"} />
            <Info rotulo="ISBN" valor={livro.isbn || "—"} />
            <Info
              rotulo="Exemplares"
              valor={`${livro.disponiveis} disponíveis de ${livro.quantidade}`}
            />
            <Info
              rotulo="Cadastrado em"
              valor={new Date(livro.created_at).toLocaleDateString("pt-BR")}
            />
          </dl>
        </div>

        <div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                proporcao > 0 ? "bg-primary" : "bg-muted-foreground/40",
              )}
              style={{ width: `${Math.max(proporcao, 4)}%` }}
            />
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {proporcao}% dos exemplares desta obra estão na estante
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Sobre o livro
          </p>
          <p className="mt-1.5 text-sm leading-relaxed">
            {livro.descricao || "Ainda não há uma descrição para este livro."}
          </p>
        </div>

        {logado ? (
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => onEtiqueta(livro)}>
              <Tag className="mr-2 size-4" /> Imprimir etiqueta
            </Button>
            <Button asChild variant="secondary">
              <Link to="/emprestimos">Emprestar este livro</Link>
            </Button>
            {!livro.descricao ? (
              <Button onClick={() => void gerarDescricao()} disabled={gerando}>
                {gerando ? (
                  <Loader2 className="mr-2 size-4 animate-spin" />
                ) : (
                  <Wand2 className="mr-2 size-4" />
                )}
                Gerar descrição
              </Button>
            ) : null}
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

function Info({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex gap-2">
      <dt className="w-28 shrink-0 text-muted-foreground">{rotulo}</dt>
      <dd className="min-w-0 flex-1 truncate font-medium">{valor}</dd>
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
    <div className="glass card-lift rounded-xl px-4 py-3">
      <p
        className={cn(
          "font-display text-2xl leading-none font-semibold tabular-nums",
          destaque ? "text-gradient" : "text-foreground",
        )}
      >
        {valor}
      </p>
      <p className="mt-1 text-xs text-muted-foreground">{rotulo}</p>
    </div>
  );
}
