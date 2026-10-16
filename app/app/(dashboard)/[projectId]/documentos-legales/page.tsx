import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GUIDES } from "@/lib/tool-guides";
import { EmptyState } from "@/components/EmptyState";
import { StatusLine } from "@/components/gestion/ToolStatus";

type Template = {
  href: string;
  title: string;
  description: string;
  when: string;
  // Para contar cuántos firmados hay ya en la Biblioteca (por el nombre del archivo).
  match: RegExp;
};

// Las plantillas ordenadas por el momento del rodaje en que se necesitan,
// que es como se buscan: «voy a rodar en un sitio», «entra alguien nuevo»,
// «voy a mandar el guion».
const MOMENTS: { title: string; templates: Template[] }[] = [
  {
    title: "Antes de rodar en un sitio",
    templates: [
      {
        href: "permiso-rodaje",
        title: "Permiso de rodaje",
        description: "Autorización del responsable para grabar en una localización o en la vía pública.",
        when: "En cualquier sitio que no sea tuyo.",
        match: /permiso|licencia/,
      },
    ],
  },
  {
    title: "Con cada persona que participa",
    templates: [
      {
        href: "contrato-colaboracion",
        title: "Contrato de colaboración",
        description: "Acuerdo básico con un actor o técnico: puesto, fechas y lo que cobra (o que no cobra).",
        when: "Al cerrar quién entra en el reparto o el equipo.",
        match: /contrato/,
      },
      {
        href: "cesion-imagen",
        title: "Cesión de derechos de imagen",
        description: "Autorización de una persona para que usemos su imagen en el proyecto.",
        when: "Con cada persona que salga reconocible en pantalla.",
        match: /cesion|derechos de imagen/,
      },
      {
        href: "autorizacion-menor",
        title: "Autorización de menor en pantalla",
        description: "Consentimiento del tutor legal para que un menor aparezca en el material.",
        when: "Siempre que aparezca alguien menor de edad.",
        match: /menor/,
      },
    ],
  },
  {
    title: "Antes de compartir el guion",
    templates: [
      {
        href: "nda",
        title: "Acuerdo de confidencialidad",
        description: "Compromiso de no contar ni difundir el guion ni el material sin estrenar.",
        when: "Antes de enviar material a alguien de fuera.",
        match: /confidencialidad|nda/,
      },
    ],
  },
];

const normalize = (s: string) => s.toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");

// Miniatura decorativa de un documento: una hoja con título y renglones.
function DocThumb() {
  return (
    <span aria-hidden className="relative block h-[4.5rem] w-14 shrink-0 rounded-[3px] bg-fg/85 px-2 pt-2.5 transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none">
      <span className="mx-auto block h-1 w-7 rounded-full bg-bg/70" />
      <span className="mt-2 block space-y-1">
        {[100, 92, 100, 70, 96].map((w, i) => (
          <span key={i} className="block h-[2px] rounded-full bg-bg/30" style={{ width: `${w}%` }} />
        ))}
      </span>
      <span className="absolute right-2 bottom-2.5 left-2 flex justify-between gap-1.5">
        <span className="h-[2px] flex-1 bg-bg/50" />
        <span className="h-[2px] flex-1 bg-bg/50" />
      </span>
    </span>
  );
}

export default async function DocumentosLegalesPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [isPro, documents] = await Promise.all([
    isProjectOwnerPro(project.organizationId),
    // Solo lectura: cuántos firmados de cada tipo hay ya subidos.
    prisma.document.findMany({ where: { projectId }, select: { fileName: true } }),
  ]);
  const names = documents.map((d) => normalize(d.fileName));
  const signedCount = (t: Template) => names.filter((n) => t.match.test(n)).length;

  return (
    <div className="pb-16">
      <PageHeader
        guide={TOOL_GUIDES["documentos-legales"]}
        eyebrow="Entregar"
        title="Contratos y permisos"
        description="Permisos, contratos y cesiones ya escritos con los datos del proyecto: rellenas cuatro huecos y sale el PDF para firmar."
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
          <StatusLine>
            Elige el documento según el momento del rodaje. Cuando esté firmado, súbelo a la{" "}
            <Link href={`/app/${projectId}/documentos`} className="text-accent underline-offset-4 hover:underline">
              Biblioteca
            </Link>{" "}
            y aquí verás cuántos tienes.
          </StatusLine>

          <div className="mt-10 space-y-12">
            {MOMENTS.map((moment, mi) => (
              <section key={moment.title} aria-labelledby={`momento-${mi}`}>
                <h2 id={`momento-${mi}`} className="flex items-baseline gap-3">
                  <span className="font-mono text-[11px] text-accent tabular-nums">{String(mi + 1).padStart(2, "0")}</span>
                  <span className="font-display text-lg font-black tracking-tight sm:text-xl">{moment.title}</span>
                </h2>
                <ul className="sheet mt-4 divide-y divide-line px-5 sm:px-6">
                  {moment.templates.map((template) => {
                    const signed = signedCount(template);
                    return (
                      <li key={template.href}>
                        <Link
                          href={`/app/${projectId}/documentos-legales/${template.href}`}
                          className="group flex items-center gap-5 py-5"
                        >
                          <DocThumb />
                          <span className="grid min-w-0 flex-1 gap-x-8 gap-y-1.5 md:grid-cols-[minmax(0,1fr)_14rem]">
                            <span className="min-w-0">
                              <span className="block font-display text-lg leading-tight font-bold tracking-tight transition-colors group-hover:text-accent">
                                {template.title}
                              </span>
                              <span className="mt-1 block font-sans text-sm leading-relaxed text-muted">
                                {template.description}
                              </span>
                            </span>
                            <span className="font-sans text-sm leading-relaxed">
                              <span className="eyebrow block">Cuándo</span>
                              <span className="text-fg/90">{template.when}</span>
                              {signed > 0 && (
                                <span className="mt-1 block font-mono text-[11px] text-success">
                                  ✓ {signed} firmado{signed === 1 ? "" : "s"} en la Biblioteca
                                </span>
                              )}
                            </span>
                          </span>
                          <span
                            aria-hidden
                            className="hidden shrink-0 font-mono text-[11px] tracking-widest whitespace-nowrap text-muted uppercase transition-colors group-hover:text-accent sm:block"
                          >
                            Rellenar →
                          </span>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </div>

          <p className="mt-10 max-w-2xl border-l-2 border-warn pl-3 font-sans text-sm leading-relaxed text-muted">
            Son plantillas orientativas de producción: no sustituyen a una asesoría legal, y su validez cambia según el país.
          </p>
        </>
      )}
    </div>
  );
}
