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
import { SubmitButton } from "@/components/SubmitButton";

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
      const linked = [
        item.actor?.name,
        item.location?.name,
        item.crewMember?.name,
        item.breakdownElement?.name,
      ].filter(Boolean) as string[];
      return { ...item, subtotal, total, linked };
    });
    const categoryTotal = items.reduce((sum, item) => sum + item.total, 0);
    return { ...category, items, categoryTotal };
  });

  const grandTotal = categoriesWithTotals.reduce(
    (sum, category) => sum + category.categoryTotal,
    0,
  );
  const itemCount = categoriesWithTotals.reduce((n, c) => n + c.items.length, 0);
  const target = project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  const targetPct = target && target > 0 ? Math.min(100, (grandTotal / target) * 100) : null;

  const newCategoryForm = (
    <form
      action={createCategoryAction}
      className="flex max-w-md gap-2 print:hidden"
    >
      <input
        name="name"
        placeholder="Nueva categoría (ej. Localizaciones)"
        required
        className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
      />
      <SubmitButton
        pendingLabel="Creando…"
        savedLabel="✓ Creada"
        className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
      >
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
        description="Cada partida con su cantidad, precio e IVA. Los totales por categoría y el general se calculan solos."
        actions={<PdfLink href={`/api/pdf/presupuesto/${projectId}`} />}
      />

      <div className="mt-8 grid gap-px overflow-hidden border border-line bg-line sm:grid-cols-[1.4fr_1fr_1fr]">
        <div className="bg-bg-raised p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Total con IVA
          </p>
          <p className="mt-2 font-display text-3xl font-black tabular-nums">
            {currency(grandTotal)}
          </p>
          {targetPct !== null && target !== null && (
            <div className="mt-3">
              <div className="h-1 w-full bg-line">
                <div className="h-full bg-accent" style={{ width: `${targetPct}%` }} />
              </div>
              <p className="mt-1.5 font-mono text-[10px] text-muted">
                {Math.round((grandTotal / target) * 100)}% del objetivo ({currency(target)})
              </p>
            </div>
          )}
        </div>
        <div className="bg-bg-raised p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Categorías
          </p>
          <p className="mt-2 font-display text-3xl font-black tabular-nums">
            {categoriesWithTotals.length}
          </p>
        </div>
        <div className="bg-bg-raised p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Partidas
          </p>
          <p className="mt-2 font-display text-3xl font-black tabular-nums">{itemCount}</p>
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
            const createItemAction = createBudgetItem.bind(
              null,
              projectId,
              category.id,
            );
            const share = grandTotal > 0 ? (category.categoryTotal / grandTotal) * 100 : 0;
            return (
              <section key={category.id} className="border border-line bg-bg-raised/40">
                <div className="flex items-center justify-between gap-4 px-5 py-4">
                  <div className="min-w-0">
                    <h2 className="font-display text-lg font-bold uppercase">
                      {category.name}
                    </h2>
                    <p className="mt-0.5 font-mono text-[11px] text-muted">
                      {category.items.length} partida
                      {category.items.length === 1 ? "" : "s"} · {Math.round(share)}% del total
                    </p>
                  </div>
                  <div className="flex items-center gap-5">
                    <span className="font-display text-xl font-bold tabular-nums text-accent">
                      {currency(category.categoryTotal)}
                    </span>
                    <form
                      action={deleteBudgetCategory.bind(null, projectId, category.id)}
                      className="print:hidden"
                    >
                      <DeleteButton
                        confirmMessage="¿Eliminar esta categoría y todas sus partidas?"
                        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-fg"
                      >
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
                        className="grid grid-cols-[1fr_auto] items-center gap-x-6 gap-y-1 px-5 py-3 sm:grid-cols-[1fr_13rem_8rem_auto]"
                      >
                        <div className="min-w-0">
                          <p className="font-mono text-sm">{item.description}</p>
                          {item.linked.length > 0 && (
                            <p className="mt-0.5 font-mono text-[11px] text-accent/80">
                              {item.linked.join(" · ")}
                            </p>
                          )}
                        </div>
                        <p className="hidden font-mono text-xs text-muted tabular-nums sm:block">
                          {Number(item.quantity)} × {currency(Number(item.unitPrice))}
                          {Number(item.taxRate) > 0 ? ` · IVA ${Number(item.taxRate)}%` : ""}
                        </p>
                        <p className="text-right font-mono text-sm tabular-nums">
                          {currency(item.total)}
                        </p>
                        <form
                          action={deleteBudgetItem.bind(null, projectId, item.id)}
                          className="print:hidden"
                        >
                          <DeleteButton
                            confirmMessage="¿Eliminar esta partida de presupuesto?"
                            className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-fg"
                          />
                        </form>
                      </div>
                    ))}
                  </div>
                )}

                <details className="group border-t border-line print:hidden">
                  <summary className="cursor-pointer list-none px-5 py-3 font-mono text-[11px] tracking-widest text-muted uppercase transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
                    <span className="mr-1.5 inline-block transition-transform group-open:rotate-45">
                      +
                    </span>
                    Añadir partida
                  </summary>
                  <form
                    action={createItemAction}
                    className="grid gap-2 px-5 pb-5 sm:grid-cols-3 lg:grid-cols-6"
                  >
                    <input
                      name="description"
                      placeholder="Concepto"
                      required
                      className={`${FIELD} sm:col-span-2 lg:col-span-2`}
                    />
                    <input
                      name="quantity"
                      type="number"
                      step="0.01"
                      placeholder="Cantidad"
                      defaultValue="1"
                      className={FIELD}
                    />
                    <input
                      name="unitPrice"
                      type="number"
                      step="0.01"
                      placeholder="Precio unidad"
                      className={FIELD}
                    />
                    <input
                      name="taxRate"
                      type="number"
                      step="0.01"
                      placeholder="IVA %"
                      className={FIELD}
                    />
                    <select name="actorId" defaultValue="" className={FIELD}>
                      <option value="" className="bg-bg">
                        Sin actor
                      </option>
                      {actors.map((a) => (
                        <option key={a.id} value={a.id} className="bg-bg">
                          {a.name}
                        </option>
                      ))}
                    </select>
                    <select name="locationId" defaultValue="" className={FIELD}>
                      <option value="" className="bg-bg">
                        Sin localización
                      </option>
                      {locations.map((l) => (
                        <option key={l.id} value={l.id} className="bg-bg">
                          {l.name}
                        </option>
                      ))}
                    </select>
                    <select name="crewMemberId" defaultValue="" className={FIELD}>
                      <option value="" className="bg-bg">
                        Sin equipo
                      </option>
                      {crewMembers.map((c) => (
                        <option key={c.id} value={c.id} className="bg-bg">
                          {c.name}
                        </option>
                      ))}
                    </select>
                    <select name="breakdownElementId" defaultValue="" className={FIELD}>
                      <option value="" className="bg-bg">
                        Sin elemento
                      </option>
                      {breakdownElements.map((b) => (
                        <option key={b.id} value={b.id} className="bg-bg">
                          {b.name}
                        </option>
                      ))}
                    </select>
                    <div>
                      <SubmitButton
                        pendingLabel="Añadiendo…"
                        savedLabel="✓ Añadido"
                        className="rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                      >
                        Añadir
                      </SubmitButton>
                    </div>
                  </form>
                </details>
              </section>
            );
          })}

          <div className="flex items-center justify-between border border-accent/40 bg-accent/5 px-5 py-5">
            <span className="font-display text-xl font-bold uppercase">Total</span>
            <span className="font-display text-2xl font-black tabular-nums text-accent">
              {currency(grandTotal)}
            </span>
          </div>

          <div className="pt-2">{newCategoryForm}</div>
        </div>
      )}
    </div>
  );
}
