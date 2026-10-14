import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createActor, deleteActor, updateActor } from "@/lib/actions/actors";
import { createCharacter, deleteCharacter, updateCharacter, updateCharacterActor } from "@/lib/actions/characters";
import { colorFor } from "@/components/canvas/presence";
import { ActorAssignmentField } from "@/components/ActorAssignmentField";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { DeleteButton } from "@/components/DeleteButton";
import { FormField } from "@/components/FormField";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import type { CharacterProfile } from "@/lib/screenplay-taller";

// Personajes como la tabla de reparto de un director de producción: cada
// personaje es una fila con su retrato, una tira con TODAS las escenas del
// proyecto (encendidas las que pisa) y, a la derecha, su actor o el hueco
// «sin actor» en ámbar. Así se ve en tres segundos quién falta y cuánto pesa.
// Al pulsar la fila se abre su ficha en papel (retrato, rasgos del guion,
// galería, escenas, actor y contacto). Debajo, los actores del proyecto como
// una agenda: a quién interpreta cada uno y cómo localizarlo.

const LABEL = "font-mono text-[10px] tracking-[0.16em] text-muted uppercase";

function profileOf(value: unknown): CharacterProfile | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as CharacterProfile) : null;
}

function hueOf(name: string) {
  return Number(colorFor(name).match(/^hsl\((\d+)/)?.[1] ?? 260);
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

function listNames(names: string[]) {
  if (names.length <= 1) return names.join("");
  return `${names.slice(0, -1).join(", ")} y ${names[names.length - 1]}`;
}

function Portrait({ name, photo, size = 44 }: { name: string; photo?: string; size?: number }) {
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- foto de la ficha del guion (Supabase)
    <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-display font-black text-white/85"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hueOf(name)}, 28%, 32%)` }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default async function PersonajesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ ficha?: string }>;
}) {
  const { projectId } = await params;
  const { ficha } = await searchParams;
  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [actorRows, characters, people, sceneRows] = await Promise.all([
    prisma.actor.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        rate: true,
        availability: true,
        notes: true,
        characters: { select: { name: true } },
      },
    }),
    prisma.character.findMany({
      where: { projectId },
      orderBy: { createdAt: "asc" },
      include: { _count: { select: { scenes: true } } },
    }),
    prisma.person.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
    // Solo lectura: las escenas del proyecto, para la tira de cada personaje y los días que rueda.
    prisma.scene.findMany({
      where: { projectId },
      orderBy: [{ order: "asc" }, { createdAt: "asc" }],
      select: {
        id: true,
        number: true,
        intExt: true,
        dayPart: true,
        description: true,
        location: { select: { name: true } },
        characters: { select: { characterId: true } },
        shootingDayScenes: { select: { shootingDay: { select: { id: true, date: true } } } },
      },
    }),
  ]);

  const actors = actorRows.map((a) => ({ ...a, rate: a.rate === null ? null : Number(a.rate) }));
  const conflictsFor = (id: string) =>
    Object.fromEntries(characters.filter((c) => c.id !== id && c.actorId).map((c) => [c.actorId as string, c.name]));

  // Cada personaje con lo que hace falta para decidir: escenas, días y actor. Ordenados por peso
  // (más escenas primero), como se numera el reparto en el plan de rodaje.
  const rows = characters
    .map((c) => {
      const p = profileOf(c.profile);
      const gallery = (p?.images ?? []).filter((i) => typeof i?.url === "string" && i.url.startsWith("https://"));
      const sceneIds = new Set(sceneRows.filter((s) => s.characters.some((sc) => sc.characterId === c.id)).map((s) => s.id));
      const days = new Map<string, Date>();
      for (const s of sceneRows) {
        if (!sceneIds.has(s.id)) continue;
        for (const d of s.shootingDayScenes) days.set(d.shootingDay.id, d.shootingDay.date);
      }
      return {
        c,
        p,
        gallery,
        photo: gallery[0]?.url,
        actor: actors.find((a) => a.id === c.actorId) ?? null,
        sceneIds,
        // Si las escenas aún no están en Taller, la cuenta viene del guion vinculado.
        sceneCount: sceneIds.size || c._count.scenes || p?.sceneCount || 0,
        days: [...days.values()].sort((a, b) => a.getTime() - b.getTime()),
      };
    })
    .sort((a, b) => b.sceneCount - a.sceneCount);

  const missing = rows.filter((r) => !r.actor);
  const cast = rows.length - missing.length;
  const freeActors = actors.filter((a) => a.characters.length === 0);
  const hasSceneLinks = rows.some((r) => r.sceneIds.size > 0);
  const maxScenes = Math.max(1, ...rows.map((r) => r.sceneCount));
  const castPct = rows.length > 0 ? Math.round((cast / rows.length) * 100) : 0;

  const newCharacter = (
    <CreateDialog label="Personaje" title="Nuevo personaje" description="Ponle nombre y, si ya lo sabes, quién lo interpreta.">
      <form action={createCharacter.bind(null, projectId)} className="space-y-4">
        <FormField label="Nombre">
          <input name="name" required autoComplete="off" placeholder="Ej. ELENA" className="field font-display font-bold uppercase" />
        </FormField>
        <FormField label="Actor">
          <select name="actorId" defaultValue="" className="field">
            <option value="">Sin actor todavía</option>
            {actors.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Notas de producción" hint="Vestuario, maquillaje, dobles…">
          <input name="notes" className="field" />
        </FormField>
        <div className="flex items-center gap-4 pt-2">
          <SubmitButton pendingLabel="Añadiendo…" className="btn btn-primary">
            Añadir personaje
          </SubmitButton>
          <DialogCancel />
        </div>
      </form>
    </CreateDialog>
  );

  const newActor = (
    <CreateDialog
      label="Actor"
      variant="outline"
      title="Nuevo actor"
      description="Elígelo del directorio de Equipo o escribe sus datos si es nuevo."
    >
      <form action={createActor.bind(null, projectId)} className="grid gap-4 sm:grid-cols-2">
        <FormField label="Del directorio de Equipo" className="sm:col-span-2">
          <select name="personId" defaultValue="" className="field">
            <option value="">Persona nueva</option>
            {people.map((person) => (
              <option key={person.id} value={person.id}>
                {person.firstName} {person.lastName ?? ""}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Nombre" hint="Si no está en Equipo" className="sm:col-span-2">
          <input name="name" className="field" />
        </FormField>
        <FormField label="Email">
          <input name="email" type="email" className="field" />
        </FormField>
        <FormField label="Teléfono">
          <input name="phone" type="tel" className="field" />
        </FormField>
        <FormField label="Caché (€)">
          <input name="rate" type="number" step="0.01" className="field" />
        </FormField>
        <FormField label="Disponibilidad">
          <input name="availability" placeholder="Ej. libre del 15 al 25" className="field" />
        </FormField>
        <div className="flex items-center gap-4 pt-2 sm:col-span-2">
          <SubmitButton pendingLabel="Añadiendo…" className="btn btn-primary">
            Añadir actor
          </SubmitButton>
          <DialogCancel />
        </div>
      </form>
    </CreateDialog>
  );

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preproducción"
        title="Personajes"
        description="Quién sale en la película, en qué escenas y qué actor lo interpreta."
        actions={newCharacter}
      />

      {/* ------------------------------------------------ cómo voy */}
      {rows.length > 0 && (
        <section aria-label="Estado del reparto" className="mt-10">
          <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
            <div>
              <p className="font-display text-4xl font-black tabular-nums">
                {cast}
                <span className="text-muted">/{rows.length}</span>
              </p>
              <p className="mt-1 font-sans text-sm text-muted">personajes con actor</p>
            </div>
            <div className="min-w-[12rem] flex-1 pb-2 sm:max-w-sm">
              <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
                <div className={`h-full rounded-full ${missing.length === 0 ? "bg-success" : "bg-accent"}`} style={{ width: `${castPct}%` }} />
              </div>
              <p className="mt-2 font-sans text-sm">
                {missing.length === 0 ? (
                  <span className="text-success">Reparto completo.</span>
                ) : (
                  <>
                    Faltan <span className="text-fg">{plural(missing.length, "personaje", "personajes")}</span> por repartir.
                  </>
                )}
              </p>
            </div>
            <div className="pb-2">
              <p className="font-sans text-sm">
                {plural(actors.length, "actor", "actores")}
                <span className="text-muted">
                  {actors.length > 0 && (freeActors.length > 0 ? ` · ${freeActors.length} sin personaje` : " · todos con papel")}
                </span>
              </p>
            </div>
          </div>

          {/* Avisos accionables: los personajes que más pesan primero. */}
          {(missing.length > 0 || !hasSceneLinks) && (
            <ul className="mt-6 space-y-2">
              {actors.length === 0 && missing.length > 0 && (
                <li>
                  <a href="#actores" className="group flex items-center justify-between gap-3 border-l-2 border-warn py-1.5 pl-3 font-sans text-sm">
                    <span className="transition-colors group-hover:text-accent">
                      Aún no hay actores en el proyecto. Añádelos para repartir a{" "}
                      <span className="font-semibold">{listNames(missing.slice(0, 4).map((r) => r.c.name))}</span>
                      {missing.length > 4 ? ` y ${missing.length - 4} más` : ""}.
                    </span>
                    <span aria-hidden className="text-muted group-hover:text-accent">
                      →
                    </span>
                  </a>
                </li>
              )}
              {actors.length > 0 && missing.slice(0, 3).map((r) => (
                <li key={r.c.id}>
                  <Link
                    href={`?ficha=${r.c.id}#pj-${r.c.id}`}
                    scroll={false}
                    className="group flex items-center justify-between gap-3 border-l-2 border-warn py-1.5 pl-3 font-sans text-sm"
                  >
                    <span className="transition-colors group-hover:text-accent">
                      <span className="font-semibold">{r.c.name}</span>
                      {r.sceneCount > 0 ? ` sale en ${plural(r.sceneCount, "escena", "escenas")}` : ""}
                      {r.days.length > 0 ? ` y rueda ${plural(r.days.length, "día", "días")}` : ""}
                      {" "}y no tiene actor
                    </span>
                    <span aria-hidden className="shrink-0 text-muted group-hover:text-accent">
                      <span className="hidden sm:inline">Asignar </span>→
                    </span>
                  </Link>
                </li>
              ))}
              {!hasSceneLinks && sceneRows.length === 0 && rows.some((r) => r.sceneCount > 0) && (
                <li className="border-l-2 border-line py-1.5 pl-3 font-sans text-sm text-muted">
                  Las escenas vienen del guion: cuando estén en el{" "}
                  <Link href={`/app/${projectId}/desglose`} className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
                    Desglose
                  </Link>
                  , aquí verás en cuáles sale cada uno.
                </li>
              )}
            </ul>
          )}
        </section>
      )}

      {/* ------------------------------------------------ tabla de reparto */}
      <section aria-labelledby="reparto-title" className="mt-14">
        <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
          <h2 id="reparto-title" className="font-display text-xl font-black tracking-tight">
            Reparto
          </h2>
          {rows.length > 0 && (
            <p className="hidden font-sans text-xs text-muted sm:block">
              {sceneRows.length > 0 ? "Tira = escenas del proyecto; en color, las que pisa" : "Ordenados por número de escenas"}
            </p>
          )}
        </div>

        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <p className="font-display text-lg font-bold">Todavía no hay personajes</p>
            <p className="mx-auto mt-2 max-w-md font-sans text-sm leading-relaxed text-muted">
              Añádelos a mano con «+ Personaje», o escribe el guion en{" "}
              <Link href="/app/guiones" className="text-accent hover:underline">
                Guiones
              </Link>{" "}
              y vincúlalo a este proyecto: aparecerán solos, con su ficha.
            </p>
          </div>
        ) : (
          <ol className="divide-y divide-line">
            {rows.map((r, index) => {
              const { c, p, actor } = r;
              const traits = [
                ["Quiere", p?.want],
                ["Necesita", p?.need],
                ["Teme", p?.fear],
                ["Oculta", p?.secret],
                ["Arco", p?.arc],
              ].filter((t): t is [string, string] => Boolean(t[1]));
              const scenesIn = sceneRows.filter((s) => r.sceneIds.has(s.id));
              return (
                <li key={c.id} id={`pj-${c.id}`} className="scroll-mt-40">
                  <details className="group" open={ficha === c.id}>
                    <summary className="grid cursor-pointer list-none grid-cols-[2.75rem_minmax(0,1fr)] items-center gap-x-4 gap-y-3 rounded-lg py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:grid-cols-[2.75rem_minmax(0,1fr)_minmax(0,auto)_14rem] md:gap-x-6 [&::-webkit-details-marker]:hidden">
                      <Portrait name={c.name} photo={r.photo} />

                      <span className="min-w-0">
                        <span className="flex items-baseline gap-3">
                          <span aria-hidden className="font-mono text-[10px] text-muted tabular-nums">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="truncate font-display text-xl font-black tracking-tight uppercase transition-colors group-hover:text-accent sm:text-2xl">
                            {c.name}
                          </span>
                        </span>
                        <span className="mt-0.5 block truncate font-sans text-sm text-muted">
                          {r.sceneCount > 0 ? plural(r.sceneCount, "escena", "escenas") : "Sin escenas"}
                          {r.days.length > 0 && ` · rueda ${plural(r.days.length, "día", "días")}`}
                          {c.screenplayId && !r.sceneIds.size && r.sceneCount > 0 && " en el guion"}
                        </span>
                      </span>

                      {/* La tira de escenas: el objeto que el ayudante de dirección cruza a mano. */}
                      {sceneRows.length > 0 ? (
                        <span
                          className="col-span-2 flex flex-wrap gap-1 md:col-span-1 md:justify-end"
                          role="img"
                          aria-label={
                            scenesIn.length > 0
                              ? `Sale en las escenas ${scenesIn.map((s) => s.number).join(", ")}`
                              : "No sale en ninguna escena todavía"
                          }
                        >
                          {sceneRows.slice(0, 40).map((s) => {
                            const on = r.sceneIds.has(s.id);
                            return (
                              <span
                                key={s.id}
                                className={`grid h-7 min-w-6 place-items-center rounded px-1 font-mono text-[10px] tabular-nums ${
                                  on ? "bg-accent font-semibold text-bg" : "bg-fg/[0.05] text-muted/60"
                                }`}
                              >
                                {s.number}
                              </span>
                            );
                          })}
                        </span>
                      ) : r.sceneCount > 0 ? (
                        // Sin escenas en Taller: el peso del personaje en el guion, como barra.
                        <span className="col-span-2 flex items-center gap-3 md:col-span-1 md:w-56" aria-hidden>
                          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-fg/[0.06]">
                            <span className="block h-full rounded-full bg-accent" style={{ width: `${Math.round((r.sceneCount / maxScenes) * 100)}%` }} />
                          </span>
                        </span>
                      ) : (
                        <span className="hidden md:block" />
                      )}

                      <span className="col-span-2 flex min-w-0 items-center gap-2 md:col-span-1 md:justify-end md:text-right">
                        {actor ? (
                          <span className="min-w-0">
                            <span className="block truncate font-sans text-base">{actor.name}</span>
                            {actor.phone || actor.email ? (
                              <span className="block truncate font-mono text-[10px] text-muted">{actor.phone ?? actor.email}</span>
                            ) : null}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-2 font-sans text-sm text-warn">
                            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-warn" />
                            Sin actor
                          </span>
                        )}
                        <span aria-hidden className="ml-1 text-muted transition-transform group-open:rotate-90">
                          ›
                        </span>
                      </span>
                    </summary>

                    {/* ------------------------------ ficha abierta: papel */}
                    <div className="paper mb-6 grid gap-x-10 gap-y-8 p-5 sm:p-8 md:grid-cols-[11rem_minmax(0,1fr)] xl:grid-cols-[11rem_minmax(0,1fr)_17rem]">
                      {/* Retrato y galería */}
                      <div className="flex gap-4 md:block">
                        {r.photo ? (
                          // eslint-disable-next-line @next/next/no-img-element -- foto de la ficha del guion
                          <img src={r.photo} alt={`Retrato de ${c.name}`} className="aspect-[3/4] w-28 shrink-0 rounded-lg object-cover md:w-full" />
                        ) : (
                          <div
                            aria-hidden
                            className="grid aspect-[3/4] w-28 shrink-0 place-items-center rounded-lg font-display text-6xl font-black text-white/85 md:w-full"
                            style={{ background: `hsl(${hueOf(c.name)}, 26%, 34%)` }}
                          >
                            {c.name.slice(0, 1)}
                          </div>
                        )}
                        <div className="min-w-0 md:mt-4">
                          <p className="font-display text-2xl font-black tracking-tight uppercase md:hidden">{c.name}</p>
                          {r.gallery.length > 1 && (
                            <div className="mt-2 grid grid-cols-3 gap-1.5 md:mt-0">
                              {r.gallery.slice(1, 7).map((img) => (
                                // eslint-disable-next-line @next/next/no-img-element -- imágenes de la ficha
                                <img key={img.id} src={img.url} alt={img.caption ?? ""} className="aspect-square w-full rounded object-cover" />
                              ))}
                            </div>
                          )}
                          {r.gallery.length === 0 && c.screenplayId && (
                            <p className="mt-2 font-sans text-xs leading-relaxed text-muted">
                              Sin imágenes. Se añaden en la ficha del guion.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Quién es y dónde sale */}
                      <div className="min-w-0">
                        <p className={LABEL}>{c.screenplayId ? `Del guion${p?.screenplayTitle ? ` «${p.screenplayTitle}»` : ""}` : "Personaje"}</p>
                        <h3 className="mt-1 hidden font-display text-3xl font-black tracking-tight uppercase md:block">{c.name}</h3>
                        {traits.length > 0 ? (
                          <dl className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2">
                            {traits.map(([k, v]) => (
                              <div key={k}>
                                <dt className={LABEL}>{k}</dt>
                                <dd className="mt-1 font-sans text-[15px] leading-relaxed">{v}</dd>
                              </div>
                            ))}
                          </dl>
                        ) : (
                          <p className="mt-4 max-w-md font-sans text-sm leading-relaxed text-muted">
                            {c.screenplayId
                              ? "La ficha del guion aún está vacía: qué quiere, qué teme, su arco…"
                              : "Sin ficha de guion. Si el personaje viene de un guion de Guiones, aquí verás qué quiere, qué teme y su arco."}
                          </p>
                        )}
                        {c.screenplayId && (
                          <Link href={`/app/guiones/${c.screenplayId}?paso=idea`} className="mt-4 inline-block font-sans text-sm text-accent hover:underline">
                            Editar la ficha en el guion →
                          </Link>
                        )}

                        <div className="mt-8 border-t border-line pt-5">
                          <p className={LABEL}>
                            Sale en {r.sceneCount > 0 ? plural(r.sceneCount, "escena", "escenas") : "ninguna escena"}
                          </p>
                          {scenesIn.length > 0 ? (
                            <ul className="mt-3 divide-y divide-line">
                              {scenesIn.map((s) => {
                                const day = s.shootingDayScenes[0]?.shootingDay.date;
                                return (
                                  <li key={s.id} className="grid grid-cols-[2.25rem_minmax(0,1fr)_auto] items-baseline gap-3 py-2">
                                    <span className="font-display text-lg font-black tabular-nums">{s.number}</span>
                                    <span className="min-w-0">
                                      <span className="block font-mono text-[10px] tracking-widest text-muted uppercase">
                                        {INT_EXT_LABELS[s.intExt]} · {DAY_PART_LABELS[s.dayPart]}
                                        {s.location ? ` · ${s.location.name}` : ""}
                                      </span>
                                      {s.description && <span className="block truncate font-sans text-sm">{s.description}</span>}
                                    </span>
                                    <span className={`font-mono text-[10px] whitespace-nowrap ${day ? "text-fg" : "text-muted"}`}>
                                      {day ? day.toLocaleDateString("es-ES", { day: "numeric", month: "short" }) : "sin día"}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          ) : (
                            <p className="mt-2 font-sans text-sm text-muted">
                              {r.sceneCount > 0
                                ? "Las escenas están en el guion; en cuanto pasen al Desglose verás cuáles son y qué día se ruedan."
                                : "Márcalo en las escenas del Desglose para saber cuándo hay que citarlo."}
                            </p>
                          )}
                        </div>
                      </div>

                      {/* Actor y producción */}
                      <div className="space-y-7 md:col-span-2 xl:col-span-1 xl:border-l xl:border-line xl:pl-8">
                        <div>
                          <p className={LABEL}>Lo interpreta</p>
                          <form action={updateCharacterActor.bind(null, projectId, c.id)} className="mt-2">
                            <ActorAssignmentField actors={actors} defaultActorId={c.actorId ?? ""} conflicts={conflictsFor(c.id)} />
                          </form>
                          {actor && (actor.email || actor.phone) && (
                            <p className="mt-2 flex flex-wrap gap-x-4 gap-y-1 font-sans text-sm">
                              {actor.phone && (
                                <a href={`tel:${actor.phone.replace(/\s/g, "")}`} className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
                                  {actor.phone}
                                </a>
                              )}
                              {actor.email && (
                                <a href={`mailto:${actor.email}`} className="truncate text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
                                  {actor.email}
                                </a>
                              )}
                            </p>
                          )}
                          {actor?.availability && <p className="mt-1 font-sans text-xs text-muted">{actor.availability}</p>}
                          {actors.length === 0 && (
                            <a href="#actores" className="mt-2 inline-block font-sans text-sm text-accent hover:underline">
                              Añade actores al proyecto ↓
                            </a>
                          )}
                        </div>
                        <form action={updateCharacter.bind(null, projectId, c.id)} className="space-y-4">
                          <FormField label="Nombre">
                            <input name="name" required defaultValue={c.name} className="field" />
                          </FormField>
                          <FormField label="Notas de producción">
                            <input name="notes" defaultValue={c.notes ?? ""} placeholder="Vestuario, maquillaje, dobles…" className="field" />
                          </FormField>
                          <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-outline btn-sm">
                            Guardar
                          </SubmitButton>
                        </form>
                        <form action={deleteCharacter.bind(null, projectId, c.id)} className="border-t border-line pt-4">
                          <DeleteButton confirmMessage="¿Eliminar este personaje?" className="link-action !px-0">
                            Eliminar personaje
                          </DeleteButton>
                        </form>
                      </div>
                    </div>
                  </details>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {/* ------------------------------------------------ actores */}
      <section id="actores" aria-labelledby="actores-title" className="mt-16 scroll-mt-32">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
          <div>
            <h2 id="actores-title" className="font-display text-xl font-black tracking-tight">
              Actores
            </h2>
            <p className="mt-1 font-sans text-sm text-muted">
              {actors.length === 0
                ? "Las personas que pueden interpretar a tus personajes, con su contacto y caché."
                : `${plural(actors.length, "actor", "actores")} en el proyecto${freeActors.length > 0 ? ` · ${freeActors.length} todavía sin papel` : ""}`}
            </p>
          </div>
          {newActor}
        </div>

        {actors.length === 0 ? (
          <p className="py-8 font-sans text-sm text-muted">Aún no hay ninguno. Añade el primero y luego asígnalo desde la ficha de un personaje.</p>
        ) : (
          <ul className="divide-y divide-line">
            {actors.map((a) => (
              <li key={a.id}>
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[2.25rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 rounded-lg py-4 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:grid-cols-[2.25rem_minmax(0,1fr)_minmax(0,1fr)_minmax(0,14rem)_auto] [&::-webkit-details-marker]:hidden">
                    <Portrait name={a.name} size={36} />
                    <span className="min-w-0">
                      <span className="block truncate font-sans text-base font-semibold transition-colors group-hover:text-accent">{a.name}</span>
                      <span className="block truncate font-sans text-sm md:hidden">
                        {a.characters.length ? (
                          <span className="text-muted">es <span className="text-fg">{a.characters.map((c) => c.name).join(", ")}</span></span>
                        ) : (
                          <span className="text-muted">Sin personaje</span>
                        )}
                      </span>
                    </span>
                    <span className="hidden min-w-0 truncate font-sans text-sm md:block">
                      {a.characters.length ? (
                        <>
                          <span className="text-muted">es </span>
                          <span className="font-display font-bold tracking-tight uppercase">{a.characters.map((c) => c.name).join(", ")}</span>
                        </>
                      ) : (
                        <span className="text-muted">Sin personaje</span>
                      )}
                    </span>
                    <span className="hidden min-w-0 font-sans text-xs text-muted md:block">
                      <span className="block truncate">{[a.phone, a.email].filter(Boolean).join(" · ") || "Sin contacto"}</span>
                      {(a.rate != null || a.availability) && (
                        <span className="block truncate">
                          {[a.rate != null ? `${a.rate.toLocaleString("es-ES")} €` : null, a.availability].filter(Boolean).join(" · ")}
                        </span>
                      )}
                    </span>
                    <span aria-hidden className="text-muted transition-transform group-open:rotate-90">
                      ›
                    </span>
                  </summary>
                  <div className="paper mb-5 p-5 sm:p-7">
                    <form action={updateActor.bind(null, projectId, a.id)} className="grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3">
                      {(
                        [
                          ["name", "Nombre", a.name, "text"],
                          ["email", "Email", a.email ?? "", "email"],
                          ["phone", "Teléfono", a.phone ?? "", "tel"],
                          ["rate", "Caché (€)", a.rate ?? "", "number"],
                          ["availability", "Disponibilidad", a.availability ?? "", "text"],
                          ["notes", "Notas", a.notes ?? "", "text"],
                        ] as const
                      ).map(([name, label, value, type]) => (
                        <FormField key={name} label={label}>
                          <input
                            name={name}
                            type={type}
                            step={type === "number" ? "0.01" : undefined}
                            required={name === "name"}
                            defaultValue={value}
                            className="field"
                          />
                        </FormField>
                      ))}
                      <div className="sm:col-span-2 lg:col-span-3">
                        <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-outline btn-sm">
                          Guardar datos
                        </SubmitButton>
                      </div>
                    </form>
                    <form action={deleteActor.bind(null, projectId, a.id)} className="mt-5 border-t border-line pt-4">
                      <DeleteButton confirmMessage="¿Eliminar este actor? Se desvinculará de sus personajes." className="link-action !px-0">
                        Eliminar actor
                      </DeleteButton>
                    </form>
                  </div>
                </details>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------ siguiente */}
      <p className="mt-16 border-t border-line pt-5 font-sans text-sm text-muted">
        Siguiente:{" "}
        <Link href={`/app/${projectId}/shot-list`} className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
          Lista de planos
        </Link>
        <span aria-hidden> · </span>o completa el{" "}
        <Link href={`/app/${projectId}/equipo`} className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
          Equipo técnico
        </Link>
      </p>
    </div>
  );
}
