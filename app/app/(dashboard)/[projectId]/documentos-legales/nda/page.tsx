import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PageHeader } from "@/components/PageHeader";
import { LEGAL_INPUT, LegalField, LegalTemplateForm } from "@/components/gestion/LegalTemplateForm";


export default async function NdaPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();
  // Sin PRO, a la lista de plantillas, que explica qué es y cómo tenerlo.
  if (!(await isProjectOwnerPro(project.organizationId))) redirect(`/app/${projectId}/documentos-legales`);
  const organization = await prisma.organization.findUnique({
    where: { id: project.organizationId },
    select: { name: true },
  });

  const [actors, crewMembers] = await Promise.all([
    prisma.actor.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.crewMember.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { name: true } }),
  ]);
  const people = [...actors.map((a) => a.name), ...crewMembers.map((c) => c.name)];

  return (
    <div className="pb-16">
      <PageHeader
        backHref={`/app/${projectId}/documentos-legales`}
        backLabel="← Contratos y permisos"
        eyebrow="Plantilla legal"
        title="Acuerdo de confidencialidad"
        description="Para quien vaya a leer el guion o ver material sin estrenar: se compromete a no contarlo ni difundirlo."
      />

      <LegalTemplateForm
        action={`/api/pdf/legal/${projectId}/nda`}
        slug="nda"
        organizationName={organization?.name ?? ""}
        projectName={project.name}
        tip="«Nombre completo» te sugiere a la gente del reparto y del equipo mientras escribes."
      >
        <LegalField label="Nombre completo">
          <input name="nombre" list="people-list" required className={LEGAL_INPUT} />
          <datalist id="people-list">
            {people.map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
        </LegalField>
        <LegalField label="DNI / identificación">
          <input name="dni" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Duración del acuerdo" wide>
          <input name="duracion" placeholder="Ej. hasta el estreno del proyecto, o 2 años" className={LEGAL_INPUT} />
        </LegalField>
      </LegalTemplateForm>
    </div>
  );
}
