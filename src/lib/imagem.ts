export type ImagemPreparada = {
  /** Foto completa (usada na leitura e no envio). */
  dataUrl: string;
  blob: Blob;
  /** Miniatura leve, para mostrar listas grandes sem pesar. */
  miniatura: string;
};

function paraCanvas(bitmap: ImageBitmap, ladoMaximo: number) {
  const escala = Math.min(1, ladoMaximo / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * escala));
  canvas.height = Math.max(1, Math.round(bitmap.height * escala));
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Não foi possível processar a foto.");
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas;
}

/** Redimensiona e comprime a foto no navegador antes de enviar para a IA e para o armazenamento. */
export async function prepararFoto(arquivo: File, ladoMaximo = 1280): Promise<ImagemPreparada> {
  const bitmap = await createImageBitmap(arquivo);
  const canvas = paraCanvas(bitmap, ladoMaximo);
  const mini = paraCanvas(bitmap, 160);
  bitmap.close?.();

  const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
  const miniatura = mini.toDataURL("image/jpeg", 0.6);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao converter a foto."))),
      "image/jpeg",
      0.82,
    );
  });

  return { dataUrl, blob, miniatura };
}

/** Versão econômica: devolve só o arquivo comprimido e a miniatura (sem manter a foto grande na memória). */
export async function prepararFotoLeve(
  arquivo: File,
  ladoMaximo = 1280,
): Promise<{ blob: Blob; miniatura: string }> {
  const bitmap = await createImageBitmap(arquivo);
  const canvas = paraCanvas(bitmap, ladoMaximo);
  const mini = paraCanvas(bitmap, 160);
  bitmap.close?.();

  const miniatura = mini.toDataURL("image/jpeg", 0.6);
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("Falha ao converter a foto."))),
      "image/jpeg",
      0.82,
    );
  });

  return { blob, miniatura };
}
