import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { DeleteButton } from "@/components/DeleteButton";
import { createCrewMember, deleteCrewMember } from "@/lib/actions/breakdown";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import { CloseOnSaved, FormModal, ModalCancel } from "@/components/gestion/FormModal";
import { NextTool, Notice, Notices, StatusLine } from "@/components/gestion/ToolStatus";
import { CREW_DEPARTMENTS, DEPARTMENT_ORDER, OTHER_DEPARTMENT, departmentFor } from "@/lib/crew-departments";

// Equipo técnico del proyecto como unos créditos: agrupado por departamento
// (deducido del puesto, ver lib/crew-departments.ts), con el puesto a un lado
// y el nombre al otro, y cómo localizar a cada persona. Arriba, qué
// departamentos tienen gente y cuáles faltan. Añadir a alguien se hace en un
// diálogo; solo si todavía no hay nadie, el formulario se ve como primer paso.

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

  const withDept = crewMembers.map((m) => ({ ...m, dept: departmentFor(m.role) }));
  const departments = DEPARTMENT_ORDER.map((id) => CREW_DEPARTMENTS.find((d) => d.id === id) ?? OTHER_DEPARTMENT).map(
    (dept) => ({ ...dept, members: withDept.filter((m) => m.dept.id === dept.id) }),
  );
  const staffed = departments.filter((d) => d.members.length > 0);
  const missingEssential = departments.filter((d) => d.essential && d.members.length === 0);
  const noContact = crewMembers.filter((m) => !m.email && !m.phone);
  const noScenes = crewMembers.filter((m) => m._count.scenes === 0);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preproducción"
        title="Equipo técnico"
        description="Quién hace qué en el rodaje, por departamentos, y cómo localizar a cada persona."
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
        <>
          <StatusLine tone={missingEssential.length > 0 || noContact.length > 0 ? "warn" : "ok"}>
            {crewMembers.length} {crewMembers.length === 1 ? "persona" : "personas"} en {staffed.length}{" "}
            {staffed.length === 1 ? "departamento" : "departamentos"}
            {missingEssential.length > 0 ? (
              <>
                {" · "}sin nadie en{" "}
                <strong className="font-semibold">{missingEssential.map((d) => d.title).join(", ")}</strong>.
              </>
            ) : (
              " · están cubiertos los departamentos básicos."
            )}
          </StatusLine>
          {(noContact.length > 0 || noScenes.length > 0) && (
            <Notices>
              {noContact.length > 0 && (
                <Notice>
                  Sin email ni teléfono: {noContact.map((m) => m.name).join(", ")}. No les llegará la hoja de llamada.
                </Notice>
              )}
              {noScenes.length > 0 && (
                <Notice action={{ label: "Asignar en Guion", href: `/app/${projectId}/guion` }}>
                  {noScenes.length === crewMembers.length
                    ? "Nadie del equipo está asignado a escenas todavía, así que no saldrán en las hojas de llamada."
                    : `${noScenes.length === 1 ? `${noScenes[0].name} no está` : `${noScenes.length} personas no están`} en ninguna escena, así que no ${noScenes.length === 1 ? "saldrá" : "saldrán"} en las hojas de llamada.`}
                </Notice>
              )}
            </Notices>
          )}

          {/* Índice de departamentos: quién hay y qué falta, de un vistazo */}
          <nav aria-label="Departamentos" className="mt-10">
            <ul className="flex flex-wrap gap-2">
              {departments
                .filter((d) => d.members.length > 0 || d.essential)
                .map((d) => (
                  <li key={d.id}>
                    {d.members.length > 0 ? (
                      <a
                        href={`#dep-${d.id}`}
                        className="inline-flex items-center gap-2 rounded-full bg-fg/[0.06] px-3 py-1.5 font-sans text-[13px] transition-colors hover:bg-accent/15 hover:text-fg"
                      >
                        {d.title}
                        <span className="font-mono text-[11px] text-muted tabular-nums">{d.members.length}</span>
                      </a>
                    ) : (
                      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1.5 font-sans text-[13px] text-warn ring-1 ring-warn/50 ring-inset">
                        {d.title}
                        <span className="font-mono text-[11px]">falta</span>
                      </span>
                    )}
                  </li>
                ))}
            </ul>
          </nav>

          {/* Créditos */}
          <section aria-label="Equipo por departamentos" className="sheet mt-6 px-5 sm:px-8">
            {staffed.map((dept, di) => (
              <section
                key={dept.id}
                id={`dep-${dept.id}`}
                aria-labelledby={`dep-title-${dept.id}`}
                className={`grid scroll-mt-32 gap-x-8 gap-y-1 py-5 md:grid-cols-[12rem_minmax(0,1fr)] ${di > 0 ? "border-t border-line" : ""}`}
              >
                <h2 id={`dep-title-${dept.id}`} className="pt-3 md:pt-3.5">
                  <span className="font-mono text-[11px] font-semibold tracking-[0.14em] text-accent uppercase">{dept.title}</span>
                </h2>
                <ul className="divide-y divide-line/60">
                  {dept.members.map((member) => (
                    <li
                      key={member.id}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-1.5 py-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,14rem)_6rem_auto]"
                    >
                      <div className="min-w-0">
                        <p className="truncate font-display text-lg leading-tight font-bold tracking-tight">{member.name}</p>
                        <p className="truncate font-sans text-[13px] text-muted">{member.role || "Sin puesto"}</p>
                      </div>
                      <form
                        action={deleteCrewMember.bind(null, projectId, member.id)}
                        className="justify-self-end lg:order-last"
                      >
                        <DeleteButton confirmMessage="¿Eliminar a este miembro del equipo?" className="link-action">
                          Quitar
                        </DeleteButton>
                      </form>
                      <div className="col-span-2 flex min-w-0 flex-wrap gap-x-4 font-mono text-xs text-muted lg:col-span-1 lg:block">
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
                        {!member.email && !member.phone && <span className="text-warn">Sin contacto</span>}
                      </div>
                      <p className="col-span-2 font-mono text-xs text-muted tabular-nums lg:col-span-1">
                        {member._count.scenes === 0
                          ? "Sin escenas"
                          : `${member._count.scenes} escena${member._count.scenes === 1 ? "" : "s"}`}
                      </p>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </section>

          <NextTool href={`/app/${projectId}/shot-list`} label="Lista de planos" note="qué planos rodar en cada escena" />
        </>
      )}
    </div>
  );
}
