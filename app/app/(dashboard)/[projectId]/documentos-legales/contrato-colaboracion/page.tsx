import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PageHeader } from "@/components/PageHeader";
import { LEGAL_INPUT, LegalField, LegalTemplateForm } from "@/components/gestion/LegalTemplateForm";


export default async function ContratoColaboracionPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();
  if (!(await isProjectOwnerPro(project.organizationId))) notFound();

  const [actors, crewMembers] = await Promise.all([
    prisma.actor.findMany({ where: { projectId }, orderBy: { name: "asc" }, select: { name: true } }),
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { name: true, role: true },
    }),
  ]);
  const people = [
    ...actors.map((a) => a.name),
    ...crewMembers.map((c) => c.name),
  ];

  return (
    <div className="pb-16">
      <PageHeader
        backHref={`/app/${projectId}/documentos-legales`}
        backLabel="← Plantillas de documentos"
        eyebrow="Plantilla legal"
        title="Contrato de colaboración"
        description="Acuerdo básico con un actor o técnico: qué hace, cuándo y a cambio de qué."
      />

      <LegalTemplateForm
        action={`/api/pdf/legal/${projectId}/contrato-colaboracion`}
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
        <LegalField label="Rol / función">
          <input name="rol" placeholder="Ej. actor protagonista, director de fotografía" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Fechas de colaboración">
          <input name="fechas" placeholder="Ej. del 12 al 14 de octubre" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Remuneración / contraprestación">
          <input name="remuneracion" placeholder="Ej. 150 € por jornada, o copia del corto" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Condiciones adicionales">
          <input name="condiciones" className={LEGAL_INPUT} />
        </LegalField>
      </LegalTemplateForm>
    </div>
  );
}
