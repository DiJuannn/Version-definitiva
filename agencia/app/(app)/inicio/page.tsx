import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Play } from "lucide-react";
import { requireUser } from "@/lib/auth/current";
import type { UserActor } from "@/lib/authz/actor";
import { clientDashboard, editorDashboard, managerDashboard } from "@/lib/services/dashboard";
import { ButtonLink } from "@/components/ui/button";
import { Chip, Tape } from "@/components/ui/chip";
import { EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { PieceList, PieceRow } from "@/components/work/piece-row";
import { ActivityList } from "@/components/work/activity";
import { AVAILABILITY, CATEGORY_LABEL, PIECE_STATUS, PROJECT_STATUS } from "@/lib/domain/labels";
import { formatClock } from "@/lib/domain/timecode";
import { fmtDate, fmtDue } from "@/lib/format";
import { cx } from "@/components/ui/cx";

export const metadata: Metadata = { title: "Inicio" };

function greeting(name: string) {
  const h = new Date().getHours();
  const first = name.split(" ")[0];
  return h < 13 ? `Buenos días, ${first}` : h < 20 ? `Buenas tardes, ${first}` : `Buenas noches, ${first}`;
}

export default async function HomePage() {
  const me = await requireUser();
  if (me.role === "EDITOR") return <EditorHome me={me} />;
  if (me.role === "CLIENT") return <ClientHome me={me} />;
  return <ManagerHome me={me} />;
}

async function ManagerHome({ me }: { me: UserActor }) {
  const d = await managerDashboard(me);
  const actions = [
    ...d.requests.map((r) => ({ key: `r${r.id}`, href: `/proyectos/${r.id}`, title: r.name, what: `Nueva solicitud de ${r.client.name}`, tone: "attention" as const, cta: "Revisar solicitud" })),
    ...d.unassigned.map((p) => ({ key: `u${p.id}`, href: `/piezas/${p.id}`, title: p.title, what: `Sin editor · ${fmtDue(p.dueDate)}`, tone: "attention" as const, cta: "Asignar editor" })),
    ...d.internalReview.map((p) => ({ key: `i${p.id}`, href: p.currentVersion ? `/revision/${p.currentVersion.id}` : `/piezas/${p.id}`, title: p.title, what: `V${p.currentVersion?.number ?? "?"} espera tu revisión interna`, tone: "info" as const, cta: "Revisar" })),
    ...d.awaitingDelivery.map((p) => ({ key: `d${p.id}`, href: `/piezas/${p.id}`, title: p.title, what: "Aprobada: falta la entrega final", tone: "success" as const, cta: "Entregar" })),
    ...d.blocked.map((p) => ({ key: `b${p.id}`, href: `/piezas/${p.id}`, title: p.title, what: `Bloqueada: ${p.blockers[0]?.reason}`, tone: "danger" as const, cta: "Ver bloqueo" })),
  ];
  return (
    <>
      <PageHeader
        eyebrow={fmtDate(new Date())}
        title={greeting(me.name)}
        meta={
          <span>
            {d.activePieces} piezas activas · {d.withClient.length} con el cliente · {d.openCorrections} correcciones abiertas
          </span>
        }
        actions={<ButtonLink href="/proyectos/nuevo" variant="primary">Nuevo proyecto</ButtonLink>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Próximas acciones" description="Lo que depende de coordinación, por orden de urgencia.">
            {actions.length ? (
              <ul className="divide-y divide-line">
                {actions.map((a) => (
                  <li key={a.key} className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className={cx("size-2 shrink-0 rounded-full", { attention: "bg-[var(--tone-attention)]", info: "bg-[var(--tone-info)]", success: "bg-[var(--tone-success)]", danger: "bg-[var(--tone-danger)]" }[a.tone])} />
                    <div className="min-w-0 flex-1">
                      <Link href={a.href} className="block truncate text-sm font-medium after:absolute after:inset-0">
                        {a.title}
                      </Link>
                      <p className="truncate text-[13px] text-ink-3">{a.what}</p>
                    </div>
                    <span className="hidden shrink-0 items-center gap-1 text-[13px] font-medium text-ink-2 sm:inline-flex">
                      {a.cta} <ArrowRight className="size-3.5" />
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Nada pendiente por tu parte">Las piezas nuevas, revisiones internas y bloqueos aparecerán aquí.</EmptyState>
            )}
          </Section>
          <Section title="En riesgo" description="Retrasadas o con poco margen para su estado actual.">
            {d.atRisk.length ? (
              <PieceList>{d.atRisk.map((p) => <PieceRow key={p.id} p={p} />)}</PieceList>
            ) : (
              <EmptyState title="Ninguna pieza en riesgo" />
            )}
          </Section>
          <Section title="Con el cliente" description="Publicadas y a la espera de su decisión.">
            {d.withClient.length ? (
              <PieceList>{d.withClient.map((p) => <PieceRow key={p.id} p={p} />)}</PieceList>
            ) : (
              <EmptyState title="No hay versiones esperando al cliente" />
            )}
          </Section>
        </div>
        <div className="flex flex-col gap-5">
          <Section title="Entregas" description="Hoy y próximos 7 días.">
            {d.dueToday.length + d.upcoming.length ? (
              <ul className="divide-y divide-line">
                {[...d.dueToday, ...d.upcoming].map((p) => (
                  <li key={p.id} className="relative flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                    <span className="w-16 shrink-0 font-mono text-[12px] text-ink-3 uppercase">{fmtDate(p.dueDate)}</span>
                    <Link href={`/piezas/${p.id}`} className="min-w-0 flex-1 truncate text-sm after:absolute after:inset-0">
                      {p.title}
                    </Link>
                    <Chip tone={PIECE_STATUS[p.status].tone} className="shrink-0">{PIECE_STATUS[p.status].label}</Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin entregas en los próximos 7 días" />
            )}
          </Section>
          <Section title="Equipo" description="Carga actual frente a capacidad declarada." actions={<Link href="/equipo" className="text-[13px] text-ink-2 hover:text-ink">Ver equipo</Link>}>
            <ul className="divide-y divide-line">
              {d.editors.map((e) => {
                const pct = e.capacity ? Math.min(100, Math.round((e.load / e.capacity) * 100)) : 100;
                const av = AVAILABILITY[e.profile?.availability ?? "AVAILABLE"];
                return (
                  <li key={e.id} className="px-4 py-2.5">
                    <div className="flex items-center justify-between gap-2 text-sm">
                      <span className="font-medium">{e.name}</span>
                      <span className="text-[13px] text-ink-3 tabular">
                        {e.load} / {e.capacity}
                      </span>
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2" role="meter" aria-valuenow={e.load} aria-valuemin={0} aria-valuemax={e.capacity} aria-label={`Carga de ${e.name}`}>
                        <div className={cx("h-full rounded-full", pct >= 100 ? "bg-[var(--tone-danger)]" : pct >= 75 ? "bg-[var(--tone-attention)]" : "bg-ink")} style={{ width: `${pct}%` }} />
                      </div>
                      {av.tone !== "success" && <Chip tone={av.tone} className="h-5 text-[11px]">{av.label}</Chip>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </Section>
          <Section title="Actividad reciente">
            <ActivityList items={d.activity} />
          </Section>
        </div>
      </div>
    </>
  );
}

async function EditorHome({ me }: { me: UserActor }) {
  const d = await editorDashboard(me);
  return (
    <>
      <PageHeader eyebrow={fmtDate(new Date())} title={greeting(me.name)} meta={<span>{d.pieces.length} piezas asignadas · {d.corrections.length} correcciones abiertas</span>} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Ahora" description="Piezas que dependen de ti, las más urgentes primero.">
            {d.now.length ? (
              <PieceList>{d.now.map((p) => <PieceRow key={p.id} p={p} />)}</PieceList>
            ) : (
              <EmptyState title="Nada urgente">Cuando te asignen una pieza o te pidan cambios aparecerá aquí.</EmptyState>
            )}
          </Section>
          {d.internalChanges.length > 0 && (
            <Section title="Cambios internos pedidos por coordinación">
              <ul className="divide-y divide-line">
                {d.internalChanges.map((v) => (
                  <li key={v.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Tape variant="paper">V{v.number}</Tape>
                    <Link href={`/revision/${v.id}`} className="flex-1 text-sm font-medium after:absolute after:inset-0">
                      {v.piece.title}
                    </Link>
                    <ArrowRight className="size-4 text-ink-3" />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          <Section title="Correcciones abiertas" description="Pulsa una para ir al momento exacto del vídeo.">
            {d.corrections.length ? (
              <ul className="divide-y divide-line">
                {d.corrections.map((c) => (
                  <li key={c.id} className="relative flex items-start gap-3 px-4 py-3 hover:bg-surface-2">
                    <span className="mt-0.5 w-14 shrink-0 font-mono text-[12px] text-ink-3">{c.comment.timeMs != null ? formatClock(c.comment.timeMs) : "General"}</span>
                    <div className="min-w-0 flex-1">
                      <Link href={`/revision/${c.comment.versionId}?c=${c.comment.id}`} className="line-clamp-2 text-sm after:absolute after:inset-0">
                        {c.comment.body}
                      </Link>
                      <p className="mt-0.5 text-[13px] text-ink-3">
                        {c.piece.title} · V{c.originVersion.number} · {CATEGORY_LABEL[c.category]}
                        {c.comment.visibility === "INTERNAL" && " · interna"}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Sin correcciones abiertas" />
            )}
          </Section>
        </div>
        <Section title="Todas mis piezas">
          {d.pieces.length ? <PieceList>{d.pieces.map((p) => <PieceRow key={p.id} p={p} />)}</PieceList> : <EmptyState title="No tienes piezas asignadas" />}
        </Section>
      </div>
    </>
  );
}

async function ClientHome({ me }: { me: UserActor }) {
  const d = await clientDashboard(me);
  return (
    <>
      <PageHeader title={greeting(me.name)} meta={<span>Aquí verás lo que está listo para revisar y el estado de tus proyectos.</span>} />
      <div className="flex flex-col gap-5">
        <Section title="Listo para revisar" description="Mira el vídeo, deja tus cambios sobre la imagen y aprueba cuando esté bien.">
          {d.toReview.length ? (
            <ul className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-3">
              {d.toReview.map((p) => (
                <li key={p.id} className="relative flex flex-col gap-3 rounded-lg border border-line bg-surface-2 p-4 hover:border-line-strong">
                  <div className="flex items-center justify-between">
                    <Tape variant="marker">V{p.clientVersion!.number}</Tape>
                    <span className="text-[13px] text-ink-3">{p.project.name}</span>
                  </div>
                  <p className="font-display text-lg leading-snug font-bold">{p.title}</p>
                  <Link
                    href={`/revision/${p.clientVersion!.id}`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md bg-ink text-sm font-medium text-white after:absolute after:inset-0 hover:bg-[#2a2e35]"
                  >
                    <Play className="size-4" /> Revisar vídeo
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nada pendiente de revisar">Te avisaremos cuando haya una versión nueva.</EmptyState>
          )}
        </Section>
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="En preparación">
            {d.inProgress.length ? (
              <ul className="divide-y divide-line">
                {d.inProgress.map((p) => (
                  <li key={p.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Link href={`/piezas/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0">
                      {p.title}
                    </Link>
                    <Chip tone={PIECE_STATUS[p.status].tone}>{PIECE_STATUS[p.status].label}</Chip>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="No hay piezas en preparación" />
            )}
          </Section>
          <Section title="Entregas disponibles">
            {d.delivered.length ? (
              <ul className="divide-y divide-line">
                {d.delivered.map((p) => (
                  <li key={p.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                    <Link href={`/piezas/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0">
                      {p.title}
                    </Link>
                    {p.approvedVersion && <Tape variant="marker">V{p.approvedVersion.number}</Tape>}
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyState title="Aún no hay entregas finales" />
            )}
          </Section>
        </div>
        <div className="grid gap-5 lg:grid-cols-2">
          <Section title="Tus proyectos" actions={<Link href="/proyectos" className="text-[13px] text-ink-2 hover:text-ink">Ver todos</Link>}>
            <ul className="divide-y divide-line">
              {d.projects.map((p) => (
                <li key={p.id} className="relative flex items-center gap-3 px-4 py-3 hover:bg-surface-2">
                  <Link href={`/proyectos/${p.id}`} className="min-w-0 flex-1 truncate text-sm font-medium after:absolute after:inset-0">
                    {p.name}
                  </Link>
                  {p.brief?.status === "DRAFT" && <Chip tone="attention">Brief sin enviar</Chip>}
                  <Chip tone={PROJECT_STATUS[p.status].tone}>{PROJECT_STATUS[p.status].label}</Chip>
                </li>
              ))}
            </ul>
          </Section>
          <Section title="Actividad reciente">
            <ActivityList items={d.activity} />
          </Section>
        </div>
      </div>
    </>
  );
}
