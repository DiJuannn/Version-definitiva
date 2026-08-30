"use client";

import { useState } from "react";
import type { ReactNode } from "react";

// Igual que PdfLink: un <a target="_blank"> normal no puede usar
// useLinkStatus (eso es solo para <Link> de Next), así que este puntito de
// carga se apaga solo pasado un rato en vez de saber con certeza cuándo
// terminó de abrir la pestaña nueva.
export function FileOpenLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: ReactNode;
}) {
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
      className={className}
    >
      {children}
      <span aria-hidden className={`link-hint ${pending ? "is-pending" : ""}`} />
    </a>
  );
}
