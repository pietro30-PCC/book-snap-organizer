import { supabase } from "@/integrations/supabase/client";

export type Livro = {
  id: string;
  codigo: string;
  titulo: string;
  autor: string;
  categoria: string;
  isbn: string | null;
  quantidade: number;
  disponiveis: number;
  capa_url: string | null;
  descricao: string | null;
  created_at: string;
};

export type Aluno = {
  id: string;
  nome: string;
  turma: string;
  matricula: string;
  created_at: string;
};

export type Emprestimo = {
  id: string;
  livro_id: string;
  aluno_id: string;
  data_emprestimo: string;
  data_prevista: string | null;
  data_devolucao: string | null;
  livros: Pick<Livro, "id" | "titulo" | "codigo" | "capa_url"> | null;
  alunos: Pick<Aluno, "id" | "nome" | "turma" | "matricula"> | null;
};

function checar<T>(resultado: { data: T | null; error: { message: string } | null }): T {
  if (resultado.error) throw new Error(resultado.error.message);
  return resultado.data as T;
}

export async function listarLivros(): Promise<Livro[]> {
  return checar(
    await supabase.from("livros").select("*").order("created_at", { ascending: false }),
  ) as Livro[];
}

export async function listarAlunos(): Promise<Aluno[]> {
  return checar(
    await supabase.from("alunos").select("*").order("nome", { ascending: true }),
  ) as Aluno[];
}

export async function listarEmprestimos(): Promise<Emprestimo[]> {
  return checar(
    await supabase
      .from("emprestimos")
      .select("*, livros(id, titulo, codigo, capa_url), alunos(id, nome, turma, matricula)")
      .order("data_emprestimo", { ascending: false }),
  ) as unknown as Emprestimo[];
}

export async function buscarLivroPorCodigo(codigo: string): Promise<Livro | null> {
  const alvo = codigo.trim();
  const { data, error } = await supabase
    .from("livros")
    .select("*")
    .or(`codigo.eq.${alvo},isbn.eq.${alvo}`)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Livro | null) ?? null;
}

/** Empréstimo em aberto (sem devolução) de um livro — usado na devolução por leitura da etiqueta. */
export async function buscarEmprestimoAbertoPorLivro(
  livroId: string,
): Promise<Emprestimo | null> {
  const { data, error } = await supabase
    .from("emprestimos")
    .select("*, livros(id, titulo, codigo, capa_url), alunos(id, nome, turma, matricula)")
    .eq("livro_id", livroId)
    .is("data_devolucao", null)
    .order("data_emprestimo", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as unknown as Emprestimo | null) ?? null;
}

