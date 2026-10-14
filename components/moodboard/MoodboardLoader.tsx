"use client";

import dynamic from "next/dynamic";

// El editor (y React Flow con él) se descarga solo al entrar en esta página:
// el resto de Taller no carga nada de esto.
const MoodboardEditor = dynamic(() => import("@/components/moodboard/MoodboardEditor"), {
  ssr: false,
  loading: () => (
    <div
      className="taller-paper flex h-[calc(100dvh-16rem)] min-h-[520px] items-center justify-center rounded-xl font-sans text-sm text-muted"
      style={{
        background: "color-mix(in srgb, var(--fg) 4%, var(--bg))",
        boxShadow: "inset 0 0 0 1px color-mix(in srgb, var(--fg) 8%, transparent)",
      }}
    >
      <span className="animate-pulse">Abriendo el tablero…</span>
    </div>
  ),
});

export function MoodboardLoader(props: React.ComponentProps<typeof MoodboardEditor>) {
  return <MoodboardEditor {...props} />;
}
