import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useCallback, useState } from "react";
import { BookOpen, ScanLine, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { ScannerCodigo } from "@/components/ScannerCodigo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  buscarLivroPorCodigo,
  devolverLivro,
  emprestarLivro,
  listarAlunos,
  listarEmprestimos,
  type Livro,
} from "@/lib/biblioteca";

export const Route = createFileRoute("/emprestimos")({
  head: () => ({
    meta: [
      { title: "Empréstimos | Biblioteca Escolar" },
      {
        name: "description",
        content:
          "Escaneie o código de barras do livro para registrar empréstimos e devoluções e acompanhe todo o histórico da biblioteca.",
      },
      { property: "og:title", content: "Empréstimos | Biblioteca Escolar" },
      {
        property: "og:description",
        content: "Registre empréstimos e devoluções escaneando o código de barras do livro.",
      },
    ],
  }),
  component: Emprestimos,
});

function Emprestimos() {
  const queryClient = useQueryClient();
  const [scannerAberto, setScannerAberto] = useState(false);
  const [livro, setLivro] = useState<Livro | null>(null);
  const [alunoId, setAlunoId] = useState("");

  const { data: alunos = [] } = useQuery({ queryKey: ["alunos"], queryFn: listarAlunos });
  const { data: emprestimos = [] } = useQuery({
    queryKey: ["emprestimos"],
    queryFn: listarEmprestimos,
  });

  const aoLerCodigo = useCallback(async (codigo: string) => {
    try {
      const encontrado = await buscarLivroPorCodigo(codigo);
      if (!encontrado) {
        toast.error(`Nenhum livro com o código ${codigo}.`);
        return;
      }
      setLivro(encontrado);
      setScannerAberto(false);
      toast.success(`Livro encontrado: ${encontrado.titulo}`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Erro ao buscar o livro.");
    }
  }, []);

  const emprestar = useMutation({
    mutationFn: () => emprestarLivro(livro!.id, alunoId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emprestimos"] });
      queryClient.invalidateQueries({ queryKey: ["livros"] });
      toast.success("Empréstimo registrado.");
      setLivro(null);
      setAlunoId("");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  const devolver = useMutation({
    mutationFn: ({ id, livroId }: { id: string; livroId: string }) => devolverLivro(id, livroId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["emprestimos"] });
      queryClient.invalidateQueries({ queryKey: ["livros"] });
      toast.success("Devolução registrada.");
    },
    onError: (erro: Error) => toast.error(erro.message),
  });

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <main className="mx-auto max-w-4xl px-4 py-10">
        <h1 className="text-4xl font-semibold">Empréstimos</h1>
        <p className="mt-2 text-muted-foreground">
          Escaneie a etiqueta do livro, escolha o aluno e pronto.
        </p>

        <section className="surface-paper mt-8 rounded-xl p-6">
          <Button onClick={() => setScannerAberto(true)} className="w-full sm:w-auto">
            <ScanLine className="mr-2 size-4" /> Escanear livro
          </Button>

          {livro ? (
            <div className="mt-5 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
              <div>
                <p className="font-semibold">{livro.titulo}</p>
                <p className="text-sm text-muted-foreground">{livro.autor}</p>
                <div className="mt-2 flex gap-1.5">
                  <Badge variant="secondary" className="font-mono">
                    {livro.codigo}
                  </Badge>
                  <Badge variant="outline">{livro.disponiveis} disponíveis</Badge>
                </div>

                <div className="mt-4 grid gap-1.5">
                  <Label>Aluno</Label>
                  <Select value={alunoId} onValueChange={setAlunoId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Selecione o aluno" />
                    </SelectTrigger>
                    <SelectContent>
                      {alunos.map((aluno) => (
                        <SelectItem key={aluno.id} value={aluno.id}>
                          {aluno.nome} — {aluno.turma || "sem turma"}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <Button
                onClick={() => {
                  if (!alunoId) {
                    toast.error("Escolha o aluno.");
                    return;
                  }
                  emprestar.mutate();
                }}
                disabled={emprestar.isPending || livro.disponiveis < 1}
              >
                <BookOpen className="mr-2 size-4" /> Registrar empréstimo
              </Button>
            </div>
          ) : null}
        </section>

        <section className="mt-10">
          <h2 className="text-2xl font-semibold">Histórico</h2>
          {emprestimos.length === 0 ? (
            <p className="mt-3 text-muted-foreground">Nenhum empréstimo registrado ainda.</p>
          ) : (
            <ul className="mt-4 grid gap-3">
              {emprestimos.map((emp) => (
                <li
                  key={emp.id}
                  className="surface-paper flex flex-wrap items-center gap-3 rounded-xl px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{emp.livros?.titulo ?? "Livro removido"}</p>
                    <p className="text-sm text-muted-foreground">
                      {emp.alunos?.nome ?? "Aluno removido"} ·{" "}
                      {new Date(emp.data_emprestimo).toLocaleDateString("pt-BR")}
                    </p>
                  </div>
                  {emp.data_devolucao ? (
                    <Badge variant="secondary">
                      Devolvido em {new Date(emp.data_devolucao).toLocaleDateString("pt-BR")}
                    </Badge>
                  ) : (
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        emp.livros &&
                        devolver.mutate({ id: emp.id, livroId: emp.livros.id })
                      }
                    >
                      <Undo2 className="mr-1.5 size-3.5" /> Devolver
                    </Button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      <ScannerCodigo
        aberto={scannerAberto}
        onFechar={() => setScannerAberto(false)}
        onLido={(codigo) => void aoLerCodigo(codigo)}
      />
    </div>
  );
}
