import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { criarAluno, listarAlunos, removerAluno } from "@/lib/biblioteca";

export const Route = createFileRoute("/alunos")({
  head: () => ({
    meta: [
      { title: "Cadastro de Alunos | Biblioteca Escolar" },
      {
        name: "description",
        content:
          "Cadastre e gerencie os alunos da escola que podem pegar livros emprestados na biblioteca.",
      },
      { property: "og:title", content: "Cadastro de Alunos | Biblioteca Escolar" },
      {
        property: "og:description",
        content: "Gerencie os alunos autorizados a pegar livros emprestados.",
      },
    ],
  }),
  component: Alunos,
});

const VAZIO = { nome: "", turma: "", matricula: "" };

function Alunos() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(VAZIO);

  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: listarAlunos });

  const salvar = useMutation({
    mutationFn: () => criarAluno(form),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      setForm(VAZIO);
      toast.success("Aluno cadastrado.");
    },
    onError: (erro: Error) =>
      toast.error(
        erro.message.includes("duplicate") ? "Essa matrícula já existe." : erro.message,
      ),
  });

  const excluir = useMutation({
    mutationFn: removerAluno,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alunos"] });
      toast.success("Aluno removido.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-4xl font-semibold">Alunos</h1>
        <p className="mt-2 text-muted-foreground">
          Quem pode pegar livros emprestados na biblioteca.
        </p>

        <form
          className="surface-paper mt-8 grid gap-4 rounded-xl p-6 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!form.nome.trim() || !form.matricula.trim()) {
              toast.error("Nome e matrícula são obrigatórios.");
              return;
            }
            salvar.mutate();
          }}
        >
          <div className="grid gap-1.5">
            <Label htmlFor="nome">Nome</Label>
            <Input
              id="nome"
              value={form.nome}
              onChange={(e) => setForm({ ...form, nome: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="turma">Turma</Label>
            <Input
              id="turma"
              value={form.turma}
              onChange={(e) => setForm({ ...form, turma: e.target.value })}
            />
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="matricula">Matrícula</Label>
            <Input
              id="matricula"
              value={form.matricula}
              onChange={(e) => setForm({ ...form, matricula: e.target.value })}
            />
          </div>
          <div className="sm:col-span-3">
            <Button type="submit" disabled={salvar.isPending}>
              <Plus className="mr-2 size-4" /> Cadastrar aluno
            </Button>
          </div>
        </form>

        <ul className="mt-8 grid gap-3">
          {alunos.length === 0 ? (
            <p className="text-muted-foreground">Nenhum aluno cadastrado ainda.</p>
          ) : (
            alunos.map((aluno) => (
              <li
                key={aluno.id}
                className="surface-paper flex items-center gap-3 rounded-xl px-4 py-3"
              >
                <span className="grid size-9 place-items-center rounded-full bg-secondary">
                  <UserRound className="size-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{aluno.nome}</p>
                  <p className="text-sm text-muted-foreground">
                    {aluno.turma || "Sem turma"} · matrícula {aluno.matricula}
                  </p>
                </div>
                <Badge variant="secondary" className="hidden sm:inline-flex">
                  {aluno.matricula}
                </Badge>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => excluir.mutate(aluno.id)}
                  aria-label={`Remover ${aluno.nome}`}
                >
                  <Trash2 className="size-4" />
                </Button>
              </li>
            ))
          )}
        </ul>
      </main>
    </div>
  );
}
