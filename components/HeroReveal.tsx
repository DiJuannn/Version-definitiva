import type { ReactNode } from "react";

// Entrada del hero con CSS puro (clase .hero-reveal en globals.css), no con
// Motion: así arranca con la propia página, sin esperar a que cargue el
// JavaScript — antes el titular estaba invisible hasta entonces, justo lo
// primero que se ve. La regla de "reducir movimiento" de globals.css la deja
// instantánea. `delay` (s) para encadenarla tras el titular.
export function HeroReveal({ children, delay = 0.15 }: { children: ReactNode; delay?: number }) {
  return (
    <div className="hero-reveal" style={{ animationDelay: `${delay}s` }}>
      {children}
    </div>
  );
}
