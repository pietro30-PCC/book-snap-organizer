const MODELO = "google/gemini-3.5-flash";

export async function gerarDescricaoComIA(dados: {
  titulo: string;
  autor: string;
  categoria: string;
}): Promise<string> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new Error("IA indisponível: chave não configurada.");

  const resposta = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Lovable-API-Key": apiKey },
    body: JSON.stringify({
      model: MODELO,
      messages: [
        {
          role: "user",
          content: `Escreva uma descrição curta (2 a 3 frases, em português do Brasil) sobre o livro abaixo, adequada para o catálogo de uma biblioteca escolar. Não invente prêmios nem dados específicos que você não saiba.
Título: ${dados.titulo}
Autor: ${dados.autor || "não informado"}
Categoria: ${dados.categoria || "não informada"}
Responda apenas com o texto da descrição.`,
        },
      ],
    }),
  });

  if (resposta.status === 429) throw new Error("Muitas solicitações seguidas. Aguarde um pouco.");
  if (resposta.status === 402) throw new Error("Os créditos de IA acabaram.");
  if (!resposta.ok) {
    console.error("[descricao] falha do gateway", resposta.status, await resposta.text());
    throw new Error("Não consegui gerar a descrição agora.");
  }

  const json = (await resposta.json()) as { choices?: Array<{ message?: { content?: string } }> };
  return (json.choices?.[0]?.message?.content ?? "").trim();
}
