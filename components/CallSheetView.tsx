import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { ShootingDaySummary } from "@/lib/shooting-day-summary";
import { ChipOption } from "@/components/ChipOption";
import { SubmitButton } from "@/components/SubmitButton";
import {
  clearCallSheetCrewOverride,
  clearSceneCastOverride,
  updateCallSheetCrew,
  updateSceneCallTime,
  updateSceneCastOverride,
} from "@/lib/actions/call-sheets";

type EditContext = {
  projectId: string;
  shootingDayId: string;
  allCharacters: { id: string; name: string }[];
  allCrewMembers: { id: string; name: string; role: string | null }[];
};

// La hoja del call sheet. La usan la pantalla del proyecto (con `edit`, para
// poder corregir a mano quién sale citado y a qué hora) y el enlace público
// /hoja/[token] (sin `edit` — de solo lectura, y sin teléfonos ni correos).
export function CallSheetView({
  projectName,
  summary,
  edit,
}: {
  projectName: string;
  summary: ShootingDaySummary;
  edit?: EditContext;
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
          {summary.locations.length === 0 ? (
            <p className="mt-1 font-mono text-sm">—</p>
          ) : (
            summary.locations.map((l) => (
              <p key={l.id} className="mt-1 font-mono text-sm">
                {l.name}
                {l.address ? <span className="text-muted"> — {l.address}</span> : ""}
              </p>
            ))
          )}
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
            summary.sceneAssignments.map((assignment) => {
              const sceneCharacters = summary.charactersByAssignment.get(assignment.id) ?? [];
              const isOverridden = summary.overriddenSceneIds.has(assignment.sceneId);
              const selectedIds = new Set(sceneCharacters.map((c) => c.character.id));
              return (
                <div key={assignment.id} className="border-b border-line py-3">
                  <div className="grid grid-cols-[auto_1fr_auto] items-baseline gap-4">
                    {edit ? (
                      <form
                        action={updateSceneCallTime.bind(null, edit.projectId, edit.shootingDayId, assignment.id)}
                        className="flex items-center gap-1"
                      >
                        <input
                          name="callTime"
                          defaultValue={assignment.callTime ?? ""}
                          placeholder="—"
                          className="w-14 border border-transparent bg-transparent font-mono text-sm outline-none transition-colors hover:border-line focus:border-accent"
                        />
                        <button
                          type="submit"
                          className="font-mono text-[10px] text-muted transition-colors hover:text-accent"
                          aria-label="Guardar hora"
                        >
                          ✓
                        </button>
                      </form>
                    ) : (
                      <span className="font-mono text-sm">{assignment.callTime ?? "—"}</span>
                    )}
                    <span className="font-mono text-sm">
                      Escena {assignment.scene.number} —{" "}
                      {INT_EXT_LABELS[assignment.scene.intExt]}{" "}
                      {DAY_PART_LABELS[assignment.scene.dayPart]}
                      {assignment.scene.location
                        ? ` · ${assignment.scene.location.name}`
                        : ""}
                    </span>
                    <span className="font-mono text-xs text-muted">
                      {sceneCharacters.map((c) => c.character.name).join(", ")}
                      {isOverridden && <span className="ml-1.5 text-accent">(editado)</span>}
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
                  {edit && (
                    <details className="mt-2 print:hidden">
                      <summary className="cursor-pointer font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent">
                        Corregir a mano quién sale en esta escena
                      </summary>
                      <form
                        action={updateSceneCastOverride.bind(null, edit.projectId, edit.shootingDayId, assignment.sceneId)}
                        className="mt-2 flex flex-wrap items-center gap-2"
                      >
                        {edit.allCharacters.map((character) => (
                          <ChipOption
                            key={character.id}
                            type="checkbox"
                            name="characterIds"
                            value={character.id}
                            label={character.name}
                            defaultChecked={selectedIds.has(character.id)}
                          />
                        ))}
                        <SubmitButton
                          pendingLabel="Guardando…"
                          savedLabel="✓ Guardado"
                          className="btn btn-secondary btn-sm"
                        >
                          Guardar
                        </SubmitButton>
                      </form>
                      {isOverridden && (
                        <form
                          action={clearSceneCastOverride.bind(null, edit.projectId, edit.shootingDayId, assignment.sceneId)}
                          className="mt-1.5"
                        >
                          <button type="submit" className="link-action font-mono text-[10px] tracking-widest uppercase">
                            Quitar corrección, volver a lo automático
                          </button>
                        </form>
                      )}
                    </details>
                  )}
                </div>
              );
            })
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
            {summary.crewOverridden && <span className="ml-1.5 text-accent">(editado)</span>}
          </p>
          <p className="mt-1 font-mono text-sm">
            {summary.crewMembers.map((c) => c.name).join(", ") || "—"}
          </p>
          {edit && (
            <details className="mt-2 print:hidden">
              <summary className="cursor-pointer font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent">
                Corregir a mano
              </summary>
              <form
                action={updateCallSheetCrew.bind(null, edit.projectId, edit.shootingDayId)}
                className="mt-2 flex flex-wrap items-center gap-2"
              >
                {edit.allCrewMembers.map((member) => (
                  <ChipOption
                    key={member.id}
                    type="checkbox"
                    name="crewMemberIds"
                    value={member.id}
                    label={member.role ? `${member.name} (${member.role})` : member.name}
                    defaultChecked={summary.crewMembers.some((c) => c.id === member.id)}
                  />
                ))}
                <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-secondary btn-sm">
                  Guardar
                </SubmitButton>
              </form>
              {summary.crewOverridden && (
                <form action={clearCallSheetCrewOverride.bind(null, edit.projectId, edit.shootingDayId)} className="mt-1.5">
                  <button type="submit" className="link-action font-mono text-[10px] tracking-widest uppercase">
                    Quitar corrección, volver a lo automático
                  </button>
                </form>
              )}
            </details>
          )}
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
