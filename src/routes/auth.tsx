import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, Library, Loader2, Mail } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/auth")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "Acesso da bibliotecária | Biblioteca Escolar" },
      {
        name: "description",
        content:
          "Entre com seu e-mail e senha para acessar o painel administrativo da biblioteca escolar.",
      },
      { property: "og:title", content: "Acesso da bibliotecária | Biblioteca Escolar" },
      {
        property: "og:description",
        content: "Área restrita para cadastro de livros, alunos e empréstimos.",
      },
    ],
  }),
  component: Autenticacao,
});

function Autenticacao() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"entrar" | "criar">("entrar");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/admin", replace: true });
    });
  }, [navigate]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "entrar") {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
        toast.success("Bem-vinda de volta!");
        navigate({ to: "/admin", replace: true });
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (data.session) {
          toast.success("Conta criada. Você já está no painel.");
          navigate({ to: "/admin", replace: true });
        } else {
          toast.success("Conta criada! Confirme o e-mail que enviamos para entrar.");
          setModo("entrar");
        }
      }
    } catch (erro) {
      const msg = erro instanceof Error ? erro.message : "Não foi possível continuar.";
      toast.error(
        msg.includes("Invalid login credentials") ? "E-mail ou senha incorretos." : msg,
      );
    } finally {
      setCarregando(false);
    }
  }

  return (
    <div className="aurora relative grid min-h-screen place-items-center px-4 py-12">
      <Link
        to="/"
        className="absolute left-5 top-5 inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-sm text-muted-foreground backdrop-blur transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-4" /> Voltar ao catálogo
      </Link>

      <div className="glass w-full max-w-md rounded-3xl p-8 shadow-[var(--shadow-lift)]">
        <div className="text-center">
          <span className="glow-ring mx-auto grid size-14 place-items-center rounded-2xl bg-linear-to-br from-primary to-accent text-primary-foreground">
            <Library className="size-7" />
          </span>
          <h1 className="mt-4 font-display text-3xl font-semibold">Área da bibliotecária</h1>
          <p className="mt-1.5 text-sm text-muted-foreground">
            {modo === "entrar"
              ? "Entre para gerenciar acervo, alunos e empréstimos."
              : "Crie a conta da biblioteca. A primeira conta vira administradora."}
          </p>
        </div>

        <form onSubmit={enviar} className="mt-7 grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="email">E-mail</Label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="bibliotecaria@escola.com"
                className="h-11 pl-9"
              />
            </div>
          </div>

          <div className="grid gap-1.5">
            <Label htmlFor="senha">Senha</Label>
            <div className="relative">
              <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="senha"
                type="password"
                required
                minLength={6}
                autoComplete={modo === "entrar" ? "current-password" : "new-password"}
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                placeholder="••••••••"
                className="h-11 pl-9"
              />
            </div>
          </div>

          <Button type="submit" className="btn-shine h-11 w-full text-base" disabled={carregando}>
            {carregando ? <Loader2 className="mr-2 size-4 animate-spin" /> : null}
            {modo === "entrar" ? "Entrar no painel" : "Criar conta"}
          </Button>
        </form>

        <button
          type="button"
          onClick={() => setModo(modo === "entrar" ? "criar" : "entrar")}
          className="mt-5 w-full text-center text-sm text-muted-foreground underline-offset-4 transition-colors hover:text-primary hover:underline"
        >
          {modo === "entrar"
            ? "Ainda não tem conta? Criar acesso da biblioteca"
            : "Já tenho conta — quero entrar"}
        </button>
      </div>
    </div>
  );
}
