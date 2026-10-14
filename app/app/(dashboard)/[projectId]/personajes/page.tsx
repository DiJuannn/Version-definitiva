import { CastBoard } from "@/components/CastBoard";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createActor, deleteActor, updateActor } from "@/lib/actions/actors";
import { DeleteButton } from "@/components/DeleteButton";
import {
  createCharacter,
  deleteCharacter,
  updateCharacter,
  updateCharacterActor,
} from "@/lib/actions/characters";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import { SectionTabs } from "@/components/SectionTabs";

export default async function PersonajesPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const { tab } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);

  if (!project) {
    notFound();
  }

  const [actorRows, characters, people] = await Promise.all([
    prisma.actor.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
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

  // El caché llega como Decimal de Prisma: se pasa a número para poder mandarlo a componentes de cliente.
  const actors = actorRows.map((a) => ({ ...a, rate: a.rate === null ? null : Number(a.rate) }));

  const createActorAction = createActor.bind(null, projectId);
  const createCharacterAction = createCharacter.bind(null, projectId);

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Preproducción"
        title="Personajes"
        description="El reparto: quién es cada personaje, qué actor lo interpreta y en cuántas escenas sale."
      />

      <div className="mt-8">
        <SectionTabs
          ariaLabel="Secciones de personajes"
          initial={tab}
          tabs={[
            {
              id: "personajes",
              label: "Personajes",
              count: characters.length,
              content: (
                <div>
                  <form action={createCharacterAction} className="flex flex-wrap items-end gap-3">
                    <FormField label="Nuevo personaje" className="min-w-[200px] flex-1">
                      <input name="name" required placeholder="Nombre" className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                    </FormField>
                    <FormField label="Actor" className="min-w-[180px]">
                      <select name="actorId" defaultValue="" className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent">
                        <option value="" className="bg-bg">
                          Sin actor
                        </option>
                        {actors.map((actor) => (
                          <option key={actor.id} value={actor.id} className="bg-bg">
                            {actor.name}
                          </option>
                        ))}
                      </select>
                    </FormField>
                    <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-secondary">
                      Añadir
                    </SubmitButton>
                  </form>

                  {characters.length === 0 ? (
                    <EmptyState
                      title="Todavía no hay personajes"
                      description="Añádelos arriba, o vincula un guion desde Guiones y aparecerán solos con su ficha."
                    />
                  ) : (
                    <CastBoard
                      characters={characters}
                      actors={actors}
                      update={(id) => updateCharacter.bind(null, projectId, id)}
                      updateActor={(id) => updateCharacterActor.bind(null, projectId, id)}
                      remove={(id) => deleteCharacter.bind(null, projectId, id)}
                    />
                  )}
                </div>
              ),
            },
            {
              id: "actores",
              label: "Actores",
              count: actors.length,
              content: (
                <div>
                          <form
                            action={createActorAction}
                            className="grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
                          >
                            <FormField label="Persona del directorio Equipo">
                              <select
                              name="personId"
                              defaultValue=""
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                            >
                              <option value="" className="bg-bg">
                                Persona nueva (sin usar el directorio)
                              </option>
                              {people.map((person) => (
                                <option key={person.id} value={person.id} className="bg-bg">
                                  {person.firstName} {person.lastName ?? ""}
                                </option>
                              ))}
                            </select>
                            </FormField>
                            <FormField label="Nombre">
                              <input name="name"
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          
                              placeholder="si no usas Equipo" />
                            </FormField>
                            <FormField label="Email de contacto">
                              <input name="email"
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                            </FormField>
                            <FormField label="Teléfono">
                              <input name="phone"
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                            </FormField>
                            <FormField label="Caché">
                              <input name="rate"
                              type="number"
                              step="0.01"
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                            </FormField>
                            <FormField label="Disponibilidad">
                              <input name="availability"
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                            </FormField>
                            <FormField label="Notas">
                              <input name="notes"
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                            </FormField>
                            <div>
                              <SubmitButton
                                pendingLabel="Añadiendo…"
                                savedLabel="✓ Añadido"
                                className="btn btn-secondary"
                              >
                                Añadir actor
                              </SubmitButton>
                            </div>
                          </form>

                          {actors.length === 0 ? (
                            <EmptyState
                              title="Todavía no hay actores"
                              description="Añade el primero con el formulario de arriba."
                            />
                          ) : (
                            <div className="mt-6 border-t border-line">
                              {actors.map((actor) => {
                                const details = [
                                  actor.email,
                                  actor.phone,
                                  actor.rate != null ? `Caché ${actor.rate} €` : null,
                                  actor.availability,
                                ].filter(Boolean);
                                return (
                                  <details key={actor.id} className="group border-b border-line">
                                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4">
                                      <div className="min-w-0">
                                        <p className="font-display text-lg font-bold">{actor.name}</p>
                                        <p className="font-mono text-xs text-muted">
                                          {details.length > 0
                                            ? details.join(" · ")
                                            : "Sin datos de contacto: pulsa para completarlos"}
                                        </p>
                                        {actor.characters.length > 0 && (
                                          <p className="mt-1 font-mono text-[11px] text-accent">
                                            Interpreta a {actor.characters.map((c) => c.name).join(", ")}
                                          </p>
                                        )}
                                      </div>
                                      {/* .link-action fija su propio display: va en un span interior para que hidden/group-open del exterior manden. */}
                                      <span className="shrink-0 group-open:hidden">
                                        <span className="link-action">Editar</span>
                                      </span>
                                      <span className="hidden shrink-0 group-open:inline">
                                        <span className="link-action">Cerrar</span>
                                      </span>
                                    </summary>
                                    <form
                                      action={updateActor.bind(null, projectId, actor.id)}
                                      className="grid gap-3 pb-5 sm:grid-cols-2 lg:grid-cols-3"
                                    >
                                      <FormField label="Nombre">
                                        <input name="name" required defaultValue={actor.name} className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                                      </FormField>
                                      <FormField label="Email de contacto">
                                        <input name="email" type="email" defaultValue={actor.email ?? ""} className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                                      </FormField>
                                      <FormField label="Teléfono">
                                        <input name="phone" type="tel" defaultValue={actor.phone ?? ""} className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                                      </FormField>
                                      <FormField label="Caché (€)">
                                        <input
                                          name="rate"
                                          type="number"
                                          step="0.01"
                                          defaultValue={actor.rate ?? ""}
                                          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                                        />
                                      </FormField>
                                      <FormField label="Disponibilidad">
                                        <input name="availability" defaultValue={actor.availability ?? ""} className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                                      </FormField>
                                      <FormField label="Notas">
                                        <input name="notes" defaultValue={actor.notes ?? ""} className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                                      </FormField>
                                      <div>
                                        <SubmitButton
                                          pendingLabel="Guardando…"
                                          savedLabel="✓ Guardado"
                                          className="btn btn-secondary"
                                        >
                                          Guardar datos
                                        </SubmitButton>
                                      </div>
                                    </form>
                                    <form action={deleteActor.bind(null, projectId, actor.id)} className="pb-4">
                                      <DeleteButton
                                        confirmMessage="¿Eliminar este actor? Se desvinculará de sus personajes."
                                        className="link-action"
                                      >
                                        Eliminar actor
                                      </DeleteButton>
                                    </form>
                                  </details>
                                );
                              })}
                            </div>
                          )}
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
