import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteScene, updateScene } from "@/lib/actions/scenes";
import {
  BREAKDOWN_CATEGORY_LABELS,
  DAY_PART_LABELS,
  INT_EXT_LABELS,
} from "@/lib/labels";
import { BreakdownCategory, DayPart, IntExt } from "@/lib/generated/prisma";
import { DeleteButton } from "@/components/DeleteButton";
import { ChipOption } from "@/components/ChipOption";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { SceneSlug } from "@/components/preproduccion/SceneSlug";
import { CATEGORY_COLOR, stripColor } from "@/components/preproduccion/palette";

// Ficha de una escena. A la izquierda, la tarjeta de escena de producción
// (encabezado en Courier, qué pasa, quién sale, qué se necesita): lo que se
// lee en tres segundos. A la derecha, el formulario en papel para cambiarlo,
// con sus apartados en filas y el botón de guardar pegado abajo.

const LABEL = "eyebrow text-muted";

function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="grid gap-y-4 border-t border-line px-5 py-7 first:border-t-0 sm:px-8">
      <div>
        <h2 className="font-display text-base font-bold">{title}</h2>
        {hint && <p className="mt-1 max-w-xl font-sans text-[13px] leading-relaxed text-muted">{hint}</p>}
      </div>
      <div className="min-w-0">{children}</div>
    </section>
  );
}

