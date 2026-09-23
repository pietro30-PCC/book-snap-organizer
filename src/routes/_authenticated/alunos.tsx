import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { Download, FileSpreadsheet, Plus, Search, Trash2, Upload, UserRound } from "lucide-react";
import { toast } from "sonner";
import { NavBiblioteca } from "@/components/NavBiblioteca";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { criarAluno, criarAlunosEmLote, listarAlunos, removerAluno } from "@/lib/biblioteca";

export const Route = createFileRoute("/_authenticated/alunos")({
  head: () => ({
    meta: [
      { title: "Cadastro de Alunos | Biblioteca Escolar" },
      {
        name: "description",
        content:
          "Cadastre alunos um a um ou importe a lista da escola por planilha do Excel para liberar empréstimos na biblioteca.",
      },
      { property: "og:title", content: "Cadastro de Alunos | Biblioteca Escolar" },
      {
        property: "og:description",
        content: "Importe a lista de alunos por planilha e gerencie quem pode pegar livros.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Alunos,
});

const VAZIO = { nome: "", turma: "", matricula: "" };

type LinhaImportacao = {
  id: string;
  nome: string;
  turma: string;
  matricula: string;
  problema: string;
};

function normalizar(valor: unknown): string {
  return String(valor ?? "").trim();
}

function Alunos() {
  const queryClient = useQueryClient();
  const [form, setForm] = useState(VAZIO);
  const [busca, setBusca] = useState("");
  const [linhas, setLinhas] = useState<LinhaImportacao[]>([]);
  const [importando, setImportando] = useState(false);
  const inputPlanilha = useRef<HTMLInputElement>(null);

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

  const filtrados = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return alunos;
    return alunos.filter((a) =>
      [a.nome, a.turma, a.matricula].join(" ").toLowerCase().includes(termo),
    );
  }, [alunos, busca]);

  /** Marca linhas sem nome/matrícula, repetidas na planilha ou já existentes no sistema. */
  function conferir(lista: LinhaImportacao[]): LinhaImportacao[] {
    const jaExistem = new Set(alunos.map((a) => a.matricula.toLowerCase()));
    const vistas = new Set<string>();
    return lista.map((linha) => {
      const matricula = linha.matricula.trim().toLowerCase();
      let problema = "";
      if (!linha.nome.trim()) problema = "Falta o nome";
      else if (!linha.matricula.trim()) problema = "Falta a matrícula";
      else if (jaExistem.has(matricula)) problema = "Matrícula já cadastrada";
      else if (vistas.has(matricula)) problema = "Matrícula repetida na planilha";
      if (matricula) vistas.add(matricula);
      return { ...linha, problema };
    });
  }

  async function baixarModelo() {
    const XLSX = await import("xlsx");
    const planilha = XLSX.utils.aoa_to_sheet([
      ["nome", "turma", "matricula"],
      ["Maria da Silva", "6º A", "2026001"],
      ["João Pereira", "6º A", "2026002"],
    ]);
    planilha["!cols"] = [{ wch: 30 }, { wch: 12 }, { wch: 14 }];
    const livro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(livro, planilha, "Alunos");
    XLSX.writeFile(livro, "modelo-alunos.xlsx");
  }

  async function lerPlanilha(arquivo: File) {
    try {
      const XLSX = await import("xlsx");
      const buffer = await arquivo.arrayBuffer();
      const livro = XLSX.read(buffer, { type: "array" });
      const primeira = livro.SheetNames[0];
      if (!primeira) throw new Error("A planilha está vazia.");
      const dados = XLSX.utils.sheet_to_json<Record<string, unknown>>(livro.Sheets[primeira]!, {
        defval: "",
      });

      const lidas: LinhaImportacao[] = dados.map((linha) => {
        const chaves = Object.fromEntries(
          Object.entries(linha).map(([k, v]) => [k.trim().toLowerCase(), v]),
        );
        return {
          id: crypto.randomUUID(),
          nome: normalizar(chaves["nome"] ?? chaves["aluno"]),
          turma: normalizar(chaves["turma"] ?? chaves["série"] ?? chaves["serie"]),
          matricula: normalizar(chaves["matricula"] ?? chaves["matrícula"]),
          problema: "",
        };
      });

      if (lidas.length === 0) {
        toast.error("Não encontrei linhas na planilha.");
        return;
      }
      setLinhas(conferir(lidas));
      toast.success(`${lidas.length} linha(s) lida(s). Confira antes de importar.`);
    } catch (erro) {
      toast.error(
        erro instanceof Error ? erro.message : "Não consegui ler esta planilha. Use o modelo.",
      );
    }
  }

  const validas = linhas.filter((l) => !l.problema);

  async function importar() {
    if (validas.length === 0) {
      toast.error("Nenhuma linha está pronta para importar.");
      return;
    }
    setImportando(true);
    try {
      await criarAlunosEmLote(
        validas.map((l) => ({ nome: l.nome, turma: l.turma, matricula: l.matricula })),
      );
      await queryClient.invalidateQueries({ queryKey: ["alunos"] });
      const restantes = linhas.filter((l) => l.problema);
      setLinhas(restantes);
      toast.success(`${validas.length} aluno(s) importado(s).`);
      if (restantes.length > 0)
        toast.info(`${restantes.length} linha(s) continuam aqui para você corrigir.`);
    } catch (erro) {
      toast.error(erro instanceof Error ? erro.message : "Falha ao importar.");
    } finally {
      setImportando(false);
    }
  }

  function editar(id: string, campos: Partial<LinhaImportacao>) {
    setLinhas((atual) =>
      conferir(atual.map((l) => (l.id === id ? { ...l, ...campos } : l))),
    );
  }

  return (
    <div className="min-h-screen">
      <NavBiblioteca />

      <main className="mx-auto max-w-5xl px-4 py-10">
        <h1 className="font-display text-4xl font-semibold">Alunos</h1>
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

        <section className="surface-paper mt-8 rounded-xl p-6">
          <h2 className="flex items-center gap-2 font-display text-2xl font-semibold">
            <FileSpreadsheet className="size-5" /> Importar a lista da escola
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Baixe o modelo, preencha com os alunos (nome, turma, matrícula) e envie de volta. Você
            confere tudo antes de salvar.
          </p>

          <input
            ref={inputPlanilha}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(e) => {
              const arquivo = e.target.files?.[0];
              if (arquivo) void lerPlanilha(arquivo);
              e.target.value = "";
            }}
          />

          <div className="mt-4 flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void baixarModelo()}>
              <Download className="mr-2 size-4" /> Baixar modelo
            </Button>
            <Button onClick={() => inputPlanilha.current?.click()}>
              <Upload className="mr-2 size-4" /> Enviar planilha preenchida
            </Button>
          </div>

          {linhas.length > 0 ? (
            <div className="mt-6">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <Badge variant="secondary">{linhas.length} linhas</Badge>
                <Badge className="bg-emerald-100 text-emerald-800">{validas.length} prontas</Badge>
                {linhas.length - validas.length > 0 ? (
                  <Badge className="bg-amber-100 text-amber-900">
                    {linhas.length - validas.length} para corrigir
                  </Badge>
                ) : null}
                <Button
                  size="sm"
                  variant="ghost"
                  className="ml-auto"
                  onClick={() => setLinhas([])}
                >
                  Descartar
                </Button>
              </div>

              <ul className="mt-4 grid max-h-[28rem] gap-2 overflow-y-auto pr-1">
                {linhas.map((linha) => (
                  <li
                    key={linha.id}
                    className="grid gap-2 rounded-lg border border-border/70 p-3 sm:grid-cols-[1fr_8rem_8rem_auto] sm:items-center"
                  >
                    <Input
                      value={linha.nome}
                      onChange={(e) => editar(linha.id, { nome: e.target.value })}
                      placeholder="Nome"
                      className="h-9"
                    />
                    <Input
                      value={linha.turma}
                      onChange={(e) => editar(linha.id, { turma: e.target.value })}
                      placeholder="Turma"
                      className="h-9"
                    />
                    <Input
                      value={linha.matricula}
                      onChange={(e) => editar(linha.id, { matricula: e.target.value })}
                      placeholder="Matrícula"
                      className="h-9"
                    />
                    <div className="flex items-center gap-2">
                      {linha.problema ? (
                        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-900">
                          {linha.problema}
                        </span>
                      ) : (
                        <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-medium text-emerald-800">
                          Pronto
                        </span>
                      )}
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          setLinhas((atual) => atual.filter((l) => l.id !== linha.id))
                        }
                        aria-label={`Remover linha de ${linha.nome || "aluno"}`}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <Button className="mt-4" onClick={() => void importar()} disabled={importando}>
                Importar os {validas.length} alunos
              </Button>
            </div>
          ) : null}
        </section>

        <div className="relative mt-10">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={busca}
            onChange={(e) => setBusca(e.target.value)}
            placeholder="Procurar por nome, turma ou matrícula..."
            className="h-11 pl-10"
          />
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {filtrados.length} de {alunos.length} alunos
        </p>

        <ul className="mt-4 grid gap-3">
          {filtrados.length === 0 ? (
            <p className="text-muted-foreground">Nenhum aluno encontrado.</p>
          ) : (
            filtrados.map((aluno) => (
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
