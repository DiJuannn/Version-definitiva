import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import {
  createBudgetCategory,
  createBudgetItem,
  deleteBudgetCategory,
  deleteBudgetItem,
} from "@/lib/actions/budget";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { PdfLink } from "@/components/PdfLink";
import { PageHeader } from "@/components/PageHeader";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { BudgetActualField } from "@/components/BudgetActualField";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

const FIELD =
  "border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent";

export default async function PresupuestoPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [categories, actors, locations, crewMembers, breakdownElements] =
    await Promise.all([
      prisma.budgetCategory.findMany({
        where: { projectId },
        orderBy: { order: "asc" },
        include: {
          items: {
            orderBy: { createdAt: "asc" },
            include: {
              actor: { select: { name: true } },
              location: { select: { name: true } },
              crewMember: { select: { name: true } },
              breakdownElement: { select: { name: true } },
            },
          },
        },
      }),
      prisma.actor.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.location.findMany({
        where: { organizationId: project.organizationId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.crewMember.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.breakdownElement.findMany({
        where: { projectId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
    ]);

  const createCategoryAction = createBudgetCategory.bind(null, projectId);

  const categoriesWithTotals = categories.map((category) => {
    const items = category.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate);
      const subtotal = quantity * unitPrice;
      const total = subtotal * (1 + taxRate / 100);
      const actual = item.actualAmount !== null ? Number(item.actualAmount) : null;
      const linked = [
        item.actor?.name,
        item.location?.name,
        item.crewMember?.name,
        item.breakdownElement?.name,
      ].filter(Boolean) as string[];
      return { ...item, quantity, unitPrice, taxRate, subtotal, total, actual, linked };
    });
    const categoryTotal = items.reduce((sum, item) => sum + item.total, 0);
    const categoryActual = items.reduce((sum, item) => sum + (item.actual ?? 0), 0);
    return { ...category, items, categoryTotal, categoryActual };
  });

  const grandTotal = categoriesWithTotals.reduce((sum, c) => sum + c.categoryTotal, 0);
  const grandActual = categoriesWithTotals.reduce((sum, c) => sum + c.categoryActual, 0);
  const itemCount = categoriesWithTotals.reduce((n, c) => n + c.items.length, 0);
  const itemsWithActual = categoriesWithTotals.reduce(
    (n, c) => n + c.items.filter((i) => i.actual !== null).length,
    0,
  );
  const target = project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  const base = target ?? grandTotal;
  const actualPct = base > 0 ? Math.min(100, (grandActual / base) * 100) : 0;
  const remaining = target !== null ? target - grandActual : null;
  const overTarget = remaining !== null && remaining < 0;

  const newCategoryForm = (
    <form action={createCategoryAction} className="flex max-w-md items-end gap-2 print:hidden">
      <FormField label="Nueva categoría" className="w-full">
        <input
          name="name"
          placeholder="Ej. Localizaciones"
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
      </FormField>
      <SubmitButton pendingLabel="Creando…" savedLabel="✓ Creada" className="btn btn-secondary shrink-0">
        Crear
      </SubmitButton>
    </form>
  );

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Producción"
        title="Presupuesto"
        description="Lo previsto (cantidad × precio + IVA) se calcula solo. Anota el gasto real de cada partida a medida que se paga para ver cómo vas."
        actions={<PdfLink href={`/api/pdf/presupuesto/${projectId}`} />}
      />

      <div className="mt-8 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-3">
        <div className="bg-bg-raised p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">Previsto (con IVA)</p>
          <p className="mt-2 font-display text-3xl font-black tabular-nums">{currency(grandTotal)}</p>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            {categoriesWithTotals.length} categoría{categoriesWithTotals.length === 1 ? "" : "s"} ·{" "}
            {itemCount} partida{itemCount === 1 ? "" : "s"}
          </p>
        </div>
        <div className="bg-bg-raised p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">Gastado</p>
          <p className="mt-2 font-display text-3xl font-black tabular-nums">{currency(grandActual)}</p>
          <div className="mt-3 h-1 w-full bg-line">
            <div
              className={`h-full ${overTarget ? "bg-danger" : "bg-accent"}`}
              style={{ width: `${actualPct}%` }}
            />
          </div>
          <p className="mt-1.5 font-mono text-[11px] text-muted">
            {itemsWithActual}/{itemCount} partidas con gasto anotado
          </p>
        </div>
        <div className="bg-bg-raised p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            {target !== null ? "Disponible del objetivo" : "Objetivo"}
          </p>
          {target !== null && remaining !== null ? (
            <>
              <p
                className={`mt-2 font-display text-3xl font-black tabular-nums ${
                  overTarget ? "text-danger" : ""
                }`}
              >
                {currency(remaining)}
              </p>
              <p className="mt-1.5 font-mono text-[11px] text-muted">
                de {currency(target)} de presupuesto objetivo
                {overTarget ? " · te has pasado" : ""}
              </p>
            </>
          ) : (
            <p className="mt-2 font-mono text-xs text-muted">
              Sin objetivo. Puedes fijarlo en «Datos del proyecto» para ver cuánto te queda.
            </p>
          )}
        </div>
      </div>

      {categoriesWithTotals.length === 0 ? (
        <>
          <EmptyState
            title="Todavía no hay categorías de presupuesto"
            description="Crea la primera con el formulario de abajo (por ejemplo, Localizaciones o Equipo técnico)."
          />
          <div className="mt-6">{newCategoryForm}</div>
        </>
      ) : (
        <div className="mt-8 space-y-5">
          {categoriesWithTotals.map((category) => {
            const createItemAction = createBudgetItem.bind(null, projectId, category.id);
            const share = grandTotal > 0 ? (category.categoryTotal / grandTotal) * 100 : 0;
            return (
              <section key={category.id} className="border border-line bg-bg-raised/40">
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold">{category.name}</h2>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {category.items.length} partida{category.items.length === 1 ? "" : "s"} ·{" "}
                      {Math.round(share)}% del total
                      {category.categoryActual > 0 && ` · gastado ${currency(category.categoryActual)}`}
                    </p>
                  </div>
                  <div className="flex items-center gap-4">
                    <span className="font-display text-xl font-bold tabular-nums text-accent">
                      {currency(category.categoryTotal)}
                    </span>
                    <form
                      action={deleteBudgetCategory.bind(null, projectId, category.id)}
                      className="print:hidden"
                    >
                      <DeleteButton confirmMessage="¿Eliminar esta categoría y todas sus partidas?">
                        Eliminar
                      </DeleteButton>
                    </form>
                  </div>
                </div>
                <div className="h-0.5 w-full bg-line">
                  <div className="h-full bg-accent" style={{ width: `${share}%` }} />
                </div>

                {category.items.length > 0 && (
                  <div className="divide-y divide-line">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 px-5 py-3 lg:grid-cols-[minmax(0,1fr)_10rem_7rem_19rem_auto]"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm">{item.description}</p>
                          {item.linked.length > 0 && (
                            <p className="mt-0.5 font-mono text-[11px] text-accent/80">
                              {item.linked.join(" · ")}
                            </p>
                          )}
                          <p className="mt-0.5 font-mono text-[11px] text-muted tabular-nums lg:hidden">
                            {item.quantity} × {currency(item.unitPrice)}
                            {item.taxRate > 0 ? ` · IVA ${item.taxRate}%` : ""}
                          </p>
                        </div>
                        <p className="hidden font-mono text-xs text-muted tabular-nums lg:block">
                          {item.quantity} × {currency(item.unitPrice)}
                          {item.taxRate > 0 ? ` · IVA ${item.taxRate}%` : ""}
                        </p>
                        <p className="text-right font-mono text-sm tabular-nums">
                          <span className="mr-1 font-mono text-[10px] tracking-widest text-muted uppercase lg:hidden">
                            Prev.
                          </span>
                          {currency(item.total)}
                        </p>
                        <div className="col-span-2 flex flex-wrap items-center justify-between gap-2 lg:contents print:hidden">
                          <BudgetActualField
                            projectId={projectId}
                            itemId={item.id}
                            description={item.description}
                            planned={item.total}
                            actual={item.actual}
                          />
                        <form
                          action={deleteBudgetItem.bind(null, projectId, item.id)}
                          className="justify-self-end print:hidden"
                        >
                          <DeleteButton confirmMessage="¿Eliminar esta partida de presupuesto?" />
                        </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <details className="group border-t border-line print:hidden">
                  <summary className="link-action cursor-pointer list-none px-5 [&::-webkit-details-marker]:hidden">
                    <span className="mr-1.5 inline-block transition-transform group-open:rotate-45">+</span>
                    Añadir partida
                  </summary>
                  <form
                    action={createItemAction}
                    className="grid gap-3 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-4"
                  >
                    <FormField label="Concepto" className="sm:col-span-2">
                      <input name="description" required className={FIELD} />
                    </FormField>
                    <FormField label="Cantidad">
                      <input name="quantity" type="number" step="0.01" defaultValue="1" className={FIELD} />
                    </FormField>
                    <FormField label="Precio unidad (€)">
                      <input name="unitPrice" type="number" step="0.01" className={FIELD} />
                    </FormField>
                    <FormField label="IVA (%)">
                      <input name="taxRate" type="number" step="0.01" className={FIELD} />
                    </FormField>
                    <FormField label="Actor">
                      <select name="actorId" defaultValue="" className={FIELD}>
                        <option value="" className="bg-bg">Sin actor</option>
                        {actors.map((a) => (
                          <option key={a.id} value={a.id} className="bg-bg">{a.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Localización">
                      <select name="locationId" defaultValue="" className={FIELD}>
                        <option value="" className="bg-bg">Sin localización</option>
                        {locations.map((l) => (
                          <option key={l.id} value={l.id} className="bg-bg">{l.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Equipo técnico">
                      <select name="crewMemberId" defaultValue="" className={FIELD}>
                        <option value="" className="bg-bg">Sin equipo</option>
                        {crewMembers.map((c) => (
                          <option key={c.id} value={c.id} className="bg-bg">{c.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <FormField label="Elemento de desglose">
                      <select name="breakdownElementId" defaultValue="" className={FIELD}>
                        <option value="" className="bg-bg">Sin elemento</option>
                        {breakdownElements.map((b) => (
                          <option key={b.id} value={b.id} className="bg-bg">{b.name}</option>
                        ))}
                      </select>
                    </FormField>
                    <div className="flex items-end">
                      <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido">
                        Añadir
                      </SubmitButton>
                    </div>
                  </form>
                </details>
              </section>
            );
          })}

          <div className="grid gap-px border border-accent/40 bg-accent/20 sm:grid-cols-2">
            <div className="flex items-center justify-between bg-bg px-5 py-4">
              <span className="font-display text-lg font-bold">Total previsto</span>
              <span className="font-display text-2xl font-black tabular-nums text-accent">
                {currency(grandTotal)}
              </span>
            </div>
            <div className="flex items-center justify-between bg-bg px-5 py-4">
              <span className="font-display text-lg font-bold">Total gastado</span>
              <span className="font-display text-2xl font-black tabular-nums">{currency(grandActual)}</span>
            </div>
          </div>

          <div className="pt-2">{newCategoryForm}</div>
        </div>
      )}
    </div>
  );
}
