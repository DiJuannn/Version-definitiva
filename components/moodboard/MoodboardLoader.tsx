"use client";

import dynamic from "next/dynamic";

// El editor (y React Flow con él) se descarga solo al entrar en esta página:
// el resto de Taller no carga nada de esto.
const MoodboardEditor = dynamic(() => import("@/components/moodboard/MoodboardEditor"), {
  ssr: false,
  loading: () => (
    <div
      className="taller-paper mt-[4.5rem] flex h-[calc(100dvh-18rem)] min-h-[520px] items-center justify-center rounded-xl font-sans text-sm text-muted"
      style={{
        background: "#e6e4df",
        boxShadow: "0 0 0 1px rgb(255 255 255 / 0.04), 0 30px 60px -30px rgb(0 0 0 / 0.9)",
      }}
    >
      <span className="motion-safe:animate-pulse">Abriendo el tablero…</span>
    </div>
  ),
});

export function MoodboardLoader(props: React.ComponentProps<typeof MoodboardEditor>) {
  return <MoodboardEditor {...props} />;
}
