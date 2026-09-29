import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { editorsWithLoad } from "@/lib/services/pieces";
import { teamMemberAction } from "@/app/actions/admin";
import { Chip } from "@/components/ui/chip";
import { EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { cx } from "@/components/ui/cx";
import { AVAILABILITY } from "@/lib/domain/labels";
import { fmtDue } from "@/lib/format";
import { TeamForm } from "./team-form";

export const metadata: Metadata = { title: "Equipo" };

export default async function TeamPage() {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const [editors, teams, coordinators] = await Promise.all([
    editorsWithLoad(me),
    db.team.findMany({
      where: { organizationId: me.organizationId },
      include: { coordinator: { select: { name: true } }, members: { include: { user: { select: { id: true, name: true } } } } },
      orderBy: { name: "asc" },
    }),
    db.user.findMany({ where: { organizationId: me.organizationId, role: "COORDINATOR", active: true }, select: { id: true, name: true } }),
  ]);
  return (
    <>
      <PageHeader title="Equipo" meta={<span>La carga es el número de piezas activas frente a la capacidad que declara cada editor. Es una ayuda para repartir, no una valoración.</span>} />
      <Section title="Editores">
        {editors.length ? (
          <ul className="divide-y divide-line">
            {editors.map((e) => {
              const av = AVAILABILITY[e.profile?.availability ?? "AVAILABLE"];
              const pct = e.capacity ? Math.min(100, Math.round((e.load / e.capacity) * 100)) : 100;
              return (
                <li key={e.id} className="relative grid gap-3 px-4 py-3 hover:bg-surface-2 md:grid-cols-[1.2fr_1fr_1fr]">
                  <div className="min-w-0">
                    <Link href={`/equipo/${e.id}`} className="font-medium after:absolute after:inset-0 hover:underline">{e.name}</Link>
                    <p className="text-[13px] text-ink-3">{[...(e.profile?.specialties ?? []), ...(e.profile?.software ?? [])].join(" · ") || "Sin especialidades registradas"}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="h-1.5 w-28 overflow-hidden rounded-full bg-surface-2">
                      <div className={cx("h-full", pct >= 100 ? "bg-[var(--tone-danger)]" : pct >= 75 ? "bg-[var(--tone-attention)]" : "bg-ink")} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="text-[13px] text-ink-2 tabular">{e.load}/{e.capacity} piezas</span>
                    <Chip tone={av.tone}>{av.label}</Chip>
                  </div>
                  <p className="text-[13px] text-ink-3">
                    {e.active.length ? `Próxima: ${e.active.sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))[0].title} · ${fmtDue(e.active[0].dueDate)}` : "Sin piezas activas"}
                    {e.profile?.availabilityNote ? ` · ${e.profile.availabilityNote}` : ""}
                  </p>
                </li>
              );
            })}
          </ul>
        ) : (
          <EmptyState title="No hay editores">Crea usuarios con rol Edición desde Ajustes.</EmptyState>
        )}
      </Section>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        {teams.map((t) => {
          const memberIds = new Set(t.members.map((m) => m.userId));
          const canEdit = me.role === "ADMIN" || t.coordinatorId === me.id;
          return (
            <Section key={t.id} title={t.name} description={`Coordina ${t.coordinator.name}`}>
              <ul className="divide-y divide-line">
                {editors.map((e) => (
                  <li key={e.id} className="flex items-center justify-between px-4 py-2 text-sm">
                    <span className={memberIds.has(e.id) ? "" : "text-ink-3"}>{e.name}</span>
                    {canEdit ? (
                      <form action={teamMemberAction}>
                        <input type="hidden" name="teamId" value={t.id} />
                        <input type="hidden" name="userId" value={e.id} />
                        <input type="hidden" name="member" value={memberIds.has(e.id) ? "false" : "true"} />
                        <button className="text-[12px] text-ink-2 hover:text-ink">{memberIds.has(e.id) ? "Quitar del equipo" : "Añadir"}</button>
                      </form>
                    ) : memberIds.has(e.id) ? (
                      <span className="text-[12px] text-ink-3">Miembro</span>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Section>
          );
        })}
        {me.role === "ADMIN" && (
          <Section title="Nuevo equipo">
            <TeamForm coordinators={coordinators} />
          </Section>
        )}
      </div>
    </>
  );
}
