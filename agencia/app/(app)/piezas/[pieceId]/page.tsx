import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import Link from "next/link";
import { AlertTriangle, Columns2, Lock, Play } from "lucide-react";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { getPieceDetail, editorsWithLoad } from "@/lib/services/pieces";
import { openCorrectionsForPiece } from "@/lib/services/corrections";
import { pieceStatusAction, resolveBlockerAction } from "@/app/actions/work";
import { buttonClass } from "@/components/ui/button";
import { Chip, Tape } from "@/components/ui/chip";
import { DefinitionList, EmptyState, Notice, PageHeader, Section } from "@/components/ui/misc";
import { DownloadButton } from "@/components/work/download-button";
import { AssignForm, BlockerForm, DeliveryForm } from "./forms";
import { NewVersionPanel } from "./new-version";
import { BLOCKER_KIND, CATEGORY_LABEL, CORRECTION_STATUS, PIECE_STATUS, VERSION_STATUS, pieceStatusFor } from "@/lib/domain/labels";
import { manualPieceTransitions } from "@/lib/domain/piece-status";
import { formatClock } from "@/lib/domain/timecode";
import { fmtBytes, fmtDate, fmtDateTime, fmtDue } from "@/lib/format";

export async function generateMetadata(props: PageProps<"/piezas/[pieceId]">): Promise<Metadata> {
  const { pieceId } = await props.params;
  const p = await db.piece.findUnique({ where: { id: pieceId }, select: { title: true } });
  return { title: p?.title ?? "Pieza" };
}

const MANUAL_LABEL: Record<string, string> = {
  IN_EDIT: "Empezar a editar",
  IN_CORRECTION: "Empezar correcciones",
  PENDING_ASSIGNMENT: "Marcar pendiente de asignación",
  CANCELLED: "Cancelar pieza",
  COMPLETED: "Marcar completada",
};

