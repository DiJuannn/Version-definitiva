"use client";

import { useState } from "react";

// Un <a target="_blank"> normal no tiene forma de avisar que está
// cargando (no es un <Link>, useLinkStatus no aplica): el PDF se genera al
// vuelo en el servidor y, mientras tanto, la pestaña nueva se queda en
// blanco unos segundos sin ninguna señal. Este estado local (se apaga solo
// pasado un rato) es una aproximación razonable — no sabemos exactamente
// cuándo terminó de cargar la pestaña nueva, pero sí que el clic se registró.
export function PdfLink({ href, label = "Descargar PDF" }: { href: string; label?: string }) {
  const [pending, setPending] = useState(false);

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={() => {
        setPending(true);
        setTimeout(() => setPending(false), 4000);
      }}
      className="btn btn-outline inline-flex items-center gap-1.5 print:hidden"
    >
      {pending && (
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
      )}
      {pending ? "Generando…" : label}
    </a>
  );
}
