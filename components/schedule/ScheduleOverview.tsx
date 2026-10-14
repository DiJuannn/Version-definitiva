import Link from "next/link";
import type { ScheduleData } from "@/lib/schedule-data";
import { computeDayTimeline, dayWarnings, formatHHMM, type PlanBlock } from "@/lib/schedule-plan";
import { SceneTag, sceneStripColor } from "@/components/SceneTag";

// Color de cada jornada en la vista de cobertura (se repite tras seis).
const DAY_TINTS = ["#a08fd0", "#6f9cf0", "#6cc58d", "#f29a6b", "#f0a6c8", "#d9d08f"];

function dayTimeline(day: ScheduleData["days"][number]) {
  return computeDayTimeline({ date: new Date(day.dateISO), callTime: day.callTime, prepMin: day.prepMin, blocks: day.blocks, lat: day.lat, lng: day.lng });
}

function filmed(blocks: PlanBlock[]) {
  return blocks.reduce((n, b) => n + b.shots.length + (b.scene ? 1 : 0), 0);
}

// Vista Calendario: cada jornada como una tira con los colores de lo que se
// rueda, horas, avisos y estado de la hoja; y la tarjeta de lo pendiente.
export function ScheduleCalendar({ projectId, data }: { projectId: string; data: ScheduleData }) {
  const pending = data.pool.shots.length + data.pool.scenes.length;
  return (
    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {data.days.map((day) => {
        const tl = dayTimeline(day);
        const count = filmed(day.blocks);
        const warns = dayWarnings(tl, { workdayHours: data.workdayHours, hasShots: count > 0 }).length + day.conflicts.length;
        const parts = day.blocks.flatMap((b) =>
          b.scene ? [{ c: sceneStripColor(b.scene.intExt, b.scene.dayPart), w: 3 }] : b.shots.map((s) => ({ c: sceneStripColor(s.intExt, s.dayPart), w: 1 })),
        );
        const done = day.blocks.reduce((n, b) => n + b.shots.filter((s) => s.done).length, 0);
        return (
          <Link
            key={day.id}
            href={`/app/${projectId}/plan-de-rodaje?dia=${day.id}`}
            className={`group rounded-xl border p-4 transition-[border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-accent/60 ${
              count === 0 ? "border-dashed border-line" : "border-line bg-bg-raised/40"
            }`}
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-base font-bold group-hover:text-accent">{day.title}</span>
              <span className="text-sm text-fg/80">{day.dateLabel}</span>
            </div>
            <p className="mt-1.5 truncate text-sm font-semibold">{day.locations.join(" · ") || <span className="font-normal text-muted">Sin localización</span>}</p>
            {parts.length > 0 ? (
              <div className="mt-3 flex h-4 gap-0.5 overflow-hidden rounded" aria-hidden>
                {parts.map((p, i) => (
                  <span key={i} style={{ background: p.c, flex: p.w }} />
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted">Sin planos todavía</p>
            )}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
              <span>
                <b className="font-mono font-medium text-fg">{count}</b> {count === 1 ? "plano" : "planos"}
                {done > 0 && <span className="text-success"> · {done} ✓</span>}
              </span>
              {count > 0 && (
                <span className="font-mono text-fg">
                  {tl.callTime !== null ? formatHHMM(tl.callTime) : "sin llamada"} → {formatHHMM(tl.wrap)}
                </span>
              )}
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {warns > 0 && <span className="rounded-full bg-warn/15 px-2.5 py-0.5 text-xs text-warn">{warns} aviso{warns === 1 ? "" : "s"}</span>}
              <span
                className={`rounded-full px-2.5 py-0.5 text-xs ${
                  day.sheet.outdated ? "bg-warn/15 text-warn" : day.sheet.shared ? "bg-success/15 text-success" : "bg-line text-fg/75"
                }`}
              >
                {day.sheet.outdated ? "Hoja desactualizada" : day.sheet.shared ? "Hoja compartida" : day.sheet.exists ? "Hoja sin compartir" : "Hoja sin generar"}
              </span>
            </div>
          </Link>
        );
      })}
      <div className={`rounded-xl border p-4 ${pending > 0 ? "border-warn/50" : "border-line"}`}>
        <div className="flex items-baseline justify-between">
          <span className={`text-base font-bold ${pending > 0 ? "text-warn" : "text-success"}`}>Por programar</span>
          <span className="text-sm text-muted">{pending}</span>
        </div>
        {pending === 0 ? (
          <p className="mt-2 text-[13px] text-muted">Todo tiene jornada.</p>
        ) : (
          <p className="mt-2 text-[13px] leading-relaxed">
            {data.pool.shots.slice(0, 18).map((s, i) => (
              <span key={s.id} className={s.retake ? "text-danger" : ""}>
                {i > 0 && " · "}
                {s.sceneNumber}.{s.number}
                {s.retake && " (repetir)"}
              </span>
            ))}
            {data.pool.shots.length > 18 && <span className="text-muted"> y {data.pool.shots.length - 18} más</span>}
            {data.pool.scenes.length > 0 && (
              <span className="text-muted">
                {data.pool.shots.length > 0 && " · "}
                {data.pool.scenes.length} escena{data.pool.scenes.length === 1 ? "" : "s"} sin lista de planos
              </span>
            )}
          </p>
        )}
      </div>
    </div>
  );
}

// Vista Cobertura: cada escena con todos sus planos y la jornada de cada uno.
// La pregunta que responde: "¿se nos queda algo sin rodar?".
export function ScheduleCoverage({ projectId, data }: { projectId: string; data: ScheduleData }) {
  const tint = new Map(data.days.map((d, i) => [d.id, DAY_TINTS[i % DAY_TINTS.length]]));
  const title = new Map(data.days.map((d) => [d.id, d.title]));
  const sceneDays = new Map<string, string[]>();
  for (const d of data.days) for (const b of d.blocks) if (b.scene) sceneDays.set(b.scene.id, [...(sceneDays.get(b.scene.id) ?? []), d.id]);

  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-line bg-bg-raised/30">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <thead>
          <tr className="bg-bg-raised text-left text-xs text-muted">
            <th scope="col" className="px-3 py-2.5 font-medium">Escena</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Planos y en qué jornada se ruedan</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Rodado</th>
            <th scope="col" className="px-3 py-2.5 font-medium">Estado</th>
          </tr>
        </thead>
        <tbody>
          {data.coverage.map((row) => {
            const scene = data.scenes[row.sceneId];
            if (!scene) return null;
            const total = row.shots.length;
            const done = row.shots.filter((s) => s.done).length;
            const noDay = row.shots.filter((s) => !s.dayId && !s.done).length;
            const retakes = row.shots.filter((s) => s.retake && !s.dayId).length;
            const wholeDays = sceneDays.get(scene.id) ?? [];
            let status: { text: string; cls: string };
            if (total === 0) {
              status = wholeDays.length > 0 ? { text: "Programada entera", cls: "bg-success/15 text-success" } : { text: "Sin día", cls: "bg-warn/15 text-warn" };
            } else if (done === total) status = { text: "Rodada", cls: "bg-success/15 text-success" };
            else if (retakes > 0) status = { text: `${retakes} a repetir${noDay - retakes > 0 ? ` · ${noDay - retakes} sin día` : ""}`, cls: "bg-danger/15 text-danger" };
            else if (noDay > 0) status = { text: `${noDay} sin día`, cls: "bg-warn/15 text-warn" };
            else status = { text: "Todo programado", cls: "bg-accent/15 text-fg" };
            return (
              <tr key={row.sceneId} className="border-t border-line/70">
                <td className="border-l-4 px-3 py-2.5" style={{ borderLeftColor: sceneStripColor(scene.intExt, scene.dayPart) }}>
                  <span className="flex flex-wrap items-center gap-2">
                    <span className="font-mono font-semibold">{scene.number}</span>
                    <SceneTag intExt={scene.intExt} dayPart={scene.dayPart} />
                    <span className="text-fg/85">{scene.location}</span>
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className="flex flex-wrap gap-1.5">
                    {total === 0 ? (
                      wholeDays.length > 0 ? (
                        wholeDays.map((d) => (
                          <Link key={d} href={`/app/${projectId}/plan-de-rodaje?dia=${d}`} className="inline-flex h-6 items-center rounded-md px-2 text-xs" style={{ background: `${tint.get(d)}2e` }}>
                            Entera · {title.get(d)}
                          </Link>
                        ))
                      ) : (
                        <span className="text-[13px] text-muted">Sin lista de planos</span>
                      )
                    ) : (
                      row.shots.map((s) =>
                        s.dayId ? (
                          <Link
                            key={s.id}
                            href={`/app/${projectId}/plan-de-rodaje?dia=${s.dayId}`}
                            className="inline-flex h-6 items-center gap-1 rounded-md px-2 text-xs hover:ring-1 hover:ring-accent"
                            style={{ background: `${tint.get(s.dayId)}2e` }}
                          >
                            <span className="font-mono">
                              {scene.number}.{s.number}
                            </span>
                            {title.get(s.dayId)}
                            {s.done && <span className="text-success">✓</span>}
                          </Link>
                        ) : s.done ? (
                          <span key={s.id} className="inline-flex h-6 items-center gap-1 rounded-md bg-success/10 px-2 text-xs">
                            <span className="font-mono">
                              {scene.number}.{s.number}
                            </span>
                            <span className="text-success">✓</span>
                          </span>
                        ) : (
                          <span
                            key={s.id}
                            className={`inline-flex h-6 items-center gap-1 rounded-md border px-2 text-xs ${s.retake ? "border-danger/60 text-danger" : "border-warn/60 text-warn"}`}
                          >
                            <span className="font-mono">
                              {scene.number}.{s.number}
                            </span>
                            {s.retake ? "Repetir" : "Sin día"}
                          </span>
                        ),
                      )
                    )}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  {total > 0 && (
                    <span className="flex items-center gap-2 text-xs text-muted">
                      <span className="h-1.5 w-16 overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-success" style={{ width: `${Math.round((done / total) * 100)}%` }} />
                      </span>
                      {done}/{total}
                    </span>
                  )}
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex h-6 items-center rounded-full px-2.5 text-xs whitespace-nowrap ${status.cls}`}>{status.text}</span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
