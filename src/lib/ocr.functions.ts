import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const EntradaOcr = z.object({
  imagemDataUrl: z
    .string()
    .startsWith("data:image/", "Envie uma imagem válida.")
    .max(9_000_000, "Imagem muito grande. Use uma foto menor."),
});

export const lerCapaLivro = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) => EntradaOcr.parse(input))
  .handler(async ({ data }) => {
    const { lerCapaComIA } = await import("./ocr.server");
    return lerCapaComIA(data.imagemDataUrl);
  });
