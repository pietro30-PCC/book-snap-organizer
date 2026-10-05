import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Entrada = z.object({
  titulo: z.string().trim().min(1).max(300),
  autor: z.string().trim().max(300).default(""),
  isbn: z.string().trim().max(32).default(""),
  descricao: z.string().trim().max(1200).default(""),
});

type Candidato = {
  titulo: string;
  autores: string[];
  isbn: string[];
  imagem: string;
};

function normalizar(valor: string) {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function palavras(valor: string) {
  return new Set(normalizar(valor).split(" ").filter((p) => p.length > 1));
}

function semelhanca(a: string, b: string) {
  const aa = palavras(a);
  const bb = palavras(b);
  if (!aa.size || !bb.size) return 0;
  let comuns = 0;
  for (const p of aa) if (bb.has(p)) comuns += 1;
  return (2 * comuns) / (aa.size + bb.size);
}

function isbnLimpo(valor: string) {
  return valor.replace(/[^0-9Xx]/g, "").toUpperCase();
}

function corresponde(candidato: Candidato, entrada: z.infer<typeof Entrada>) {
  const isbn = isbnLimpo(entrada.isbn);
  if (isbn) return candidato.isbn.some((i) => isbnLimpo(i) === isbn);
  const titulo = semelhanca(entrada.titulo, candidato.titulo);
  if (titulo < 0.72) return false;
  if (!entrada.autor.trim()) return titulo >= 0.88;
  return candidato.autores.some((autor) => semelhanca(entrada.autor, autor) >= 0.45);
}

async function buscarGoogle(entrada: z.infer<typeof Entrada>): Promise<Candidato[]> {
  const isbn = isbnLimpo(entrada.isbn);
  const contexto = entrada.descricao
    .split(/\s+/)
    .map((palavra) => palavra.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((palavra) => palavra.length >= 5)
    .slice(0, 4)
    .join(" ");
  const consulta = isbn
    ? `isbn:${isbn}`
    : `intitle:${entrada.titulo}${entrada.autor ? ` inauthor:${entrada.autor}` : ""}${contexto ? ` ${contexto}` : ""}`;
  try {
    const resposta = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(consulta)}&maxResults=8`,
    );
    if (!resposta.ok) return [];
    const json = (await resposta.json()) as {
      items?: Array<{
        volumeInfo?: {
          title?: string;
          authors?: string[];
          industryIdentifiers?: Array<{ identifier?: string }>;
          imageLinks?: { extraLarge?: string; large?: string; medium?: string; thumbnail?: string };
        };
      }>;
    };
    return (json.items ?? []).flatMap((item) => {
      const info = item.volumeInfo;
      const imagem = info?.imageLinks?.extraLarge ?? info?.imageLinks?.large ?? info?.imageLinks?.medium ?? info?.imageLinks?.thumbnail;
      if (!info?.title || !imagem) return [];
      return [{
        titulo: info.title,
        autores: info.authors ?? [],
        isbn: (info.industryIdentifiers ?? []).flatMap((i) => i.identifier ?? []),
        imagem: imagem.replace(/^http:/, "https:").replace("&edge=curl", ""),
      }];
    });
  } catch {
    return [];
  }
}

async function buscarOpenLibrary(entrada: z.infer<typeof Entrada>): Promise<Candidato[]> {
  const isbn = isbnLimpo(entrada.isbn);
  const parametros = isbn
    ? `isbn=${encodeURIComponent(isbn)}`
    : `title=${encodeURIComponent(entrada.titulo)}&author=${encodeURIComponent(entrada.autor)}`;
  try {
    const resposta = await fetch(
      `https://openlibrary.org/search.json?${parametros}&fields=title,author_name,isbn,cover_i&limit=8`,
    );
    if (!resposta.ok) return [];
    const json = (await resposta.json()) as {
      docs?: Array<{ title?: string; author_name?: string[]; isbn?: string[]; cover_i?: number }>;
    };
    return (json.docs ?? []).flatMap((doc) => {
      if (!doc.title || !doc.cover_i) return [];
      return [{
        titulo: doc.title,
        autores: doc.author_name ?? [],
        isbn: doc.isbn ?? [],
        imagem: `https://covers.openlibrary.org/b/id/${doc.cover_i}-L.jpg`,
      }];
    });
  } catch {
    return [];
  }
}

async function baixarImagem(url: string) {
  const resposta = await fetch(url, { headers: { Accept: "image/jpeg,image/png,image/webp" } });
  if (!resposta.ok) return null;
  const tipo = resposta.headers.get("content-type") ?? "";
  if (!tipo.startsWith("image/")) return null;
  const bytes = new Uint8Array(await resposta.arrayBuffer());
  if (bytes.byteLength < 2_000 || bytes.byteLength > 8_000_000) return null;
  return { base64: Buffer.from(bytes).toString("base64"), tipo };
}

export const buscarCapaLivro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Entrada.parse(input))
  .handler(async ({ data }) => {
    const google = await buscarGoogle(data);
    const candidatos = [...google, ...(await buscarOpenLibrary(data))];
    for (const candidato of candidatos) {
      if (!corresponde(candidato, data)) continue;
      const imagem = await baixarImagem(candidato.imagem);
      if (imagem) return { encontrada: true as const, ...imagem, fonte: candidato.imagem };
    }
    return { encontrada: false as const };
  });