export default async function SceneDetailPage({
  params,
}: {
  params: Promise<{ projectId: string; sceneId: string }>;
}) {
  const { projectId, sceneId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [scene, locations, characters, breakdownElements, crewMembers, siblings] =
    await Promise.all([
      prisma.scene.findFirst({
        where: { id: sceneId, projectId },
        include: {
          characters: { select: { characterId: true } },
          breakdownElements: { select: { breakdownElementId: true, condition: true } },
          crewMembers: { select: { crewMemberId: true } },
        },
      }),
      prisma.location.findMany({
        where: { organizationId: project.organizationId },
        orderBy: { name: "asc" },
      }),
      prisma.character.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
      prisma.breakdownElement.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
      }),
      prisma.crewMember.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
      // Solo lectura: para saltar a la escena anterior/siguiente y contar planos.
      prisma.scene.findMany({
        where: { projectId },
        orderBy: [{ order: "asc" }, { number: "asc" }],
        select: { id: true, number: true, _count: { select: { shots: true } } },
      }),
    ]);

  if (!scene) notFound();

  const selectedCharacterIds = new Set(
    scene.characters.map((c) => c.characterId),
  );
  const selectedBreakdownIds = new Set(
    scene.breakdownElements.map((b) => b.breakdownElementId),
  );
  const conditionByBreakdownId = new Map(
    scene.breakdownElements.map((b) => [b.breakdownElementId, b.condition ?? ""]),
  );
  const selectedCrewIds = new Set(scene.crewMembers.map((c) => c.crewMemberId));

  const breakdownByCategory = Object.values(BreakdownCategory).map(
    (category) => ({
      category,
      items: breakdownElements.filter((el) => el.category === category),
    }),
  );

  const updateAction = updateScene.bind(null, projectId, sceneId);
  const location = locations.find((l) => l.id === scene.locationId);

  const index = siblings.findIndex((s) => s.id === scene.id);
  const prev = index > 0 ? siblings[index - 1] : null;
  const next = index >= 0 && index < siblings.length - 1 ? siblings[index + 1] : null;
  const shotCount = siblings[index]?._count.shots ?? 0;
  const castInScene = characters.filter((c) => selectedCharacterIds.has(c.id));
  const crewInScene = crewMembers.filter((c) => selectedCrewIds.has(c.id));
  const neededByCategory = breakdownByCategory
    .map((g) => ({ ...g, items: g.items.filter((i) => selectedBreakdownIds.has(i.id)) }))
    .filter((g) => g.items.length > 0);
  const CARD_LABEL = "eyebrow text-muted";

  return (
    <div className="pb-16">
      <PageHeader
        backHref={`/app/${projectId}/guion`}
        backLabel="← Escenas"
        eyebrow={index >= 0 ? `Guion · escena ${index + 1} de ${siblings.length}` : "Guion"}
        title={`Escena ${scene.number}`}
        description="La tarjeta es lo que el equipo necesita saber de esta escena; el formulario en papel, para cambiarla."
        actions={
          <nav aria-label="Otras escenas" className="flex items-center gap-2">
            {prev ? (
              <Link href={`/app/${projectId}/guion/${prev.id}`} className="btn btn-outline btn-sm">
                ← Esc. {prev.number}
              </Link>
            ) : null}
            {next ? (
              <Link href={`/app/${projectId}/guion/${next.id}`} className="btn btn-outline btn-sm">
                Esc. {next.number} →
              </Link>
            ) : null}
          </nav>
        }
      />

      <div className="mt-8 grid items-start gap-8 lg:grid-cols-[minmax(0,19rem)_minmax(0,1fr)] xl:grid-cols-[minmax(0,21rem)_minmax(0,1fr)] xl:gap-10">
      {/* ---------------------------------------- tarjeta de escena */}
      <article
        aria-label={`Tarjeta de la escena ${scene.number}`}
        className="sheet relative overflow-hidden lg:sticky lg:top-6"
      >
        <span
          aria-hidden
          className="absolute inset-x-0 top-0 h-1.5"
          style={{ background: stripColor(scene.intExt, scene.dayPart) }}
        />
        <div className="px-6 pt-7 pb-5">
          <p className="flex items-baseline gap-3">
            <span className="font-display text-5xl leading-none font-black tabular-nums">{scene.number}</span>
            <span className="font-sans text-sm text-muted">
              {shotCount > 0 ? (
                <Link href={`/app/${projectId}/shot-list#esc-${scene.id}`} className="hover:text-accent">
                  {shotCount} {shotCount === 1 ? "plano" : "planos"} →
                </Link>
              ) : (
                "sin planos"
              )}
            </span>
          </p>
          <SceneSlug
            intExt={scene.intExt}
            dayPart={scene.dayPart}
            location={location?.name}
            className="mt-4 block text-[17px] leading-snug"
          />
          {scene.description ? (
            <p className="mt-3 font-sans text-[15px] leading-relaxed">{scene.description}</p>
          ) : (
            <p className="mt-3 font-sans text-sm text-muted italic">Sin descripción todavía.</p>
          )}
          {scene.action && (
            <p className="mt-2 font-sans text-sm leading-relaxed text-muted">{scene.action}</p>
          )}
        </div>
        <dl className="divide-y divide-line border-t border-line">
          <div className="px-6 py-4">
            <dt className={CARD_LABEL}>Quién sale</dt>
            <dd className="mt-2 flex flex-wrap gap-1.5">
              {castInScene.length > 0 ? (
                castInScene.map((c) => (
                  <span
                    key={c.id}
                    className="rounded-full px-2.5 py-0.5 font-mono text-[11px] tracking-wide uppercase"
                    style={{ background: `color-mix(in srgb, ${CATEGORY_COLOR.CAST} 22%, transparent)` }}
                  >
                    {c.name}
                  </span>
                ))
              ) : (
                <span className="font-sans text-sm text-warn">Nadie marcado todavía</span>
              )}
            </dd>
          </div>
          <div className="px-6 py-4">
            <dt className={CARD_LABEL}>Qué se necesita</dt>
            <dd className="mt-2 space-y-1.5">
              {neededByCategory.length > 0 ? (
                neededByCategory.map((g) => (
                  <p key={g.category} className="flex gap-2.5 font-sans text-sm leading-snug">
                    <span
                      aria-hidden
                      className="mt-1.5 h-2 w-2 shrink-0 rounded-full"
                      style={{ background: CATEGORY_COLOR[g.category] }}
                    />
                    <span>
                      <span className="text-muted">{BREAKDOWN_CATEGORY_LABELS[g.category]}: </span>
                      {g.items
                        .map((i) => {
                          const cond = conditionByBreakdownId.get(i.id);
                          return cond ? `${i.name} (${cond})` : i.name;
                        })
                        .join(", ")}
                    </span>
                  </p>
                ))
              ) : (
                <span className="font-sans text-sm text-muted">Nada marcado del desglose.</span>
              )}
            </dd>
          </div>
          {(crewInScene.length > 0 || scene.extrasNotes || scene.productionNotes) && (
            <div className="space-y-2 px-6 py-4 font-sans text-sm leading-relaxed">
              {crewInScene.length > 0 && (
                <p>
                  <span className="text-muted">Equipo: </span>
                  {crewInScene.map((c) => c.name).join(", ")}
                </p>
              )}
              {scene.extrasNotes && (
                <p>
                  <span className="text-muted">Figuración: </span>
                  {scene.extrasNotes}
                </p>
              )}
              {scene.productionNotes && (
                <p>
                  <span className="text-muted">Producción: </span>
                  {scene.productionNotes}
                </p>
              )}
            </div>
          )}
        </dl>
      </article>

      <form action={updateAction} className="paper min-w-0">
        <Section title="Encabezado" hint="Lo que dice la línea de escena del guion.">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-[8rem_minmax(0,1fr)]">
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Número</span>
              <input name="number" defaultValue={scene.number} required className="field" />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className={LABEL}>Localización</span>
              <select name="locationId" defaultValue={scene.locationId ?? ""} className="field">
                <option value="" className="bg-bg">
                  Sin localización
                </option>
                {locations.map((loc) => (
                  <option key={loc.id} value={loc.id} className="bg-bg">
                    {loc.name}
                  </option>
                ))}
              </select>
              {locations.length === 0 && (
                <Link href="/app/localizaciones" className="font-sans text-xs text-accent hover:underline">
                  Aún no hay localizaciones · Añadir en Localizaciones →
                </Link>
              )}
            </label>
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className={`${LABEL} mb-2`}>Interior / exterior</legend>
              <div className="flex flex-wrap gap-2">
                {Object.values(IntExt).map((value) => (
                  <ChipOption
                    key={value}
                    type="radio"
                    name="intExt"
                    value={value}
                    label={INT_EXT_LABELS[value]}
                    defaultChecked={scene.intExt === value}
                  />
                ))}
              </div>
            </fieldset>
            <fieldset className="flex flex-col gap-2 sm:col-span-2">
              <legend className={`${LABEL} mb-2`}>Momento del día</legend>
              <div className="flex flex-wrap gap-2">
                {Object.values(DayPart).map((value) => (
                  <ChipOption
                    key={value}
                    type="radio"
                    name="dayPart"
                    value={value}
                    label={DAY_PART_LABELS[value]}
                    defaultChecked={scene.dayPart === value}
                  />
                ))}
              </div>
            </fieldset>
            <label className="flex flex-col gap-1.5 sm:col-span-2">
              <span className={LABEL}>Orden en la historia (opcional)</span>
              <input
                name="storyOrder"
                type="number"
                placeholder={String(scene.order)}
                defaultValue={scene.storyOrder ?? ""}
                className="field max-w-[8rem]"
              />
              <span className="font-sans text-xs text-muted">
                Solo si no ocurre en el orden en que aparece en el guion (un flashback, por ejemplo). Vacío = orden
                del guion.
              </span>
            </label>
          </div>
        </Section>

        <Section title="Qué pasa" hint="Un resumen para el equipo; el texto completo sigue en el guion.">
          <div className="grid gap-x-6 gap-y-5 sm:grid-cols-2">
            {(
              [
                ["description", "Descripción", scene.description, true],
                ["action", "Acción", scene.action, true],
                ["dialogueNotes", "Diálogos / notas", scene.dialogueNotes, true],
                ["extrasNotes", "Extras", scene.extrasNotes, false],
                ["productionNotes", "Notas de producción", scene.productionNotes, false],
              ] as const
            ).map(([name, label, value, wide]) => (
              <label key={name} className={`flex flex-col gap-1.5 ${wide ? "sm:col-span-2" : ""}`}>
                <span className={LABEL}>{label}</span>
                <textarea name={name} defaultValue={value ?? ""} rows={2} className="field leading-relaxed" />
              </label>
            ))}
          </div>
        </Section>

        <Section title="Quién sale" hint="Los personajes que aparecen en esta escena.">
          {characters.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              Aún no hay personajes en el proyecto.{" "}
              <Link href={`/app/${projectId}/personajes`} className="text-accent hover:underline">
                Añadir en Reparto →
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {characters.map((character) => (
                <ChipOption
                  key={character.id}
                  type="checkbox"
                  name="characterIds"
                  value={character.id}
                  label={character.name}
                  defaultChecked={selectedCharacterIds.has(character.id)}
                />
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Qué se necesita"
          hint="Marca lo que sale en la escena. El estado es opcional: escríbelo solo si aquí está roto, manchado, perdido… y la revisión de continuidad lo tendrá en cuenta."
        >
          {breakdownElements.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              Aún no hay elementos de desglose en el proyecto.{" "}
              <Link href={`/app/${projectId}/desglose`} className="text-accent hover:underline">
                Añadir en Desglose →
              </Link>
            </p>
          ) : (
            <div className="grid gap-x-10 gap-y-6 2xl:grid-cols-2">
              {breakdownByCategory
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.category}>
                    <p className={`${LABEL} flex items-center gap-2`}>
                      <span
                        aria-hidden
                        className="h-2 w-2 rounded-full"
                        style={{ background: CATEGORY_COLOR[group.category] }}
                      />
                      {BREAKDOWN_CATEGORY_LABELS[group.category]}
                    </p>
                    <ul className="mt-1 divide-y divide-line">
                      {group.items.map((item) => (
                        <li key={item.id} className="grid grid-cols-[minmax(0,1fr)_8rem] items-center gap-4 py-1.5 sm:grid-cols-[minmax(0,1fr)_12rem]">
                          <label className="flex min-w-0 cursor-pointer items-start gap-2.5 font-sans text-sm [&>input]:mt-0.5">
                            <input
                              type="checkbox"
                              name="breakdownElementIds"
                              value={item.id}
                              defaultChecked={selectedBreakdownIds.has(item.id)}
                              className="h-4 w-4 shrink-0"
                            />
                            <span className="leading-snug">{item.name}</span>
                          </label>
                          <label>
                            <span className="sr-only">Estado de {item.name} en esta escena</span>
                            <input
                              name={`condition_${item.id}`}
                              placeholder="Estado"
                              defaultValue={conditionByBreakdownId.get(item.id) ?? ""}
                              className="field-line mt-0 py-1 text-[13px]"
                            />
                          </label>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          )}
        </Section>

        <Section title="Equipo técnico" hint="Quién del equipo tiene que estar en esta escena.">
          {crewMembers.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              Aún no hay equipo técnico en el proyecto.{" "}
              <Link href={`/app/${projectId}/equipo`} className="text-accent hover:underline">
                Añadir en Equipo técnico →
              </Link>
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {crewMembers.map((member) => (
                <ChipOption
                  key={member.id}
                  type="checkbox"
                  name="crewMemberIds"
                  value={member.id}
                  label={member.role ? `${member.name} · ${member.role}` : member.name}
                  defaultChecked={selectedCrewIds.has(member.id)}
                />
              ))}
            </div>
          )}
        </Section>

        <div className="sticky bottom-0 flex items-center justify-between gap-4 rounded-b-xl border-t border-line bg-bg-raised/95 px-5 py-4 backdrop-blur sm:px-8">
          <p className="hidden font-sans text-xs text-muted sm:block">Los cambios se guardan al pulsar Guardar.</p>
          <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-primary">
            Guardar escena
          </SubmitButton>
        </div>
      </form>
      </div>

      <form action={deleteScene.bind(null, projectId, sceneId)} className="mt-6 flex justify-end">
        <DeleteButton confirmMessage="¿Eliminar esta escena? No se puede deshacer." className="link-action hover:text-danger">
          Eliminar escena
        </DeleteButton>
      </form>
    </div>
  );
}
