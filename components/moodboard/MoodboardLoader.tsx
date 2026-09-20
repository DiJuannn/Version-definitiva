"use client";

import dynamic from "next/dynamic";

// El editor (y React Flow con él) se descarga solo al entrar en esta página:
// el resto de Taller no carga nada de esto.
const MoodboardEditor = dynamic(() => import("@/components/moodboard/MoodboardEditor"), {
  ssr: false,
  loading: () => (
    <div className="flex h-[calc(100dvh-16rem)] min-h-[520px] items-center justify-center border border-line font-mono text-xs text-muted">
      Cargando el tablero…
    </div>
  ),
});

export function MoodboardLoader(props: React.ComponentProps<typeof MoodboardEditor>) {
  return <MoodboardEditor {...props} />;
}
