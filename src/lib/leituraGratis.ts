/** Leitura de livros sem gastar créditos: código de barras + catálogos públicos + OCR no navegador. */
export type DadosLivro = {
  titulo: string;
  autor: string;
  categoria: string;
  isbn: string;
  descricao: string;
};

export function isbnValido(bruto: string): boolean {
  const s = bruto.replace(/[^0-9Xx]/g, "").toUpperCase();
  if (s.length === 13) {
    if (!/^\d{13}$/.test(s)) return false;
    const soma = s
      .slice(0, 12)
      .split("")
      .reduce((a, d, i) => a + Number(d) * (i % 2 ? 3 : 1), 0);
    return (10 - (soma % 10)) % 10 === Number(s[12]);
  }
  if (s.length === 10) {
    let soma = 0;
    for (let i = 0; i < 10; i++) {
      const c = s[i];
      const v = c === "X" && i === 9 ? 10 : Number(c);
      if (Number.isNaN(v)) return false;
      soma += v * (10 - i);
    }
    return soma % 11 === 0;
  }
  return false;
}

/** Procura código de barras ISBN (EAN-13 978/979) na foto. */
export async function lerCodigoDeBarras(blob: Blob): Promise<string | null> {
  const { BrowserMultiFormatReader } = await import("@zxing/browser");
  const leitor = new BrowserMultiFormatReader();
  const url = URL.createObjectURL(blob);
  try {
    const r = await leitor.decodeFromImageUrl(url);
    const txt = r.getText().replace(/\D/g, "");
    return isbnValido(txt) && /^97[89]/.test(txt) ? txt : null;
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

type VolumeGoogle = {
  volumeInfo?: {
    title?: string;
    subtitle?: string;
    authors?: string[];
    categories?: string[];
    description?: string;
    industryIdentifiers?: Array<{ type: string; identifier: string }>;
  };
};

function limparDescricao(t: string) {
  const s = t.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return s.length > 600 ? s.slice(0, 597) + "..." : s;
}

function deGoogle(v: VolumeGoogle, isbn = ""): DadosLivro | null {
  const i = v.volumeInfo;
  if (!i?.title) return null;
  const id =
    isbn ||
    i.industryIdentifiers?.find((x) => x.type === "ISBN_13")?.identifier ||
    i.industryIdentifiers?.find((x) => x.type === "ISBN_10")?.identifier ||
    "";
  return {
    titulo: i.title,
    autor: (i.authors ?? []).join(", "),
    categoria: i.categories?.[0] ?? "",
    isbn: id,
    descricao: limparDescricao(i.description ?? ""),
  };
}

async function buscarJson<T>(url: string): Promise<T | null> {
  try {
    const r = await fetch(url);
    if (!r.ok) return null;
    return (await r.json()) as T;
  } catch {
    return null;
  }
}

export async function buscarPorIsbn(isbn: string): Promise<DadosLivro | null> {
  const g = await buscarJson<{ items?: VolumeGoogle[] }>(
    `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`,
  );
  const achado = g?.items?.[0] && deGoogle(g.items[0], isbn);
  if (achado) return achado;

  const o = await buscarJson<Record<string, { title?: string; authors?: Array<{ name: string }>; subjects?: Array<{ name: string }>; notes?: string | { value: string } }>>(
    `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`,
  );
  const d = o?.[`ISBN:${isbn}`];
  if (d?.title) {
    const nota = typeof d.notes === "string" ? d.notes : (d.notes?.value ?? "");
    return {
      titulo: d.title,
      autor: (d.authors ?? []).map((a) => a.name).join(", "),
      categoria: d.subjects?.[0]?.name ?? "",
      isbn,
      descricao: limparDescricao(nota),
    };
  }
  return null;
}

export async function buscarPorTexto(texto: string): Promise<DadosLivro | null> {
  const q = texto.replace(/[^\p{L}\p{N} ]/gu, " ").replace(/\s+/g, " ").trim();
  if (q.length < 3) return null;
  const g = await buscarJson<{ items?: VolumeGoogle[] }>(
    `https://www.googleapis.com/books/v1/volumes?q=${encodeURIComponent(q)}&maxResults=1`,
  );
  return (g?.items?.[0] && deGoogle(g.items[0])) || null;
}

// OCR gratuito: um único trabalhador reaproveitado.
let trabalhador: Promise<import("tesseract.js").Worker> | null = null;
function obterTrabalhador() {
  if (!trabalhador) {
    trabalhador = import("tesseract.js").then((t) => t.createWorker("por"));
  }
  return trabalhador;
}

/** Lê o texto da capa e devolve as linhas com letras maiores primeiro (provável título). */
export async function lerTextoCapa(blob: Blob): Promise<{ titulo: string; texto: string; isbn: string }> {
  const w = await obterTrabalhador();
  const { data } = await w.recognize(blob, {}, { blocks: true, text: true });
  const texto = data.text ?? "";
  const isbnMatch = texto.replace(/[-\s]/g, "").match(/97[89]\d{10}/);
  const isbn = isbnMatch && isbnValido(isbnMatch[0]) ? isbnMatch[0] : "";

  const linhas: Array<{ t: string; h: number }> = [];
  for (const b of data.blocks ?? [])
    for (const p of b.paragraphs ?? [])
      for (const l of p.lines ?? []) {
        const t = l.text.trim();
        if (l.confidence > 55 && /\p{L}{3,}/u.test(t))
          linhas.push({ t, h: l.bbox.y1 - l.bbox.y0 });
      }
  linhas.sort((a, b) => b.h - a.h);
  const titulo = linhas
    .slice(0, 2)
    .map((l) => l.t)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
  return { titulo, texto, isbn };
}

/** Caminho completo gratuito. Retorna null se não reconheceu. `certo` indica dados vindos de ISBN. */
export async function lerLivroGratis(
  blob: Blob,
): Promise<{ dados: DadosLivro; certo: boolean } | null> {
  const codigo = await lerCodigoDeBarras(blob);
  if (codigo) {
    const d = await buscarPorIsbn(codigo);
    if (d) return { dados: d, certo: true };
  }
  const ocr = await lerTextoCapa(blob);
  const isbn = codigo || ocr.isbn;
  if (isbn && !codigo) {
    const d = await buscarPorIsbn(isbn);
    if (d) return { dados: d, certo: true };
  }
  if (ocr.titulo) {
    const d = await buscarPorTexto(ocr.titulo);
    if (d) return { dados: { ...d, isbn: isbn || d.isbn }, certo: false };
    return {
      dados: { titulo: ocr.titulo, autor: "", categoria: "", isbn, descricao: "" },
      certo: false,
    };
  }
  if (isbn) return { dados: { titulo: "", autor: "", categoria: "", isbn, descricao: "" }, certo: false };
  return null;
}
