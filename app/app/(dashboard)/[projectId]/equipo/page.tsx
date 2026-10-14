import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { DeleteButton } from "@/components/DeleteButton";
import { createCrewMember, deleteCrewMember } from "@/lib/actions/breakdown";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import { CloseOnSaved, FormModal, ModalCancel } from "@/components/gestion/FormModal";

// Equipo técnico del proyecto: una lista de créditos (nombre, puesto y cómo
// localizar a cada persona). Añadir a alguien se hace en un diálogo; solo si
// todavía no hay nadie, el formulario se ve directamente como primer paso.

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

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
  const empty = crewMembers.length === 0;

  const form = (inModal: boolean) => (
    <form action={createCrewAction} className={inModal ? "mt-5 space-y-4" : "grid gap-x-6 gap-y-4 sm:grid-cols-2"}>
      {people.length > 0 && (
        <FormField
          label="Del directorio de Equipo"
          hint="Si ya está en tu directorio, elígelo y se rellena solo."
          className={inModal ? "" : "sm:col-span-2"}
        >
          <select name="personId" defaultValue="" className="field w-full">
            <option value="" className="bg-bg">
              Persona nueva
            </option>
            {people.map((person) => (
              <option key={person.id} value={person.id} className="bg-bg">
                {person.firstName} {person.lastName ?? ""}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <FormField label="Nombre">
        <input name="name" placeholder="Nombre y apellidos" className="field w-full" />
      </FormField>
      <FormField label="Puesto">
        <input name="role" placeholder="Ej. Directora de fotografía" className="field w-full" />
      </FormField>
      <FormField label="Email">
        <input name="email" type="email" className="field w-full" />
      </FormField>
      <FormField label="Teléfono">
        <input name="phone" type="tel" className="field w-full" />
      </FormField>
      <div className={`flex items-center justify-end gap-4 ${inModal ? "pt-2" : "sm:col-span-2"}`}>
        {inModal && <ModalCancel />}
        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-primary">
          Añadir al equipo
        </SubmitButton>
        {inModal && <CloseOnSaved />}
      </div>
    </form>
  );

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preproducción"
        title="Equipo técnico"
        description="Quién trabaja en este proyecto y cómo localizarle. Se asigna a cada escena desde Guion y aparece en las hojas de llamada de los días en que trabaja."
        actions={
          !empty && (
            <FormModal label="+ Añadir persona" title="Añadir al equipo">
              {form(true)}
            </FormModal>
          )
        }
      />

      {empty ? (
        <section aria-labelledby="primero" className="mt-12 max-w-2xl">
          <h2 id="primero" className="font-display text-xl font-bold">
            Empieza por la primera persona
          </h2>
          <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
            Dirección de fotografía, sonido, arte… Con nombre y puesto basta; el contacto sirve para las hojas de llamada.
          </p>
          <div className="sheet mt-6 p-6 sm:p-8">{form(false)}</div>
        </section>
      ) : (
        <section aria-label="Equipo" className="mt-10">
          <p className="eyebrow">
            {crewMembers.length} {crewMembers.length === 1 ? "persona" : "personas"}
          </p>
          <ul className="sheet mt-3 divide-y divide-line px-5 sm:px-6">
            {crewMembers.map((member) => (
              <li
                key={member.id}
                className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-x-4 gap-y-1 py-4 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,16rem)_6rem_auto]"
              >
                <span
                  aria-hidden
                  className="grid h-10 w-10 place-items-center rounded-full bg-accent/12 font-display text-sm font-bold text-accent"
                >
                  {initials(member.name)}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-sans text-base font-medium">{member.name}</p>
                  <p className="truncate font-sans text-sm text-muted">{member.role || "Sin puesto"}</p>
                </div>
                <div className="col-start-2 row-start-2 min-w-0 font-mono text-xs text-muted sm:col-start-auto sm:row-start-auto">
                  {member.email && (
                    <a href={`mailto:${member.email}`} className="block truncate hover:text-accent">
                      {member.email}
                    </a>
                  )}
                  {member.phone && (
                    <a href={`tel:${member.phone.replace(/\s+/g, "")}`} className="block truncate hover:text-accent">
                      {member.phone}
                    </a>
                  )}
                  {!member.email && !member.phone && <span className="italic">Sin contacto</span>}
                </div>
                <p className="hidden font-mono text-xs text-muted tabular-nums sm:block">
                  {member._count.scenes === 0
                    ? "Sin escenas"
                    : `${member._count.scenes} escena${member._count.scenes === 1 ? "" : "s"}`}
                </p>
                <form action={deleteCrewMember.bind(null, projectId, member.id)} className="row-span-2 justify-self-end sm:row-span-1">
                  <DeleteButton confirmMessage="¿Eliminar a este miembro del equipo?" className="link-action">
                    Quitar
                  </DeleteButton>
                </form>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
