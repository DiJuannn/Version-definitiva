import type { Metadata } from "next";
import { orNotFound } from "@/lib/http/page";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth/current";
import { canViewProjectFinance } from "@/lib/authz/guards";
import { db } from "@/lib/db";
import { projectFinance } from "@/lib/services/finance";
import { deleteFinanceLineAction, financeStatusAction } from "@/app/actions/admin";
import { Chip } from "@/components/ui/chip";
import { DefinitionList, EmptyState, Notice, PageHeader, Section } from "@/components/ui/misc";
import { FINANCE_KIND, FINANCE_STATUS } from "@/lib/domain/labels";
import { formatMoney, type MarginResult } from "@/lib/domain/money";
import { fmtDate } from "@/lib/format";
import { FinanceLineForm } from "./line-form";

export const metadata: Metadata = { title: "Economía del proyecto" };

function Summary({ r, title }: { r: MarginResult; title: string }) {
  if (!r.ok) return <Notice tone="attention" title={title}>{r.error}</Notice>;
  const v = r.value;
  const m = (c: number) => <span className="tabular">{formatMoney(c, v.currency)}</span>;
  return (
    <div className="rounded-md border border-line p-4">
      <p className="mb-2 text-[13px] font-semibold">{title}</p>
      <DefinitionList
        items={[
          { term: "Precio al cliente", value: m(v.revenue) },
          { term: "− Descuentos", value: m(v.discounts) },
          { term: "= Ingreso neto", value: m(v.netRevenue) },
          { term: "− Edición", value: m(v.editorCosts) },
          { term: "− Otros costes", value: m(v.otherCosts) },
          { term: "= Margen", value: <strong>{m(v.margin)}{v.marginPct !== null ? ` (${v.marginPct} %)` : ""}</strong> },
          { term: "Impuestos (aparte)", value: m(v.tax) },
        ]}
      />
    </div>
  );
}

export default async function ProjectFinancePage(props: PageProps<"/proyectos/[projectId]/finanzas">) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  if (!canViewProjectFinance(me)) notFound();
  const { projectId } = await props.params;
  const f = await orNotFound(projectFinance(me, projectId));
  const editors = await db.user.findMany({ where: { organizationId: me.organizationId, role: "EDITOR" }, select: { id: true, name: true } });
  const nameOf = (id: string | null) => editors.find((e) => e.id === id)?.name;
  return (
    <>
      <PageHeader
        eyebrow={<Link href={`/proyectos/${projectId}`} className="hover:text-ink">{f.project.name}</Link>}
        title="Economía"
        meta={<span>Margen estimado: todas las líneas. Margen final: solo confirmadas o liquidadas. Los impuestos no entran en el margen.</span>}
      />
      <div className="grid gap-5 lg:grid-cols-[1.5fr_1fr]">
        <div className="flex flex-col gap-5">
          <Section title="Líneas">
            {f.lines.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[640px] text-sm">
                  <thead className="border-b border-line bg-surface-2 text-left text-[12px] text-ink-3">
                    <tr>
                      <th className="px-4 py-2 font-medium">Concepto</th>
                      <th className="px-4 py-2 font-medium">Tipo</th>
                      <th className="px-4 py-2 text-right font-medium">Importe</th>
                      <th className="px-4 py-2 font-medium">Estado</th>
                      <th className="px-4 py-2" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {f.lines.map((l) => (
                      <tr key={l.id}>
                        <td className="px-4 py-2">
                          {l.description}
                          {l.editorId && <span className="block text-[12px] text-ink-3">{nameOf(l.editorId)}</span>}
                          {l.dueDate && <span className="block text-[12px] text-ink-3">Vence {fmtDate(l.dueDate)}</span>}
                        </td>
                        <td className="px-4 py-2 text-ink-2">{FINANCE_KIND[l.kind]}</td>
                        <td className="px-4 py-2 text-right tabular">
                          {l.kind === "DISCOUNT" || l.kind.endsWith("COST") ? "−" : ""}
                          {formatMoney(l.amountCents, l.currency)}
                          {l.taxBps > 0 && <span className="block text-[11px] text-ink-3">+{l.taxBps / 100} % imp.</span>}
                        </td>
                        <td className="px-4 py-2">
                          <Chip tone={l.status === "SETTLED" ? "success" : l.status === "CONFIRMED" ? "info" : "muted"}>{FINANCE_STATUS[l.status]}</Chip>
                        </td>
                        <td className="px-4 py-2 text-right whitespace-nowrap">
                          {l.status !== "SETTLED" && (
                            <form action={financeStatusAction} className="inline">
                              <input type="hidden" name="lineId" value={l.id} />
                              <input type="hidden" name="projectId" value={projectId} />
                              <input type="hidden" name="status" value={l.status === "ESTIMATED" ? "CONFIRMED" : "SETTLED"} />
                              <button className="text-[12px] text-ink-2 hover:text-ink">{l.status === "ESTIMATED" ? "Confirmar" : l.kind === "REVENUE" ? "Marcar cobrado" : "Marcar pagado"}</button>
                            </form>
                          )}
                          {me.role === "ADMIN" && l.status !== "SETTLED" && (
                            <form action={deleteFinanceLineAction} className="ml-3 inline">
                              <input type="hidden" name="lineId" value={l.id} />
                              <input type="hidden" name="projectId" value={projectId} />
                              <button className="text-[12px] text-[var(--tone-danger)]">Borrar</button>
                            </form>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Sin líneas económicas" />
            )}
          </Section>
          <Section title="Añadir línea">
            <FinanceLineForm projectId={projectId} currency={f.currency} taxPct={f.defaultTaxBps / 100} editors={editors} />
          </Section>
        </div>
        <div className="flex flex-col gap-3">
          <Summary r={f.estimated} title="Margen estimado" />
          <Summary r={f.final} title="Margen final" />
        </div>
      </div>
    </>
  );
}
