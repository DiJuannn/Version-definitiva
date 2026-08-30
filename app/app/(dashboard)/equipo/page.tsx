import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createPerson } from "@/lib/actions/people";

export default async function EquipoPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const people = await prisma.person.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { firstName: "asc" },
    include: {
      _count: { select: { actors: true, crewMembers: true } },
    },
  });

  return (
    <div>
      <Link
        href="/app"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Taller
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">Equipo</h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Directorio de personas de la organización — se enlazan a Personajes
        (Actor) y Desglose (Equipo técnico) de cualquier proyecto.
      </p>

      <form
        action={createPerson}
        className="mt-8 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input
          name="firstName"
          placeholder="Nombre"
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="lastName"
          placeholder="Apellidos"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="primaryRole"
          placeholder="Rol principal"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="email"
          placeholder="Email"
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
          placeholder="Tarifa"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <div>
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Añadir persona
          </button>
        </div>
      </form>

      {people.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          Todavía no hay nadie en el equipo.
        </p>
      ) : (
        <div className="mt-10 border-t border-line">
          {people.map((person) => (
            <Link
              key={person.id}
              href={`/app/equipo/${person.id}`}
              className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:border-accent"
            >
              <div>
                <span className="font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
                  {person.firstName} {person.lastName ?? ""}
                </span>
                <p className="font-mono text-xs text-muted">
                  {person.primaryRole ?? "Sin rol definido"}
                </p>
              </div>
              <span className="font-mono text-xs text-muted">
                {person._count.actors + person._count.crewMembers} proyecto
                {person._count.actors + person._count.crewMembers === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
