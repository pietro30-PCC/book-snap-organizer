import { Printer } from "lucide-react";
import { CodigoBarras } from "@/components/CodigoBarras";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Livro } from "@/lib/biblioteca";

type Props = {
  livro: Livro | null;
  aberto: boolean;
  onFechar: () => void;
};

export function EtiquetaLivro({ livro, aberto, onFechar }: Props) {
  if (!livro) return null;

  function imprimir() {
    if (!livro) return;
    const janela = window.open("", "_blank", "width=640,height=480");
    if (!janela) return;
    const svg = document.getElementById("etiqueta-imprimivel")?.innerHTML ?? "";
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Etiqueta ${livro.codigo}</title>
      <style>
        body{font-family:system-ui,sans-serif;margin:0;padding:16px;}
        .etiqueta{width:62mm;border:1px dashed #999;padding:8px 10px;text-align:center;}
        .titulo{font-size:11px;font-weight:700;margin:0 0 2px;}
        .autor{font-size:9px;color:#555;margin:0 0 6px;}
      </style></head><body>
      <div class="etiqueta">
        <p class="titulo">${livro.titulo.replace(/</g, "&lt;")}</p>
        <p class="autor">${(livro.autor || "Autor não informado").replace(/</g, "&lt;")}</p>
        ${svg}
      </div>
      <script>window.onload=function(){window.print();}<\/script>
      </body></html>`);
    janela.document.close();
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Etiqueta do livro</DialogTitle>
        </DialogHeader>
        <div className="rounded-lg border border-dashed border-border bg-white p-4 text-center">
          <p className="text-sm font-semibold text-neutral-900">{livro.titulo}</p>
          <p className="mb-2 text-xs text-neutral-500">{livro.autor || "Autor não informado"}</p>
          <div id="etiqueta-imprimivel" className="flex justify-center">
            <CodigoBarras valor={livro.codigo} />
          </div>
        </div>
        <p className="text-xs text-muted-foreground">
          Imprima, cole na contracapa e depois use o leitor da tela de empréstimos para escanear.
        </p>
        <Button onClick={imprimir} className="w-full">
          <Printer className="mr-2 size-4" /> Imprimir etiqueta
        </Button>
      </DialogContent>
    </Dialog>
  );
}
