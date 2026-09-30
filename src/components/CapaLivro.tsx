import { useState } from "react";
import type { Livro } from "@/lib/biblioteca";
import { cn } from "@/lib/utils";

const TONS = ["capa-a", "capa-b", "capa-c", "capa-d", "capa-e"] as const;

function tomDe(codigo: string) {
  let soma = 0;
  for (let i = 0; i < codigo.length; i += 1) soma += codigo.charCodeAt(i);
  return TONS[soma % TONS.length];
}

export function CapaLivro({
  livro,
  pequena = false,
  className,
}: {
  livro: Pick<Livro, "titulo" | "autor" | "codigo" | "capa_url">;
  pequena?: boolean;
  className?: string;
}) {
  const [urlComErro, setUrlComErro] = useState<string | null>(null);
  const url = livro.capa_url;

  if (url && url !== urlComErro) {
    return (
      <img
        src={url}
        alt={`Capa de ${livro.titulo}`}
        loading="lazy"
        onError={() => setUrlComErro(url)}
        className={cn("size-full object-cover", className)}
      />
    );
  }

  return (
    <span
      role="img"
      aria-label={`Capa ilustrativa de ${livro.titulo}, sem foto cadastrada`}
      className={cn("capa-falsa relative flex size-full min-w-0 flex-col justify-between overflow-hidden px-2 py-2 text-left", tomDe(livro.codigo), pequena ? "gap-0.5" : "gap-2 p-3 sm:p-4", className)}
    >
      <span className={cn("w-fit border-b border-current/50 pb-1 font-sans font-semibold uppercase", pequena ? "text-[6px]" : "text-[9px]")}>Biblioteca escolar</span>
      <span className={cn("line-clamp-5 w-full font-display font-semibold leading-tight wrap-break-word", pequena ? "text-[9px]" : "text-base sm:text-lg")}>
        {livro.titulo}
      </span>
      <span className={cn("line-clamp-2 w-full font-sans wrap-break-word opacity-80", pequena ? "text-[7px]" : "text-[10px]")}>
        {livro.autor || livro.codigo}
      </span>
    </span>
  );
}