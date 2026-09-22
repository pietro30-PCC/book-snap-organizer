/** Fila com concorrência limitada, pausa e cancelamento — usada no cadastro em lote. */
export type Fila = {
  promessa: Promise<void>;
  pausar: () => void;
  retomar: () => void;
  cancelar: () => void;
};

const dormir = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export function rodarFila<T>(
  itens: T[],
  tarefa: (item: T) => Promise<void>,
  concorrencia = 3,
): Fila {
  const pendentes = [...itens];
  let pausada = false;
  let cancelada = false;

  async function trabalhador() {
    for (;;) {
      if (cancelada) return;
      while (pausada && !cancelada) await dormir(200);
      if (cancelada) return;
      const proximo = pendentes.shift();
      if (proximo === undefined) return;
      await tarefa(proximo);
    }
  }

  const quantos = Math.max(1, Math.min(concorrencia, itens.length || 1));
  const promessa = Promise.all(Array.from({ length: quantos }, trabalhador)).then(() => undefined);

  return {
    promessa,
    pausar: () => {
      pausada = true;
    },
    retomar: () => {
      pausada = false;
    },
    cancelar: () => {
      cancelada = true;
      pendentes.length = 0;
    },
  };
}

/** Repete a operação quando o serviço responde "muitas leituras seguidas" (limite momentâneo). */
export async function comNovaTentativa<T>(
  operacao: () => Promise<T>,
  tentativas = 3,
  esperaInicial = 1500,
): Promise<T> {
  let erroFinal: unknown;
  for (let i = 0; i < tentativas; i++) {
    try {
      return await operacao();
    } catch (erro) {
      erroFinal = erro;
      const mensagem = erro instanceof Error ? erro.message.toLowerCase() : "";
      const vaisTentarDeNovo =
        mensagem.includes("muitas leituras") ||
        mensagem.includes("429") ||
        mensagem.includes("aguarde") ||
        mensagem.includes("network") ||
        mensagem.includes("fetch");
      if (!vaisTentarDeNovo || i === tentativas - 1) throw erro;
      await dormir(esperaInicial * Math.pow(2, i));
    }
  }
  throw erroFinal;
}
