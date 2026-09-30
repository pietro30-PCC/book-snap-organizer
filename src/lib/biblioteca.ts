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
  /** Caminho do arquivo da capa no álbum; a partir dele o site gera o link de exibição. */
  capa_arquivo: string | null;
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

/** Lê o caminho do arquivo da capa a partir do que estiver guardado (caminho puro ou link). */
function caminhoDaCapa(valor: string | null): string | null {
  const bruto = (valor ?? "").trim();
  if (!bruto) return null;
  if (bruto.startsWith("livros/")) return bruto;
  for (const marcador of ["/object/sign/capas/", "/object/public/capas/"]) {
    const indice = bruto.indexOf(marcador);
    if (indice !== -1) return bruto.slice(indice + marcador.length).split("?")[0] ?? null;
  }
  return null;
}

/**
 * O álbum de capas é privado, então cada foto precisa de um link próprio para aparecer.
 * Em vez de guardar um link fixo (que pode envelhecer), geramos links novos a cada listagem.
 */
async function comLinksDeExibicao(livros: Livro[]): Promise<Livro[]> {
  const caminhos = Array.from(
    new Set(
      livros
        .map((livro) => livro.capa_arquivo ?? caminhoDaCapa(livro.capa_url))
        .filter((caminho): caminho is string => Boolean(caminho)),
    ),
  );
  if (caminhos.length === 0) return livros;

  const links = new Map<string, string>();
  for (let i = 0; i < caminhos.length; i += 100) {
    const bloco = caminhos.slice(i, i + 100);
    const { data, error } = await supabase.storage
      .from("capas")
      .createSignedUrls(bloco, 60 * 60 * 24 * 7);
    if (error) {
      console.error("[capas] não consegui gerar os links das fotos", error.message);
      continue;
    }
    (data ?? []).forEach((item, indice) => {
      const c = bloco[indice];
      if (item.signedUrl && c) links.set(c, item.signedUrl);
    });
  }

  return livros.map((livro) => {
    const caminho = livro.capa_arquivo ?? caminhoDaCapa(livro.capa_url);
    const link = caminho ? links.get(caminho) : undefined;
    if (!link) return caminho ? { ...livro, capa_url: null } : livro;
    return { ...livro, capa_arquivo: caminho, capa_url: link };
  });
}

export async function listarLivros(): Promise<Livro[]> {
  const livros = checar(
    await supabase.from("livros").select("*").order("created_at", { ascending: false }),
  ) as Livro[];
  return comLinksDeExibicao(livros);
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

/**
 * Guarda a foto no álbum de capas e devolve o caminho do arquivo junto com um link de exibição.
 * Avisa com erro quando algo dá errado, para nenhuma foto ser perdida sem que a pessoa veja.
 */
export async function enviarCapa(foto: Blob): Promise<{ arquivo: string; url: string }> {
  const arquivo = `livros/${crypto.randomUUID()}.jpg`;
  const { error } = await supabase.storage.from("capas").upload(arquivo, foto, {
    contentType: "image/jpeg",
    upsert: false,
  });
  if (error) throw new Error(`Não consegui guardar a foto: ${error.message}`);

  const { data, error: erroLink } = await supabase.storage
    .from("capas")
    .createSignedUrl(arquivo, 60 * 60 * 24 * 365);
  if (erroLink || !data?.signedUrl) throw new Error("Não consegui gerar o link da foto.");

  return { arquivo, url: data.signedUrl };
}

export type EntradaLivro = {
  titulo: string;
  autor: string;
  categoria: string;
  isbn: string;
  quantidade: number;
  capa_url: string | null;
  capa_arquivo?: string | null;
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
        capa_arquivo: entrada.capa_arquivo ?? null,
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
      capa_arquivo: e.capa_arquivo ?? null,
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

/**
 * Troca a foto de um livro. Se o envio falhar, mantém a foto anterior no lugar
 * (assim uma falha nunca deixa o livro sem capa) e remove o arquivo antigo do armazenamento.
 */
export async function trocarCapa(id: string, foto: Blob): Promise<Livro> {
  const { data: atual } = await supabase.from("livros").select("capa_arquivo").eq("id", id).maybeSingle();
  const antiga = (atual?.capa_arquivo as string | null) ?? null;

  const capa = await enviarCapa(foto);
  const livro = checar(
    await supabase
      .from("livros")
      .update({ capa_url: capa.url, capa_arquivo: capa.arquivo })
      .eq("id", id)
      .select()
      .single(),
  ) as Livro;

  if (antiga && antiga !== capa.arquivo) {
    await supabase.storage.from("capas").remove([antiga]);
  }
  return livro;
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
