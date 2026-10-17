"use client";

import { useMemo } from "react";
import Link from "next/link";
import { SCENE_STEPS } from "@/lib/scene-status";
import { formatDuration, formatPagesEighths, scriptLength } from "@/lib/screenplay/layout";
import { isNightTime } from "@/lib/screenplay/moments";
import { useWorkspace } from "@/components/screenplay/workspace";
import { plural, screenTime } from "@/components/screenplay/editor-chrome";
import type { ScreenplayProduction } from "@/lib/actions/screenplay-production";

// Una página de guion es un minuto de pantalla; una jornada de corto rueda
// unas 4-5 páginas. Sirve de estimación mientras el proyecto no tiene plan.
const PAGES_PER_DAY = 4.5;

// Lo que ya está preparado de cada escena, dicho para quien no ha rodado
// nunca (el término de producción va pequeño al lado).
const STEP_PLAIN: Record<string, string> = {
  broken: "Lo que hace falta, apuntado",
  planned: "Planos pensados",
  scheduled: "Tiene día de rodaje",
  shot: "Ya rodada",
};

function Split({ a, b, la, lb, tech }: { a: number; b: number; la: string; lb: string; tech?: string }) {
  const t = a + b || 1;
  return (
    <div className="border-t border-[var(--line)] p-3 even:border-l">
      <p className="text-[22px] leading-none font-black tracking-tight">
        {a} <span className="text-muted">/</span> {b}
      </p>
      <p className="mt-1 text-[12px] text-muted">
        {la} / {lb} {tech && <span className="text-[10.5px] text-muted/80">· {tech}</span>}
      </p>
      <div aria-hidden className="mt-2 flex h-1 overflow-hidden rounded-full bg-black/10">
        <span className="bg-[#1c1b19]" style={{ width: `${(a / t) * 100}%` }} />
      </div>
    </div>
  );
}

