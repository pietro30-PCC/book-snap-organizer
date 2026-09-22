import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const Entrada = z.object({
  titulo: z.string().min(1).max(300),
  autor: z.string().max(300).default(""),
  categoria: z.string().max(120).default(""),
});

export const gerarDescricaoLivro = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => Entrada.parse(input))
  .handler(async ({ data }) => {
    const { gerarDescricaoComIA } = await import("./descricao.server");
    return { descricao: await gerarDescricaoComIA(data) };
  });
