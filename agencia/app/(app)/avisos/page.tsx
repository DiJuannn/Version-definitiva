import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { markNotificationsReadAction, openNotificationAction } from "@/app/actions/admin";
import { buttonClass } from "@/components/ui/button";
import { EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { cx } from "@/components/ui/cx";
import { fmtRelative } from "@/lib/format";

export const metadata: Metadata = { title: "Avisos" };

export default async function NotificationsPage() {
  const me = await requireUser();
  const items = await db.notification.findMany({ where: { userId: me.id }, orderBy: { updatedAt: "desc" }, take: 100 });
  const unread = items.filter((n) => !n.readAt).length;
  return (
    <>
      <PageHeader
        title="Avisos"
        meta={<span>{unread ? `${unread} sin leer` : "Todo leído"}</span>}
        actions={
          unread > 0 && (
            <form action={markNotificationsReadAction}>
              <button className={buttonClass("secondary")}>Marcar todo como leído</button>
            </form>
          )
        }
      />
      <Section title="Recientes" description="Los avisos repetidos sobre lo mismo se agrupan mientras no los leas.">
        {items.length ? (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <form action={openNotificationAction}>
                  <input type="hidden" name="id" value={n.id} />
                  <button className={cx("flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-surface-2", !n.readAt && "bg-marker-soft/40")}>
                    <span className={cx("mt-1.5 size-2 shrink-0 rounded-full", n.readAt ? "bg-transparent" : "bg-[#d9a900]")} aria-hidden />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-medium">
                        {n.title}
                        {n.count > 1 && <span className="ml-2 rounded-full bg-surface-2 px-1.5 text-[11px] text-ink-2">×{n.count}</span>}
                      </span>
                      {n.body && <span className="mt-0.5 line-clamp-2 block text-[13px] text-ink-3">{n.body}</span>}
                    </span>
                    <span className="shrink-0 text-[12px] text-ink-3">{fmtRelative(n.updatedAt)}</span>
                    {!n.readAt && <span className="sr-only">Sin leer</span>}
                  </button>
                </form>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No tienes avisos">Te avisaremos de asignaciones, versiones nuevas, menciones y decisiones.</EmptyState>
        )}
      </Section>
    </>
  );
}