// «Rodaje» (antes «Radiografía»): cuánto dura lo escrito y lo que costaría
// rodarlo, y lo que el proyecto ya sabe de la escena en la que está el cursor.
export function Radiography({ production, onOpenSettings }: { production: ScreenplayProduction | null; onOpenSettings?: () => void }) {
  const { blocks, scenes, currentSid, linkedProject } = useWorkspace();
  // La misma medida que la barra y el PDF (M6).
  const length = useMemo(() => scriptLength(blocks), [blocks]);
  const places = new Set(scenes.map((s) => s.place.trim().toLowerCase()).filter(Boolean));
  const ext = scenes.filter((s) => /^\s*(ext|exterior)/i.test(s.heading)).length;
  const night = scenes.filter((s) => isNightTime(s.time)).length;
  const realDays = production?.days.count ?? 0;
  const estDays = Math.max(1, Math.ceil(length.eighths / 8 / PAGES_PER_DAY));
  const days = realDays || estDays;
  const current = scenes.find((s) => s.sid === currentSid) ?? null;
  const prod = current ? production?.scenes[current.sid] : undefined;
  const minutes = Math.floor(length.seconds / 60);

  return (
    <div className="space-y-6 font-[family-name:var(--font-archivo)]">
      <section>
        <p className="sp-label">Cuánto dura</p>
        {length.seconds === 0 ? (
          <p className="mt-2 text-[13.5px] leading-relaxed text-muted">Cuando escribas, aquí verás cuánto duraría en pantalla y cuánto costaría rodarlo.</p>
        ) : (
          <>
            <p className="mt-1.5 flex items-baseline gap-1.5" aria-label={`${formatDuration(length.seconds)} en pantalla`}>
              {minutes > 0 && (
                <>
                  <span className="text-[44px] leading-none font-black tracking-tight">{minutes}</span>
                  <span className="mr-1 text-[15px] text-muted">min</span>
                </>
              )}
              <span className="text-[44px] leading-none font-black tracking-tight">{minutes > 0 ? String(length.seconds % 60).padStart(2, "0") : length.seconds}</span>
              <span className="text-[15px] text-muted">s</span>
            </p>
            <p className="mt-1 text-[12.5px] leading-snug text-muted">
              en pantalla, más o menos · {length.pagesLabel} <span className="text-[11px]">(1 página ≈ 1 minuto)</span>
            </p>
          </>
        )}
      </section>

      {scenes.length > 0 && (
        <section>
          <p className="sp-label">Lo que cuesta rodarlo</p>
          <div className="mt-2 grid grid-cols-2 overflow-hidden rounded-lg border border-[var(--line)] bg-white">
            <div className="p-3">
              <p className="text-[22px] leading-none font-black tracking-tight">
                {days} <span className="text-[13px] font-semibold text-muted">{days === 1 ? "día" : "días"}</span>
              </p>
              <p className="mt-1 text-[12px] text-muted">{realDays ? "de rodaje en el plan" : "de rodaje, calculados"}</p>
            </div>
            <div className="border-l border-[var(--line)] p-3">
              <p className="text-[22px] leading-none font-black tracking-tight">{places.size}</p>
              <p className="mt-1 text-[12px] text-muted">
                {places.size === 1 ? "sitio donde rodar" : "sitios donde rodar"} <span className="text-[10.5px]">· localizaciones</span>
              </p>
            </div>
            <Split a={scenes.length - ext} b={ext} la="Dentro" lb="fuera" tech="INT. / EXT." />
            <Split a={scenes.length - night} b={night} la="De día" lb="de noche" />
          </div>
          <p className="mt-2 text-[12px] leading-snug text-muted">
            {realDays
              ? "Los días salen del plan de rodaje del proyecto."
              : `Calculado a unas ${String(PAGES_PER_DAY).replace(".", ",")} páginas por día.`}{" "}
            Cada sitio distinto, rodar fuera y rodar de noche suelen sumar tiempo y permisos.
          </p>
        </section>
      )}

      {current && (
        <section>
          <p className="sp-label">Esta escena</p>
          <p className="mt-1.5 font-[family-name:var(--font-courier)] text-[13.5px] leading-snug font-bold uppercase">
            {current.number}. {current.heading || "Sin lugar ni hora"}
          </p>
          <p className="mt-1 text-[12.5px] text-muted" title={`${formatPagesEighths(current.eighths)} de página (octavos, como en producción)`}>
            {screenTime(current.eighths)} en pantalla
            {current.speakers.length > 0 && ` · hablan ${current.speakers.slice(0, 4).join(", ")}`}
          </p>

          {prod ? (
            <>
              <ul className="mt-3 grid grid-cols-2 gap-1.5 text-[12.5px]">
                {SCENE_STEPS.map((step) => (
                  <li key={step.key} className={`flex items-center gap-1.5 ${prod.status[step.key] ? "" : "text-muted"}`} title={step.label}>
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: prod.status[step.key] ? step.color : "transparent", boxShadow: "inset 0 0 0 1px rgba(28,27,25,0.45)" }}
                    />
                    <span>
                      {STEP_PLAIN[step.key] ?? step.label}
                      {step.key === "planned" && prod.shots > 0 && ` · ${prod.shots}`}
                      {step.key === "scheduled" && prod.days.length > 0 && ` · ${prod.days.join(", ")}`}
                      <span className="sr-only">{prod.status[step.key] ? " (sí)" : " (aún no)"}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="sp-label mt-4">
                Lo que hace falta para rodarla <span className="tracking-normal normal-case">· desglose</span>
              </p>
              {prod.breakdown.length > 0 ? (
                <ul className="mt-1.5 divide-y divide-[var(--line)] rounded-lg border border-[var(--line)] bg-white">
                  {prod.breakdown.map((b) => (
                    <li key={b.category + b.name} className="flex items-center justify-between gap-3 px-3 py-2 text-[13px]">
                      <span>{b.name}</span>
                      <span className="text-[11.5px] text-muted">{b.category}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1.5 text-[13px] leading-snug text-muted">
                  Aún no hay nada apuntado: objetos, vestuario, vehículos… se apuntan en el Desglose del proyecto.
                </p>
              )}
              <Link
                href={`/app/${production!.projectId}/desglose?escena=${prod.sceneId}`}
                className="mt-3 inline-block text-[13px] font-semibold text-[var(--accent)] hover:underline"
              >
                Abrir en el desglose →
              </Link>
            </>
          ) : linkedProject ? (
            <p className="mt-3 text-[13px] leading-snug text-muted">
              Esta escena aún no está en {linkedProject.name}. Pasa sola al proyecto unos segundos después de escribir su lugar y hora.
            </p>
          ) : (
            <div className="mt-3 rounded-lg border border-dashed border-[var(--line)] bg-white/60 p-3">
              <p className="text-[13px] leading-snug">
                ¿Lo vas a rodar? Vincula el guion a un proyecto y aquí verás qué hace falta en cada escena, sus planos y qué día se rueda.
              </p>
              {onOpenSettings && (
                <button type="button" onClick={onOpenSettings} className="sp-btn mt-2.5">
                  Vincular a un proyecto
                </button>
              )}
            </div>
          )}
        </section>
      )}
      {!current && scenes.length > 0 && (
        <p className="text-[12.5px] text-muted">{plural(scenes.length, "escena", "escenas")} · pon el cursor en una para ver lo suyo.</p>
      )}
    </div>
  );
}
