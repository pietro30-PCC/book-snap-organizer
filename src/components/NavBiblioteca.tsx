import { Link, useRouterState } from "@tanstack/react-router";
import { BookOpen, LayoutDashboard, Library, Users } from "lucide-react";
import { cn } from "@/lib/utils";

const itens = [
  { to: "/", rotulo: "Catálogo", icone: Library },
  { to: "/admin", rotulo: "Painel", icone: LayoutDashboard },
  { to: "/alunos", rotulo: "Alunos", icone: Users },
  { to: "/emprestimos", rotulo: "Empréstimos", icone: BookOpen },
] as const;

export function NavBiblioteca() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-3">
        <Link to="/" className="mr-auto flex items-center gap-2">
          <span className="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
            <Library className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold">Biblioteca Escolar</span>
        </Link>
        {itens.map((item) => {
          const ativo = caminho === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                ativo
                  ? "bg-secondary text-secondary-foreground"
                  : "text-muted-foreground hover:bg-secondary/60 hover:text-foreground",
              )}
            >
              <item.icone className="size-4" />
              {item.rotulo}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
