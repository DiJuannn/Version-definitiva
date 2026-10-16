import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { deleteDocument, uploadDocument } from "@/lib/actions/documents";
import { DeleteButton } from "@/components/DeleteButton";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GUIDES } from "@/lib/tool-guides";
import { FileOpenLink } from "@/components/FileOpenLink";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";
import { CloseOnSaved, FormModal, ModalCancel } from "@/components/gestion/FormModal";
import { StatusLine } from "@/components/gestion/ToolStatus";

// Biblioteca del proyecto como un archivador: arriba, los papeles que todo
// rodaje necesita y si ya están (seguro, permisos, contratos, cesiones);
// debajo, lo subido agrupado por tipo de papel, y al final lo que sale de las
// otras herramientas. El tipo se deduce del nombre del archivo.

function fileExt(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ext && ext !== name.toLowerCase() && ext.length <= 4 ? ext : "";
}

const normalize = (s: string) => s.toLocaleLowerCase("es").normalize("NFD").replace(/\p{Diacritic}/gu, "");

// Tipo de papel según el nombre del archivo. Un solo sitio para las reglas.
const DOC_GROUPS = [
  { id: "permisos", title: "Permisos de rodaje", test: /permiso|licencia|film ?office|ayuntamiento/ },
  { id: "seguros", title: "Seguros", test: /seguro|poliza/ },
  { id: "contratos", title: "Contratos y cesiones", test: /contrato|cesion|derechos|autorizacion|confidencialidad|nda/ },
] as const;
type GroupId = (typeof DOC_GROUPS)[number]["id"] | "otros";
function groupOf(fileName: string): GroupId {
  const n = normalize(fileName);
  return DOC_GROUPS.find((g) => g.test.test(n))?.id ?? "otros";
}

// Icono de archivo: una hoja con la esquina doblada y su formato.
function FileIcon({ name }: { name: string }) {
  const ext = fileExt(name);
  const label = ext ? ext.toUpperCase() : "—";
  const tone = "text-fg/60";
  return (
    <span aria-hidden className={`relative block h-11 w-9 shrink-0 ${tone}`}>
      <svg viewBox="0 0 36 44" className="absolute inset-0 h-full w-full" fill="none">
        <path d="M2 4a3 3 0 0 1 3-3h18l11 11v28a3 3 0 0 1-3 3H5a3 3 0 0 1-3-3V4Z" fill="currentColor" fillOpacity="0.1" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
        <path d="M23 1v8a3 3 0 0 0 3 3h8" stroke="currentColor" strokeOpacity="0.55" strokeWidth="1.5" />
      </svg>
      <span className="absolute inset-x-0 bottom-2 text-center font-mono text-[10px] font-semibold tracking-wider">{label}</span>
    </span>
  );
}

