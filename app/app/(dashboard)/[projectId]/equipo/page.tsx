import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { DeleteButton } from "@/components/DeleteButton";
import { createCrewMember, deleteCrewMember } from "@/lib/actions/breakdown";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";

const inputClass =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

export default async function EquipoPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [crewMembers, people] = await Promise.all([
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        email: true,
        phone: true,
        _count: { select: { scenes: true } },
      },
    }),
    prisma.person.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const createCrewAction = createCrewMember.bind(null, projectId);

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Preproducción"
        title="Equipo técnico"
        description="Quién forma el equipo de este proyecto — se asigna a cada escena desde Guion, y aparece en las hojas de llamada de los días en que trabaja."
      />

      <form
        action={createCrewAction}
        className="mt-8 grid gap-3 border border-line p-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <FormField label="Persona del directorio Equipo" className="sm:col-span-2 xl:col-span-3">
          <select name="personId" defaultValue="" className={inputClass}>
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
          <input name="name" placeholder="si no usas Equipo" className={inputClass} />
        </FormField>
        <FormField label="Rol">
          <input name="role" placeholder="Director de fotografía" className={inputClass} />
        </FormField>
        <FormField label="Email">
          <input name="email" className={inputClass} />
        </FormField>
        <FormField label="Teléfono">
          <input name="phone" className={inputClass} />
        </FormField>
        <div className="sm:col-span-2 xl:col-span-3">
          <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-secondary">
            Añadir
          </SubmitButton>
        </div>
      </form>

      {crewMembers.length === 0 ? (
        <p className="mt-6 font-mono text-sm text-muted">
          Aún no hay equipo técnico. Añade el primer miembro arriba.
        </p>
      ) : (
        <div className="mt-6 border-t border-line">
          {crewMembers.map((member) => (
            <div
              key={member.id}
              className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3"
            >
              <div className="min-w-0">
                <span className="font-mono text-sm">{member.name}</span>
                {member.role && <span className="ml-2 font-mono text-xs text-muted">{member.role}</span>}
                {(member.email || member.phone) && (
                  <div className="font-mono text-[11px] text-muted">
                    {[member.email, member.phone].filter(Boolean).join(" · ")}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-3">
                <span className="font-mono text-[11px] text-muted">
                  {member._count.scenes} escena{member._count.scenes === 1 ? "" : "s"}
                </span>
                <form action={deleteCrewMember.bind(null, projectId, member.id)}>
                  <DeleteButton confirmMessage="¿Eliminar a este miembro del equipo?" className="link-action" />
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
