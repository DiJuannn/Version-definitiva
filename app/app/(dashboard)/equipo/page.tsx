import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createPerson } from "@/lib/actions/people";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";

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
      <PageHeader
        backHref="/app"
        backLabel="← Taller"
        title="Equipo"
      />
      <p className="mt-3 max-w-2xl font-sans text-sm text-muted">
        Directorio de personas de la organización — se enlazan a Personajes
        (Actor) y Desglose (Equipo técnico) de cualquier proyecto.
      </p>

      <form
        action={createPerson}
        className="mt-8 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FormField label="Nombre">
            <input name="firstName"
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
          </FormField>
        <FormField label="Apellidos">
            <input name="lastName"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
          </FormField>
        <FormField label="Rol principal">
            <input name="primaryRole"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
          </FormField>
        <FormField label="Email">
            <input name="email"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
          </FormField>
        <FormField label="Teléfono">
            <input name="phone"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
          </FormField>
        <FormField label="Tarifa">
            <input name="rate"
          type="number"
          step="0.01"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
          </FormField>
        <div>
          <SubmitButton
            pendingLabel="Añadiendo…"
            savedLabel="✓ Añadida"
            className="btn btn-secondary"
          >
            Añadir persona
          </SubmitButton>
        </div>
      </form>

      {people.length === 0 ? (
        <EmptyState
          title="Todavía no hay nadie en el equipo"
          description="Añade a la primera persona con el formulario de arriba."
        />
      ) : (
        <div className="mt-10 border-t border-line">
          {people.map((person) => (
            <Link
              key={person.id}
              href={`/app/equipo/${person.id}`}
              className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:border-accent"
            >
              <div>
                <span className="font-display text-lg font-bold transition-colors group-hover:text-accent">
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
