import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteDocument, uploadDocument } from "@/lib/actions/documents";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { FileOpenLink } from "@/components/FileOpenLink";
import { SubmitButton } from "@/components/SubmitButton";
import { SectionTabs } from "@/components/SectionTabs";

export default async function DocumentosPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const { tab } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [scriptFiles, documents, actors, locations, shootingDays] =
    await Promise.all([
      prisma.scriptFile.findMany({
        where: { projectId },
        orderBy: { uploadedAt: "desc" },
      }),
      prisma.document.findMany({
        where: { projectId },
        orderBy: { uploadedAt: "desc" },
        include: {
          actor: { select: { name: true } },
          location: { select: { name: true } },
        },
      }),
      prisma.actor.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.location.findMany({
        where: { organizationId: project.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.shootingDay.findMany({
        where: { projectId },
        orderBy: { date: "asc" },
        select: { id: true, date: true, callSheet: { select: { id: true } } },
      }),
    ]);

  const uploadAction = uploadDocument.bind(null, projectId);

  const exports = [
    { label: "Shot list", href: `/app/${projectId}/shot-list` },
    { label: "Storyboard", href: `/app/${projectId}/storyboard` },
    { label: "Presupuesto", href: `/app/${projectId}/presupuesto` },
  ];

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Gestión"
        title="Biblioteca de archivos"
        description="Contratos, permisos y archivos del proyecto, junto con lo que generas en otras herramientas."
      />

      <div className="mt-8">
        <SectionTabs
          ariaLabel="Secciones de la biblioteca"
          initial={tab}
          tabs={[
            {
              id: "documentos",
              label: "Documentos",
              count: documents.length,
              content: (
                <div>
                          <form
                            action={uploadAction}
                            className="grid gap-2 border border-line p-4 sm:grid-cols-2 lg:grid-cols-4"
                          >
                            <input
                              type="file"
                              name="file"
                              required
                              className="font-mono text-xs text-muted sm:col-span-2 lg:col-span-1"
                            />
                            <select
                              name="actorId"
                              defaultValue=""
                              className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                            >
                              <option value="" className="bg-bg">
                                Sin actor
                              </option>
                              {actors.map((a) => (
                                <option key={a.id} value={a.id} className="bg-bg">
                                  {a.name}
                                </option>
                              ))}
                            </select>
                            <select
                              name="locationId"
                              defaultValue=""
                              className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                            >
                              <option value="" className="bg-bg">
                                Sin localización
                              </option>
                              {locations.map((l) => (
                                <option key={l.id} value={l.id} className="bg-bg">
                                  {l.name}
                                </option>
                              ))}
                            </select>
                            <SubmitButton
                              pendingLabel="Subiendo…"
                              savedLabel="✓ Subido"
                              className="btn btn-secondary btn-sm"
                            >
                              Subir
                            </SubmitButton>
                          </form>

                          {documents.length === 0 ? (
                            <EmptyState
                              title="Todavía no hay otros documentos"
                              description="Súbelos con el formulario de arriba (contratos, permisos, etc.)."
                            />
                          ) : (
                            <div className="mt-4 border-t border-line">
                              {documents.map((doc) => (
                                <div
                                  key={doc.id}
                                  className="flex items-center justify-between gap-4 border-b border-line py-3"
                                >
                                  <FileOpenLink
                                    href={doc.fileUrl}
                                    className="font-mono text-sm hover:text-accent"
                                  >
                                    {doc.fileName}
                                  </FileOpenLink>
                                  <div className="flex items-center gap-3">
                                    <span className="font-mono text-xs text-muted">
                                      {[doc.actor?.name, doc.location?.name].filter(Boolean).join(" · ")}
                                    </span>
                                    <form action={deleteDocument.bind(null, projectId, doc.id)}>
                                      <DeleteButton
                                        confirmMessage="¿Eliminar este documento?"
                                        className="link-action"
                                      />
                                    </form>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                </div>
              ),
            },
            {
              id: "guion",
              label: "Guion",
              count: scriptFiles.length,
              content: (
                <div>
                          {scriptFiles.length === 0 ? (
                            <p className="mt-3 font-mono text-sm text-muted">
                              Sin guion subido todavía en{" "}
                              <Link href={`/app/${projectId}/guion`} className="text-fg hover:text-accent">
                                Guion
                              </Link>
                              .
                            </p>
                          ) : (
                            <div className="mt-3 border-t border-line">
                              {scriptFiles.map((file) => (
                                <FileOpenLink
                                  key={file.id}
                                  href={file.fileUrl}
                                  className="flex items-center justify-between border-b border-line py-3 font-mono text-sm hover:text-accent"
                                >
                                  {file.fileName}
                                  <span className="font-mono text-xs text-muted">
                                    {file.uploadedAt.toLocaleDateString("es-ES")}
                                  </span>
                                </FileOpenLink>
                              ))}
                            </div>
                          )}
                </div>
              ),
            },
            {
              id: "call-sheets",
              label: "Call sheets",
              count: shootingDays.filter((d) => d.callSheet).length,
              content: (
                <div>
                          {shootingDays.filter((d) => d.callSheet).length === 0 ? (
                            <p className="mt-3 font-mono text-sm text-muted">
                              Sin call sheets generados todavía en{" "}
                              <Link
                                href={`/app/${projectId}/plan-de-rodaje`}
                                className="text-fg hover:text-accent"
                              >
                                Plan de rodaje
                              </Link>
                              .
                            </p>
                          ) : (
                            <div className="mt-3 border-t border-line">
                              {shootingDays
                                .filter((d) => d.callSheet)
                                .map((day) => (
                                  <Link
                                    key={day.id}
                                    href={`/app/${projectId}/call-sheets/${day.id}`}
                                    className="flex items-center justify-between border-b border-line py-3 font-mono text-sm hover:text-accent"
                                  >
                                    Call sheet — {day.date.toLocaleDateString("es-ES")}
                                  </Link>
                                ))}
                            </div>
                          )}
                </div>
              ),
            },
            {
              id: "exportables",
              label: "Exportables",
              count: exports.length,
              content: (
                <div>
                          <div className="mt-3 flex flex-wrap gap-4">
                            {exports.map((item) => (
                              <Link
                                key={item.href}
                                href={item.href}
                                className="btn btn-outline btn-sm"
                              >
                                {item.label} →
                              </Link>
                            ))}
                          </div>
                </div>
              ),
            },
          ]}
        />
      </div>
    </div>
  );
}
