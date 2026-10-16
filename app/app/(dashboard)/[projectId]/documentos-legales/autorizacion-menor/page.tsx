import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PageHeader } from "@/components/PageHeader";
import { LEGAL_INPUT, LegalField, LegalTemplateForm } from "@/components/gestion/LegalTemplateForm";


export default async function AutorizacionMenorPage({
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

  return (
    <div className="pb-16">
      <PageHeader
        backHref={`/app/${projectId}/documentos-legales`}
        backLabel="← Contratos y permisos"
        eyebrow="Plantilla legal"
        title="Autorización de menor en pantalla"
        description="Consentimiento del padre, madre o tutor legal para que un menor aparezca en el material."
      />

      <LegalTemplateForm
        action={`/api/pdf/legal/${projectId}/autorizacion-menor`}
        slug="autorizacion-menor"
        organizationName={organization?.name ?? ""}
        projectName={project.name}
        warning="Revisa siempre este documento con asesoría legal antes de usarlo: con menores, las normas cambian mucho según el país y la comunidad."
      >
        <LegalField label="Nombre completo del menor" wide>
          <input name="nombreMenor" required className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Nombre del tutor o tutora legal">
          <input name="nombreTutor" required className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="DNI del tutor o tutora">
          <input name="dniTutor" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Relación con el menor">
          <input name="relacion" placeholder="Ej. madre, padre, tutor legal" className={LEGAL_INPUT} />
        </LegalField>
        <LegalField label="Condiciones específicas" wide>
          <textarea
            name="condiciones"
            rows={3}
            placeholder="Ej. horario limitado, presencia del tutor en el set..."
            className={`${LEGAL_INPUT} resize-y`}
          />
        </LegalField>
      </LegalTemplateForm>
    </div>
  );
}
