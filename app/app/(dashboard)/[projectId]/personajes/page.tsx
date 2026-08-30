import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createActor, deleteActor } from "@/lib/actions/actors";
import { DeleteButton } from "@/components/DeleteButton";
import {
  createCharacter,
  deleteCharacter,
  updateCharacterActor,
} from "@/lib/actions/characters";
import { EmptyState } from "@/components/EmptyState";

export default async function PersonajesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);

  if (!project) {
    notFound();
  }

  const [actors, characters, people] = await Promise.all([
    prisma.actor.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
    }),
    prisma.character.findMany({
      where: { projectId },
      orderBy: { createdAt: "desc" },
      include: { actor: true },
    }),
    prisma.person.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { firstName: "asc" },
    }),
  ]);

  const createActorAction = createActor.bind(null, projectId);
  const createCharacterAction = createCharacter.bind(null, projectId);

  return (
    <div>
      <Link
        href={`/app/${projectId}`}
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Personajes
      </h1>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
          Actores
        </h2>

        <form
          action={createActorAction}
          className="mt-4 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <select
            name="personId"
            defaultValue=""
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            <option value="" className="bg-bg">
              Crear nuevo (sin vincular a Equipo)
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id} className="bg-bg">
                {person.firstName} {person.lastName ?? ""}
              </option>
            ))}
          </select>
          <input
            name="name"
            placeholder="Nombre (si no usas Equipo)"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <input
            name="email"
            placeholder="Email de contacto"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <input
            name="phone"
            placeholder="Teléfono"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <input
            name="rate"
            type="number"
            step="0.01"
            placeholder="Caché"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <input
            name="availability"
            placeholder="Disponibilidad"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <input
            name="notes"
            placeholder="Notas"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <div>
            <button
              type="submit"
              className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
            >
              Añadir actor
            </button>
          </div>
        </form>

        {actors.length === 0 ? (
          <EmptyState
            title="Todavía no hay actores"
            description="Añade el primero con el formulario de arriba."
          />
        ) : (
          <div className="mt-6 border-t border-line">
            {actors.map((actor) => (
              <div
                key={actor.id}
                className="flex items-center justify-between gap-4 border-b border-line py-4"
              >
                <div>
                  <p className="font-display text-lg font-bold uppercase">
                    {actor.name}
                  </p>
                  <p className="font-mono text-xs text-muted">
                    {[actor.email, actor.phone, actor.availability]
                      .filter(Boolean)
                      .join(" · ") || "Sin datos de contacto"}
                  </p>
                </div>
                <form action={deleteActor.bind(null, projectId, actor.id)}>
                  <DeleteButton
                    confirmMessage="¿Eliminar este actor? Se desvinculará de sus personajes."
                    className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
                  />
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-14">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
          Personajes
        </h2>

        <form
          action={createCharacterAction}
          className="mt-4 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <input
            name="name"
            placeholder="Nombre del personaje"
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
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
          <input
            name="notes"
            placeholder="Notas"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <div>
            <button
              type="submit"
              className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
            >
              Añadir personaje
            </button>
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
                  <p className="font-display text-lg font-bold uppercase">
                    {character.name}
                  </p>
                  {character.notes && (
                    <p className="font-mono text-xs text-muted">
                      {character.notes}
                    </p>
                  )}
                </div>

                <div className="flex items-center gap-4">
                  <form
                    action={updateCharacterActor.bind(
                      null,
                      projectId,
                      character.id,
                    )}
                    className="flex items-center gap-2"
                  >
                    <select
                      name="actorId"
                      defaultValue={character.actorId ?? ""}
                      className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                    >
                      <option value="" className="bg-bg">
                        Sin actor
                      </option>
                      {actors.map((actor) => (
                        <option key={actor.id} value={actor.id} className="bg-bg">
                          {actor.name}
                        </option>
                      ))}
                    </select>
                    <button
                      type="submit"
                      className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
                    >
                      Guardar
                    </button>
                  </form>

                  <form
                    action={deleteCharacter.bind(null, projectId, character.id)}
                  >
                    <DeleteButton
                      confirmMessage="¿Eliminar este personaje?"
                      className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
                    />
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
