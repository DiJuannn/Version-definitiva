"use client";

import Link from "next/link";
import { formatHHMM, type DayTimeline, type PlanWarning } from "@/lib/schedule-plan";
import { PersonInitials } from "@/components/PersonInitials";
import type { EditorApi } from "@/components/schedule/ScheduleEditor";

// Columna derecha de la jornada: avisos, a quién citar y a qué hora (sale
// del orden de rodaje) y cómo queda cada escena en esta jornada.
export function ScheduleSide({
  api,
  timeline,
  warnings,
  prepMin,
}: {
  api: EditorApi;
  timeline: DayTimeline;
  warnings: PlanWarning[];
  prepMin: number;
}) {
  const day = api.data.days.find((d) => d.id === api.dayId)!;
  const people = [...timeline.characterWindows.entries()]
    .map(([id, w]) => ({ id, ...w, ...api.data.characters[id] }))
    .filter((p) => p.name)
    .sort((a, b) => a.first - b.first);

  // Escenas de la jornada: completas aquí o repartidas.
  const sceneIds = new Set<string>();
  for (const b of api.blocks) {
    if (b.scene) sceneIds.add(b.scene.id);
    for (const s of b.shots) sceneIds.add(s.sceneId);
  }
  const scenes = [...sceneIds].map((id) => {
    const cov = api.data.coverage.find((c) => c.sceneId === id);
    const here = api.blocks.reduce((n, b) => n + b.shots.filter((s) => s.sceneId === id).length, 0);
    return { id, number: api.data.scenes[id]?.number ?? "?", total: cov?.shots.length ?? 0, here };
  });

  return (
    <aside aria-label="Resumen de la jornada" className="space-y-3 xl:sticky xl:top-36">
      <section className="rounded-xl border border-line bg-bg-raised/30 p-3.5">
        <h2 className="text-sm font-bold">
          Avisos <span className={`font-normal ${warnings.length ? "text-warn" : "text-success"}`}>{warnings.length || "· todo bien"}</span>
        </h2>
        {warnings.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Sin problemas detectados en esta jornada.</p>
        ) : (
          <ul className="mt-2 space-y-2.5">
            {warnings.map((w) => (
              <li key={w.id} className="grid grid-cols-[0.9rem_1fr] gap-2 text-[13px]">
                <span aria-hidden className={w.tone === "danger" ? "text-danger" : "text-warn"}>
                  ▲
                </span>
                <span>
                  {w.text}
                  {w.detail && <span className="mt-0.5 block text-xs text-muted">{w.detail}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-xl border border-line bg-bg-raised/30 p-3.5">
        <h2 className="text-sm font-bold">Reparto: a qué hora citarlo</h2>
        {people.length === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Nadie del reparto en esta jornada todavía.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {people.map((p) => {
              const call = Math.max(p.first - prepMin, timeline.callTime ?? p.first - prepMin);
              return (
                <li key={p.id} className="grid grid-cols-[1.75rem_1fr_auto] items-center gap-2 text-[13px]">
                  <PersonInitials name={p.name} />
                  <span className="min-w-0">
                    <span className="block truncate">{p.name}</span>
                    {p.actor && <span className="block truncate text-xs text-muted">{p.actor}</span>}
                  </span>
                  <span className="text-right font-mono text-xs">
                    <span className="block text-fg">{formatHHMM(call)}</span>
                    <span className="text-muted">hasta {formatHHMM(p.last)}</span>
                  </span>
                </li>
              );
            })}
          </ul>
        )}
        <p className="mt-2 text-xs text-muted">Citación = su primer plano menos la preparación.</p>
      </section>

      {scenes.length > 0 && (
        <section className="rounded-xl border border-line bg-bg-raised/30 p-3.5">
          <h2 className="text-sm font-bold">Escenas de esta jornada</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {scenes.map((s) => (
              <span
                key={s.id}
                className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs ${
                  s.total === 0 || s.here === s.total ? "bg-accent/15 text-fg" : "bg-warn/15 text-warn"
                }`}
              >
                Esc. {s.number} · {s.total === 0 ? "entera" : s.here === s.total ? "completa" : `${s.here} de ${s.total} planos`}
              </span>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-xl border border-line bg-bg-raised/30 p-3.5">
        <h2 className="text-sm font-bold">Hoja de llamada</h2>
        <p className={`mt-1 text-[13px] ${day.sheet.outdated ? "text-warn" : "text-muted"}`}>
          {!day.sheet.exists
            ? "Aún sin generar: sale de este orden de rodaje."
            : day.sheet.outdated
              ? "Compartida antes del último cambio: revísala."
              : day.sheet.shared
                ? "Compartida con el equipo y al día."
                : "Generada, sin compartir."}
        </p>
        <Link href={`/app/${api.projectId}/call-sheets/${api.dayId}`} className="btn btn-outline btn-sm mt-2.5">
          Ver hoja de llamada
        </Link>
      </section>
    </aside>
  );
}
