import { useEffect, useRef } from "react";
import JsBarcode from "jsbarcode";

type Props = {
  valor: string;
  altura?: number;
  largura?: number;
  exibirTexto?: boolean;
};

export function CodigoBarras({ valor, altura = 60, largura = 2, exibirTexto = true }: Props) {
  const ref = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!ref.current || !valor) return;
    try {
      JsBarcode(ref.current, valor, {
        format: "CODE128",
        height: altura,
        width: largura,
        displayValue: exibirTexto,
        fontSize: 14,
        margin: 6,
        background: "#ffffff",
        lineColor: "#111111",
      });
    } catch (erro) {
      console.error("[codigo-barras] não foi possível gerar", erro);
    }
  }, [valor, altura, largura, exibirTexto]);

  return <svg ref={ref} role="img" aria-label={`Código de barras ${valor}`} />;
}
