import type { ReactNode } from "react";
import type { ShootingDaySummary } from "@/lib/shooting-day-summary";
import { ChipOption } from "@/components/ChipOption";
import { SubmitButton } from "@/components/SubmitButton";
import { SceneTag, sceneStripColor } from "@/components/SceneTag";
import { formatHHMM } from "@/lib/schedule-plan";
import { PeopleStack, PersonInitials } from "@/components/PersonInitials";
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

const EDIT_SUMMARY =
  "inline-flex h-8 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line px-2.5 text-[13px] text-muted transition-colors hover:border-accent hover:text-accent [&::-webkit-details-marker]:hidden";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line p-4">
      <p className="text-xs text-muted">{label}</p>
      <div className="mt-1 text-sm">{children}</div>
    </div>
  );
}

function SectionTitle({ title, meta, action }: { title: string; meta?: string; action?: ReactNode }) {
  return (
    <div className="mt-8 mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <h2 className="text-[1.0625rem] font-bold">{title}</h2>
      {meta && <span className="text-[13px] text-muted">{meta}</span>}
      {action && <div className="ml-auto">{action}</div>}
    </div>
  );
}

function mapsHref(location: ShootingDaySummary["locations"][number]): string | null {
  if (location.latitude != null && location.longitude != null)
    return `https://www.google.com/maps/search/?api=1&query=${location.latitude},${location.longitude}`;
  if (location.address) return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(location.address)}`;
  return null;
}

// La hoja de llamada. La usan la pantalla del proyecto (con `edit`, para
// poder corregir a mano quién sale citado y a qué hora) y el enlace público
// /hoja/[token] (sin `edit` — de solo lectura, y sin teléfonos ni correos).
// Lo primero que se busca va grande (qué día y a qué hora); después dónde,
// el orden del día como línea de tiempo, y reparto y equipo en tablas.
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
  const date = summary.shootingDay.date;
  const weekday = date.toLocaleDateString("es-ES", { weekday: "long", timeZone: "Europe/Madrid" });
  const dayMonth = date.toLocaleDateString("es-ES", { day: "numeric", month: "long", timeZone: "Europe/Madrid" });
  const year = date.toLocaleDateString("es-ES", { year: "numeric", timeZone: "Europe/Madrid" });
  const shotTotal = summary.sceneAssignments.reduce((n, a) => n + a.scene.shots.length, 0);
  // Con orden de rodaje (bloques) las horas salen de ahí; la lista por escenas
  // queda solo para corregir a mano quién sale.
  const hasRun = summary.runOrder.blocks.length > 0;

  // En qué escenas del día sale cada personaje (para la tabla de reparto).
  const scenesByCharacter = new Map<string, ShootingDaySummary["sceneAssignments"][number]["scene"][]>();
  for (const assignment of summary.sceneAssignments) {
    for (const c of summary.charactersByAssignment.get(assignment.id) ?? []) {
      const list = scenesByCharacter.get(c.character.id) ?? [];
      list.push(assignment.scene);
      scenesByCharacter.set(c.character.id, list);
    }
  }

  return (
    <div className="mt-6">
      {/* Qué día y a qué hora */}
      <section className="grid gap-5 rounded-2xl border border-line bg-bg-raised p-5 sm:grid-cols-[1fr_auto] sm:items-center sm:p-7">
        <div>
          <p className="text-[13px] text-muted">
            {projectName}
            {summary.dayNumber > 0 && ` · Día ${summary.dayNumber} de ${summary.dayCount}`}
          </p>
          <h1 className="mt-1 text-[1.75rem] leading-tight font-bold tracking-tight sm:text-[2rem]">
            <span className="capitalize">{weekday}</span> {dayMonth}
            <span className="ml-2 text-base font-normal text-muted">{year}</span>
          </h1>
        </div>
        <div className="border-t border-line pt-4 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-7 sm:text-right">
          <p className="text-[13px] text-muted">Llamada general</p>
          <p className="font-mono text-[2.75rem] leading-none font-medium text-accent">
            {summary.runOrder.callTime ?? (callSheet?.generalCallTime || "—")}
          </p>
        </div>
      </section>

      {/* Dónde y logística */}
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Fact label={summary.locations.length > 1 ? "Localizaciones" : "Localización"}>
          {summary.locations.length === 0 ? (
            <span className="text-muted">Sin localización</span>
          ) : (
            <ul className="space-y-2">
              {summary.locations.map((l) => {
                const href = mapsHref(l);
                return (
                  <li key={l.id}>
                    <p className="font-semibold">{l.name}</p>
                    {l.address && <p className="text-fg/80">{l.address}</p>}
                    {href && (
                      <a
                        href={href}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-block text-[13px] text-accent hover:underline print:hidden"
                      >
                        Abrir en el mapa →
                      </a>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </Fact>
        <Fact label="Transporte">
          {callSheet?.transportNotes || <span className="text-muted">Sin indicar</span>}
        </Fact>
        <Fact label="Comida">
          {callSheet?.cateringNotes || <span className="text-muted">Sin indicar</span>}
        </Fact>
      </div>

      {hasRun && <RunOrderSection summary={summary} edit={edit} />}

      {/* Orden del día por escenas (sin orden de rodaje) o corrección de quién sale */}
      {(!hasRun || edit) && (
      <SceneListWrapper hasRun={hasRun}>
      {!hasRun && (
      <SectionTitle
        title="Orden del día"
        meta={`${summary.sceneAssignments.length} escena${summary.sceneAssignments.length === 1 ? "" : "s"}${
          shotTotal > 0 ? ` · ${shotTotal} plano${shotTotal === 1 ? "" : "s"}` : ""
        }`}
      />
      )}
      <div className="overflow-hidden rounded-xl border border-line">
        {summary.sceneAssignments.length === 0 ? (
          <p className="p-5 text-sm text-muted">Sin escenas asignadas todavía.</p>
        ) : (
          summary.sceneAssignments.map((assignment) => {
            const scene = assignment.scene;
            const sceneCharacters = summary.charactersByAssignment.get(assignment.id) ?? [];
            const isOverridden = summary.overriddenSceneIds.has(assignment.sceneId);
            const selectedIds = new Set(sceneCharacters.map((c) => c.character.id));
            const names = sceneCharacters.map((c) => c.character.name);
            return (
              <div
                key={assignment.id}
                className={`grid gap-x-3 gap-y-3 border-b border-line/70 p-4 last:border-b-0 ${
                  hasRun ? "grid-cols-1 sm:grid-cols-[1fr_auto]" : "grid-cols-[5.5rem_1fr] sm:grid-cols-[6.25rem_1fr_auto]"
                }`}
              >
                {/* Hora */}
                {!hasRun && (
                <div className="pt-0.5">
                  {edit ? (
                    <form
                      action={updateSceneCallTime.bind(null, edit.projectId, edit.shootingDayId, assignment.id)}
                      className="flex items-center"
                    >
                      <input
                        name="callTime"
                        defaultValue={assignment.callTime ?? ""}
                        placeholder="--:--"
                        aria-label={`Hora de la escena ${scene.number}`}
                        className="w-[4.75rem] rounded-md border border-transparent bg-transparent px-1 font-mono text-lg outline-none transition-colors hover:border-line focus:border-accent"
                      />
                      <button
                        type="submit"
                        aria-label="Guardar hora"
                        className="ml-0.5 text-xs text-muted transition-colors hover:text-accent"
                      >
                        ✓
                      </button>
                    </form>
                  ) : (
                    <span className="font-mono text-lg">{assignment.callTime ?? "—"}</span>
                  )}
                </div>
                )}

                {/* Escena */}
                <div className="min-w-0 border-l-4 pl-3.5" style={{ borderLeftColor: sceneStripColor(scene.intExt, scene.dayPart) }}>
                  <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1">
                    <span className="font-semibold">
                      Esc. <span className="font-mono">{scene.number}</span>
                    </span>
                    <SceneTag intExt={scene.intExt} dayPart={scene.dayPart} />
                    {scene.location && <span className="font-semibold">{scene.location.name}</span>}
                  </div>
                  {(scene.description || scene.shots.length > 0) && (
                    <p className="mt-1 text-sm text-fg/80">
                      {scene.description}
                      {scene.shots.length > 0 && (
                        <span className="text-muted">
                          {scene.description ? " · " : ""}
                          {scene.shots.length} plano{scene.shots.length === 1 ? "" : "s"}
                        </span>
                      )}
                    </p>
                  )}
                  {scene.shots.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {scene.shots.map((shot) => (
                        <li key={shot.id} className="grid grid-cols-[3.25rem_2.75rem_1fr] gap-2 text-[13px]">
                          <span className="font-mono text-fg/80">
                            {scene.number}.{shot.number}
                          </span>
                          <span className="font-mono text-muted">{shot.shotSize ?? "—"}</span>
                          <span className="text-fg/80">
                            {[shot.description, shot.movement].filter(Boolean).join(" · ")}
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Quién sale */}
                <div
                  className={`flex flex-wrap items-center gap-2.5 sm:justify-end sm:self-start ${
                    hasRun ? "sm:col-start-2" : "col-start-2 sm:col-start-3"
                  }`}
                >
                  <PeopleStack names={names} />
                  {names.length > 0 && <span className="text-[13px] text-fg/80">{names.join(", ")}</span>}
                  {isOverridden && <span className="text-xs text-accent">(editado)</span>}
                </div>

                {edit && (
                  <details className={`-mt-1 print:hidden ${hasRun ? "sm:col-span-2" : "col-start-2 sm:col-end-4"}`}>
                    <summary className={EDIT_SUMMARY}>
                      <span aria-hidden>✎</span> Editar quién sale
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
                      <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-secondary btn-sm">
                        Guardar
                      </SubmitButton>
                    </form>
                    {isOverridden && (
                      <form
                        action={clearSceneCastOverride.bind(null, edit.projectId, edit.shootingDayId, assignment.sceneId)}
                        className="mt-1.5"
                      >
                        <button type="submit" className="link-action">
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
      </SceneListWrapper>
      )}

      {/* Reparto y equipo */}
      <div className="grid gap-x-4 lg:grid-cols-2">
        <div>
          <SectionTitle
            title="Reparto"
            meta={`${summary.characters.length} personaje${summary.characters.length === 1 ? "" : "s"}`}
          />
          {summary.characters.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Nadie del reparto este día.</p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-raised text-left text-xs text-muted">
                    <th scope="col" className="px-3 py-2.5 font-medium">Personaje</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Escenas</th>
                    {hasRun && <th scope="col" className="px-3 py-2.5 font-medium">Citación</th>}
                  </tr>
                </thead>
                <tbody>
                  {summary.characters.map((c) => (
                    <tr key={c.id} className="border-t border-line/70">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <PersonInitials name={c.name} />
                          <div>
                            <p>{c.name}</p>
                            {c.actor && <p className="text-xs text-muted">{c.actor.name}</p>}
                          </div>
                        </div>
                      </td>
                      <td className="px-3 py-2.5">
                        <span className="inline-flex flex-wrap gap-1">
                          {(scenesByCharacter.get(c.id) ?? []).map((scene) => (
                            <span
                              key={scene.id}
                              title={`Escena ${scene.number}`}
                              className="inline-grid h-[1.375rem] min-w-[1.375rem] place-items-center rounded px-1 font-mono text-xs font-medium text-bg"
                              style={{ background: sceneStripColor(scene.intExt, scene.dayPart) }}
                            >
                              {scene.number}
                            </span>
                          ))}
                        </span>
                      </td>
                      {hasRun && (
                        <td className="px-3 py-2.5 font-mono whitespace-nowrap">
                          {summary.runOrder.castCalls[c.id] ? (
                            <>
                              {summary.runOrder.castCalls[c.id].call}
                              <span className="block text-xs text-muted">hasta {summary.runOrder.castCalls[c.id].until}</span>
                            </>
                          ) : (
                            <span className="text-muted">—</span>
                          )}
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div>
          <SectionTitle
            title="Equipo técnico"
            meta={`${summary.crewMembers.length} persona${summary.crewMembers.length === 1 ? "" : "s"}${summary.crewOverridden ? " · editado" : ""}`}
          />
          {summary.crewMembers.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">
              {edit
                ? "Nadie del equipo citado. Elige quién viene con «Editar quién va», o asígnalo a las escenas desde Equipo técnico."
                : "Sin equipo técnico citado."}
            </p>
          ) : (
            <div className="overflow-hidden rounded-xl border border-line">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-bg-raised text-left text-xs text-muted">
                    <th scope="col" className="px-3 py-2.5 font-medium">Persona</th>
                    <th scope="col" className="px-3 py-2.5 font-medium">Puesto</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.crewMembers.map((c) => (
                    <tr key={c.id} className="border-t border-line/70">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2.5">
                          <PersonInitials name={c.name} />
                          {c.name}
                        </div>
                      </td>
                      <td className="px-3 py-2.5 text-fg/80">{c.role ?? <span className="text-muted">—</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {edit && (
            <details className="mt-2 print:hidden">
              <summary className={EDIT_SUMMARY}>
                <span aria-hidden>✎</span> Editar quién va
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
                  <button type="submit" className="link-action">
                    Quitar corrección, volver a lo automático
                  </button>
                </form>
              )}
            </details>
          )}
        </div>
      </div>

      {/* Material y notas */}
      <div className="grid gap-x-4 lg:grid-cols-2">
        <div>
          <SectionTitle title="Atrezzo y material" />
          {summary.breakdownElements.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Nada apuntado en el desglose.</p>
          ) : (
            <ul className="flex flex-wrap gap-1.5">
              {summary.breakdownElements.map((b) => (
                <li key={b.id} className="rounded-full border border-line px-3 py-1 text-[13px]">
                  {b.name}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div>
          <SectionTitle title="Notas" />
          {callSheet?.additionalNotes ? (
            <p className="rounded-xl border border-line p-4 text-sm whitespace-pre-line">{callSheet.additionalNotes}</p>
          ) : (
            <p className="rounded-xl border border-dashed border-line p-4 text-sm text-muted">Sin notas para este día.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function SceneListWrapper({ hasRun, children }: { hasRun: boolean; children: ReactNode }) {
  if (!hasRun) return <>{children}</>;
  return (
    <details className="group mt-3 print:hidden">
      <summary className={EDIT_SUMMARY}>
        <span aria-hidden>✎</span> Corregir a mano quién sale en cada escena
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

const EVENT_TONE: Record<string, string> = { MEAL: "text-warn", MOVE: "text-[#8fb7f2]", NOTE: "text-fg/80" };
const EVENT_ICON: Record<string, string> = { MEAL: "🍽", MOVE: "⇄", NOTE: "✎" };

// Orden de rodaje con horas: sale del Plan de rodaje (bloques), así la hoja
// de llamada y el plan nunca dicen cosas distintas.
function RunOrderSection({ summary, edit }: { summary: ShootingDaySummary; edit?: EditContext }) {
  const run = summary.runOrder;
  const names = new Map(summary.characters.map((c) => [c.id, c.name]));
  for (const a of summary.sceneAssignments) for (const c of summary.charactersByAssignment.get(a.id) ?? []) names.set(c.character.id, c.character.name);
  const shotCount = run.blocks.reduce((n, b) => n + b.shots.length, 0);
  return (
    <>
      <SectionTitle
        title="Orden de rodaje"
        meta={`${shotCount} plano${shotCount === 1 ? "" : "s"}${run.wrap ? ` · fin previsto ${run.wrap}` : ""}`}
        action={
          edit ? (
            <a href={`/app/${edit.projectId}/plan-de-rodaje?dia=${edit.shootingDayId}`} className="link-action print:hidden">
              Cambiar el orden en Plan de rodaje →
            </a>
          ) : undefined
        }
      />
      <ol className="overflow-hidden rounded-xl border border-line">
        <li className="grid grid-cols-[3.75rem_1fr] gap-3 border-b border-line/70 px-4 py-2.5 text-sm">
          <span className="font-mono">{run.callTime ?? "—"}</span>
          <span>
            <b>Llamada general</b> <span className="text-muted">· preparación {run.prepMin} min</span>
          </span>
        </li>
        {run.blocks.map((block) => {
          const time = formatHHMM(block.start);
          if (block.kind === "MEAL" || block.kind === "MOVE" || block.kind === "NOTE") {
            return (
              <li key={block.id} className={`grid grid-cols-[3.75rem_1fr] gap-3 border-b border-line/70 bg-bg-raised/30 px-4 py-2.5 text-sm ${EVENT_TONE[block.kind]}`}>
                <span className="font-mono">{time}</span>
                <span>
                  <span aria-hidden>{EVENT_ICON[block.kind]}</span> <b>{block.label}</b>
                  {block.minutes > 0 && <span className="text-muted"> · {block.minutes} min</span>}
                </span>
              </li>
            );
          }
          if (block.kind === "SCENE" && block.scene) {
            const people = block.scene.characterIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n));
            return (
              <li key={block.id} className="grid grid-cols-[3.75rem_1fr] gap-3 border-b border-line/70 px-4 py-3 text-sm">
                <span className="font-mono">{time}</span>
                <div className="border-l-4 pl-3" style={{ borderLeftColor: sceneStripColor(block.scene.intExt, block.scene.dayPart) }}>
                  <p className="flex flex-wrap items-center gap-2">
                    <b>{block.label.split(" · ")[0]}</b>
                    <span className="font-semibold">
                      Escena <span className="font-mono">{block.scene.number}</span> entera
                    </span>
                    <SceneTag intExt={block.scene.intExt} dayPart={block.scene.dayPart} />
                    {block.location && <span>{block.location}</span>}
                  </p>
                  {people.length > 0 && <p className="mt-1 text-[13px] text-fg/80">{people.join(", ")}</p>}
                </div>
              </li>
            );
          }
          return (
            <li key={block.id} className="border-b border-line/70 px-4 py-3 last:border-b-0">
              <div className="grid grid-cols-[3.75rem_1fr] gap-3 text-sm">
                <span className="font-mono">{time}</span>
                <p className="font-bold">{block.label}</p>
              </div>
              <ul className="mt-1.5 space-y-1">
                {block.shots.map((shot) => {
                  const people = shot.characterIds.map((id) => names.get(id)).filter((n): n is string => Boolean(n));
                  return (
                    <li key={shot.id} className="grid grid-cols-[3.75rem_4px_2.75rem_2.5rem_1fr] items-start gap-x-2 gap-y-0.5 text-[13px] sm:grid-cols-[3.75rem_4px_2.75rem_2.5rem_1fr_auto]">
                      <span className="font-mono text-muted">{formatHHMM(shot.start)}</span>
                      <span className="mt-0.5 h-4 w-1 rounded-full" style={{ background: sceneStripColor(shot.intExt, shot.dayPart) }} />
                      <span className="font-mono">
                        {shot.sceneNumber}.{shot.number}
                      </span>
                      <span className="font-mono text-muted">{shot.shotSize ?? ""}</span>
                      <span className={shot.done ? "text-muted line-through" : "text-fg/90"}>{shot.description ?? ""}</span>
                      {people.length > 0 && <span className="col-start-5 text-xs text-muted sm:col-start-auto sm:text-right">{people.join(", ")}</span>}
                    </li>
                  );
                })}
              </ul>
            </li>
          );
        })}
        {run.wrap && (
          <li className="grid grid-cols-[3.75rem_1fr] gap-3 px-4 py-2.5 text-sm">
            <span className="font-mono">{run.wrap}</span>
            <b>Fin de rodaje previsto</b>
          </li>
        )}
      </ol>
    </>
  );
}
