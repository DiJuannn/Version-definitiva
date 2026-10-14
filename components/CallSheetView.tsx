import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { ShootingDaySummary } from "@/lib/shooting-day-summary";
import { stripTone } from "@/lib/stripboard";
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

// Hora "HH:MM" comparable; lo que no lo parezca va al final.
const timeKey = (t: string | null | undefined) =>
  t && /^\d{1,2}:\d{2}$/.test(t.trim()) ? t.trim().padStart(5, "0") : "99:99";

// Título de bloque del documento: barra fina oscura como en una call sheet
// impresa, para que se encuentre cada parte de un vistazo.
function BlockTitle({
  id,
  children,
}: {
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <h2
      id={id}
      className="border-b-2 border-fg pb-1.5 font-mono text-[11px] font-semibold tracking-[0.14em] uppercase"
    >
      {children}
    </h2>
  );
}

// La hoja de llamada (call sheet). La usan la pantalla del proyecto (con
// `edit`, para poder corregir a mano quién sale citado y a qué hora) y el
// enlace público /hoja/[token] (sin `edit` — de solo lectura, y sin teléfonos
// ni correos). Maquetada como una call sheet de verdad: cabecera, citación
// general, localización, escenas en tabla, reparto con horas, equipo y notas.
export function CallSheetView({
  projectName,
  summary,
  edit,
  dayNumber,
  totalDays,
}: {
  projectName: string;
  summary: ShootingDaySummary;
  edit?: EditContext;
  dayNumber?: number;
  totalDays?: number;
}) {
  const callSheet = summary.shootingDay.callSheet;
  const dateLabel = summary.shootingDay.date.toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  // Reparto con horas: cada personaje, en qué escenas sale hoy y a qué hora
  // se le cita (la primera de sus escenas).
  const castRows = summary.characters
    .map((character) => {
      const scenes: string[] = [];
      let first: string | null = null;
      for (const assignment of summary.sceneAssignments) {
        const cast = summary.charactersByAssignment.get(assignment.id) ?? [];
        if (!cast.some((c) => c.character.id === character.id)) continue;
        scenes.push(assignment.scene.number);
        if (
          assignment.callTime &&
          timeKey(assignment.callTime) < timeKey(first)
        )
          first = assignment.callTime;
      }
      return { character, scenes, first };
    })
    .sort(
      (a, b) =>
        timeKey(a.first).localeCompare(timeKey(b.first)) ||
        a.character.name.localeCompare(b.character.name),
    );

  const notes = [
    ["Transporte", callSheet?.transportNotes],
    ["Catering", callSheet?.cateringNotes],
    ["Notas para el equipo", callSheet?.additionalNotes],
  ] as const;

  return (
    // Un documento: siempre papel (también en el enlace público, que va sobre
    // fondo oscuro, y al imprimir). Dentro solo hay líneas y espacio.
    <article className="taller-paper paper p-5 text-fg sm:p-10 print:rounded-none print:p-0 print:shadow-none">
      {/* Cabecera: producción, qué jornada es y cuándo. */}
      <header className="grid gap-x-8 gap-y-3 border-b-4 border-fg pb-4 sm:grid-cols-[1fr_auto] sm:items-end">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold tracking-[0.2em] text-accent uppercase">
            Hoja de llamada
          </p>
          <h1 className="mt-1 font-display text-3xl leading-none font-black tracking-tight uppercase sm:text-4xl">
            {projectName}
          </h1>
        </div>
        <div className="sm:text-right">
          {dayNumber && totalDays ? (
            <p className="font-display text-xl leading-none font-black uppercase">
              Día {dayNumber}{" "}
              <span className="font-sans text-base font-normal text-muted normal-case">
                de {totalDays}
              </span>
            </p>
          ) : null}
          <p className="mt-1 font-sans text-[15px] first-letter:uppercase">
            {dateLabel}
          </p>
        </div>
      </header>

      {/* Lo primero que busca cualquiera: a qué hora, dónde y qué hay que saber. */}
      <div className="grid gap-x-8 gap-y-5 border-b border-line py-5 sm:grid-cols-[auto_1fr_1fr]">
        <div className="sm:border-r sm:border-line sm:pr-8">
          <p className="eyebrow">Citación general</p>
          <p className="mt-1 font-display text-5xl leading-none font-black tabular-nums sm:text-6xl">
            {callSheet?.generalCallTime ?? (
              <span className="text-muted">—:—</span>
            )}
          </p>
        </div>
        <div className="min-w-0">
          <p className="eyebrow">
            {summary.locations.length === 1 ? "Localización" : "Localizaciones"}
          </p>
          {summary.locations.length === 0 ? (
            <p className="mt-1 font-sans text-[15px] text-muted">
              Sin localización asignada
            </p>
          ) : (
            <ul className="mt-1 space-y-1.5">
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
        <div className="min-w-0">
          <p className="eyebrow">Luz y avisos del día</p>
          <p className="mt-1 font-sans text-[15px] leading-snug">
            {summary.shootingDay.notes ?? <span className="text-muted">—</span>}
          </p>
        </div>
      </div>

      {/* Escenas del día, en tabla. */}
      <section className="pt-7" aria-labelledby="cs-escenas">
        <BlockTitle id="cs-escenas">
          Escenas del día · {summary.sceneAssignments.length}
        </BlockTitle>
        {summary.sceneAssignments.length === 0 ? (
          <p className="py-4 font-sans text-sm text-muted">
            Sin escenas asignadas todavía.
          </p>
        ) : (
          <>
            <div
              aria-hidden
              className="hidden grid-cols-[5rem_3.5rem_7rem_minmax(0,1fr)_minmax(0,13rem)] gap-x-4 border-b border-line py-2 sm:grid"
            >
              {[
                "Hora",
                "Esc.",
                "INT/EXT · Luz",
                "Localización y acción",
                "Reparto",
              ].map((h) => (
                <span key={h} className="eyebrow">
                  {h}
                </span>
              ))}
            </div>
            <ol className="divide-y divide-line">
              {summary.sceneAssignments.map((assignment) => {
                const scene = assignment.scene;
                const tone = stripTone(scene.intExt, scene.dayPart);
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
                    className="grid grid-cols-[4.5rem_minmax(0,1fr)] gap-x-4 gap-y-1 py-3.5 sm:grid-cols-[5rem_3.5rem_7rem_minmax(0,1fr)_minmax(0,13rem)]"
                  >
                    {edit ? (
                      <form
                        action={updateSceneCallTime.bind(
                          null,
                          edit.projectId,
                          edit.shootingDayId,
                          assignment.id,
                        )}
                        className="row-span-3 flex items-start gap-0.5 sm:row-span-1"
                      >
                        <input
                          name="callTime"
                          aria-label={`Hora de la escena ${scene.number}`}
                          defaultValue={assignment.callTime ?? ""}
                          placeholder="—:—"
                          className="w-14 border-b border-dashed border-line bg-transparent py-0.5 font-mono text-base tabular-nums outline-none transition-colors hover:border-fg focus:border-solid focus:border-accent print:border-none"
                        />
                        <button
                          type="submit"
                          className="rounded px-1 py-1 font-mono text-[11px] text-muted transition-colors hover:text-accent focus-visible:outline-2 focus-visible:outline-accent print:hidden"
                          aria-label={`Guardar la hora de la escena ${scene.number}`}
                        >
                          ✓
                        </button>
                      </form>
                    ) : (
                      <span className="row-span-3 py-0.5 font-mono text-base tabular-nums sm:row-span-1">
                        {assignment.callTime ?? "—"}
                      </span>
                    )}
                    <span className="flex items-baseline gap-2">
                      <span
                        aria-hidden
                        className="h-2.5 w-2.5 shrink-0 rounded-sm ring-1 ring-black/25 print:hidden"
                        style={{ backgroundColor: tone.bg }}
                      />
                      <span className="font-display text-lg leading-tight font-black">
                        <span className="sm:hidden">Escena </span>
                        {scene.number}
                      </span>
                    </span>
                    <span className="col-start-2 font-mono text-[11px] tracking-wider uppercase sm:col-start-auto sm:pt-1">
                      {INT_EXT_LABELS[scene.intExt]} ·{" "}
                      {DAY_PART_LABELS[scene.dayPart]}
                    </span>
                    <div className="col-start-2 min-w-0 sm:col-start-auto">
                      <p className="font-sans text-sm leading-snug">
                        {scene.location && (
                          <span className="font-semibold">
                            {scene.location.name}
                          </span>
                        )}
                        {scene.location && scene.description ? " — " : ""}
                        {scene.description}
                        {!scene.location && !scene.description && (
                          <span className="text-muted">Sin localización</span>
                        )}
                      </p>
                      {scene.shots.length > 0 && (
                        <ul className="mt-1.5 space-y-0.5">
                          {scene.shots.map((shot) => (
                            <li
                              key={shot.id}
                              className="grid grid-cols-[3rem_2.5rem_minmax(0,1fr)] gap-2 font-mono text-xs"
                            >
                              <span className="text-accent">
                                {scene.number}.{shot.number}
                              </span>
                              <span className="uppercase">
                                {shot.shotSize ?? "—"}
                              </span>
                              <span className="truncate font-sans text-[13px] text-muted">
                                {[shot.description, shot.movement]
                                  .filter(Boolean)
                                  .join(" · ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                    <div className="col-start-2 min-w-0 sm:col-start-auto">
                      <p className="font-sans text-sm">
                        {sceneCharacters.length > 0 ? (
                          sceneCharacters
                            .map((c) => c.character.name)
                            .join(", ")
                        ) : (
                          <span className="text-muted">Sin personajes</span>
                        )}
                        {isOverridden && (
                          <span className="ml-1.5 font-mono text-[11px] text-accent">
                            (corregido)
                          </span>
                        )}
                      </p>
                      {edit && (
                        <details className="group mt-0.5 print:hidden">
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
          </>
        )}
      </section>

      {/* Reparto con horas y equipo técnico, lado a lado. */}
      <div className="mt-8 grid gap-x-10 gap-y-8 lg:grid-cols-2">
        <section aria-labelledby="cs-reparto">
          <BlockTitle id="cs-reparto">
            Reparto · {summary.characters.length}
          </BlockTitle>
          {castRows.length === 0 ? (
            <p className="py-3 font-sans text-sm text-muted">
              Nadie del reparto citado.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {castRows.map(({ character, scenes, first }) => (
                <li
                  key={character.id}
                  className="grid grid-cols-[3.5rem_minmax(0,1fr)_auto] items-baseline gap-x-3 py-2.5"
                >
                  <span className="font-mono text-sm tabular-nums">
                    {first ?? <span className="text-muted">—</span>}
                  </span>
                  <span className="min-w-0">
                    <span className="font-sans text-sm font-semibold">
                      {character.name}
                    </span>
                    {character.actor && (
                      <span className="font-sans text-sm text-muted">
                        {" "}
                        · {character.actor.name}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-[11px] text-muted">
                    Esc. {scenes.join(", ") || "—"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section aria-labelledby="cs-equipo">
          <BlockTitle id="cs-equipo">
            Equipo técnico · {summary.crewMembers.length}
            {summary.crewOverridden && (
              <span className="ml-1.5 font-normal tracking-normal text-accent normal-case">
                (corregido)
              </span>
            )}
          </BlockTitle>
          {summary.crewMembers.length === 0 ? (
            <p className="py-3 font-sans text-sm text-muted">
              Nadie del equipo citado.
            </p>
          ) : (
            <ul className="divide-y divide-line">
              {summary.crewMembers.map((member) => (
                <li
                  key={member.id}
                  className="flex items-baseline justify-between gap-3 py-2.5"
                >
                  <span className="font-sans text-sm font-semibold">
                    {member.name}
                  </span>
                  <span className="truncate font-sans text-sm text-muted">
                    {member.role ?? ""}
                  </span>
                </li>
              ))}
            </ul>
          )}
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
        </section>
      </div>

      <section className="mt-8" aria-labelledby="cs-material">
        <BlockTitle id="cs-material">Atrezzo y material</BlockTitle>
        <p className="pt-2.5 font-sans text-sm leading-relaxed">
          {summary.breakdownElements.map((b) => b.name).join(" · ") || (
            <span className="text-muted">—</span>
          )}
        </p>
      </section>

      <section className="mt-8" aria-labelledby="cs-notas">
        <BlockTitle id="cs-notas">Logística y notas</BlockTitle>
        <dl className="grid gap-x-10 gap-y-4 pt-3 sm:grid-cols-3">
          {notes.map(([label, value]) => (
            <div key={label}>
              <dt className="eyebrow">{label}</dt>
              <dd className="mt-1 font-sans text-sm leading-relaxed">
                {value ?? <span className="text-muted">—</span>}
              </dd>
            </div>
          ))}
        </dl>
      </section>
    </article>
  );
}
