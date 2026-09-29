import type { Metadata } from "next";
import Link from "next/link";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { financeOverview } from "@/lib/services/finance";
import { EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { FINANCE_STATUS } from "@/lib/domain/labels";
import { formatMoney } from "@/lib/domain/money";
import { fmtDate } from "@/lib/format";
import { PackageForm } from "./package-form";

export const metadata: Metadata = { title: "Finanzas" };

const PERIOD = { ONE_OFF: "Pago único", MONTHLY: "Mensual", QUARTERLY: "Trimestral" } as const;

function totals(lines: { amountCents: number; currency: string }[]) {
  const m = new Map<string, number>();
  for (const l of lines) m.set(l.currency, (m.get(l.currency) ?? 0) + l.amountCents);
  return [...m.entries()].map(([c, v]) => formatMoney(v, c)).join(" + ") || "0";
}

export default async function FinancePage() {
  const me = await requireUser(["ADMIN"]);
  const { receivables, payables, editors } = await financeOverview(me);
  const [packages, clients] = await Promise.all([
    db.servicePackage.findMany({ where: { organizationId: me.organizationId }, include: { client: { select: { name: true } }, _count: { select: { projects: true } } }, orderBy: { name: "asc" } }),
    db.client.findMany({ where: { organizationId: me.organizationId }, select: { id: true, name: true } }),
  ]);
  const name = (id: string | null) => editors.find((e) => e.id === id)?.name ?? "";
  return (
    <>
      <PageHeader title="Finanzas" meta={<span>Seguimiento interno de cobros y pagos. No es contabilidad ni ejecuta pagos bancarios.</span>} />
      <div className="grid gap-5 lg:grid-cols-2">
        <Section title="Cobros pendientes" description={`Total: ${totals(receivables)}`}>
          {receivables.length ? (
            <ul className="divide-y divide-line">
              {receivables.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <Link href={`/proyectos/${l.project.id}/finanzas`} className="font-medium hover:underline">{l.project.name}</Link>
                    <p className="text-[12px] text-ink-3">{l.project.client.name} · {l.description} · {FINANCE_STATUS[l.status]}{l.dueDate ? ` · vence ${fmtDate(l.dueDate)}` : ""}</p>
                  </div>
                  <span className="tabular">{formatMoney(l.amountCents, l.currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nada pendiente de cobro" />
          )}
        </Section>
        <Section title="Pagos pendientes" description={`Total: ${totals(payables)}`}>
          {payables.length ? (
            <ul className="divide-y divide-line">
              {payables.map((l) => (
                <li key={l.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{l.kind === "EDITOR_COST" ? name(l.editorId) || "Edición" : l.description}</p>
                    <p className="text-[12px] text-ink-3">
                      <Link href={`/proyectos/${l.project.id}/finanzas`} className="hover:underline">{l.project.name}</Link> · {FINANCE_STATUS[l.status]}
                    </p>
                  </div>
                  <span className="tabular">{formatMoney(l.amountCents, l.currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Nada pendiente de pago" />
          )}
        </Section>
        <Section title="Paquetes de servicio" description="Configurables: número de piezas, periodo y precio.">
          {packages.length ? (
            <ul className="divide-y divide-line">
              {packages.map((p) => (
                <li key={p.id} className="flex items-center gap-3 px-4 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium">{p.name}</p>
                    <p className="text-[12px] text-ink-3">{p.client?.name ?? "Cualquier cliente"} · {p.piecesIncluded} piezas · {PERIOD[p.period]} · {p._count.projects} proyectos</p>
                  </div>
                  <span className="tabular">{formatMoney(p.priceCents, p.currency)}</span>
                </li>
              ))}
            </ul>
          ) : (
            <EmptyState title="Sin paquetes" />
          )}
        </Section>
        <Section title="Nuevo paquete">
          <PackageForm clients={clients} />
        </Section>
      </div>
    </>
  );
}
