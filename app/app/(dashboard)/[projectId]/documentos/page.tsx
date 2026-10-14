import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteDocument, uploadDocument } from "@/lib/actions/documents";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { FileOpenLink } from "@/components/FileOpenLink";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import { CloseOnSaved, FormModal, ModalCancel } from "@/components/gestion/FormModal";

// Biblioteca del proyecto en una sola página, sin pestañas: primero lo que
// se sube a mano (contratos, permisos, seguros), y debajo lo que generan las
// otras herramientas (guion, hojas de llamada y exportables), cada cosa en
// su sección con una línea que explica de dónde sale.

const SECTION_TITLE = "font-display text-xl font-black tracking-tight";

function fileKind(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext && ext !== name.toLowerCase() && ext.length <= 4 ? ext.toUpperCase() : "ARCHIVO";
}

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
  const callSheetDays = shootingDays.filter((d) => d.callSheet);
  const dateFmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  const exports = [
    { label: "Shot list", note: "Planos por escena, en PDF", href: `/app/${projectId}/shot-list` },
    { label: "Storyboard", note: "Viñetas con su descripción", href: `/app/${projectId}/storyboard` },
    { label: "Presupuesto", note: "PDF y Excel / Google Sheets", href: `/app/${projectId}/presupuesto` },
  ];

  const uploadForm = (inModal: boolean) => (
    <form action={uploadAction} className={inModal ? "mt-5 space-y-4" : "grid gap-x-6 gap-y-4 sm:grid-cols-2"}>
      <FormField label="Archivo" className={inModal ? "" : "sm:col-span-2"}>
        <input
          type="file"
          name="file"
          required
          className="w-full font-sans text-sm text-muted file:mr-4 file:cursor-pointer file:rounded-full file:border-0 file:bg-fg file:px-4 file:py-2 file:font-mono file:text-[11px] file:tracking-widest file:text-bg file:uppercase"
        />
      </FormField>
      <FormField label="Es de un actor (opcional)">
        <select name="actorId" defaultValue="" className="field w-full">
          <option value="" className="bg-bg">
            Ninguno
          </option>
          {actors.map((a) => (
            <option key={a.id} value={a.id} className="bg-bg">
              {a.name}
            </option>
          ))}
        </select>
      </FormField>
      <FormField label="Es de una localización (opcional)">
        <select name="locationId" defaultValue="" className="field w-full">
          <option value="" className="bg-bg">
            Ninguna
          </option>
          {locations.map((l) => (
            <option key={l.id} value={l.id} className="bg-bg">
              {l.name}
            </option>
          ))}
        </select>
      </FormField>
      <div className={`flex items-center justify-end gap-4 ${inModal ? "pt-2" : "sm:col-span-2"}`}>
        {inModal && <ModalCancel />}
        <SubmitButton pendingLabel="Subiendo…" savedLabel="✓ Subido" className="btn btn-primary">
          Subir documento
        </SubmitButton>
        {inModal && <CloseOnSaved />}
      </div>
    </form>
  );

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Gestión"
        title="Biblioteca de archivos"
        description="Todos los papeles del proyecto en un sitio: lo que subes tú (contratos, permisos, seguros) y lo que sale de las demás herramientas."
        actions={
          documents.length > 0 && (
            <FormModal
              label="+ Subir documento"
              title="Subir documento"
              description="PDF, imagen o lo que sea. Si es de un actor o de una localización, vincúlalo y aparecerá también en su ficha."
            >
              {uploadForm(true)}
            </FormModal>
          )
        }
      />

      {/* ------------------------------------------------ subidos */}
      <section id="documentos" aria-labelledby="documentos-title" className="mt-12 scroll-mt-32">
        <div className="flex items-baseline justify-between gap-4">
          <h2 id="documentos-title" className={SECTION_TITLE}>
            Documentos subidos
          </h2>
          {documents.length > 0 && (
            <span className="eyebrow">
              {documents.length} archivo{documents.length === 1 ? "" : "s"}
            </span>
          )}
        </div>

        {documents.length === 0 ? (
          <>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted">
              Aún no has subido nada. Empieza por lo que más se pierde: permisos de rodaje, contratos firmados, la póliza
              del seguro.
            </p>
            <div className="sheet mt-5 max-w-3xl p-6 sm:p-8">{uploadForm(false)}</div>
          </>
        ) : (
          <ul className="sheet mt-4 divide-y divide-line px-5 sm:px-6">
            {documents.map((doc) => {
              const links = [doc.actor?.name, doc.location?.name].filter(Boolean).join(" · ");
              return (
                <li key={doc.id} className="flex items-center gap-4 py-3.5">
                  <span
                    aria-hidden
                    className="w-12 shrink-0 rounded bg-fg/[0.06] py-1 text-center font-mono text-[10px] tracking-wider text-muted"
                  >
                    {fileKind(doc.fileName)}
                  </span>
                  <div className="min-w-0 flex-1">
                    <FileOpenLink
                      href={doc.fileUrl}
                      className="block truncate font-sans text-[15px] font-medium hover:text-accent"
                    >
                      {doc.fileName}
                    </FileOpenLink>
                    <p className="truncate font-mono text-[11px] text-muted">
                      Subido el {dateFmt(doc.uploadedAt)}
                      {links && <span className="text-accent"> · {links}</span>}
                    </p>
                  </div>
                  <form action={deleteDocument.bind(null, projectId, doc.id)} className="shrink-0">
                    <DeleteButton confirmMessage="¿Eliminar este documento?" className="link-action">
                      Borrar
                    </DeleteButton>
                  </form>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* ------------------------------------------------ generados */}
      <div className="mt-16 grid gap-x-12 gap-y-14 lg:grid-cols-2">
        <section id="guion" aria-labelledby="guion-title" className="scroll-mt-32">
          <h2 id="guion-title" className={SECTION_TITLE}>
            Guion
          </h2>
          <p className="mt-1 font-sans text-sm text-muted">
            Las versiones que subes en{" "}
            <Link href={`/app/${projectId}/guion`} className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
              Guion
            </Link>
            .
          </p>
          {scriptFiles.length === 0 ? (
            <p className="mt-4 border-l-2 border-line pl-3 font-sans text-sm text-muted">Todavía no hay ninguna.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {scriptFiles.map((file) => (
                <li key={file.id}>
                  <FileOpenLink
                    href={file.fileUrl}
                    className="flex items-baseline justify-between gap-4 py-3 font-sans text-[15px] hover:text-accent"
                  >
                    <span className="min-w-0 truncate">{file.fileName}</span>
                    <span className="ml-auto shrink-0 font-mono text-[11px] text-muted">{dateFmt(file.uploadedAt)}</span>
                  </FileOpenLink>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="call-sheets" aria-labelledby="call-sheets-title" className="scroll-mt-32">
          <h2 id="call-sheets-title" className={SECTION_TITLE}>
            Hojas de llamada
          </h2>
          <p className="mt-1 font-sans text-sm text-muted">
            Una por día de rodaje, generadas desde{" "}
            <Link
              href={`/app/${projectId}/plan-de-rodaje`}
              className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent"
            >
              Plan de rodaje
            </Link>
            .
          </p>
          {callSheetDays.length === 0 ? (
            <p className="mt-4 border-l-2 border-line pl-3 font-sans text-sm text-muted">Todavía no hay ninguna.</p>
          ) : (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {callSheetDays.map((day) => (
                <li key={day.id}>
                  <Link
                    href={`/app/${projectId}/call-sheets/${day.id}`}
                    className="flex items-baseline justify-between gap-4 py-3 font-sans text-[15px] hover:text-accent"
                  >
                    <span>
                      {day.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                    </span>
                    <span aria-hidden className="font-mono text-xs text-muted">
                      Abrir →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section id="exportables" aria-labelledby="exportables-title" className="scroll-mt-32 lg:col-span-2">
          <h2 id="exportables-title" className={SECTION_TITLE}>
            Para exportar
          </h2>
          <p className="mt-1 font-sans text-sm text-muted">Se descargan desde su herramienta, siempre con los datos al día.</p>
          <ul className="mt-4 grid border-t border-line sm:grid-cols-3 sm:divide-x sm:divide-line">
            {exports.map((item) => (
              <li key={item.href} className="border-b border-line sm:border-b-0 sm:px-5 sm:first:pl-0">
                <Link href={item.href} className="group block py-4">
                  <span className="font-sans text-[15px] font-medium transition-colors group-hover:text-accent">
                    {item.label} →
                  </span>
                  <span className="mt-0.5 block font-sans text-sm text-muted">{item.note}</span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
