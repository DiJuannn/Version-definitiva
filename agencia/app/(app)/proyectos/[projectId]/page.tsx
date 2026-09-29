import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import Link from "next/link";
import { ExternalLink, FileVideo, Link2, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth/current";
import { canViewProjectFinance } from "@/lib/authz/guards";
import { getProjectDetail, projectActivity } from "@/lib/services/projects";
import { listMaterials, linkService } from "@/lib/services/media";
import { projectFinance } from "@/lib/services/finance";
import { db } from "@/lib/db";
import { applyStyleAction, materialVisibilityAction, setProjectStatusAction } from "@/app/actions/work";
import { ButtonLink, buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { DefinitionList, EmptyState, Notice, PageHeader, Section } from "@/components/ui/misc";
import { PieceList, PieceRow } from "@/components/work/piece-row";
import { ActivityList } from "@/components/work/activity";
import { UploadButton } from "@/components/work/upload-button";
import { AddLinkForm, AddPieceForm } from "./forms";
import { briefCompleteness, missingBriefFields, parseBriefData } from "@/lib/domain/brief";
import { PRIORITY, PROJECT_STATUS } from "@/lib/domain/labels";
import { STYLE_FIELDS, parseStyleData } from "@/lib/domain/style";
import { formatMoney } from "@/lib/domain/money";
import { fmtBytes, fmtDate, fmtDue, fmtRelative } from "@/lib/format";
import type { ProjectStatus } from "@prisma/client";

export async function generateMetadata(props: PageProps<"/proyectos/[projectId]">): Promise<Metadata> {
  const { projectId } = await props.params;
  const p = await db.project.findUnique({ where: { id: projectId }, select: { name: true } });
  return { title: p?.name ?? "Proyecto" };
}

const NEXT_STATUS: Partial<Record<ProjectStatus, { to: ProjectStatus; label: string }[]>> = {
  REQUESTED: [{ to: "ACTIVE", label: "Aceptar solicitud" }, { to: "CANCELLED", label: "Rechazar" }],
  DRAFT: [{ to: "ACTIVE", label: "Activar" }],
  ACTIVE: [{ to: "ON_HOLD", label: "Pausar" }, { to: "COMPLETED", label: "Marcar completado" }],
  ON_HOLD: [{ to: "ACTIVE", label: "Reanudar" }],
  COMPLETED: [{ to: "ACTIVE", label: "Reabrir" }],
  CANCELLED: [{ to: "ACTIVE", label: "Reactivar" }],
};

export default async function ProjectPage(props: PageProps<"/proyectos/[projectId]">) {
  const me = await requireUser();
  const { projectId } = await props.params;
  const project = await orNotFound(getProjectDetail(me, projectId));
  const [activity, materials] = await Promise.all([projectActivity(me, projectId, 15), listMaterials(me, projectId)]);
  const manager = me.role === "ADMIN" || me.role === "COORDINATOR";
  const internal = me.role !== "CLIENT";
  const finance = canViewProjectFinance(me) ? await projectFinance(me, projectId) : null;
  const brief = parseBriefData(project.brief?.data);
  const missing = missingBriefFields(brief);
  const latestStyle = internal ? await db.styleProfile.findFirst({ where: { clientId: project.clientId }, orderBy: { version: "desc" }, select: { version: true } }) : null;
  const style = parseStyleData(project.styleProfile?.data);

  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            <Link href="/proyectos" className="hover:text-ink">Proyectos</Link>
            {internal && <> · {project.client.name}</>}
          </span>
        }
        title={project.name}
        meta={
          <>
            <Chip tone={PROJECT_STATUS[project.status].tone}>{PROJECT_STATUS[project.status].label}</Chip>
            {project.priority !== "NORMAL" && <Chip tone={PRIORITY[project.priority].tone}>Prioridad {PRIORITY[project.priority].label.toLowerCase()}</Chip>}
            <span className="text-ink-3">{fmtDue(project.dueDate)}</span>
            {project.coordinator && <span className="text-ink-3">· Coordina {project.coordinator.name}</span>}
          </>
        }
        actions={
          <>
            <ButtonLink href={`/proyectos/${project.id}/brief`} variant="secondary">
              {me.role === "CLIENT" || manager ? "Brief" : "Ver brief"}
            </ButtonLink>
            {manager && <ButtonLink href={`/proyectos/${project.id}/compartir`}>Enlaces de revisión</ButtonLink>}
            {manager &&
              NEXT_STATUS[project.status]?.map((s) => (
                <form key={s.to} action={setProjectStatusAction}>
                  <input type="hidden" name="projectId" value={project.id} />
                  <input type="hidden" name="status" value={s.to} />
                  <button className={buttonClass(s.to === "ACTIVE" ? "primary" : "ghost", "md")}>{s.label}</button>
                </form>
              ))}
          </>
        }
      />

      {project.status === "REQUESTED" && me.role === "CLIENT" && (
        <div className="mb-5">
          <Notice tone="info" title="Solicitud enviada">La agencia la revisará y te avisará. Mientras tanto, completa el brief para que el equipo pueda empezar antes.</Notice>
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Piezas" description={me.role === "EDITOR" ? "Solo ves las piezas que tienes asignadas." : `${project.pieces.length} en este proyecto`} actions={manager ? <AddPieceForm projectId={project.id} /> : undefined}>
            {project.pieces.length ? (
              <PieceList>
                {project.pieces.map((p) => (
                  <PieceRow key={p.id} showProject={false} p={{ ...p, currentVersion: me.role === "CLIENT" ? p.clientVersion : p.currentVersion }} />
                ))}
              </PieceList>
            ) : (
              <EmptyState title="Todavía no hay piezas">{manager ? "Añade las piezas que se van a entregar (un reel, un spot…)." : "La agencia añadirá aquí las piezas del proyecto."}</EmptyState>
            )}
          </Section>

          <Section
            title="Brief"
            description={project.brief?.status === "SUBMITTED" ? `Enviado ${fmtRelative(project.brief.submittedAt!)}` : "Borrador"}
            actions={<Link href={`/proyectos/${project.id}/brief`} className="text-[13px] font-medium text-ink-2 hover:text-ink">{manager || me.role === "CLIENT" ? "Completar" : "Abrir"} →</Link>}
          >
            <div className="px-4 py-3">
              <div className="flex items-center gap-3">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                  <div className="h-full bg-ink" style={{ width: `${briefCompleteness(brief)}%` }} />
                </div>
                <span className="text-[13px] text-ink-3 tabular">{briefCompleteness(brief)} %</span>
              </div>
              {missing.length > 0 ? (
                <p className="mt-2 text-[13px] text-[var(--tone-attention)]">Falta: {missing.map((m) => m.label.toLowerCase()).join(", ")}.</p>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--tone-success)]">Tiene todo lo imprescindible.</p>
              )}
              {brief.objective && <p className="mt-3 line-clamp-3 text-sm text-ink-2">{brief.objective}</p>}
            </div>
          </Section>

          <Section
            title="Material y referencias"
            description={me.role === "CLIENT" ? "Sube o enlaza el material bruto y vídeos de referencia." : "Enlaces y archivos del proyecto. Un enlace a Drive o Dropbox no es una integración: solo se guarda la dirección."}
          >
            <div className="flex flex-col gap-3 border-b border-line px-4 py-3">
              <AddLinkForm projectId={project.id} />
              <UploadButton kind="REFERENCE" projectId={project.id} label="Subir archivo de referencia (máx. 2 GB)" />
            </div>
            {materials.length ? (
              <ul className="divide-y divide-line">
                {materials.map((m) => (
                  <li key={m.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                    {m.provider === "EXTERNAL_LINK" ? <Link2 className="size-4 shrink-0 text-ink-3" /> : <FileVideo className="size-4 shrink-0 text-ink-3" />}
                    <div className="min-w-0 flex-1">
                      {m.externalUrl ? (
                        <a href={m.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium hover:underline">
                          {m.label || m.filename} <ExternalLink className="size-3" />
                        </a>
                      ) : (
                        <span className="font-medium">{m.label || m.filename}</span>
                      )}
                      <p className="text-[12px] text-ink-3">
                        {m.kind === "SOURCE" ? "Material bruto" : "Referencia"} · {m.externalUrl ? linkService(m.externalUrl) : m.status === "READY" ? fmtBytes(Number(m.sizeBytes ?? 0)) : "Subida incompleta"} · {fmtDate(m.createdAt)}
                      </p>
                    </div>
                    {internal && (
                      m.visibility === "INTERNAL" ? (
                        <span className="inline-flex items-center gap-1 text-[12px] text-ink-3"><Lock className="size-3" /> Interno</span>
                      ) : (
                        <span className="text-[12px] text-ink-3">Visible al cliente</span>
                      )
                    )}
                    {manager && (
                      <form action={materialVisibilityAction}>
                        <input type="hidden" name="assetId" value={m.id} />
                        <input type="hidden" name="projectId" value={project.id} />
                        <input type="hidden" name="visibility" value={m.visibility === "INTERNAL" ? "CLIENT" : "INTERNAL"} />
                        <button className="text-[12px] text-ink-2 underline-offset-2 hover:underline">{m.visibility === "INTERNAL" ? "Mostrar al cliente" : "Hacer interno"}</button>
                      </form>
                    )}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin material todavía" />
            )}
          </Section>
        </div>

        <div className="flex flex-col gap-5">
          <Section title="Detalles">
            <div className="px-4 py-3">
              <DefinitionList
                items={[
                  { term: "Cliente", value: project.client.name },
                  { term: "Tipo", value: project.contentType ?? "—" },
                  { term: "Entrega", value: fmtDate(project.dueDate) },
                  ...(internal ? [{ term: "Equipo", value: project.team?.name ?? "—" }] : []),
                  { term: "Paquete", value: project.package ? `${project.package.name} (${project.package.piecesIncluded} piezas)` : "Proyecto suelto" },
                  ...(project.description ? [{ term: "Descripción", value: project.description }] : []),
                ]}
              />
              {internal && project.internalNotes && (
                <div className="mt-3 rounded-md bg-surface-2 p-3 text-[13px] text-ink-2">
                  <p className="mb-1 inline-flex items-center gap-1 font-medium text-ink"><Lock className="size-3" /> Notas internas</p>
                  <p className="whitespace-pre-line">{project.internalNotes}</p>
                </div>
              )}
            </div>
          </Section>

          {internal && (
            <Section
              title="Perfil de estilo"
              description={project.styleProfile ? `Versión ${project.styleProfile.version} (congelada al crear el proyecto)` : "El cliente no tenía perfil al crear el proyecto"}
              actions={
                manager && latestStyle && latestStyle.version !== project.styleProfile?.version ? (
                  <form action={applyStyleAction}>
                    <input type="hidden" name="projectId" value={project.id} />
                    <button className={buttonClass("secondary", "sm")}>Aplicar v{latestStyle.version}</button>
                  </form>
                ) : undefined
              }
            >
              {project.styleProfile ? (
                <dl className="divide-y divide-line">
                  {STYLE_FIELDS.filter((f) => style[f.key]).map((f) => (
                    <div key={f.key} className="px-4 py-2 text-[13px]">
                      <dt className="text-ink-3">{f.label}</dt>
                      <dd className="whitespace-pre-line text-ink">{style[f.key]}</dd>
                    </div>
                  ))}
                </dl>
              ) : (
                <EmptyState title="Sin perfil de estilo" />
              )}
            </Section>
          )}

          {finance && (
            <Section title="Economía" description="Margen = ingreso neto − costes (sin impuestos)" actions={<Link href={`/proyectos/${project.id}/finanzas`} className="text-[13px] text-ink-2 hover:text-ink">Detalle →</Link>}>
              <div className="px-4 py-3 text-sm">
                {finance.estimated.ok ? (
                  <DefinitionList
                    items={[
                      { term: "Ingreso neto", value: <span className="tabular">{formatMoney(finance.estimated.value.netRevenue, finance.estimated.value.currency)}</span> },
                      { term: "Costes", value: <span className="tabular">{formatMoney(finance.estimated.value.costs, finance.estimated.value.currency)}</span> },
                      {
                        term: "Margen estimado",
                        value: (
                          <span className="font-medium tabular">
                            {formatMoney(finance.estimated.value.margin, finance.estimated.value.currency)}
                            {finance.estimated.value.marginPct !== null && ` · ${finance.estimated.value.marginPct} %`}
                          </span>
                        ),
                      },
                      {
                        term: "Margen final",
                        value: finance.final.ok ? <span className="tabular">{formatMoney(finance.final.value.margin, finance.final.value.currency)}</span> : finance.final.error,
                      },
                    ]}
                  />
                ) : (
                  <Notice tone="attention">{finance.estimated.error}</Notice>
                )}
              </div>
            </Section>
          )}

          <Section title="Actividad">
            <ActivityList items={activity} />
          </Section>
        </div>
      </div>
    </>
  );
}
