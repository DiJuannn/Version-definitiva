"use client";

import { useEffect, useState } from "react";
import type { HealthMetric } from "@/lib/project-roadmap";

const RADIUS = 22;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

function MiniRing({ ratio }: { ratio: number | null }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    const id = requestAnimationFrame(() => setMounted(true));
    return () => cancelAnimationFrame(id);
  }, []);

  // ratio === null significa "todavía no aplica" (p.ej. 0 personajes en
  // total), no "0% completado" — un anillo relleno al 0% diría "vas mal"
  // cuando en realidad es "aún no has empezado". Se distingue con un
  // trazo discontinuo en vez de un relleno real.
  if (ratio === null) {
    return (
      <svg viewBox="0 0 52 52" className="h-11 w-11">
        <circle
          cx="26"
          cy="26"
          r={RADIUS}
          fill="none"
          stroke="var(--line)"
          strokeWidth="4"
          strokeDasharray="3 5"
        />
      </svg>
    );
  }

  const clamped = Math.min(ratio, 1);
  const offset = CIRCUMFERENCE * (1 - (mounted ? clamped : 0));

  return (
    <svg viewBox="0 0 52 52" className="h-11 w-11 -rotate-90">
      <circle cx="26" cy="26" r={RADIUS} fill="none" stroke="var(--line)" strokeWidth="4" />
      <circle
        cx="26"
        cy="26"
        r={RADIUS}
        fill="none"
        stroke="var(--accent)"
        strokeWidth="4"
        strokeLinecap="round"
        strokeDasharray={CIRCUMFERENCE}
        strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 900ms cubic-bezier(0.16,1,0.3,1)" }}
      />
    </svg>
  );
}

export function ProjectHealthMini({ metrics }: { metrics: HealthMetric[] }) {
  return (
    <div className="mt-6 border border-line p-4">
      <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
        Salud del proyecto
      </p>
      <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
        {metrics.map((metric) => (
          <div key={metric.key} className="flex items-center gap-3">
            <div className="relative flex h-11 w-11 shrink-0 items-center justify-center">
              <MiniRing ratio={metric.ratio} />
              <span className="absolute font-mono text-[9px] font-bold text-fg data-[empty=true]:text-muted/50" data-empty={metric.ratio === null}>
                {metric.ratio !== null ? `${Math.round(metric.ratio * 100)}%` : "N/A"}
              </span>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-wide text-muted">
                {metric.label}
              </p>
              <p className="font-mono text-[10px] text-muted/70">{metric.detail}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
