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
import { BackLink } from "@/components/BackLink";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

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
      ].filter(Boolean);
      return { ...item, subtotal, total, linked };
    });
    const categoryTotal = items.reduce((sum, item) => sum + item.total, 0);
    return { ...category, items, categoryTotal };
  });

  const grandTotal = categoriesWithTotals.reduce(
    (sum, category) => sum + category.categoryTotal,
    0,
  );

  return (
    <div>
      <div className="flex items-center justify-between print:hidden">
        <BackLink href={`/app/${projectId}`}>← {project.name}</BackLink>
        <PdfLink href={`/api/pdf/presupuesto/${projectId}`} />
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Presupuesto
      </h1>

      <form
        action={createCategoryAction}
        className="mt-8 flex max-w-sm gap-2 print:hidden"
      >
        <input
          name="name"
          placeholder="Nueva categoría (ej. Localizaciones)"
          required
          className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <button
          type="submit"
          className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          Crear
        </button>
      </form>

      {categoriesWithTotals.length === 0 ? (
        <EmptyState
          title="Todavía no hay categorías de presupuesto"
          description="Crea la primera con el formulario de arriba (por ejemplo, Localizaciones o Equipo técnico)."
        />
      ) : (
        <div className="mt-10 space-y-10">
          {categoriesWithTotals.map((category) => {
            const createItemAction = createBudgetItem.bind(
              null,
              projectId,
              category.id,
            );
            return (
              <section key={category.id}>
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-lg font-bold uppercase">
                    {category.name}
                  </h2>
                  <div className="flex items-center gap-4">
                    <span className="font-mono text-sm text-accent">
                      {currency(category.categoryTotal)}
                    </span>
                    <form
                      action={deleteBudgetCategory.bind(null, projectId, category.id)}
                      className="print:hidden"
                    >
                      <DeleteButton
                        confirmMessage="¿Eliminar esta categoría y todas sus partidas?"
                        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
                      >
                        Eliminar
                      </DeleteButton>
                    </form>
                  </div>
                </div>

                {category.items.length > 0 && (
                  <div className="mt-3 border-t border-line">
                    {category.items.map((item) => (
                      <div
                        key={item.id}
                        className="flex items-center justify-between gap-4 border-b border-line py-3"
                      >
                        <div>
                          <span className="font-mono text-sm">
                            {item.description}
                          </span>
                          <span className="ml-2 font-mono text-xs text-muted">
                            {Number(item.quantity)} × {currency(Number(item.unitPrice))}
                            {Number(item.taxRate) > 0
                              ? ` · IVA ${Number(item.taxRate)}%`
                              : ""}
                            {item.linked.length > 0
                              ? ` · ${item.linked.join(", ")}`
                              : ""}
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-sm">
                            {currency(item.total)}
                          </span>
                          <form
                            action={deleteBudgetItem.bind(null, projectId, item.id)}
                            className="print:hidden"
                          >
                            <DeleteButton
                              confirmMessage="¿Eliminar esta partida de presupuesto?"
                              className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                            />
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <form
                  action={createItemAction}
                  className="mt-3 grid gap-2 border border-dashed border-line p-4 sm:grid-cols-3 lg:grid-cols-6 print:hidden"
                >
                  <input
                    name="description"
                    placeholder="Concepto"
                    required
                    className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent sm:col-span-2 lg:col-span-2"
                  />
                  <input
                    name="quantity"
                    type="number"
                    step="0.01"
                    placeholder="Cantidad"
                    defaultValue="1"
                    className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  />
                  <input
                    name="unitPrice"
                    type="number"
                    step="0.01"
                    placeholder="Precio unidad"
                    className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  />
                  <input
                    name="taxRate"
                    type="number"
                    step="0.01"
                    placeholder="IVA %"
                    className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  />
                  <select
                    name="actorId"
                    defaultValue=""
                    className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  >
                    <option value="" className="bg-bg">
                      Sin actor
                    </option>
                    {actors.map((a) => (
                      <option key={a.id} value={a.id} className="bg-bg">
                        {a.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="locationId"
                    defaultValue=""
                    className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  >
                    <option value="" className="bg-bg">
                      Sin localización
                    </option>
                    {locations.map((l) => (
                      <option key={l.id} value={l.id} className="bg-bg">
                        {l.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="crewMemberId"
                    defaultValue=""
                    className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  >
                    <option value="" className="bg-bg">
                      Sin equipo
                    </option>
                    {crewMembers.map((c) => (
                      <option key={c.id} value={c.id} className="bg-bg">
                        {c.name}
                      </option>
                    ))}
                  </select>
                  <select
                    name="breakdownElementId"
                    defaultValue=""
                    className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                  >
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
                    <button
                      type="submit"
                      className="rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                    >
                      Añadir
                    </button>
                  </div>
                </form>
              </section>
            );
          })}

          <div className="flex items-center justify-between border-t border-line pt-6">
            <span className="font-display text-xl font-bold uppercase">
              Total
            </span>
            <span className="font-display text-xl font-bold text-accent">
              {currency(grandTotal)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
