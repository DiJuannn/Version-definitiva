import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { PageHeader } from "@/components/ui/misc";
import { actionLabel } from "@/components/work/activity";
import { fmtDateTime } from "@/lib/format";

export const metadata: Metadata = { title: "Auditoría" };

export default async function AuditPage(props: PageProps<"/auditoria">) {
  const me = await requireUser(["ADMIN"]);
  const sp = await props.searchParams;
  const q = typeof sp.q === "string" ? sp.q : "";
  const before = typeof sp.antes === "string" ? new Date(sp.antes) : undefined;
  const rows = await db.auditLog.findMany({
    where: {
      organizationId: me.organizationId,
      ...(q ? { OR: [{ action: { contains: q } }, { actorLabel: { contains: q, mode: "insensitive" } }, { entityType: { contains: q } }] } : {}),
      ...(before && !Number.isNaN(before.getTime()) ? { createdAt: { lt: before } } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  return (
    <>
      <PageHeader title="Auditoría" meta={<span>Registro inalterable de acciones. Se muestran 100 por página.</span>} />
      <form className="mb-4 max-w-sm" role="search">
        <input name="q" defaultValue={q} placeholder="Filtrar por acción, persona o tipo" aria-label="Filtrar" className="h-9 w-full rounded-md border border-line bg-surface px-3 text-sm focus:border-focus focus:outline-none" />
      </form>
      <div className="overflow-x-auto rounded-lg border border-line bg-surface">
        <table className="w-full min-w-[720px] text-[13px]">
          <thead className="border-b border-line bg-surface-2 text-left text-ink-3">
            <tr>
              <th className="px-3 py-2 font-medium">Fecha</th>
              <th className="px-3 py-2 font-medium">Quién</th>
              <th className="px-3 py-2 font-medium">Acción</th>
              <th className="px-3 py-2 font-medium">Entidad</th>
              <th className="px-3 py-2 font-medium">Detalle</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2 whitespace-nowrap text-ink-3 tabular">{fmtDateTime(r.createdAt)}</td>
                <td className="px-3 py-2">{r.actorLabel}</td>
                <td className="px-3 py-2">{actionLabel(r.action)}</td>
                <td className="px-3 py-2 text-ink-3">
                  {r.projectId ? <Link href={`/proyectos/${r.projectId}`} className="underline">{r.entityType}</Link> : r.entityType}
                </td>
                <td className="max-w-[320px] truncate px-3 py-2 font-mono text-[11px] text-ink-3">{r.data ? JSON.stringify(r.data) : ""}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 100 && (
        <Link href={{ pathname: "/auditoria", query: { ...(q ? { q } : {}), antes: rows[rows.length - 1].createdAt.toISOString() } }} className="mt-3 inline-block text-sm underline">
          Ver anteriores
        </Link>
      )}
    </>
  );
}
