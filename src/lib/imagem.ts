export type ImagemPreparada = {
  dataUrl: string;
  blob: Blob;
};

/** Redimensiona e comprime a foto no navegador antes de enviar para a IA e para o armazenamento. */
export async function prepararFoto(arquivo: File, ladoMaximo = 1280): Promise<ImagemPreparada> {
  const bitmap = await createImageBitmap(arquivo);
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const largura = Math.round(bitmap.width * escala);
  const altura = Math.round(bitmap.height * escala);

  const canvas = document.createElement("canvas");
  canvas.width = largura;
  canvas.height = altura;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a foto.");
  ctx.drawImage(bitmap, 0, 0, largura, altura);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao converter a foto."))),
      "image/jpeg",
      0.82,
    );
  });

  return { dataUrl, blob };
}
