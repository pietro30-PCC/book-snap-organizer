import { useEffect, useState } from "react";
import { useServerFn } from "@tanstack/react-start";
import { useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { baixarCapaEscolhida, listarCapasLivro, type CapaCandidata } from "@/lib/capas.functions";
import { trocarCapa, type Livro } from "@/lib/biblioteca";
import { cn } from "@/lib/utils";

export function SeletorCapa({
  livro,
  aberto,
  onFechar,
  onSalvo,
}: {
  livro: Livro | null;
  aberto: boolean;
  onFechar: () => void;
  onSalvo?: () => void;
}) {
  const queryClient = useQueryClient();
  const listar = useServerFn(listarCapasLivro);
  const baixar = useServerFn(baixarCapaEscolhida);
  const [capas, setCapas] = useState<CapaCandidata[] | null>(null);
  const [quebradas, setQuebradas] = useState<Set<string>>(new Set());
  const [escolhida, setEscolhida] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  useEffect(() => {
    if (!aberto || !livro) return;
    let ativo = true;
    setCapas(null);
    setEscolhida(null);
    setQuebradas(new Set());
    listar({
      data: { titulo: livro.titulo, autor: livro.autor, isbn: livro.isbn ?? "", descricao: "" },
    })
      .then((r) => ativo && setCapas(r.capas))
      .catch(() => ativo && setCapas([]));
    return () => {
      ativo = false;
    };
  }, [aberto, livro, listar]);

  const visiveis = (capas ?? []).filter((c) => !quebradas.has(c.url));

  async function salvar() {
    if (!livro || !escolhida) return;
    setSalvando(true);
    try {
      const r = await baixar({ data: { url: escolhida } });
      const bin = atob(r.base64);
      const bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i += 1) bytes[i] = bin.charCodeAt(i);
      await trocarCapa(livro.id, new Blob([bytes], { type: r.tipo }));
      await queryClient.invalidateQueries({ queryKey: ["livros"] });
      toast.success("Capa salva no livro!");
      onSalvo?.();
      onFechar();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Não consegui salvar essa capa.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Escolha a capa correta</DialogTitle>
          <DialogDescription>
            {livro ? `${livro.titulo}${livro.autor ? ` — ${livro.autor}` : ""}` : ""}. Toque na
            imagem certa e depois em salvar.
          </DialogDescription>
        </DialogHeader>

        {capas === null ? (
          <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
            <Loader2 className="size-5 animate-spin" /> Procurando capas na internet…
          </div>
        ) : visiveis.length === 0 ? (
          <p className="py-16 text-center text-muted-foreground">
            Nenhuma capa encontrada para este livro.
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            {visiveis.map((c) => (
              <button
                key={c.url}
                type="button"
                onClick={() => setEscolhida(c.url)}
                className={cn(
                  "group relative overflow-hidden rounded-lg border-2 bg-muted text-left transition",
                  escolhida === c.url ? "border-primary ring-2 ring-primary/40" : "border-transparent hover:border-border",
                )}
              >
                <img
                  src={c.url}
                  alt={c.titulo || "Capa encontrada"}
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="aspect-[2/3] w-full object-cover"
                  onError={() => setQuebradas((q) => new Set(q).add(c.url))}
                />
                <span className="block truncate px-2 py-1 text-xs text-muted-foreground">{c.fonte}</span>
                {escolhida === c.url && (
                  <span className="absolute right-2 top-2 rounded-full bg-primary p-1 text-primary-foreground">
                    <Check className="size-4" />
                  </span>
                )}
              </button>
            ))}
          </div>
        )}

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="ghost" onClick={onFechar}>Cancelar</Button>
          <Button onClick={() => void salvar()} disabled={!escolhida || salvando}>
            {salvando && <Loader2 className="mr-2 size-4 animate-spin" />}
            Salvar esta capa
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
