import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PageHeader } from "@/components/PageHeader";
import { LEGAL_INPUT, LegalField, LegalTemplateForm } from "@/components/gestion/LegalTemplateForm";


export default async function PermisoRodajePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();
  if (!(await isProjectOwnerPro(project.organizationId))) notFound();
  const organization = await prisma.organization.findUnique({
    where: { id: project.organizationId },
    select: { name: true },
  });

  const locations = await prisma.location.findMany({
    where: { organizationId: project.organizationId },
    orderBy: { name: "asc" },
    select: { name: true, address: true },
  });

  return (
    <div className="pb-16">
      <PageHeader
        backHref={`/app/${projectId}/documentos-legales`}
        backLabel="← Plantillas de documentos"
        eyebrow="Plantilla legal"
        title="Permiso de rodaje"
        description="Para que el propietario o responsable de un sitio autorice grabar allí, con fechas y horario."
      />

      <LegalTemplateForm
        action={`/api/pdf/legal/${projectId}/permiso-rodaje`}
        slug="permiso-rodaje"
        organizationName={organization?.name ?? ""}
        projectName={project.name}
        tip="«Localización» te sugiere las de tu biblioteca mientras escribes."
      >
        <LegalField label="Localización">
          <input name="localizacion" list="locations-list" required className={LEGAL_INPUT} />
          <datalist id="locations-list">
            {locations.map((l) => (
              <option key={l.name} value={l.name} />
            ))}
          </datalist>
        </LegalField>
        <LegalField label="Dirección">
          <input name="direccion" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Fechas de rodaje">
          <input name="fechas" placeholder="Ej. 12-14 de octubre de 2026" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Horario">
          <input name="horario" placeholder="Ej. 08:00 - 20:00" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Nombre de quien autoriza">
          <input name="nombreAutoriza" required className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="DNI / identificación">
          <input name="dniAutoriza" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Condiciones especiales" wide>
          <textarea name="condiciones" rows={3} className={`${LEGAL_INPUT} resize-y`} />
        </LegalField>
      </LegalTemplateForm>
    </div>
  );
}
