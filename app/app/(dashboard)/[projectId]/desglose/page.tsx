import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { DeleteButton } from "@/components/DeleteButton";
import {
  createBreakdownElement,
  createCrewMember,
  deleteBreakdownElement,
  deleteCrewMember,
  updateBreakdownElementCategory,
} from "@/lib/actions/breakdown";
import { BREAKDOWN_CATEGORY_LABELS } from "@/lib/labels";
import { EmptyState } from "@/components/EmptyState";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import { BreakdownCategorySelect } from "@/components/BreakdownCategorySelect";

export default async function DesglosePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [elements, crewMembers, people] = await Promise.all([
    prisma.breakdownElement.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        _count: { select: { scenes: true } },
      },
    }),
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        role: true,
        _count: { select: { scenes: true } },
      },
    }),
    prisma.person.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { firstName: "asc" },
      select: { id: true, firstName: true, lastName: true },
    }),
  ]);

  const elementsByCategory = Object.values(BreakdownCategory).map(
    (category) => ({
      category,
      items: elements.filter((el) => el.category === category),
    }),
  );

  const createElementAction = createBreakdownElement.bind(null, projectId);
  const createCrewAction = createCrewMember.bind(null, projectId);

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        title="Desglose"
      />
      <p className="mt-3 max-w-2xl font-sans text-sm text-muted">
        Catálogo de atrezzo, vestuario y equipo del proyecto. Se asigna a cada
        escena desde{" "}
        <Link href={`/app/${projectId}/guion`} className="text-fg hover:text-accent">
          Guion
        </Link>
        .
      </p>

      <section className="mt-8">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Elementos
        </h2>
        <form
          action={createElementAction}
          className="mt-4 grid gap-3 border border-line p-5 sm:grid-cols-3"
        >
          <FormField label="Categoría">
            <select
            name="category"
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            {Object.values(BreakdownCategory).map((value) => (
              <option key={value} value={value} className="bg-bg">
                {BREAKDOWN_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
          </FormField>
          <FormField label="Nombre">
            <input name="name"
            required
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
              Añadir
            </SubmitButton>
          </div>
        </form>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {elementsByCategory
            .filter((group) => group.items.length > 0)
            .map((group) => (
              <div key={group.category}>
                <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  {BREAKDOWN_CATEGORY_LABELS[group.category]}
                </p>
                <div className="mt-2 border-t border-line">
                  {group.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-3 border-b border-line py-2.5"
                    >
                      <span className="font-mono text-sm">{item.name}</span>
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-[11px] text-muted">
                          {item._count.scenes} escena
                          {item._count.scenes === 1 ? "" : "s"}
                        </span>
                        <BreakdownCategorySelect
                          category={item.category}
                          action={updateBreakdownElementCategory.bind(
                            null,
                            projectId,
                            item.id,
                          )}
                        />
                        <form
                          action={deleteBreakdownElement.bind(
                            null,
                            projectId,
                            item.id,
                          )}
                        >
                          <DeleteButton
                            confirmMessage="¿Eliminar este elemento del desglose?"
                            className="link-action"
                          />
                        </form>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
        {elements.length === 0 && (
          <EmptyState
            title="Todavía no hay elementos de desglose"
            description="Añade el primero con el formulario de arriba."
          />
        )}
      </section>

      <section className="mt-14">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Equipo técnico
        </h2>
        <form
          action={createCrewAction}
          className="mt-4 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-5"
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
          <FormField label="Rol">
            <input name="role"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          
            placeholder="Director de fotografía" />
          </FormField>
          <FormField label="Email">
            <input name="email"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
          </FormField>
          <FormField label="Teléfono">
            <input name="phone"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent" />
          </FormField>
          <div>
            <SubmitButton
              pendingLabel="Añadiendo…"
              savedLabel="✓ Añadido"
              className="btn btn-secondary"
            >
              Añadir
            </SubmitButton>
          </div>
        </form>

        {crewMembers.length === 0 ? (
          <EmptyState
            title="Todavía no hay equipo técnico"
            description="Añade el primer miembro con el formulario de arriba."
          />
        ) : (
          <div className="mt-6 border-t border-line">
            {crewMembers.map((member) => (
              <div
                key={member.id}
                className="flex items-center justify-between gap-3 border-b border-line py-3"
              >
                <div>
                  <span className="font-mono text-sm">{member.name}</span>
                  {member.role && (
                    <span className="ml-2 font-mono text-xs text-muted">
                      {member.role}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-[11px] text-muted">
                    {member._count.scenes} escena
                    {member._count.scenes === 1 ? "" : "s"}
                  </span>
                  <form action={deleteCrewMember.bind(null, projectId, member.id)}>
                    <DeleteButton
                      confirmMessage="¿Eliminar a este miembro del equipo?"
                      className="link-action"
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
