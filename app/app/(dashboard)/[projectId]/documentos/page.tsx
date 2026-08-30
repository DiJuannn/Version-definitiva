import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteDocument, uploadDocument } from "@/lib/actions/documents";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";

export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

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
        include: { actor: true, location: true },
      }),
      prisma.actor.findMany({ where: { projectId }, orderBy: { name: "asc" } }),
      prisma.location.findMany({
        where: { organizationId: project.organizationId },
        orderBy: { name: "asc" },
      }),
      prisma.shootingDay.findMany({
        where: { projectId },
        orderBy: { date: "asc" },
        include: { callSheet: true },
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
      <Link
        href={`/app/${projectId}`}
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Documentos
      </h1>

      <section className="mt-8">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Guion
        </h2>
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
              <a
                key={file.id}
                href={file.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between border-b border-line py-3 font-mono text-sm hover:text-accent"
              >
                {file.fileName}
                <span className="font-mono text-xs text-muted">
                  {file.uploadedAt.toLocaleDateString("es-ES")}
                </span>
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Call sheets
        </h2>
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
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Exportables
        </h2>
        <div className="mt-3 flex flex-wrap gap-4">
          {exports.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-full border border-line px-4 py-1.5 font-mono text-xs tracking-widest uppercase transition-colors hover:border-accent hover:text-accent"
            >
              {item.label} →
            </Link>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Otros documentos
        </h2>
        <form
          action={uploadAction}
          className="mt-4 grid gap-2 border border-line p-4 sm:grid-cols-2 lg:grid-cols-4"
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
          <button
            type="submit"
            className="rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Subir
          </button>
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
                <a
                  href={doc.fileUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="font-mono text-sm hover:text-accent"
                >
                  {doc.fileName}
                </a>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-xs text-muted">
                    {[doc.actor?.name, doc.location?.name].filter(Boolean).join(" · ")}
                  </span>
                  <form action={deleteDocument.bind(null, projectId, doc.id)}>
                    <DeleteButton
                      confirmMessage="¿Eliminar este documento?"
                      className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                    />
                  </form>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