export async function enviarCapa(arquivo: Blob): Promise<string | null> {
  const nome = `livros/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("capas").upload(nome, arquivo, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) {
    console.error("[capa] falha ao enviar", error.message);
    return null;
  }
  const { data } = await supabase.storage.from("capas").createSignedUrl(nome, 60 * 60 * 24 * 3650);
  return data?.signedUrl ?? null;
}

export type EntradaLivro = {
  titulo: string;
  autor: string;
  categoria: string;
  isbn: string;
  quantidade: number;
  capa_url: string | null;
  descricao?: string;
};

export async function criarLivro(entrada: EntradaLivro): Promise<Livro> {
  const quantidade = Math.max(1, Math.floor(entrada.quantidade || 1));
  return checar(
    await supabase
      .from("livros")
      .insert({
        titulo: entrada.titulo.trim(),
        autor: entrada.autor.trim(),
        categoria: entrada.categoria.trim(),
        isbn: entrada.isbn.trim() || null,
        quantidade,
        disponiveis: quantidade,
        capa_url: entrada.capa_url,
        descricao: entrada.descricao?.trim() || null,
      })
      .select()
      .single(),
  ) as Livro;
}

/** Salva vários livros de uma vez (cadastro em lote) e devolve os registros criados. */
export async function criarLivrosEmLote(entradas: EntradaLivro[]): Promise<Livro[]> {
  if (entradas.length === 0) return [];
  const linhas = entradas.map((e) => {
    const quantidade = Math.max(1, Math.floor(e.quantidade || 1));
    return {
      titulo: e.titulo.trim(),
      autor: e.autor.trim(),
      categoria: e.categoria.trim(),
      isbn: e.isbn.trim() || null,
      quantidade,
      disponiveis: quantidade,
      capa_url: e.capa_url,
      descricao: e.descricao?.trim() || null,
    };
  });
  return checar(await supabase.from("livros").insert(linhas).select()) as Livro[];
}

/** Atualiza campos de um livro (usado para salvar a descrição gerada). */
export async function atualizarLivro(
  id: string,
  campos: Partial<Pick<Livro, "titulo" | "autor" | "categoria" | "isbn" | "descricao">>,
): Promise<Livro> {
  return checar(
    await supabase.from("livros").update(campos).eq("id", id).select().single(),
  ) as Livro;
}

/** Muda a quantidade de exemplares mantendo os emprestados coerentes. */
export async function atualizarQuantidade(livro: Livro, novaQuantidade: number): Promise<Livro> {
  const emprestados = livro.quantidade - livro.disponiveis;
  const qtd = Math.max(1, Math.round(novaQuantidade));
  if (qtd < emprestados)
    throw new Error(`Há ${emprestados} exemplar(es) emprestado(s). A quantidade não pode ser menor.`);
  return checar(
    await supabase
      .from("livros")
      .update({ quantidade: qtd, disponiveis: qtd - emprestados })
      .eq("id", livro.id)
      .select()
      .single(),
  ) as Livro;
}

export async function trocarCapa(id: string, foto: Blob): Promise<Livro> {
  const capa = await enviarCapa(foto);
  return checar(
    await supabase.from("livros").update({ capa_url: capa }).eq("id", id).select().single(),
  ) as Livro;
}

export async function removerLivro(id: string): Promise<void> {
  const { error } = await supabase.from("livros").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function criarAluno(entrada: {
  nome: string;
  turma: string;
  matricula: string;
}): Promise<Aluno> {
  return checar(
    await supabase
      .from("alunos")
      .insert({
        nome: entrada.nome.trim(),
        turma: entrada.turma.trim(),
        matricula: entrada.matricula.trim(),
      })
      .select()
      .single(),
  ) as Aluno;
}

export async function criarAlunosEmLote(
  entradas: Array<{ nome: string; turma: string; matricula: string }>,
): Promise<Aluno[]> {
  if (entradas.length === 0) return [];
  return checar(
    await supabase
      .from("alunos")
      .insert(
        entradas.map((e) => ({
          nome: e.nome.trim(),
          turma: e.turma.trim(),
          matricula: e.matricula.trim(),
        })),
      )
      .select(),
  ) as Aluno[];
}

export async function removerAluno(id: string): Promise<void> {
  const { error } = await supabase.from("alunos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function emprestarLivro(
  livroId: string,
  alunoId: string,
  dias = 14,
): Promise<void> {
  const livro = checar(
    await supabase.from("livros").select("*").eq("id", livroId).single(),
  ) as Livro;
  if (livro.disponiveis < 1) throw new Error("Não há exemplares disponíveis deste livro.");

  const prevista = new Date();
  prevista.setDate(prevista.getDate() + Math.max(1, Math.floor(dias)));

  const { error: erroEmprestimo } = await supabase.from("emprestimos").insert({
    livro_id: livroId,
    aluno_id: alunoId,
    data_prevista: prevista.toISOString(),
  });
  if (erroEmprestimo) throw new Error(erroEmprestimo.message);

  const { error: erroLivro } = await supabase
    .from("livros")
    .update({ disponiveis: livro.disponiveis - 1 })
    .eq("id", livroId);
  if (erroLivro) throw new Error(erroLivro.message);
}

export async function devolverLivro(emprestimoId: string, livroId: string): Promise<void> {
  const { error } = await supabase
    .from("emprestimos")
    .update({ data_devolucao: new Date().toISOString() })
    .eq("id", emprestimoId);
  if (error) throw new Error(error.message);

  const livro = checar(
    await supabase.from("livros").select("*").eq("id", livroId).single(),
  ) as Livro;
  const { error: erroLivro } = await supabase
    .from("livros")
    .update({ disponiveis: Math.min(livro.quantidade, livro.disponiveis + 1) })
    .eq("id", livroId);
  if (erroLivro) throw new Error(erroLivro.message);
}

/** Quantos dias de atraso (0 quando está no prazo). */
export function diasDeAtraso(emprestimo: Emprestimo, referencia = new Date()): number {
  if (emprestimo.data_devolucao || !emprestimo.data_prevista) return 0;
  const prevista = new Date(emprestimo.data_prevista);
  const diff = referencia.getTime() - prevista.getTime();
  return diff <= 0 ? 0 : Math.floor(diff / 86_400_000);
}
