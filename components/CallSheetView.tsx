import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { ShootingDaySummary } from "@/lib/shooting-day-summary";

// La hoja del call sheet (solo lectura). La usan la pantalla del proyecto y el
// enlace público /hoja/[token], para que las dos muestren exactamente lo mismo.
export function CallSheetView({
  projectName,
  summary,
}: {
  projectName: string;
  summary: ShootingDaySummary;
}) {
  const callSheet = summary.shootingDay.callSheet;

  return (
    <div className="mt-6 border border-line bg-bg-raised/40 p-6 sm:p-10">
      <div className="flex items-baseline justify-between gap-4 border-b border-accent/40 pb-5">
        <div>
          <p className="font-mono text-xs tracking-widest text-accent uppercase">
            Call sheet
          </p>
          <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight uppercase sm:text-4xl">
            {projectName}
          </h1>
        </div>
        <p className="font-mono text-sm">
          {summary.shootingDay.date.toLocaleDateString("es-ES", {
            weekday: "long",
            day: "2-digit",
            month: "long",
            year: "numeric",
          })}
        </p>
      </div>

      <div className="mt-6 grid gap-6 sm:grid-cols-2">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Hora general de llamada
          </p>
          <p className="mt-1 font-mono text-sm">
            {callSheet?.generalCallTime ?? "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Localizaciones
          </p>
          <p className="mt-1 font-mono text-sm">
            {summary.locations.map((l) => l.name).join(", ") || "—"}
          </p>
        </div>
      </div>

      <div className="mt-8">
        <p className="font-mono text-xs tracking-widest text-accent uppercase">
          Escenas
        </p>
        <div className="mt-3 border-t border-line">
          {summary.sceneAssignments.length === 0 ? (
            <p className="py-4 font-mono text-sm text-muted">
              Sin escenas asignadas todavía.
            </p>
          ) : (
            summary.sceneAssignments.map((assignment) => (
              <div key={assignment.id} className="border-b border-line py-3">
                <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4">
                  <span className="font-mono text-sm">
                    {assignment.callTime ?? "—"}
                  </span>
                  <span className="font-mono text-sm">
                    Escena {assignment.scene.number} —{" "}
                    {INT_EXT_LABELS[assignment.scene.intExt]}{" "}
                    {DAY_PART_LABELS[assignment.scene.dayPart]}
                    {assignment.scene.location
                      ? ` · ${assignment.scene.location.name}`
                      : ""}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {assignment.scene.characters.map((c) => c.character.name).join(", ")}
                  </span>
                </div>
                {assignment.scene.shots.length > 0 && (
                  <ul className="mt-2 space-y-1 pl-4">
                    {assignment.scene.shots.map((shot) => (
                      <li key={shot.id} className="grid grid-cols-[3.5rem_3rem_1fr] gap-3 font-mono text-xs">
                        <span className="text-accent">
                          {assignment.scene.number}.{shot.number}
                        </span>
                        <span className="uppercase">{shot.shotSize ?? "—"}</span>
                        <span className="text-muted">
                          {[shot.description, shot.movement].filter(Boolean).join(" · ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))
          )}
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Cast
          </p>
          <p className="mt-1 font-mono text-sm">
            {summary.characters
              .map((c) => `${c.name}${c.actor ? ` (${c.actor.name})` : ""}`)
              .join(", ") || "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Equipo técnico
          </p>
          <p className="mt-1 font-mono text-sm">
            {summary.crewMembers.map((c) => c.name).join(", ") || "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Atrezzo / equipo
          </p>
          <p className="mt-1 font-mono text-sm">
            {summary.breakdownElements.map((b) => b.name).join(", ") || "—"}
          </p>
        </div>
      </div>

      <div className="mt-8 grid gap-6 sm:grid-cols-3">
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Transporte
          </p>
          <p className="mt-1 font-mono text-sm">
            {callSheet?.transportNotes ?? "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Catering
          </p>
          <p className="mt-1 font-mono text-sm">
            {callSheet?.cateringNotes ?? "—"}
          </p>
        </div>
        <div>
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Notas adicionales
          </p>
          <p className="mt-1 font-mono text-sm">
            {callSheet?.additionalNotes ?? "—"}
          </p>
        </div>
      </div>
    </div>
  );
}