export default async function PiecePage(props: PageProps<"/piezas/[pieceId]">) {
  const me = await requireUser();
  const { pieceId } = await props.params;
  const piece = await orNotFound(getPieceDetail(me, pieceId));
  const manager = me.role === "ADMIN" || me.role === "COORDINATOR";
  const isAssignedEditor = me.role === "EDITOR" && piece.editorId === me.id;
  const internal = me.role !== "CLIENT";
  const canUpload = (manager || isAssignedEditor) && !["COMPLETED", "CANCELLED", "DRAFT", "PENDING_ASSIGNMENT", "FINAL_DELIVERY"].includes(piece.status);
  const corrections = internal ? await openCorrectionsForPiece(me, pieceId) : [];
  const editors = manager ? await editorsWithLoad(me) : [];
  const people = internal
    ? await db.user.findMany({ where: { organizationId: me.organizationId, active: true, role: { not: "CLIENT" } }, select: { id: true, name: true }, orderBy: { name: "asc" } })
    : [];
  const transitions = manager || isAssignedEditor ? manualPieceTransitions(piece.status, me.role).filter((t) => MANUAL_LABEL[t]) : [];
  const pendingDeliverables = manager
    ? await db.mediaAsset.findMany({ where: { pieceId, kind: "DELIVERABLE", status: "READY", delivery: null, deletedAt: null }, select: { id: true, filename: true } })
    : [];
  const nextNumber = (piece.versions[0]?.number ?? 0) + 1;
  const byId = new Map(piece.versions.map((v) => [v.id, v]));
  const cur = piece.currentVersionId ? byId.get(piece.currentVersionId) : undefined;
  const cli = piece.clientVersionId ? byId.get(piece.clientVersionId) : undefined;
  const appr = piece.approvedVersionId ? byId.get(piece.approvedVersionId) : undefined;

  return (
    <>
      <PageHeader
        eyebrow={
          <span>
            <Link href="/proyectos" className="hover:text-ink">Proyectos</Link> ·{" "}
            <Link href={`/proyectos/${piece.projectId}`} className="hover:text-ink">{piece.project.name}</Link>
          </span>
        }
        title={piece.title}
        meta={
          <>
            <Chip tone={pieceStatusFor(me.role, piece.status).tone}>{pieceStatusFor(me.role, piece.status).label}</Chip>
            <span className="text-ink-3">{fmtDue(piece.dueDate)}</span>
            {internal && <span className="text-ink-3">· {piece.editor ? `Edita ${piece.editor.name}` : "Sin editor"}</span>}
          </>
        }
        actions={
          <>
            {transitions.map((t) => (
              <form key={t} action={pieceStatusAction}>
                <input type="hidden" name="pieceId" value={piece.id} />
                <input type="hidden" name="status" value={t} />
                <button className={buttonClass(t === "CANCELLED" ? "ghost" : "primary")}>{MANUAL_LABEL[t]}</button>
              </form>
            ))}
            {(me.role === "CLIENT" ? cli : cur) && (
              <Link href={`/revision/${(me.role === "CLIENT" ? cli : cur)!.id}`} className={buttonClass("marker")}>
                <Play className="size-4" /> Abrir revisión
              </Link>
            )}
          </>
        }
      />

      {piece.blockers.some((b) => !b.resolvedAt) && (
        <div className="mb-5 flex flex-col gap-2">
          {piece.blockers
            .filter((b) => !b.resolvedAt)
            .map((b) => (
              <Notice key={b.id} tone="danger" title={BLOCKER_KIND[b.kind]}>
                {b.reason}
              </Notice>
            ))}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section
            title="Versiones"
            description={
              internal ? (
                <span className="flex flex-wrap gap-x-3">
                  <span>Actual: {cur ? `V${cur.number}` : "—"}</span>
                  <span>Ve el cliente: {cli ? `V${cli.number}` : "ninguna"}</span>
                  <span>Aprobada: {appr ? `V${appr.number}` : "ninguna"}</span>
                </span>
              ) : (
                "Versiones publicadas para ti"
              )
            }
          >
            {piece.versions.length ? (
              <ul className="divide-y divide-line">
                {piece.versions.map((v, i) => {
                  const prev = piece.versions[i + 1];
                  return (
                    <li key={v.id} className="flex flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:gap-4">
                      <Tape variant={v.id === piece.approvedVersionId ? "marker" : "paper"} title={v.id === piece.approvedVersionId ? "Versión aprobada" : undefined}>
                        V{v.number}
                      </Tape>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Chip tone={VERSION_STATUS[v.status].tone}>{VERSION_STATUS[v.status].label}</Chip>
                          {internal &&
                            (v.publishedAt ? (
                              <span className="text-[12px] text-ink-3">Publicada {fmtDate(v.publishedAt)}</span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[12px] text-ink-3"><Lock className="size-3" /> Solo interna</span>
                            ))}
                        </div>
                        <p className="mt-1 text-[13px] text-ink-3">
                          {v.uploadedBy.name} · {fmtDateTime(v.createdAt)} · {v._count.comments} comentarios
                        </p>
                        {v.changeSummary && <p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{v.changeSummary}</p>}
                      </div>
                      <div className="flex shrink-0 gap-2">
                        {prev && (
                          <Link href={`/revision/${v.id}/comparar?con=${prev.id}`} className={buttonClass("ghost", "sm")} aria-label={`Comparar V${v.number} con V${prev.number}`}>
                            <Columns2 className="size-4" /> Comparar
                          </Link>
                        )}
                        <Link href={`/revision/${v.id}`} className={buttonClass("secondary", "sm")}>
                          <Play className="size-4" /> Revisar
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <EmptyState title={internal ? "Aún no hay versiones" : "Todavía no hay nada que revisar"}>
                {internal ? "Cuando el editor suba el primer montaje aparecerá aquí como V1." : "Te avisaremos cuando la agencia publique la primera versión."}
              </EmptyState>
            )}
          </Section>

          {canUpload && (
            <Section title={`Subir V${nextNumber}`} description="El archivo va directo al almacenamiento, por trozos y con reanudación.">
              <NewVersionPanel
                pieceId={piece.id}
                nextNumber={nextNumber}
                openCorrections={corrections.map((c) => ({ id: c.id, body: c.comment.body, timeMs: c.comment.timeMs, originNumber: c.originVersion.number, category: c.category }))}
              />
            </Section>
          )}

          {internal && (
            <Section title="Correcciones abiertas" description="De todas las versiones. Resueltas por el equipo ≠ aprobadas por el cliente.">
              {corrections.length ? (
                <ul className="divide-y divide-line">
                  {corrections.map((c) => (
                    <li key={c.id} className="flex items-start gap-3 px-4 py-2.5">
                      <span className="mt-0.5 w-14 shrink-0 font-mono text-[12px] text-ink-3">{c.comment.timeMs != null ? formatClock(c.comment.timeMs) : "General"}</span>
                      <div className="min-w-0 flex-1">
                        <p className="line-clamp-2 text-sm">{c.comment.body}</p>
                        <p className="text-[12px] text-ink-3">
                          V{c.originVersion.number} · {CATEGORY_LABEL[c.category]} · {CORRECTION_STATUS[c.status].label}
                          {c.comment.visibility === "INTERNAL" && " · interna"}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="No hay correcciones abiertas" />
              )}
            </Section>
          )}

          {(piece.approvedVersionId || piece.deliveries.length > 0) && (
            <Section title="Entrega final" description={appr ? `Ligada a la versión aprobada V${appr.number}` : undefined}>
              {piece.deliveries.length > 0 && (
                <ul className="divide-y divide-line">
                  {piece.deliveries.map((d) => (
                    <li key={d.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                      <Tape variant="marker">V{d.version.number}</Tape>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{d.asset.filename}</p>
                        <p className="text-[12px] text-ink-3">
                          {fmtBytes(Number(d.asset.sizeBytes ?? 0))} · {fmtDateTime(d.createdAt)}
                          {d.asset.checksumSha256 && <> · SHA-256 {d.asset.checksumSha256.slice(0, 12)}…</>}
                        </p>
                        {d.note && <p className="text-[13px] text-ink-2">{d.note}</p>}
                      </div>
                      <DownloadButton assetId={d.assetId} variant="primary" />
                    </li>
                  ))}
                </ul>
              )}
              {manager && piece.approvedVersionId && <DeliveryForm pieceId={piece.id} pending={pendingDeliverables} />}
            </Section>
          )}
        </div>

        <div className="flex flex-col gap-5">
          {manager && (
            <Section title="Editor" description={piece.editor ? `Ahora: ${piece.editor.name}` : "Sin asignar"}>
              <AssignForm
                pieceId={piece.id}
                currentEditorId={piece.editorId}
                editors={editors.map((e) => ({ id: e.id, name: e.name, load: e.load, capacity: e.capacity, availability: e.profile?.availability ?? "AVAILABLE", specialties: e.profile?.specialties ?? [] }))}
              />
            </Section>
          )}
          <Section title="Especificaciones">
            <div className="px-4 py-3">
              <DefinitionList
                items={[
                  { term: "Formato", value: piece.format ?? "—" },
                  { term: "Relación", value: piece.aspectRatio ?? "—" },
                  { term: "Resolución", value: piece.resolution ?? "—" },
                  { term: "Duración", value: piece.targetDurationSec ? `${piece.targetDurationSec} s` : "—" },
                  { term: "Entrega", value: fmtDate(piece.dueDate) },
                  ...(piece.description ? [{ term: "Notas", value: piece.description }] : []),
                ]}
              />
            </div>
          </Section>
          {internal && (
            <Section title="Bloqueos" description="Qué impide avanzar y quién debe resolverlo.">
              {piece.blockers.length ? (
                <ul className="divide-y divide-line">
                  {piece.blockers.map((b) => (
                    <li key={b.id} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                      <AlertTriangle className={`mt-0.5 size-4 shrink-0 ${b.resolvedAt ? "text-ink-3" : "text-[var(--tone-danger)]"}`} />
                      <div className="min-w-0 flex-1">
                        <p className={b.resolvedAt ? "text-ink-3 line-through" : ""}>{b.reason}</p>
                        <p className="text-[12px] text-ink-3">
                          {BLOCKER_KIND[b.kind]} · {fmtDate(b.createdAt)}
                          {b.ownerId && ` · Responsable: ${people.find((p) => p.id === b.ownerId)?.name ?? "—"}`}
                        </p>
                      </div>
                      {!b.resolvedAt && (
                        <form action={resolveBlockerAction}>
                          <input type="hidden" name="blockerId" value={b.id} />
                          <input type="hidden" name="pieceId" value={piece.id} />
                          <button className="text-[12px] font-medium text-ink-2 hover:text-ink">Resuelto</button>
                        </form>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyState title="Sin bloqueos" />
              )}
              {(manager || isAssignedEditor) && <BlockerForm pieceId={piece.id} people={people} />}
            </Section>
          )}
          {internal && piece.events && piece.events.length > 0 && (
            <Section title="Historial de estados">
              <ol className="px-4 py-3 text-[13px]">
                {piece.events.map((e) => (
                  <li key={e.id} className="flex justify-between gap-2 py-1">
                    <span>{PIECE_STATUS[e.toStatus].label}</span>
                    <span className="text-ink-3 tabular">{fmtDateTime(e.createdAt)}</span>
                  </li>
                ))}
              </ol>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}
