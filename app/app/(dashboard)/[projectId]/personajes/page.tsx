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
import { ActorAssignmentField } from "@/components/ActorAssignmentField";
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
      orderBy: { createdAt: "desc" },
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
        description="El reparto: qué actor interpreta a cada personaje."
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
                          <form
                            action={createCharacterAction}
                            className="grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
                          >
                            <FormField label="Nombre del personaje">
                              <input name="name"
                              required
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
                            </FormField>
                            <FormField label="Actor">
                              <select
                              name="actorId"
                              defaultValue=""
                              className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                            >
                              <option value="" className="bg-bg">
                                Sin actor asignado
                              </option>
                              {actors.map((actor) => (
                                <option key={actor.id} value={actor.id} className="bg-bg">
                                  {actor.name}
                                </option>
                              ))}
                            </select>
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
                                Añadir personaje
                              </SubmitButton>
                            </div>
                          </form>

                          {characters.length === 0 ? (
                            <EmptyState
                              title="Todavía no hay personajes"
                              description="Añade el primero con el formulario de arriba."
                            />
                          ) : (
                            <div className="mt-6 border-t border-line">
                              {characters.map((character) => (
                                <div
                                  key={character.id}
                                  className="flex flex-wrap items-center justify-between gap-4 border-b border-line py-4"
                                >
                                  <div>
                                    <p className="font-display text-lg font-bold">
                                      {character.name}
                                    </p>
                                    {character.notes && (
                                      <p className="font-mono text-xs text-muted">
                                        {character.notes}
                                      </p>
                                    )}
                                    <details className="mt-2">
                                      <summary className="link-action inline-block cursor-pointer list-none">
                                        Editar nombre y notas
                                      </summary>
                                      <form
                                        action={updateCharacter.bind(null, projectId, character.id)}
                                        className="mt-3 grid gap-3 sm:grid-cols-2"
                                      >
                                        <FormField label="Nombre del personaje">
                                          <input
                                            name="name"
                                            required
                                            defaultValue={character.name}
                                            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                                          />
                                        </FormField>
                                        <FormField label="Notas">
                                          <input
                                            name="notes"
                                            defaultValue={character.notes ?? ""}
                                            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
                                          />
                                        </FormField>
                                        <div>
                                          <SubmitButton
                                            pendingLabel="Guardando…"
                                            savedLabel="✓ Guardado"
                                            className="btn btn-secondary"
                                          >
                                            Guardar
                                          </SubmitButton>
                                        </div>
                                      </form>
                                    </details>
                                  </div>

                                  <div className="flex items-center gap-4">
                                    <form
                                      action={updateCharacterActor.bind(
                                        null,
                                        projectId,
                                        character.id,
                                      )}
                                    >
                                      <ActorAssignmentField
                                        actors={actors}
                                        defaultActorId={character.actorId ?? ""}
                                        conflicts={Object.fromEntries(
                                          characters
                                            .filter((c) => c.id !== character.id && c.actorId)
                                            .map((c) => [c.actorId as string, c.name]),
                                        )}
                                      />
                                    </form>

                                    <form
                                      action={deleteCharacter.bind(null, projectId, character.id)}
                                    >
                                      <DeleteButton
                                        confirmMessage="¿Eliminar este personaje?"
                                        className="link-action"
                                      />
                                    </form>
                                  </div>
                                </div>
                              ))}
                            </div>
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
