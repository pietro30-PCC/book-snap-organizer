import { useEffect, useRef } from "react";
import { Printer } from "lucide-react";
import JsBarcode from "jsbarcode";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { Livro } from "@/lib/biblioteca";

type Props = {
  livros: Livro[];
  aberto: boolean;
  onFechar: () => void;
};

/** Folha com grade de etiquetas (código de barras + título + autor) pronta para imprimir e recortar. */
export function FolhaEtiquetas({ livros, aberto, onFechar }: Props) {
  const areaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!aberto) return;
    const svgs = areaRef.current?.querySelectorAll<SVGSVGElement>("svg[data-codigo]");
    svgs?.forEach((svg) => {
      const valor = svg.dataset["codigo"];
      if (!valor) return;
      try {
        JsBarcode(svg, valor, {
          format: "CODE128",
          height: 42,
          width: 1.6,
          displayValue: true,
          fontSize: 12,
          margin: 4,
          background: "#ffffff",
          lineColor: "#111111",
        });
      } catch (erro) {
        console.error("[etiquetas] falha ao gerar", erro);
      }
    });
  }, [aberto, livros]);

  function imprimir() {
    const html = areaRef.current?.innerHTML ?? "";
    const janela = window.open("", "_blank", "width=900,height=700");
    if (!janela) return;
    janela.document.write(`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8">
      <title>Etiquetas da biblioteca</title>
      <style>
        @page { margin: 10mm; }
        body{font-family:system-ui,sans-serif;margin:0;}
        .grade{display:grid;grid-template-columns:repeat(3,1fr);gap:6mm;}
        .etiqueta{border:1px dashed #999;padding:6px 8px;text-align:center;break-inside:avoid;}
        .titulo{font-size:10px;font-weight:700;margin:0 0 2px;}
        .autor{font-size:8px;color:#555;margin:0 0 4px;}
      </style></head><body>${html}
      <script>window.onload=function(){window.print();}<\/script></body></html>`);
    janela.document.close();
  }

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Etiquetas para imprimir ({livros.length})</DialogTitle>
        </DialogHeader>

        <div ref={areaRef} className="rounded-lg bg-white p-3">
          <div className="grade grid grid-cols-2 gap-3 sm:grid-cols-3">
            {livros.map((livro) => (
              <div key={livro.id} className="etiqueta rounded border border-dashed p-2 text-center">
                <p className="titulo truncate text-[10px] font-bold text-neutral-900">
                  {livro.titulo}
                </p>
                <p className="autor truncate text-[8px] text-neutral-500">
                  {livro.autor || "Autor não informado"}
                </p>
                <svg data-codigo={livro.codigo} className="mx-auto" />
              </div>
            ))}
          </div>
        </div>

        <Button onClick={imprimir} className="w-full" disabled={livros.length === 0}>
          <Printer className="mr-2 size-4" /> Imprimir folha de etiquetas
        </Button>
      </DialogContent>
    </Dialog>
  );
}
