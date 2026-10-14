import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PageHeader } from "@/components/PageHeader";
import { EmptyState } from "@/components/EmptyState";

const TEMPLATES = [
  {
    href: "permiso-rodaje",
    title: "Permiso de rodaje",
    description: "Autorización para grabar en una localización o vía pública.",
    when: "Antes de rodar en cualquier sitio que no sea tuyo.",
  },
  {
    href: "cesion-imagen",
    title: "Cesión de derechos de imagen",
    description: "Autorización de una persona para usar su imagen en el proyecto.",
    when: "Con cada persona que salga reconocible en pantalla.",
  },
  {
    href: "contrato-colaboracion",
    title: "Contrato de colaboración",
    description: "Acuerdo básico con un actor o técnico que colabora en el proyecto.",
    when: "Al cerrar quién entra en el reparto o el equipo.",
  },
  {
    href: "autorizacion-menor",
    title: "Autorización de menor en pantalla",
    description: "Consentimiento del tutor legal para que un menor aparezca en el material.",
    when: "Siempre que aparezca alguien menor de edad.",
  },
  {
    href: "nda",
    title: "Acuerdo de confidencialidad",
    description: "Compromiso de no divulgar guion ni material no publicado del proyecto.",
    when: "Antes de enviar el guion o material sin estrenar.",
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
    <div className="pb-16">
      <PageHeader
        eyebrow="Gestión"
        title="Plantillas de documentos"
        description="Permisos, cesiones y contratos ya rellenos con los datos del proyecto. Elige uno, completa lo que falta y sale un PDF listo para imprimir y firmar."
      />

      {!isPro ? (
        <EmptyState
          title="Función de PRO"
          description="Pásate a PRO para generar permisos de rodaje, cesiones de imagen, contratos de colaboración y más, ya rellenos con los datos del proyecto."
          actionLabel="Ver planes"
          actionHref="/app/organizacion"
        />
      ) : (
        <>
          <ol className="sheet mt-10 divide-y divide-line px-5 sm:px-8">
            {TEMPLATES.map((template, index) => (
              <li key={template.href}>
                <Link
                  href={`/app/${projectId}/documentos-legales/${template.href}`}
                  className="group grid grid-cols-[2rem_minmax(0,1fr)_auto] items-baseline gap-x-4 py-5 sm:grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,18rem)_auto] sm:gap-x-6"
                >
                  <span aria-hidden className="col-start-1 row-start-1 font-mono text-xs text-muted tabular-nums">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="col-start-2 row-start-1 min-w-0">
                    <span className="block font-display text-lg font-bold tracking-tight transition-colors group-hover:text-accent">
                      {template.title}
                    </span>
                    <span className="mt-0.5 block font-sans text-sm text-muted">{template.description}</span>
                  </span>
                  <span className="col-start-2 row-start-2 mt-2 font-sans text-sm text-muted italic sm:col-start-3 sm:row-start-1 sm:mt-0">
                    {template.when}
                  </span>
                  <span
                    aria-hidden
                    className="col-start-3 row-start-1 font-mono text-[11px] tracking-widest whitespace-nowrap text-muted uppercase transition-colors group-hover:text-accent sm:col-start-4"
                  >
                    Rellenar →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
          <p className="mt-6 max-w-2xl border-l-2 border-warn pl-3 font-sans text-sm leading-relaxed text-muted">
            Son plantillas orientativas de producción: no sustituyen a una asesoría legal, y su validez cambia según el país.
          </p>
        </>
      )}
    </div>
  );
}
