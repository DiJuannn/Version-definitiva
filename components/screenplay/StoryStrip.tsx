"use client";

import { useEffect, useRef } from "react";
import { BEATS, formatEighths } from "@/lib/screenplay/story";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { useWorkspace } from "@/components/screenplay/workspace";
import { SceneProgress } from "@/components/SceneProgress";
import type { ScreenplayProduction } from "@/lib/actions/screenplay-production";

export const isNightTime = (time: string) => /noche|night|atardecer|anochecer|dusk/i.test(time);

// La tira viva: todo el guion como una tira de película, un fotograma por
// escena con el ancho de lo que dura (octavos de página), si es de día o de
// noche y, si el guion está vinculado a un proyecto, cuánto tiene preparado
// para el rodaje. Encima, los momentos clave de la estructura.
export function StoryStrip({ production }: { production: ScreenplayProduction | null }) {
  const { scenes, currentSid, goToScene, maps } = useWorkspace();
  const beats = useYMap<string>(maps.beats);
  const scroller = useRef<HTMLDivElement>(null);

  // La escena actual siempre a la vista dentro de la tira.
  useEffect(() => {
    const el = scroller.current?.querySelector<HTMLElement>(`[data-sid="${currentSid}"]`);
    el?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [currentSid]);

  if (scenes.length === 0) return null;
  const total = scenes.reduce((n, s) => n + Math.max(1, s.eighths), 0);
  const unit = (s: (typeof scenes)[number]) => Math.max(1, s.eighths);

  // Momento clave: la escena elegida en Estructura o, si no, dónde debería ir.
  let acc = 0;
  const startOf = new Map<string, number>();
  for (const s of scenes) {
    startOf.set(s.sid, acc / total);
    acc += unit(s);
  }
  const marks = BEATS.map((b) => {
    const sid = beats[b.key];
    const placed = sid && startOf.has(sid);
    return { key: b.key, label: b.label, at: placed ? startOf.get(sid!)! : b.at, placed: Boolean(placed), row: 0 };
  }).sort((a, b) => a.at - b.at);
  // Dos momentos muy juntos no se pisan: el segundo sube una fila.
  const lastAt = [-1, -1];
  for (const m of marks) {
    m.row = m.at - lastAt[0] >= 0.12 ? 0 : m.at - lastAt[1] >= 0.12 ? 1 : 0;
    lastAt[m.row] = m.at;
  }
  const rows = marks.some((m) => m.row === 1) ? 2 : 1;

  return (
    <section aria-label="Tira del guion" className="mt-3">
      <div ref={scroller} className={`overflow-x-auto rounded-[6px] bg-[#1c1b19] px-2 pb-2.5 ${rows === 2 ? "pt-[32px]" : "pt-[18px]"}`}>
        <div className="relative min-w-full" style={{ width: `max(100%, ${scenes.length * 34}px)` }}>
          {/* Momentos clave, encima de la tira */}
          {marks.map((m) => (
            <span
              key={m.key}
              title={m.placed ? `${m.label}: escena elegida en Estructura` : `${m.label}: posición clásica (aún sin escena)`}
              className={`absolute -translate-x-px border-l pl-1 font-mono text-[10px] leading-none tracking-[0.1em] whitespace-nowrap uppercase ${
                m.placed ? "border-[#e3b25c] text-[#e3b25c]" : "border-dashed border-white/25 text-white/40"
              }`}
              style={{ left: `${m.at * 100}%`, top: m.row ? -30 : -16 }}
            >
              {m.label}
            </span>
          ))}
          {/* Perforaciones */}
          <span aria-hidden className="absolute inset-x-0 -top-[5px] h-[3px] bg-[repeating-linear-gradient(90deg,rgba(245,245,243,0.22)_0_5px,transparent_5px_11px)]" />
          <ol className="flex gap-[3px]">
            {scenes.map((s) => {
              const prod = production?.scenes[s.sid];
              const on = s.sid === currentSid;
              const night = isNightTime(s.time);
              return (
                <li key={s.sid} data-sid={s.sid} style={{ flexGrow: unit(s), flexBasis: 0 }} className="min-w-[30px]">
                  <button
                    type="button"
                    onClick={() => goToScene(s.sid)}
                    aria-current={on ? "true" : undefined}
                    title={`${s.number}. ${s.heading || "Sin encabezado"} · ${formatEighths(s.eighths)} pág.`}
                    className={`relative flex h-11 w-full flex-col justify-between overflow-hidden rounded-[3px] px-1.5 py-1 text-left transition-colors ${
                      on ? "bg-[#f5f5f3] text-[#1c1b19]" : "bg-[#2a2824] text-[#e9e6dd] hover:bg-[#35322c]"
                    }`}
                  >
                    <span className="flex items-start justify-between gap-1">
                      <span className="font-mono text-[11px] leading-none font-semibold">{s.number}</span>
                      {on && s.eighths > 0 && <span className="hidden font-mono text-[10px] leading-none opacity-70 lg:inline">{formatEighths(s.eighths)}</span>}
                    </span>
                    <span className="flex items-end justify-between gap-1">
                      <span aria-label={night ? "Noche" : "Día"} className="text-[11px] leading-none opacity-75">
                        {night ? "☾" : "☀"}
                      </span>
                      {prod && <SceneProgress status={prod.status} size={13} />}
                    </span>
                    <span aria-hidden className={`absolute inset-x-0 bottom-0 h-[2px] ${night ? "bg-[#5b6ba8]" : "bg-[#b9ac8e]"}`} />
                  </button>
                </li>
              );
            })}
          </ol>
          <span aria-hidden className="absolute inset-x-0 -bottom-[7px] h-[3px] bg-[repeating-linear-gradient(90deg,rgba(245,245,243,0.22)_0_5px,transparent_5px_11px)]" />
        </div>
      </div>
      <p className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 font-mono text-[10.5px] text-muted">
        <span>{scenes.length} escenas · ancho = páginas</span>
        <span>☀ día · ☾ noche</span>
        {production ? <span>círculo: desglose · planos · día · rodada</span> : <span>vincula un proyecto para ver lo preparado</span>}
      </p>
    </section>
  );
}
