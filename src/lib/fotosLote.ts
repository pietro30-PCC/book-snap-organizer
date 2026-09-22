/**
 * Guarda as fotos do cadastro em lote no armazenamento do navegador (IndexedDB),
 * para o site aguentar centenas de imagens sem estourar a memória.
 */
const BANCO = "biblioteca-lote";
const DEPOSITO = "fotos";

function abrir(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const pedido = indexedDB.open(BANCO, 1);
    pedido.onupgradeneeded = () => {
      const db = pedido.result;
      if (!db.objectStoreNames.contains(DEPOSITO)) db.createObjectStore(DEPOSITO);
    };
    pedido.onsuccess = () => resolve(pedido.result);
    pedido.onerror = () => reject(pedido.error ?? new Error("Armazenamento indisponível."));
  });
}

async function comDeposito<T>(
  modo: IDBTransactionMode,
  acao: (deposito: IDBObjectStore) => IDBRequest,
): Promise<T> {
  const db = await abrir();
  try {
    return await new Promise<T>((resolve, reject) => {
      const transacao = db.transaction(DEPOSITO, modo);
      const pedido = acao(transacao.objectStore(DEPOSITO));
      pedido.onsuccess = () => resolve(pedido.result as T);
      pedido.onerror = () => reject(pedido.error ?? new Error("Falha no armazenamento."));
    });
  } finally {
    db.close();
  }
}

export function salvarFoto(id: string, blob: Blob): Promise<void> {
  return comDeposito<void>("readwrite", (d) => d.put(blob, id));
}

export function lerFoto(id: string): Promise<Blob | undefined> {
  return comDeposito<Blob | undefined>("readonly", (d) => d.get(id));
}

export function removerFoto(id: string): Promise<void> {
  return comDeposito<void>("readwrite", (d) => d.delete(id));
}

export function limparFotos(): Promise<void> {
  return comDeposito<void>("readwrite", (d) => d.clear());
}

export function blobParaDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const leitor = new FileReader();
    leitor.onload = () => resolve(String(leitor.result));
    leitor.onerror = () => reject(new Error("Não consegui ler a foto guardada."));
    leitor.readAsDataURL(blob);
  });
}
