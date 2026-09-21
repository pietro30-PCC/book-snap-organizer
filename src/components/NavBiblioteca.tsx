import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { BookOpen, Images, LayoutDashboard, Library, LogIn, LogOut, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const itens = [
  { to: "/", rotulo: "Catálogo", icone: Library },
  { to: "/admin", rotulo: "Painel", icone: LayoutDashboard },
  { to: "/lote", rotulo: "Lote", icone: Images },
  { to: "/alunos", rotulo: "Alunos", icone: Users },
  { to: "/emprestimos", rotulo: "Empréstimos", icone: BookOpen },
] as const;

export function NavBiblioteca() {
  const caminho = useRouterState({ select: (s) => s.location.pathname });
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => setEmail(data.session?.user.email ?? null));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) =>
      setEmail(session?.user.email ?? null),
    );
    return () => sub.subscription.unsubscribe();
  }, []);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="no-print sticky top-0 z-40 border-b border-border/70 bg-background/70 backdrop-blur-xl">
      <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-1 px-4 py-3">
        <Link to="/" className="mr-auto flex items-center gap-2.5">
          <span className="glow-ring grid size-10 place-items-center rounded-xl bg-linear-to-br from-primary to-accent text-primary-foreground">
            <Library className="size-5" />
          </span>
          <span className="font-display text-lg font-semibold tracking-tight">
            Biblioteca <span className="text-gradient">Escolar</span>
          </span>
        </Link>

        {itens.map((item) => {
          const ativo = caminho === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "relative flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-medium transition-all",
                ativo
                  ? "bg-linear-to-br from-primary to-primary/85 text-primary-foreground shadow-[var(--shadow-paper)]"
                  : "text-muted-foreground hover:bg-secondary/70 hover:text-foreground",
              )}
            >
              <item.icone className="size-4" />
              {item.rotulo}
            </Link>
          );
        })}

        {email ? (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => void sair()}
            className="ml-1 rounded-full text-muted-foreground hover:text-destructive"
            title={email}
          >
            <LogOut className="mr-1.5 size-4" /> Sair
          </Button>
        ) : (
          <Button asChild size="sm" className="btn-shine ml-1 rounded-full">
            <Link to="/auth">
              <LogIn className="mr-1.5 size-4" /> Entrar
            </Link>
          </Button>
        )}
      </nav>
    </header>
  );
}
