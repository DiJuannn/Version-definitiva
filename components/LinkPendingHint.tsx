"use client";

import { useLinkStatus } from "next/link";

// Debe usarse como hijo directo de un <Link> — muestra un puntito pulsante
// mientras la navegación está en curso (solo aparece si de verdad tarda,
// ver .link-hint en globals.css). Pensado para enlaces a rutas dinámicas
// sin loading.js propio, donde si no hay aviso la página se queda quieta
// unos segundos y luego salta de golpe.
export function LinkPendingHint({ className }: { className?: string }) {
  const { pending } = useLinkStatus();
  return (
    <span
      aria-hidden
      className={`link-hint ${pending ? "is-pending" : ""} ${className ?? ""}`}
    />
  );
}
