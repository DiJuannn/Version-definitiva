"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { FirstStep } from "@/lib/first-steps";

// Primeros pasos del proyecto: los cinco que llevan del guion al rodaje, en
// orden. Los hechos se tachan solos; el siguiente lleva su botón. Se puede
// ocultar (se recuerda en este navegador) y desaparece cuando están todos.
export function FirstSteps({ projectId, steps }: { projectId: string; steps: FirstStep[] }) {
  const key = `first-steps-hidden:${projectId}`;
  const [hidden, setHidden] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setHidden(localStorage.getItem(key) === "1");
    } catch {}
  }, [key]);

  const done = steps.filter((s) => s.done).length;
  if (done === steps.length) return null;
  const next = steps.findIndex((s) => !s.done);

  if (hidden) {
    return (
      <p className="mt-10 font-sans text-[13px] text-muted">
        Primeros pasos: {done} de {steps.length}.{" "}
        <button
          type="button"
          onClick={() => {
            setHidden(false);
            try {
              localStorage.removeItem(key);
            } catch {}
          }}
          className="text-accent hover:underline"
        >
          Mostrar
        </button>
      </p>
    );
  }

  return (
    <section aria-labelledby="primeros-pasos" className="mt-12">
      <div className="flex flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 id="primeros-pasos" className="poster-sub text-[30px]">
          Primeros pasos
        </h2>
        <span className="font-sans text-[14px] text-muted">
          {done} de {steps.length} · se tachan solos cuando los haces
        </span>
        <button
          type="button"
          onClick={() => {
            setHidden(true);
            try {
              localStorage.setItem(key, "1");
            } catch {}
          }}
          className="ml-auto font-sans text-[13px] text-muted hover:text-fg"
        >
          Ocultar
        </button>
      </div>
      <ol className="mt-5 grid gap-px overflow-hidden rounded-lg border border-line bg-line sm:grid-cols-5">
        {steps.map((s, i) => {
          const isNext = i === next;
          return (
            <li key={s.key} className={`flex flex-col bg-bg p-4 ${isNext ? "bg-bg-raised" : ""}`}>
              <div className="flex items-center gap-2.5">
                <span
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-sans text-[13px] font-bold ${
                    s.done ? "bg-[var(--phase-4)] text-[#0d0d10]" : isNext ? "bg-accent text-bg" : "border border-line text-muted"
                  }`}
                >
                  {s.done ? "✓" : i + 1}
                </span>
                <span className={`font-sans text-[15px] font-semibold ${s.done ? "text-muted line-through decoration-1" : ""}`}>{s.title}</span>
              </div>
              <p className={`mt-2 flex-1 font-sans text-[13px] leading-snug ${s.done ? "text-muted/70" : "text-muted"}`}>{s.why}</p>
              {s.detail && <p className="mt-2 font-mono text-[10.5px] tracking-wider text-muted uppercase">{s.detail}</p>}
              {isNext ? (
                <Link href={s.href} className="btn btn-primary btn-sm mt-3 self-start">
                  {s.cta} →
                </Link>
              ) : (
                !s.done && (
                  <Link href={s.href} className="mt-3 self-start font-sans text-[13px] text-accent hover:underline">
                    {s.cta} →
                  </Link>
                )
              )}
            </li>
          );
        })}
      </ol>
    </section>
  );
}
