"use client";

import { useRef, useState } from "react";

// Escena ilustrativa propia (no una foto de stock) — evita cualquier lío de
// derechos de una imagen ajena publicada en una web real, y dado que es una
// ilustración nadie puede confundirla con una toma real nuestra. Sirve solo
// para enseñar el mecanismo del comparador; se sustituye por un fotograma
// real en cuanto haya metraje graduado de verdad.
function IllustrativeScene() {
  return (
    <svg viewBox="0 0 800 450" className="h-full w-full" preserveAspectRatio="xMidYMid slice">
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#3a2e2a" />
          <stop offset="100%" stopColor="#8a5a3a" />
        </linearGradient>
      </defs>
      <rect width="800" height="450" fill="url(#sky)" />
      <circle cx="600" cy="140" r="70" fill="#e8b06a" />
      <path d="M0 320 L180 190 L320 300 L470 170 L620 290 L800 210 L800 450 L0 450 Z" fill="#241c18" />
      <path d="M0 380 L220 300 L400 360 L600 290 L800 340 L800 450 L0 450 Z" fill="#150f0d" />
    </svg>
  );
}

export function BeforeAfterSlider() {
  const containerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState(50);
  const draggingRef = useRef(false);

  const updateFromClientX = (clientX: number) => {
    const el = containerRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const pct = ((clientX - rect.left) / rect.width) * 100;
    setPosition(Math.min(100, Math.max(0, pct)));
  };

  return (
    <div
      ref={containerRef}
      className="relative aspect-video w-full touch-none overflow-hidden border border-line select-none"
      onPointerDown={(e) => {
        draggingRef.current = true;
        updateFromClientX(e.clientX);
      }}
      onPointerMove={(e) => {
        if (draggingRef.current) updateFromClientX(e.clientX);
      }}
      onPointerUp={() => {
        draggingRef.current = false;
      }}
      onPointerLeave={() => {
        draggingRef.current = false;
      }}
    >
      {/* Graduado (después) — capa base */}
      <div
        className="absolute inset-0"
        style={{ filter: "saturate(1.25) contrast(1.12) brightness(0.98) sepia(0.08)" }}
      >
        <IllustrativeScene />
      </div>

      {/* LOG (antes) — recortada por la posición del slider */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{ clipPath: `inset(0 ${100 - position}% 0 0)` }}
      >
        <div
          className="h-full w-full"
          style={{ filter: "saturate(0.35) contrast(0.72) brightness(1.22)" }}
        >
          <IllustrativeScene />
        </div>
      </div>

      <span className="absolute top-4 left-4 font-mono text-[10px] tracking-widest text-fg/80 uppercase">
        Log
      </span>
      <span className="absolute top-4 right-4 font-mono text-[10px] tracking-widest text-fg/80 uppercase">
        Grade
      </span>

      <div
        className="absolute inset-y-0 w-0.5 bg-accent"
        style={{ left: `${position}%` }}
      >
        <div className="absolute top-1/2 left-1/2 flex h-9 w-9 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-accent bg-bg font-mono text-xs text-accent">
          ↔
        </div>
      </div>
    </div>
  );
}
