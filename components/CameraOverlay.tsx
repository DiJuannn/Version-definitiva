"use client";

import { useEffect, useState } from "react";

function formatTimecode(ms: number): string {
  const totalFrames = Math.floor(ms / (1000 / 24)); // 24fps, como un rodaje real
  const frames = totalFrames % 24;
  const totalSeconds = Math.floor(totalFrames / 24);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const hours = Math.floor(totalSeconds / 3600);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}:${pad(frames)}`;
}

// Overlay decorativo tipo visor de cámara de rodaje — marcas de encuadre en
// las esquinas, indicador REC y timecode corriendo desde que se monta el
// componente. Puramente estético (aria-hidden), no simula datos reales.
export function CameraOverlay() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = performance.now();
    let raf: number;
    const tick = () => {
      setElapsed(performance.now() - start);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  const bracket = "absolute h-5 w-5 border-fg/40";

  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-x-6 top-32 bottom-8 sm:inset-x-10 sm:top-36 sm:bottom-10"
    >
      <span className={`${bracket} top-0 left-0 border-t border-l`} />
      <span className={`${bracket} top-0 right-0 border-t border-r`} />
      <span className={`${bracket} bottom-0 left-0 border-b border-l`} />
      <span className={`${bracket} bottom-0 right-0 border-b border-r`} />

      <div className="absolute bottom-0 left-0 flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-fg/60 uppercase">
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff2b2b]" />
        Rec
      </div>

      <div className="absolute right-0 bottom-0 font-mono text-[10px] tracking-widest text-fg/50 tabular-nums">
        {formatTimecode(elapsed)}
      </div>
    </div>
  );
}
