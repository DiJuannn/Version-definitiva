"use client";

import { ViewportPortal, useViewport } from "@xyflow/react";

export type RemoteCursor = { x: number; y: number; name: string; color: string; at: number };

// Los cursores de las demás personas que tienen abierta la misma pizarra. Van en coordenadas de la
// pizarra (se mueven con el zoom y el desplazamiento) pero con tamaño constante en pantalla.
export function RemoteCursors({ cursors }: { cursors: Record<string, RemoteCursor> }) {
  const { zoom } = useViewport();
  return (
    <ViewportPortal>
      {Object.entries(cursors).map(([id, c]) => (
        <div
          key={id}
          className="map-cursor pointer-events-none absolute top-0 left-0 z-50"
          style={{ transform: `translate(${c.x}px, ${c.y}px)` }}
        >
          <div style={{ transform: `scale(${1 / zoom})`, transformOrigin: "0 0" }}>
            <svg width="18" height="18" viewBox="0 0 18 18" fill={c.color} stroke="#0a0a0a" strokeWidth="1" aria-hidden>
              <path d="M2 1 L2 14 L5.5 10.8 L8 16 L10.4 14.9 L8 9.8 L13 9.6 Z" />
            </svg>
            <span
              className="ml-3.5 -mt-1 inline-block rounded-sm px-1.5 py-0.5 font-mono text-[10px] whitespace-nowrap text-black"
              style={{ background: c.color }}
            >
              {c.name}
            </span>
          </div>
        </div>
      ))}
    </ViewportPortal>
  );
}
