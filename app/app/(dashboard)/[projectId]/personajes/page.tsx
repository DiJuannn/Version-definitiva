import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createActor, deleteActor, updateActor } from "@/lib/actions/actors";
import { createCharacter, deleteCharacter, updateCharacter, updateCharacterActor } from "@/lib/actions/characters";
import { colorFor } from "@/components/canvas/presence";
import { ActorAssignmentField } from "@/components/ActorAssignmentField";
import { DeleteButton } from "@/components/DeleteButton";
import { SubmitButton } from "@/components/SubmitButton";
import type { CharacterProfile } from "@/lib/screenplay-taller";

// Personajes, como la hoja de reparto de unos créditos: cada personaje en una
// línea, unido a su actor. Sin tarjetas ni pestañas: se pulsa una línea y se
// abre su ficha debajo. Los actores del proyecto van después, igual.

const FIELD = "field-line";
const LABEL = "font-mono text-[10px] tracking-[0.18em] text-muted uppercase";

function profileOf(value: unknown): CharacterProfile | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as CharacterProfile) : null;
}

function Portrait({ name, photo, size = 44 }: { name: string; photo?: string; size?: number }) {
  const hue = Number(colorFor(name).match(/^hsl\((\d+)/)?.[1] ?? 260);
  return photo ? (
    // eslint-disable-next-line @next/next/no-img-element -- foto de la ficha del guion (Supabase)
    <img src={photo} alt="" width={size} height={size} className="shrink-0 rounded-full object-cover" style={{ width: size, height: size }} />
  ) : (
    <span
      aria-hidden
      className="grid shrink-0 place-items-center rounded-full font-display font-black text-white/80"
      style={{ width: size, height: size, fontSize: size * 0.42, background: `hsl(${hue}, 28%, 30%)` }}
    >
      {name.slice(0, 1)}
    </span>
  );
}

export default async function PersonajesPage({ params }: { params: Promise<{ projectId: string }> }) {
  const { projectId } = await params;
  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [actorRows, characters, people] = await Promise.all([
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
  ]);
  const actors = actorRows.map((a) => ({ ...a, rate: a.rate === null ? null : Number(a.rate) }));
  const cast = characters.filter((c) => c.actorId).length;
  const missing = characters.length - cast;
  const conflictsFor = (id: string) =>
    Object.fromEntries(characters.filter((c) => c.id !== id && c.actorId).map((c) => [c.actorId as string, c.name]));

  return (
    <div className="pb-16">
      <header className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Preproducción</p>
          <h1 className="mt-1.5 font-display text-4xl font-black tracking-tight uppercase sm:text-5xl">Reparto</h1>
          <p className="mt-3 font-sans text-sm text-muted">
            {characters.length === 0
              ? "Quién es cada personaje y qué actor lo interpreta."
              : `${characters.length} ${characters.length === 1 ? "personaje" : "personajes"} · ${actors.length} ${actors.length === 1 ? "actor" : "actores"}`}
            {missing > 0 && <span className="text-accent"> · faltan {missing} por repartir</span>}
          </p>
        </div>
        <nav className="flex gap-6 font-mono text-[11px] tracking-widest uppercase" aria-label="Ir a">
          <a href="#nuevo-personaje" className="text-muted hover:text-fg">
            + Personaje
          </a>
          <a href="#actores" className="text-muted hover:text-fg">
            Actores ↓
          </a>
        </nav>
      </header>

      {/* ------------------------------------------------ reparto */}
      <section aria-label="Personajes" className="mt-12">
        <div className="hidden grid-cols-[56px_1fr_minmax(0,280px)] gap-x-5 border-b border-line pb-2 sm:grid">
          <span />
          <span className={LABEL}>Personaje</span>
          <span className={`${LABEL} text-right`}>Actor</span>
        </div>

        {characters.length === 0 && (
          <p className="max-w-lg py-10 font-sans text-sm leading-relaxed text-muted">
            Todavía no hay personajes. Añádelos abajo, o escribe el guion en{" "}
            <Link href="/app/guiones" className="text-accent hover:underline">
              Guiones
            </Link>{" "}
            y vincúlalo a este proyecto: aparecerán solos, con su ficha.
          </p>
        )}

        <ol>
          {characters.map((c) => {
            const p = profileOf(c.profile);
            const photo = p?.images?.find((i) => typeof i?.url === "string" && i.url.startsWith("https://"))?.url;
            const actor = actors.find((a) => a.id === c.actorId) ?? null;
            const scenes = c._count.scenes || p?.sceneCount || 0;
            const traits = [
              ["Quiere", p?.want],
              ["Necesita", p?.need],
              ["Teme", p?.fear],
              ["Oculta", p?.secret],
              ["Arco", p?.arc],
            ].filter((t): t is [string, string] => Boolean(t[1]));
            const gallery = (p?.images ?? []).filter((i) => typeof i?.url === "string" && i.url.startsWith("https://"));
            return (
              <li key={c.id} className="border-b border-line">
                <details className="group">
                  <summary className="grid cursor-pointer list-none grid-cols-[44px_1fr] items-center gap-x-5 gap-y-1 py-5 sm:grid-cols-[56px_1fr_minmax(0,280px)]">
                    <Portrait name={c.name} photo={photo} />
                    <span className="flex min-w-0 items-baseline gap-4">
                      <span className="truncate font-display text-2xl font-black tracking-tight uppercase transition-colors group-hover:text-accent sm:text-3xl">
                        {c.name}
                      </span>
                      {scenes > 0 && (
                        <span className="shrink-0 font-mono text-[10px] tracking-widest text-muted uppercase">
                          {scenes} {scenes === 1 ? "escena" : "escenas"}
                        </span>
                      )}
                      {/* Los puntos de los créditos, de personaje a actor. */}
                      <span aria-hidden className="hidden h-0 flex-1 -translate-y-1 border-b-2 border-dotted border-line sm:block" />
                    </span>
                    <span className="col-start-2 sm:col-start-auto sm:text-right">
                      {actor ? (
                        <span className="font-sans text-lg">{actor.name}</span>
                      ) : (
                        <span className="font-sans text-lg text-muted italic">Por repartir</span>
                      )}
                    </span>
                  </summary>

                  <div className="paper mb-6 grid gap-x-12 gap-y-8 p-6 sm:ml-[76px] sm:p-8 lg:grid-cols-[minmax(0,1fr)_280px]">
                    <div className="min-w-0">
                      {traits.length > 0 ? (
                        <dl className="grid gap-x-8 gap-y-4 sm:grid-cols-2">
                          {traits.map(([k, v]) => (
                            <div key={k}>
                              <dt className={LABEL}>{k}</dt>
                              <dd className="mt-1 font-sans text-[15px] leading-relaxed">{v}</dd>
                            </div>
                          ))}
                        </dl>
                      ) : (
                        <p className="font-sans text-sm text-muted">
                          {c.screenplayId ? "La ficha del guion aún está vacía." : "Sin ficha de guion."}
                        </p>
                      )}
                      {gallery.length > 1 && (
                        <div className="mt-6 flex gap-2">
                          {gallery.slice(0, 6).map((img) => (
                            // eslint-disable-next-line @next/next/no-img-element -- imágenes de la ficha
                            <img key={img.id} src={img.url} alt={img.caption ?? ""} className="h-20 w-16 object-cover" />
                          ))}
                        </div>
                      )}
                      {c.screenplayId && (
                        <Link
                          href={`/app/guiones/${c.screenplayId}?paso=idea`}
                          className="mt-5 inline-block font-mono text-[11px] tracking-widest text-accent uppercase hover:underline"
                        >
                          Editar la ficha en el guion{p?.screenplayTitle ? ` «${p.screenplayTitle}»` : ""} →
                        </Link>
                      )}
                    </div>

                    <div className="space-y-6">
                      <div>
                        <p className={LABEL}>Actor</p>
                        <form action={updateCharacterActor.bind(null, projectId, c.id)} className="mt-2">
                          <ActorAssignmentField actors={actors} defaultActorId={c.actorId ?? ""} conflicts={conflictsFor(c.id)} />
                        </form>
                        {actor && (actor.email || actor.phone) && (
                          <p className="mt-1 font-mono text-[11px] text-muted">{[actor.email, actor.phone].filter(Boolean).join(" · ")}</p>
                        )}
                      </div>
                      <form action={updateCharacter.bind(null, projectId, c.id)} className="space-y-3">
                        <label className="block">
                          <span className={LABEL}>Nombre</span>
                          <input name="name" required defaultValue={c.name} className={FIELD} />
                        </label>
                        <label className="block">
                          <span className={LABEL}>Notas de producción</span>
                          <input name="notes" defaultValue={c.notes ?? ""} placeholder="Vestuario, maquillaje, dobles…" className={FIELD} />
                        </label>
                        <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="link-action text-fg">
                          Guardar
                        </SubmitButton>
                      </form>
                      <form action={deleteCharacter.bind(null, projectId, c.id)}>
                        <DeleteButton confirmMessage="¿Eliminar este personaje?" className="link-action">
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

        <form
          id="nuevo-personaje"
          action={createCharacter.bind(null, projectId)}
          className="grid scroll-mt-32 items-end gap-x-5 gap-y-3 py-6 sm:grid-cols-[56px_1fr_minmax(0,220px)_auto]"
        >
          <span aria-hidden className="hidden h-11 w-11 place-items-center rounded-full border border-dashed border-line text-muted sm:grid">
            +
          </span>
          <label className="block">
            <span className="sr-only">Nombre del personaje nuevo</span>
            <input name="name" required placeholder="Nuevo personaje" className={`${FIELD} font-display text-xl font-black uppercase`} />
          </label>
          <label className="block">
            <span className="sr-only">Actor</span>
            <select name="actorId" defaultValue="" className={FIELD}>
              <option value="" className="bg-bg">
                Por repartir
              </option>
              {actors.map((a) => (
                <option key={a.id} value={a.id} className="bg-bg">
                  {a.name}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="link-action text-fg">
            Añadir
          </SubmitButton>
        </form>
      </section>

      {/* ------------------------------------------------ actores */}
      <section id="actores" aria-labelledby="actores-title" className="mt-20 scroll-mt-32">
        <div className="flex items-baseline justify-between border-b border-line pb-3">
          <h2 id="actores-title" className="font-display text-2xl font-black tracking-tight uppercase">
            Actores
          </h2>
          <span className="font-mono text-[11px] tracking-widest text-muted uppercase">{actors.length} en el proyecto</span>
        </div>

        <ul>
          {actors.map((a) => {
            const contact = [a.email, a.phone, a.rate != null ? `Caché ${a.rate} €` : null, a.availability].filter(Boolean);
            return (
              <li key={a.id} className="border-b border-line">
                <details className="group">
                  <summary className="flex cursor-pointer list-none flex-wrap items-baseline justify-between gap-x-6 gap-y-1 py-4">
                    <span className="font-sans text-xl transition-colors group-hover:text-accent">{a.name}</span>
                    <span className="font-mono text-[11px] text-muted">
                      {a.characters.length ? <span className="text-fg">es {a.characters.map((c) => c.name).join(", ")}</span> : "sin personaje"}
                      {contact.length > 0 && <> · {contact.join(" · ")}</>}
                    </span>
                  </summary>
                  <form action={updateActor.bind(null, projectId, a.id)} className="paper mb-5 grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
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
                      <label key={name} className="block">
                        <span className={LABEL}>{label}</span>
                        <input
                          name={name}
                          type={type}
                          step={type === "number" ? "0.01" : undefined}
                          required={name === "name"}
                          defaultValue={value}
                          className={FIELD}
                        />
                      </label>
                    ))}
                    <div className="flex items-end">
                      <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="link-action text-fg">
                        Guardar datos
                      </SubmitButton>
                    </div>
                  </form>
                  <form action={deleteActor.bind(null, projectId, a.id)} className="pb-5">
                    <DeleteButton confirmMessage="¿Eliminar este actor? Se desvinculará de sus personajes." className="link-action">
                      Eliminar actor
                    </DeleteButton>
                  </form>
                </details>
              </li>
            );
          })}
        </ul>

        <details className="group py-5">
          <summary className="cursor-pointer list-none font-mono text-[11px] tracking-widest text-muted uppercase hover:text-fg">
            <span className="group-open:hidden">+ Añadir actor</span>
            <span className="hidden group-open:inline">Nuevo actor</span>
          </summary>
          <form action={createActor.bind(null, projectId)} className="paper mt-4 grid gap-x-8 gap-y-4 p-6 sm:grid-cols-2 lg:grid-cols-3">
            <label className="block">
              <span className={LABEL}>Del directorio de Equipo</span>
              <select name="personId" defaultValue="" className={FIELD}>
                <option value="" className="bg-bg">
                  Persona nueva
                </option>
                {people.map((person) => (
                  <option key={person.id} value={person.id} className="bg-bg">
                    {person.firstName} {person.lastName ?? ""}
                  </option>
                ))}
              </select>
            </label>
            {(
              [
                ["name", "Nombre", "text", "si no está en Equipo"],
                ["email", "Email", "email", ""],
                ["phone", "Teléfono", "tel", ""],
                ["rate", "Caché (€)", "number", ""],
                ["availability", "Disponibilidad", "text", ""],
              ] as const
            ).map(([name, label, type, placeholder]) => (
              <label key={name} className="block">
                <span className={LABEL}>{label}</span>
                <input name={name} type={type} step={type === "number" ? "0.01" : undefined} placeholder={placeholder} className={FIELD} />
              </label>
            ))}
            <div className="flex items-end">
              <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="link-action text-fg">
                Añadir actor
              </SubmitButton>
            </div>
          </form>
        </details>
      </section>
    </div>
  );
}
