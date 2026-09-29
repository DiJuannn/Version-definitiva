import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { loadProject } from "@/lib/authz/guards";
import { listShareLinks } from "@/lib/services/shares";
import { revokeShareAction } from "@/app/actions/work";
import { buttonClass } from "@/components/ui/button";
import { Chip } from "@/components/ui/chip";
import { EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { fmtDate, fmtDateTime } from "@/lib/format";
import { ShareForm } from "./share-form";

export const metadata: Metadata = { title: "Enlaces de revisión" };

const SCOPE = { PROJECT: "Proyecto completo", PIECE: "Una pieza", VERSION: "Una versión" } as const;
const EVENT = { OPENED: "Abierto", VIEWED: "Visto", COMMENTED: "Comentó", APPROVED: "Aprobó", CHANGES_REQUESTED: "Pidió cambios", DOWNLOADED: "Descargó" } as Record<string, string>;

export default async function SharePage(props: PageProps<"/proyectos/[projectId]/compartir">) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const { projectId } = await props.params;
  const sp = await props.searchParams;
  const project = await orNotFound(loadProject(me, projectId));
  const [links, pieces] = await Promise.all([
    listShareLinks(me, projectId),
    db.piece.findMany({
      where: { projectId },
      select: { id: true, title: true, versions: { where: { publishedAt: { not: null } }, orderBy: { number: "desc" }, select: { id: true, number: true } } },
      orderBy: { createdAt: "asc" },
    }),
  ]);
  const now = new Date();
  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/proyectos/${projectId}`} className="hover:text-ink">{project.name}</Link>}
        title="Enlaces de revisión"
        meta={<span>Para clientes o invitados sin cuenta. Solo muestran versiones publicadas y la conversación visible al cliente.</span>}
      />
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Section title="Nuevo enlace">
          <ShareForm
            projectId={projectId}
            pieces={pieces}
            defaultPieceId={typeof sp.pieza === "string" ? sp.pieza : undefined}
            defaultVersionId={typeof sp.version === "string" ? sp.version : undefined}
          />
        </Section>
        <Section title="Enlaces creados" description="El enlace completo solo se muestra al crearlo.">
          {links.length ? (
            <ul className="divide-y divide-line">
              {links.map((l) => {
                const active = !l.revokedAt && (!l.expiresAt || l.expiresAt > now);
                return (
                  <li key={l.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{l.name}</span>
                      <Chip tone={active ? "success" : "muted"}>{l.revokedAt ? "Revocado" : active ? "Activo" : "Caducado"}</Chip>
                      <span className="font-mono text-[12px] text-ink-3">/r/{l.tokenPrefix}…</span>
                    </div>
                    <p className="text-[13px] text-ink-3">
                      {SCOPE[l.scope]} · {[l.canComment && "comentar", l.canApprove && "aprobar", l.canDownload && "descargar"].filter(Boolean).join(", ") || "solo ver"}
                      {l.passwordHash && " · con contraseña"}
                      {l.allowedDomain && ` · solo @${l.allowedDomain}`}
                      {l.expiresAt && ` · caduca ${fmtDate(l.expiresAt)}`}
                    </p>
                    <p className="text-[12px] text-ink-3">
                      {l._count.guests} {l._count.guests === 1 ? "persona" : "personas"} identificadas
                      {l.events[0] && ` · Último: ${EVENT[l.events[0].type] ?? l.events[0].type} ${fmtDateTime(l.events[0].createdAt)}`}
                    </p>
                    {active && (
                      <form action={revokeShareAction}>
                        <input type="hidden" name="linkId" value={l.id} />
                        <input type="hidden" name="projectId" value={projectId} />
                        <button className={buttonClass("ghost", "sm", "text-[var(--tone-danger)]")}>Revocar ahora</button>
                      </form>
                    )}
                  </li>
                );
              })}
            </ul>
          ) : (
            <EmptyState title="Todavía no hay enlaces" />
          )}
        </Section>
      </div>
    </>
  );
}
