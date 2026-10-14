import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PageHeader } from "@/components/PageHeader";
import { LEGAL_INPUT, LegalField, LegalTemplateForm } from "@/components/gestion/LegalTemplateForm";


export default async function CesionImagenPage({
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

  const actors = await prisma.actor.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    select: { name: true },
  });

  return (
    <div className="pb-16">
      <PageHeader
        backHref={`/app/${projectId}/documentos-legales`}
        backLabel="← Plantillas de documentos"
        eyebrow="Plantilla legal"
        title="Cesión de derechos de imagen"
        description="Para que una persona autorice usar su imagen y su voz en el proyecto y en su promoción."
      />

      <LegalTemplateForm
        action={`/api/pdf/legal/${projectId}/cesion-imagen`}
        slug="cesion-imagen"
        organizationName={organization?.name ?? ""}
        projectName={project.name}
        tip="«Nombre completo» te sugiere a los actores del proyecto mientras escribes."
      >
        <LegalField label="Nombre completo">
          <input name="nombre" list="actors-list" required className={LEGAL_INPUT} />
          <datalist id="actors-list">
            {actors.map((a) => (
              <option key={a.name} value={a.name} />
            ))}
          </datalist>
        </LegalField>
        <LegalField label="DNI / identificación">
          <input name="dni" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Uso autorizado">
          <input
            name="alcance"
            placeholder="Ej. promoción del proyecto en redes y festivales"
            className={LEGAL_INPUT}
          />
        </LegalField>
        <LegalField label="Duración">
          <input name="duracion" placeholder="Ej. indefinida, o 5 años" className={LEGAL_INPUT} />
        </LegalField>
      </LegalTemplateForm>
    </div>
  );
}
