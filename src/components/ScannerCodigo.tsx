import { useEffect, useRef, useState } from "react";
import { CameraOff, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

type Props = {
  aberto: boolean;
  onFechar: () => void;
  onLido: (codigo: string) => void;
};

export function ScannerCodigo({ aberto, onFechar, onLido }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [manual, setManual] = useState("");

  useEffect(() => {
    if (!aberto) return;
    let parar: (() => void) | undefined;
    let cancelado = false;

    (async () => {
      try {
        const { BrowserMultiFormatReader } = await import("@zxing/browser");
        const leitor = new BrowserMultiFormatReader();
        const controls = await leitor.decodeFromVideoDevice(
          undefined,
          videoRef.current ?? undefined,
          (resultado) => {
            if (resultado && !cancelado) {
              cancelado = true;
              onLido(resultado.getText());
            }
          },
        );
        parar = () => controls.stop();
        if (cancelado) controls.stop();
      } catch (e) {
        console.error("[scanner]", e);
        setErro("Não consegui acessar a câmera. Digite o código manualmente abaixo.");
      }
    })();

    return () => {
      cancelado = true;
      parar?.();
    };
  }, [aberto, onLido]);

  return (
    <Dialog open={aberto} onOpenChange={(v) => !v && onFechar()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ScanLine className="size-5" /> Escanear código
          </DialogTitle>
        </DialogHeader>

        {erro ? (
          <div className="flex items-center gap-2 rounded-lg bg-muted p-4 text-sm text-muted-foreground">
            <CameraOff className="size-4 shrink-0" /> {erro}
          </div>
        ) : (
          <div className="overflow-hidden rounded-lg bg-black">
            <video ref={videoRef} className="aspect-video w-full object-cover" muted playsInline />
          </div>
        )}

        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) {
              onLido(manual.trim());
              setManual("");
            }
          }}
        >
          <Input
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            placeholder="Ou digite o código (ex: BIB-000001)"
          />
          <Button type="submit" variant="secondary">
            Buscar
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
