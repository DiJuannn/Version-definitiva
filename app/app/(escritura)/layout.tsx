import type { Metadata } from "next";
import type { ReactNode } from "react";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Escribir un guion es otra forma de trabajar: pantalla limpia, sin el menú
// de Taller, y en claro como el papel. Solo la barra propia del guion.
export default function EscrituraLayout({ children }: { children: ReactNode }) {
  return <div className="sp-light min-h-screen bg-bg text-fg">{children}</div>;
}
