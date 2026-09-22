export type LeituraCapa = {
  titulo: string;
  autor: string;
  categoria: string;
  isbn: string;
  descricao: string;
};

const MODELO = "google/gemini-3.5-flash";

const INSTRUCAO = `Você analisa a foto da capa (ou contracapa) de um livro.
Extraia os dados visíveis e responda APENAS com um JSON válido no formato:
{"titulo":"","autor":"","categoria":"","isbn":"","descricao":""}
Regras:
- "titulo": título principal do livro, sem subtítulo quando for muito longo.
- "autor": nome do autor ou autores separados por vírgula. Vazio se não aparecer.
- "categoria": um gênero curto em português (ex: Romance, Didático, Infantil, História, Ciências, Literatura Brasileira).
- "isbn": apenas dígitos do ISBN se estiver visível (inclusive abaixo do código de barras), senão vazio.
- "descricao": resumo curto do livro em português do Brasil, de 2 a 3 frases, adequado ao catálogo de uma biblioteca escolar. Use o texto da contracapa quando visível; caso contrário, use o que você souber sobre a obra. Vazio se não tiver ideia do que se trata.
Não invente informações que não estejam na imagem, exceto a categoria e a descrição, que podem ser inferidas.`;

export async function lerCapaComIA(imagemDataUrl: string): Promise<LeituraCapa> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("IA indisponível: chave não configurada.");

  const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": apiKey,
    },
    body: JSON.stringify({
      model: MODELO,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: INSTRUCAO },
            { type: "image_url", image_url: { url: imagemDataUrl } },
          ],
        },
      ],
      response_format: { type: "json_object" },
    }),
  });

  if (resposta.status === 429) {
    throw new Error("Muitas leituras seguidas. Aguarde alguns segundos e tente de novo.");
  }
  if (resposta.status === 402) {
    throw new Error("Os créditos de IA acabaram. Adicione créditos para continuar usando o OCR.");
  }
  if (!resposta.ok) {
    const detalhe = await resposta.text();
    console.error("[OCR] falha do gateway", resposta.status, detalhe);
    throw new Error("Não consegui ler a foto agora. Tente novamente.");
  }

  const json = (await resposta.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  const conteudo = json.choices?.[0]?.message?.content ?? "{}";
  const limpo = conteudo.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();

  let dados: Partial<LeituraCapa> = {};
  try {
    dados = JSON.parse(limpo) as Partial<LeituraCapa>;
  } catch {
    console.error("[OCR] resposta não era JSON:", conteudo);
    throw new Error("A leitura veio em formato inesperado. Tente outra foto.");
  }

  return {
    titulo: (dados.titulo ?? "").toString().trim(),
    autor: (dados.autor ?? "").toString().trim(),
    categoria: (dados.categoria ?? "").toString().trim(),
    isbn: (dados.isbn ?? "").toString().replace(/[^0-9Xx]/g, ""),
    descricao: (dados.descricao ?? "").toString().trim(),
  };
}