export default async function DocumentosPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [scriptFiles, documents, actors, locations, shootingDays, crewMembers, projectLocations, isPro] =
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
      // Solo lectura, para saber qué papeles faltan.
      prisma.crewMember.findMany({ where: { projectId }, select: { name: true } }),
      prisma.location.findMany({
        where: { scenes: { some: { projectId } } },
        select: { id: true, name: true },
      }),
      isProjectOwnerPro(project.organizationId),
    ]);

  const uploadAction = uploadDocument.bind(null, projectId);
  const callSheetDays = shootingDays.filter((d) => d.callSheet);
  const dateFmt = (d: Date) => d.toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" });

  // ------------------------------------------------ qué falta
  const docNames = documents.map((d) => ({ ...d, n: normalize(d.fileName), group: groupOf(d.fileName) }));
  const mentions = (person: string, test: RegExp) => {
    const p = normalize(person);
    return docNames.some((d) => test.test(d.n) && d.n.includes(p));
  };
  const insurance = docNames.filter((d) => d.group === "seguros");
  const permits = docNames.filter((d) => d.group === "permisos");
  const permitLocationsCovered = projectLocations.filter(
    (l) => documents.some((d) => d.locationId === l.id) || permits.some((d) => d.n.includes(normalize(l.name))),
  ).length;
  const crewWithContract = crewMembers.filter((c) => mentions(c.name, /contrato/)).length;
  const actorsWithRelease = actors.filter(
    (a) => documents.some((d) => d.actorId === a.id && /cesion|imagen|derechos/.test(normalize(d.fileName))) || mentions(a.name, /cesion|imagen|derechos/),
  ).length;
  const nda = docNames.filter((d) => /confidencialidad|nda/.test(d.n));
  const templateHref = (slug: string) =>
    isPro ? `/app/${projectId}/documentos-legales/${slug}` : `/app/${projectId}/documentos-legales`;

  type Need = { title: string; detail: string; state: "ok" | "partial" | "missing" | "na"; href?: string; cta?: string };
  const needs: Need[] = [
    {
      title: "Seguro de rodaje",
      detail: insurance.length > 0 ? insurance[0].fileName : "Lo piden casi todas las localizaciones y alquileres.",
      state: insurance.length > 0 ? "ok" : "missing",
    },
    {
      title: "Permisos de rodaje",
      detail:
        projectLocations.length > 0
          ? `${permitLocationsCovered} de ${projectLocations.length} localizaciones con permiso`
          : permits.length > 0
            ? `${permits.length} permiso${permits.length === 1 ? "" : "s"} subido${permits.length === 1 ? "" : "s"}`
            : "Uno por cada sitio que no sea tuyo.",
      state:
        projectLocations.length > 0
          ? permitLocationsCovered >= projectLocations.length
            ? "ok"
            : permitLocationsCovered > 0 || permits.length > 0
              ? "partial"
              : "missing"
          : permits.length > 0
            ? "ok"
            : "missing",
      href: templateHref("permiso-rodaje"),
      cta: "Plantilla de permiso",
    },
    {
      title: "Contratos del equipo",
      detail:
        crewMembers.length > 0
          ? `${crewWithContract} de ${crewMembers.length} personas del equipo con contrato`
          : "Todavía no hay equipo técnico en el proyecto.",
      state: crewMembers.length === 0 ? "na" : crewWithContract >= crewMembers.length ? "ok" : crewWithContract > 0 ? "partial" : "missing",
      href: templateHref("contrato-colaboracion"),
      cta: "Plantilla de contrato",
    },
    {
      title: "Cesiones de imagen del reparto",
      detail:
        actors.length > 0 ? `${actorsWithRelease} de ${actors.length} actores con cesión firmada` : "Todavía no hay reparto en el proyecto.",
      state: actors.length === 0 ? "na" : actorsWithRelease >= actors.length ? "ok" : actorsWithRelease > 0 ? "partial" : "missing",
      href: templateHref("cesion-imagen"),
      cta: "Plantilla de cesión",
    },
    {
      title: "Confidencialidad",
      detail: nda.length > 0 ? `${nda.length} acuerdo${nda.length === 1 ? "" : "s"} subido${nda.length === 1 ? "" : "s"}` : "Opcional: antes de mandar el guion a alguien de fuera.",
      state: nda.length > 0 ? "ok" : "na",
      href: templateHref("nda"),
      cta: "Plantilla",
    },
  ];
  const pending = needs.filter((n) => n.state === "missing" || n.state === "partial");

  // ------------------------------------------------ subidos, por tipo
  const groups = [
    ...DOC_GROUPS.map((g) => ({ id: g.id as GroupId, title: g.title })),
    { id: "otros" as GroupId, title: "Otros" },
  ]
    .map((g) => ({ ...g, docs: docNames.filter((d) => d.group === g.id) }))
    .filter((g) => g.docs.length > 0);

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

  const STATE_MARK: Record<Need["state"], { cls: string; label: string; glyph: string }> = {
    ok: { cls: "bg-success text-bg", label: "Lo tienes", glyph: "✓" },
    partial: { cls: "ring-2 ring-inset ring-warn text-warn", label: "A medias", glyph: "½" },
    missing: { cls: "ring-2 ring-inset ring-warn text-warn", label: "Falta", glyph: "!" },
    na: { cls: "ring-1 ring-inset ring-line text-muted", label: "No aplica todavía", glyph: "–" },
  };

  return (
    <div className="pb-16">
      <PageHeader
        guide={TOOL_GUIDES["documentos"]}
        eyebrow="Entregar"
        title="Archivos"
        description="Los papeles del proyecto en un sitio, y cuáles te faltan antes de rodar."
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

      <StatusLine tone={pending.length === 0 ? "ok" : "warn"}>
        {documents.length} archivo{documents.length === 1 ? "" : "s"} subido{documents.length === 1 ? "" : "s"}
        {pending.length === 0 ? (
          " · tienes todos los papeles básicos del rodaje."
        ) : (
          <>
            {" · "}pendiente:{" "}
            {pending.map((n, i) => (
              <span key={n.title}>
                {i > 0 && (i === pending.length - 1 ? " y " : ", ")}
                <strong className="font-semibold">{n.title.toLocaleLowerCase("es")}</strong>
              </span>
            ))}
            .
          </>
        )}
      </StatusLine>

      {/* ------------------------------------------------ papeles del rodaje */}
      <section aria-labelledby="papeles-title" className="mt-10">
        <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
          <h2 id="papeles-title" className="font-display text-xl font-black tracking-tight sm:text-2xl">
            Papeles del rodaje
          </h2>
          <p className="font-sans text-sm text-muted">Lo deduzco por el nombre de cada archivo.</p>
        </div>
        <ul className="mt-5 grid gap-x-10 border-t border-line sm:grid-cols-2 lg:grid-cols-[repeat(5,minmax(0,1fr))] lg:gap-x-6 lg:border-t-0">
          {needs.map((need) => {
            const mark = STATE_MARK[need.state];
            const showCta = need.href && (need.state === "missing" || need.state === "partial");
            return (
              <li key={need.title} className={`flex gap-3 border-b border-line py-4 lg:flex-col lg:border-t-2 lg:border-b-0 lg:pt-4 lg:pb-0  ${need.state === "ok" ? "lg:border-t-success" : need.state === "na" ? "lg:border-t-line" : "lg:border-t-warn"}`}>
                <span
                  data-state={need.state}
                  className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-xs font-bold ${mark.cls}`}
                  aria-hidden
                >
                  {mark.glyph}
                </span>
                <div className="min-w-0">
                  <p className="font-sans text-[15px] font-semibold">
                    {need.title}
                    <span className="sr-only"> — {mark.label}</span>
                  </p>
                  <p className="mt-0.5 font-sans text-sm leading-snug text-muted">{need.detail}</p>
                  {showCta && (
                    <Link href={need.href as string} className="mt-2 inline-block font-sans text-sm text-accent underline-offset-4 hover:underline">
                      {need.cta} →
                    </Link>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {/* ------------------------------------------------ subidos, por tipo */}
      <section id="documentos" aria-labelledby="documentos-title" className="mt-16 scroll-mt-32">
        <h2 id="documentos-title" className="font-display text-xl font-black tracking-tight sm:text-2xl">
          Archivos subidos
        </h2>

        {documents.length === 0 ? (
          <>
            <p className="mt-2 max-w-2xl font-sans text-sm leading-relaxed text-muted">
              Aún no has subido nada. Empieza por lo que más se pierde: permisos de rodaje, contratos firmados, la póliza
              del seguro.
            </p>
            <div className="sheet mt-5 max-w-3xl p-6 sm:p-8">{uploadForm(false)}</div>
          </>
        ) : (
          <div className="sheet mt-5 px-5 sm:px-6">
            {groups.map((group, gi) => (
              <section key={group.id} aria-labelledby={`grupo-${group.id}`} className={gi > 0 ? "border-t border-line" : ""}>
                <h3 id={`grupo-${group.id}`} className="flex items-baseline gap-3 pt-5 pb-1">
                  <span className="eyebrow !text-fg">{group.title}</span>
                  <span className="font-mono text-[11px] text-muted tabular-nums">{group.docs.length}</span>
                </h3>
                <ul className="divide-y divide-line/60">
                  {group.docs.map((doc) => {
                    const links = [doc.actor?.name, doc.location?.name].filter(Boolean).join(" · ");
                    return (
                      <li key={doc.id} className="flex items-center gap-4 py-3">
                        <FileIcon name={doc.fileName} />
                        <div className="min-w-0 flex-1">
                          <FileOpenLink
                            href={doc.fileUrl}
                            className="block truncate font-sans text-[15px] font-medium hover:text-accent"
                          >
                            {doc.fileName.replace(/\.[a-z0-9]{2,4}$/i, "")}
                          </FileOpenLink>
                          <p className="truncate font-sans text-[13px] text-muted">
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
              </section>
            ))}
            <div className="pb-2" />
          </div>
        )}
      </section>

      {/* ------------------------------------------------ generados */}
      <section aria-labelledby="generados-title" className="mt-16">
        <h2 id="generados-title" className="font-display text-xl font-black tracking-tight sm:text-2xl">
          Lo que sale de las herramientas
        </h2>
        <p className="mt-1 font-sans text-sm text-muted">Se genera solo y siempre está al día.</p>

        <div className="mt-6 grid gap-x-12 gap-y-10 lg:grid-cols-3">
          <section id="guion" aria-labelledby="guion-title" className="scroll-mt-32">
            <h3 id="guion-title" className="eyebrow !text-fg">
              Versiones del guion
            </h3>
            {scriptFiles.length === 0 ? (
              <p className="mt-3 font-sans text-sm text-muted">
                Ninguna todavía.{" "}
                <Link href={`/app/${projectId}/guion`} className="text-accent underline-offset-4 hover:underline">
                  Subir en Guion →
                </Link>
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line border-y border-line">
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
            <h3 id="call-sheets-title" className="eyebrow !text-fg">
              Hojas de llamada
            </h3>
            {callSheetDays.length === 0 ? (
              <p className="mt-3 font-sans text-sm text-muted">
                Ninguna todavía.{" "}
                <Link href={`/app/${projectId}/plan-de-rodaje`} className="text-accent underline-offset-4 hover:underline">
                  Crearlas en Plan de rodaje →
                </Link>
              </p>
            ) : (
              <ul className="mt-2 divide-y divide-line border-y border-line">
                {callSheetDays.map((day) => (
                  <li key={day.id}>
                    <Link
                      href={`/app/${projectId}/call-sheets/${day.id}`}
                      className="flex items-baseline justify-between gap-4 py-3 font-sans text-[15px] hover:text-accent"
                    >
                      <span className="first-letter:uppercase">
                        {day.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
                      </span>
                      <span aria-hidden className="font-mono text-xs text-muted">
                        →
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="exportables" aria-labelledby="exportables-title" className="scroll-mt-32">
            <h3 id="exportables-title" className="eyebrow !text-fg">
              Para exportar
            </h3>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {exports.map((item) => (
                <li key={item.href}>
                  <Link href={item.href} className="group flex items-baseline justify-between gap-4 py-3">
                    <span className="min-w-0">
                      <span className="block font-sans text-[15px] transition-colors group-hover:text-accent">{item.label}</span>
                      <span className="block font-sans text-[13px] text-muted">{item.note}</span>
                    </span>
                    <span aria-hidden className="font-mono text-xs text-muted group-hover:text-accent">
                      →
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </section>
    </div>
  );
}
