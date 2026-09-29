"use client";

import { useRef, useState } from "react";
import { roundShape, simplifyPath, type Shape } from "@/lib/domain/annotation";

export type Tool = "pen" | "arrow" | "rect" | "ellipse" | "point";

function shapeEl(s: Shape, W: number, H: number, key: string | number) {
  const sw = Math.max(1.5, s.w * W);
  const P = s.pts.map(([x, y]) => [x * W, y * H] as const);
  const common = { stroke: s.color, strokeWidth: sw, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  switch (s.t) {
    case "pen":
      return <polyline key={key} points={P.map((p) => p.join(",")).join(" ")} {...common} />;
    case "rect": {
      const [a, b] = [P[0], P[P.length - 1]];
      return <rect key={key} x={Math.min(a[0], b[0])} y={Math.min(a[1], b[1])} width={Math.abs(b[0] - a[0])} height={Math.abs(b[1] - a[1])} {...common} />;
    }
    case "ellipse": {
      const [a, b] = [P[0], P[P.length - 1]];
      return <ellipse key={key} cx={(a[0] + b[0]) / 2} cy={(a[1] + b[1]) / 2} rx={Math.abs(b[0] - a[0]) / 2} ry={Math.abs(b[1] - a[1]) / 2} {...common} />;
    }
    case "arrow": {
      const [a, b] = [P[0], P[P.length - 1]];
      const ang = Math.atan2(b[1] - a[1], b[0] - a[0]);
      const head = Math.max(10, sw * 4);
      const h1 = [b[0] - head * Math.cos(ang - 0.45), b[1] - head * Math.sin(ang - 0.45)];
      const h2 = [b[0] - head * Math.cos(ang + 0.45), b[1] - head * Math.sin(ang + 0.45)];
      return (
        <g key={key}>
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} {...common} />
          <polyline points={`${h1.join(",")} ${b.join(",")} ${h2.join(",")}`} {...common} />
        </g>
      );
    }
    case "point": {
      const [a] = P;
      const r = Math.max(8, W * 0.018);
      return (
        <g key={key}>
          <circle cx={a[0]} cy={a[1]} r={r} fill="none" stroke={s.color} strokeWidth={sw} />
          <circle cx={a[0]} cy={a[1]} r={Math.max(2.5, sw)} fill={s.color} />
        </g>
      );
    }
  }
}

/** Dibuja formas normalizadas sobre el área real de la imagen (W×H en px). */
export function ShapesSvg({ shapes, width, height, className }: { shapes: Shape[]; width: number; height: number; className?: string }) {
  if (!width || !height) return null;
  return (
    <svg className={className} width={width} height={height} viewBox={`0 0 ${width} ${height}`} aria-hidden style={{ filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.55))" }}>
      {shapes.map((s, i) => shapeEl(s, width, height, i))}
    </svg>
  );
}

/**
 * Superficie de dibujo. Se coloca EXACTAMENTE sobre el área de imagen, así las
 * coordenadas se calculan con su getBoundingClientRect (válido con zoom/escala).
 */
export function DrawingSurface({
  width,
  height,
  tool,
  color,
  shapes,
  onAdd,
}: {
  width: number;
  height: number;
  tool: Tool;
  color: string;
  shapes: Shape[];
  onAdd: (s: Shape) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [draft, setDraft] = useState<Shape | null>(null);

  const norm = (e: React.PointerEvent): [number, number] => {
    const r = ref.current!.getBoundingClientRect();
    return [(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height];
  };

  return (
    <div
      ref={ref}
      className="absolute inset-0 cursor-crosshair touch-none"
      role="application"
      aria-label="Zona de dibujo sobre el vídeo"
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.currentTarget.setPointerCapture(e.pointerId);
        const p = norm(e);
        const s: Shape = { t: tool, color, w: 0.0045, pts: tool === "point" ? [p] : [p, p] };
        if (tool === "point") {
          onAdd(roundShape(s));
          return;
        }
        setDraft(s);
      }}
      onPointerMove={(e) => {
        if (!draft) return;
        const p = norm(e);
        setDraft(draft.t === "pen" ? { ...draft, pts: [...draft.pts, p] } : { ...draft, pts: [draft.pts[0], p] });
      }}
      onPointerUp={() => {
        if (!draft) return;
        const [a, b] = [draft.pts[0], draft.pts[draft.pts.length - 1]];
        const big = draft.t === "pen" ? draft.pts.length > 2 : Math.hypot(b[0] - a[0], b[1] - a[1]) > 0.01;
        if (big) onAdd(roundShape(draft.t === "pen" ? { ...draft, pts: simplifyPath(draft.pts) } : draft));
        setDraft(null);
      }}
      onPointerCancel={() => setDraft(null)}
    >
      <ShapesSvg shapes={draft ? [...shapes, draft] : shapes} width={width} height={height} className="pointer-events-none absolute inset-0" />
      <div className="pointer-events-none absolute inset-0 ring-2 ring-marker/70 ring-inset" />
    </div>
  );
}
