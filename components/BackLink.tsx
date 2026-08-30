import Link from "next/link";
import type { ReactNode } from "react";
import { LinkPendingHint } from "@/components/LinkPendingHint";

// El "← Volver" que encabeza casi toda página del Taller. Centralizado
// aquí (en vez de repetir el <Link> suelto en cada page.tsx) para que el
// aviso de carga (LinkPendingHint) quede aplicado en todos a la vez.
export function BackLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link
      href={href}
      className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
    >
      {children}
      <LinkPendingHint />
    </Link>
  );
}
