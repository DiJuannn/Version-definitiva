import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { BackLink } from "@/components/BackLink";
import { EmptyState } from "@/components/EmptyState";

const TEMPLATES = [
  {
    href: "permiso-rodaje",
    title: "Permiso de rodaje",
    description: "Autorización para grabar en una localización o vía pública.",
  },
  {
    href: "cesion-imagen",
    title: "Cesión de derechos de imagen",
    description: "Autorización de una persona para usar su imagen en el proyecto.",
  },
  {
    href: "contrato-colaboracion",
    title: "Contrato de colaboración",
    description: "Acuerdo básico con un actor o técnico que colabora en el proyecto.",
  },
  {
    href: "autorizacion-menor",
    title: "Autorización de menor en pantalla",
    description: "Consentimiento del tutor legal para que un menor aparezca en el material.",
  },
  {
    href: "nda",
    title: "Acuerdo de confidencialidad",
    description: "Compromiso de no divulgar guion ni material no publicado del proyecto.",
  },
];

export default async function DocumentosLegalesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const isPro = await isProjectOwnerPro(project.organizationId);

  return (
    <div>
      <BackLink href={`/app/${projectId}`}>← {project.name}</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Plantilla de documentos
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Plantillas orientativas de producción, rellenas con los datos del
        proyecto y listas para imprimir y firmar. No sustituyen asesoría
        legal profesional — la validez varía según el país.
      </p>

      {!isPro ? (
        <div className="mt-8">
          <EmptyState
            title="Función de PRO"
            description="Pásate a PRO para generar permisos de rodaje, cesiones de imagen, contratos de colaboración y más, ya rellenos con los datos del proyecto."
            actionLabel="Ver planes"
            actionHref="/app/organizacion"
          />
        </div>
      ) : (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {TEMPLATES.map((template) => (
            <Link
              key={template.href}
              href={`/app/${projectId}/documentos-legales/${template.href}`}
              className="group border border-line p-5 transition-colors hover:border-accent"
            >
              <p className="font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
                {template.title}
              </p>
              <p className="mt-1 font-mono text-xs text-muted">{template.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
