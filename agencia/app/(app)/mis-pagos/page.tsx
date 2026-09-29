import type { Metadata } from "next";
import { requireUser } from "@/lib/auth/current";
import { myPayments } from "@/lib/services/finance";
import { Chip } from "@/components/ui/chip";
import { EmptyState, PageHeader, Section } from "@/components/ui/misc";
import { FINANCE_STATUS } from "@/lib/domain/labels";
import { formatMoney } from "@/lib/domain/money";
import { fmtDate } from "@/lib/format";

export const metadata: Metadata = { title: "Mis pagos" };

export default async function MyPaymentsPage() {
  const me = await requireUser(["EDITOR"]);
  const lines = await myPayments(me);
  return (
    <>
      <PageHeader title="Mis pagos" meta={<span>Importes registrados por la agencia por tus trabajos.</span>} />
      <Section title="Movimientos">
        {lines.length ? (
          <ul className="divide-y divide-line">
            {lines.map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-4 py-3 text-sm">
                <div className="min-w-0 flex-1">
                  <p className="font-medium">{l.project.name}</p>
                  <p className="text-[12px] text-ink-3">{l.description}{l.settledAt ? ` · pagado ${fmtDate(l.settledAt)}` : l.dueDate ? ` · previsto ${fmtDate(l.dueDate)}` : ""}</p>
                </div>
                <Chip tone={l.status === "SETTLED" ? "success" : l.status === "CONFIRMED" ? "info" : "muted"}>{l.status === "SETTLED" ? "Pagado" : FINANCE_STATUS[l.status]}</Chip>
                <span className="w-28 text-right tabular">{formatMoney(l.amountCents, l.currency)}</span>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="Todavía no hay pagos registrados" />
        )}
      </Section>
    </>
  );
}
