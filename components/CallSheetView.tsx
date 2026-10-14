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
  const dateLabel = summary.shootingDay.date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    // Un documento: siempre papel (también en el enlace público, que va sobre
    // fondo oscuro, y al imprimir). Dentro solo hay líneas y espacio.
    <article className="taller-paper sheet p-6 text-fg sm:p-10 print:rounded-none print:p-0 print:shadow-none">
      <header className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3 border-b-2 border-fg pb-5">
        <div className="min-w-0">
          <p className="eyebrow text-accent">Hoja de llamada</p>
          <h1 className="mt-1.5 font-display text-3xl font-black tracking-tight uppercase sm:text-4xl">
            {projectName}
          </h1>
        </div>
        <p className="font-sans text-[15px] first-letter:uppercase">
          {dateLabel}
        </p>
      </header>

      {/* Lo primero que busca cualquiera: a qué hora y dónde. */}
      <div className="grid gap-x-10 gap-y-6 border-b border-line py-6 sm:grid-cols-[auto_1fr]">
        <div>
          <p className="eyebrow">Llamada general</p>
          <p className="mt-1 font-display text-5xl leading-none font-black tabular-nums sm:text-6xl">
            {callSheet?.generalCallTime ?? (
              <span className="text-muted">—</span>
            )}
          </p>
        </div>
        <div>
          <p className="eyebrow">
            {summary.locations.length === 1 ? "Localización" : "Localizaciones"}
          </p>
          {summary.locations.length === 0 ? (
            <p className="mt-1 font-sans text-[15px] text-muted">
              Sin localización asignada
            </p>
          ) : (
            <ul className="mt-1 space-y-1">
              {summary.locations.map((l) => (
                <li key={l.id} className="font-sans text-[15px] leading-snug">
                  <span className="font-semibold">{l.name}</span>
                  {l.address && (
                    <span className="block text-sm text-muted">
                      {l.address}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <section className="pt-6" aria-labelledby="cs-escenas">
        <h2 id="cs-escenas" className="eyebrow text-accent">
          Plan del día
        </h2>
        {summary.sceneAssignments.length === 0 ? (
          <p className="py-4 font-sans text-sm text-muted">
            Sin escenas asignadas todavía.
          </p>
        ) : (
          <ol className="mt-2 divide-y divide-line">
            {summary.sceneAssignments.map((assignment) => {
              const sceneCharacters =
                summary.charactersByAssignment.get(assignment.id) ?? [];
              const isOverridden = summary.overriddenSceneIds.has(
                assignment.sceneId,
              );
              const selectedIds = new Set(
                sceneCharacters.map((c) => c.character.id),
              );
              return (
                <li
                  key={assignment.id}
                  className="grid grid-cols-[4.5rem_1fr] gap-x-4 py-4 sm:grid-cols-[5.5rem_1fr]"
                >
                  {edit ? (
                    <form
                      action={updateSceneCallTime.bind(
                        null,
                        edit.projectId,
                        edit.shootingDayId,
                        assignment.id,
                      )}
                      className="flex items-start gap-1"
                    >
                      <input
                        name="callTime"
                        aria-label={`Hora de la escena ${assignment.scene.number}`}
                        defaultValue={assignment.callTime ?? ""}
                        placeholder="—"
                        className="w-14 border-b border-transparent bg-transparent py-0.5 font-mono text-base tabular-nums outline-none transition-colors hover:border-line focus:border-accent"
                      />
                      <button
                        type="submit"
                        className="py-1 font-mono text-[11px] text-muted transition-colors hover:text-accent print:hidden"
                        aria-label={`Guardar la hora de la escena ${assignment.scene.number}`}
                      >
                        ✓
                      </button>
                    </form>
                  ) : (
                    <span className="py-0.5 font-mono text-base tabular-nums">
                      {assignment.callTime ?? "—"}
                    </span>
                  )}
                  <div className="min-w-0">
                    <p className="font-display text-lg leading-tight font-bold">
                      Escena {assignment.scene.number}
                      <span className="ml-2 font-sans text-sm font-normal text-muted">
                        {INT_EXT_LABELS[assignment.scene.intExt]} ·{" "}
                        {DAY_PART_LABELS[assignment.scene.dayPart]}
                        {assignment.scene.location
                          ? ` · ${assignment.scene.location.name}`
                          : ""}
                      </span>
                    </p>
                    <p className="mt-1 font-sans text-sm">
                      {sceneCharacters.length > 0 ? (
                        sceneCharacters.map((c) => c.character.name).join(", ")
                      ) : (
                        <span className="text-muted">Sin personajes</span>
                      )}
                      {isOverridden && (
                        <span className="ml-1.5 font-mono text-[11px] text-accent">
                          (corregido a mano)
                        </span>
                      )}
                    </p>
                    {assignment.scene.shots.length > 0 && (
                      <ul className="mt-2 space-y-0.5">
                        {assignment.scene.shots.map((shot) => (
                          <li
                            key={shot.id}
                            className="grid grid-cols-[3rem_2.5rem_1fr] gap-2 font-mono text-xs"
                          >
                            <span className="text-accent">
                              {assignment.scene.number}.{shot.number}
                            </span>
                            <span className="uppercase">
                              {shot.shotSize ?? "—"}
                            </span>
                            <span className="font-sans text-[13px] text-muted">
                              {[shot.description, shot.movement]
                                .filter(Boolean)
                                .join(" · ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                    {edit && (
                      <details className="group mt-2 print:hidden">
                        <summary className="link-action -ml-1 min-h-0 list-none py-1 hover:!text-accent [&::-webkit-details-marker]:hidden">
                          Corregir quién sale
                        </summary>
                        <form
                          action={updateSceneCastOverride.bind(
                            null,
                            edit.projectId,
                            edit.shootingDayId,
                            assignment.sceneId,
                          )}
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
                            action={clearSceneCastOverride.bind(
                              null,
                              edit.projectId,
                              edit.shootingDayId,
                              assignment.sceneId,
                            )}
                            className="mt-1"
                          >
                            <button type="submit" className="link-action">
                              Quitar la corrección y volver a lo automático
                            </button>
                          </form>
                        )}
                      </details>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <div className="mt-2 grid gap-x-10 gap-y-6 border-t border-line pt-6 sm:grid-cols-3">
        <div>
          <h2 className="eyebrow">Reparto</h2>
          {summary.characters.length === 0 ? (
            <p className="mt-1 font-sans text-sm text-muted">—</p>
          ) : (
            <ul className="mt-1 space-y-0.5 font-sans text-sm">
              {summary.characters.map((c) => (
                <li key={c.id}>
                  <span className="font-semibold">{c.name}</span>
                  {c.actor && (
                    <span className="text-muted"> · {c.actor.name}</span>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <h2 className="eyebrow">
            Equipo técnico
            {summary.crewOverridden && (
              <span className="ml-1.5 normal-case tracking-normal text-accent">
                (corregido)
              </span>
            )}
          </h2>
          <p className="mt-1 font-sans text-sm leading-relaxed">
            {summary.crewMembers.map((c) => c.name).join(", ") || (
              <span className="text-muted">—</span>
            )}
          </p>
          {edit && (
            <details className="mt-1 print:hidden">
              <summary className="link-action -ml-1 min-h-0 list-none py-1 hover:!text-accent [&::-webkit-details-marker]:hidden">
                Corregir quién viene
              </summary>
              <form
                action={updateCallSheetCrew.bind(
                  null,
                  edit.projectId,
                  edit.shootingDayId,
                )}
                className="mt-2 flex flex-wrap items-center gap-2"
              >
                {edit.allCrewMembers.map((member) => (
                  <ChipOption
                    key={member.id}
                    type="checkbox"
                    name="crewMemberIds"
                    value={member.id}
                    label={
                      member.role
                        ? `${member.name} (${member.role})`
                        : member.name
                    }
                    defaultChecked={summary.crewMembers.some(
                      (c) => c.id === member.id,
                    )}
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
              {summary.crewOverridden && (
                <form
                  action={clearCallSheetCrewOverride.bind(
                    null,
                    edit.projectId,
                    edit.shootingDayId,
                  )}
                  className="mt-1"
                >
                  <button type="submit" className="link-action">
                    Quitar la corrección y volver a lo automático
                  </button>
                </form>
              )}
            </details>
          )}
        </div>
        <div>
          <h2 className="eyebrow">Atrezzo y material</h2>
          <p className="mt-1 font-sans text-sm leading-relaxed">
            {summary.breakdownElements.map((b) => b.name).join(", ") || (
              <span className="text-muted">—</span>
            )}
          </p>
        </div>
      </div>

      <div className="mt-6 grid gap-x-10 gap-y-6 border-t border-line pt-6 sm:grid-cols-3">
        {(
          [
            ["Transporte", callSheet?.transportNotes],
            ["Catering", callSheet?.cateringNotes],
            ["Notas", callSheet?.additionalNotes],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <h2 className="eyebrow">{label}</h2>
            <p className="mt-1 font-sans text-sm leading-relaxed">
              {value ?? <span className="text-muted">—</span>}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
