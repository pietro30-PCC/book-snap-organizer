import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const Entrada = z.object({
  titulo: z.string().trim().min(1).max(300),
  autor: z.string().trim().max(300).default(""),
  isbn: z.string().trim().max(32).default(""),
  descricao: z.string().trim().max(1200).default(""),
});
type EntradaT = z.infer<typeof Entrada>;

export type CapaCandidata = { url: string; titulo: string; fonte: string };

const UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36";

function isbnLimpo(v: string) {
  return v.replace(/[^0-9Xx]/g, "").toUpperCase();
}

async function buscarImagensWeb(consulta: string): Promise<CapaCandidata[]> {
  try {
    const pagina = await fetch(
      `https://duckduckgo.com/?q=${encodeURIComponent(consulta)}&iar=images&iax=images&ia=images`,
      { headers: { "User-Agent": UA } },
    );
    const html = await pagina.text();
    const vqd = (html.match(/vqd=["']?([\d-]+)/) ?? [])[1];
    if (!vqd) return [];
    const r = await fetch(
      `https://duckduckgo.com/i.js?l=br-pt&o=json&q=${encodeURIComponent(consulta)}&vqd=${vqd}&f=,,,,,&p=1`,
      { headers: { "User-Agent": UA, Referer: "https://duckduckgo.com/" } },
    );
    if (!r.ok) return [];
    const json = (await r.json()) as {
      results?: Array<{ image?: string; title?: string; url?: string; width?: number; height?: number }>;
    };
    return (json.results ?? [])
      .filter((x) => x.image?.startsWith("https://") && (!x.width || !x.height || x.height >= x.width * 0.9))
      .slice(0, 12)
      .map((x) => {
        let fonte = "internet";
        try {
          fonte = new URL(x.url ?? x.image!).hostname.replace(/^www\./, "");
        } catch {
          /* ignora */
        }
        return { url: x.image!, titulo: x.title ?? "", fonte };
      });
  } catch {
    return [];
  }
}

async function buscarOpenLibrary(e: EntradaT): Promise<CapaCandidata[]> {
  const isbn = isbnLimpo(e.isbn);
  const p = isbn
    ? `isbn=${encodeURIComponent(isbn)}`
    : `title=${encodeURIComponent(e.titulo)}&author=${encodeURIComponent(e.autor)}`;
  try {
    const r = await fetch(`https://openlibrary.org/search.json?${p}&fields=title,cover_i&limit=4`);
    if (!r.ok) return [];
    const json = (await r.json()) as { docs?: Array<{ title?: string; cover_i?: number }> };
    return (json.docs ?? []).flatMap((d) =>
      d.cover_i
        ? [{ url: `https://covers.openlibrary.org/b/id/${d.cover_i}-L.jpg`, titulo: d.title ?? "", fonte: "openlibrary.org" }]
        : [],
    );
  } catch {
    return [];
  }
}

async function candidatos(e: EntradaT) {
  const isbn = isbnLimpo(e.isbn);
  const consulta = `livro ${e.titulo} ${e.autor} ${isbn} capa`.replace(/\s+/g, " ").trim();
  const [web, ol] = await Promise.all([buscarImagensWeb(consulta), buscarOpenLibrary(e)]);
  const vistos = new Set<string>();
  return [...ol, ...web].filter((c) => (vistos.has(c.url) ? false : (vistos.add(c.url), true)));
}

function urlPermitida(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname;
    if (h === "localhost" || /^(\d+\.){3}\d+$/.test(h) || h.includes(":") || h.endsWith(".local") || h.endsWith(".internal")) return false;
    return true;
  } catch {
    return false;
  }
}

async function baixarImagem(url: string) {
  if (!urlPermitida(url)) return null;
  try {
    const r = await fetch(url, { headers: { "User-Agent": UA, Accept: "image/jpeg,image/png,image/webp,image/*" } });
    if (!r.ok) return null;
    const tipo = r.headers.get("content-type") ?? "";
    if (!tipo.startsWith("image/")) return null;
    const bytes = new Uint8Array(await r.arrayBuffer());
    if (bytes.byteLength < 2_000 || bytes.byteLength > 8_000_000) return null;
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return { base64: btoa(bin), tipo: tipo.split(";")[0] ?? "image/jpeg" };
  } catch {
    return null;
  }
}

/** Lista capas possíveis para a bibliotecária escolher. */
export const listarCapasLivro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Entrada.parse(input))
  .handler(async ({ data }) => ({ capas: await candidatos(data) }));

/** Baixa a capa escolhida e devolve os bytes para salvar no álbum privado. */
export const baixarCapaEscolhida = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ url: z.string().url().max(2000) }).parse(input))
  .handler(async ({ data }) => {
    const img = await baixarImagem(data.url);
    if (!img) throw new Error("Não consegui baixar essa imagem. Escolha outra.");
    return img;
  });

/** Busca automática (lote): usa a primeira capa que puder ser baixada. */
export const buscarCapaLivro = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => Entrada.parse(input))
  .handler(async ({ data }) => {
    for (const c of (await candidatos(data)).slice(0, 4)) {
      const img = await baixarImagem(c.url);
      if (img) return { encontrada: true as const, ...img, fonte: c.url };
    }
    return { encontrada: false as const };
  });
