"use client";

import { useState } from "react";

// Franja de "créditos" que se desplaza sola. Todo lo que se mueve solo más
// de 5 s tiene que poder pararse (WCAG 2.2.2): botón visible de pausa, y
// también se para con el ratón encima o con el foco del teclado dentro. La
// segunda copia (solo para que el bucle no tenga corte) va oculta al lector
// de pantalla, que lee la lista una sola vez.
export function CreditsMarquee({ tags }: { tags: string[] }) {
  const [paused, setPaused] = useState(false);

  return (
    <div className="group relative flex w-full overflow-hidden border-y border-line bg-bg-raised py-4 [contain:layout_paint]">
      <div
        className={`flex w-max animate-[credits-scroll_70s_linear_infinite] group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused] ${
          paused ? "[animation-play-state:paused]" : ""
        }`}
      >
        {[0, 1].map((copy) => (
          <ul key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center gap-6 pr-6">
            {tags.map((tag, i) => (
              <li key={i} className="flex items-center gap-6">
                <span className="font-mono text-sm tracking-widest whitespace-nowrap uppercase">{tag}</span>
                <span aria-hidden className="text-accent-purple-soft">
                  ●
                </span>
              </li>
            ))}
          </ul>
        ))}
      </div>
      <button
        type="button"
        onClick={() => setPaused((p) => !p)}
        aria-pressed={paused}
        aria-label={paused ? "Reanudar la franja animada" : "Pausar la franja animada"}
        className="absolute top-1/2 right-3 flex h-8 w-8 -translate-y-1/2 items-center justify-center border border-line bg-bg-raised font-mono text-[10px] text-muted transition-colors hover:border-accent hover:text-accent"
      >
        {paused ? "▶" : "❚❚"}
      </button>
    </div>
  );
}
