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
  data_devolucao: string | null;
  livros: Pick<Livro, "id" | "titulo" | "codigo"> | null;
  alunos: Pick<Aluno, "id" | "nome" | "turma"> | null;
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
      .select("*, livros(id, titulo, codigo), alunos(id, nome, turma)")
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

export async function criarLivro(entrada: {
  titulo: string;
  autor: string;
  categoria: string;
  isbn: string;
  quantidade: number;
  capa_url: string | null;
}): Promise<Livro> {
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
      })
      .select()
      .single(),
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

export async function removerAluno(id: string): Promise<void> {
  const { error } = await supabase.from("alunos").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

export async function emprestarLivro(livroId: string, alunoId: string): Promise<void> {
  const livro = checar(
    await supabase.from("livros").select("*").eq("id", livroId).single(),
  ) as Livro;
  if (livro.disponiveis < 1) throw new Error("Não há exemplares disponíveis deste livro.");

  const { error: erroEmprestimo } = await supabase
    .from("emprestimos")
    .insert({ livro_id: livroId, aluno_id: alunoId });
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
