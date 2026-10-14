import Link from "next/link";
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
import { PdfLink } from "@/components/PdfLink";
import { ExcelExport } from "@/components/ExcelExport";
import { PageHeader } from "@/components/PageHeader";
import { ActionButtonForm } from "@/components/ActionButtonForm";
import { createStarterBudget } from "@/lib/actions/budget";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { BudgetActualField } from "@/components/BudgetActualField";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

const FIELD = "field w-full";

// Columnas de la tabla en pantalla ancha: partida, cálculo, previsto, gasto
// real y borrar. La cabecera de cada categoría usa las mismas para que sus
// totales caigan bajo «Previsto» y «Gastado».
const COLS = "lg:grid-cols-[minmax(0,1fr)_11rem_8rem_16.5rem_4.5rem]";

// Presupuesto como una hoja de cálculo limpia: una sola hoja con todas las
// categorías, sus partidas en filas y los totales al pie. Las cifras de
// arriba van sin cajas, y los formularios (nueva partida, nueva categoría)
// están plegados hasta que se piden.

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
    <form action={createCategoryAction} className="flex max-w-md items-end gap-4 print:hidden">
      <label className="block min-w-0 flex-1">
        <span className="eyebrow">Nombre de la categoría</span>
        <input name="name" placeholder="Ej. Localizaciones" required className="field-line" />
      </label>
      <SubmitButton pendingLabel="Creando…" savedLabel="✓ Creada" className="btn btn-outline btn-sm shrink-0">
        Crear
      </SubmitButton>
    </form>
  );

  const spentPct = grandTotal > 0 ? Math.round((grandActual / grandTotal) * 100) : 0;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Producción"
        title="Presupuesto"
        description="Apunta cada partida con cantidad, precio e IVA y el previsto se calcula solo. Cuando pagues algo, anota el gasto real en su fila para ver cómo vas."
        actions={
          <>
            <PdfLink href={`/api/pdf/presupuesto/${projectId}`} />
            <ExcelExport href={`/api/xlsx/presupuesto/${projectId}`} />
          </>
        }
      />

      {/* ------------------------------------------------ cifras */}
      <dl className="mt-10 grid gap-y-8 border-y border-line py-7 sm:grid-cols-3 sm:gap-x-10 sm:divide-x sm:divide-line">
        <div>
          <dt className="eyebrow">Previsto, con IVA</dt>
          <dd className="mt-2 font-display text-4xl font-black tracking-tight tabular-nums">{currency(grandTotal)}</dd>
          <dd className="mt-1 font-sans text-sm text-muted">
            {itemCount} partida{itemCount === 1 ? "" : "s"} en {categoriesWithTotals.length} categoría
            {categoriesWithTotals.length === 1 ? "" : "s"}
          </dd>
        </div>
        <div className="sm:pl-10">
          <dt className="eyebrow">Gastado</dt>
          <dd className="mt-2 font-display text-4xl font-black tracking-tight tabular-nums">{currency(grandActual)}</dd>
          <dd className="mt-3 flex items-center gap-3">
            <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
              <span
                className={`block h-full rounded-full ${overTarget ? "bg-danger" : "bg-accent"}`}
                style={{ width: `${actualPct}%` }}
              />
            </span>
            <span className="font-mono text-[11px] text-muted tabular-nums">
              {target !== null ? `${Math.round(actualPct)}% del objetivo` : `${spentPct}% de lo previsto`}
            </span>
          </dd>
          <dd className="mt-1 font-sans text-sm text-muted">
            {itemsWithActual} de {itemCount} partidas con gasto anotado
          </dd>
        </div>
        <div className="sm:pl-10">
          {target !== null && remaining !== null ? (
            <>
              <dt className="eyebrow">{overTarget ? "Te has pasado del objetivo" : "Te queda del objetivo"}</dt>
              <dd
                className={`mt-2 font-display text-4xl font-black tracking-tight tabular-nums ${
                  overTarget ? "text-danger" : "text-success"
                }`}
              >
                {currency(Math.abs(remaining))}
              </dd>
              <dd className="mt-1 font-sans text-sm text-muted">Objetivo: {currency(target)}</dd>
            </>
          ) : (
            <>
              <dt className="eyebrow">Objetivo</dt>
              <dd className="mt-2 font-display text-4xl font-black tracking-tight text-muted/50">—</dd>
              <dd className="mt-1 font-sans text-sm text-muted">
                Fíjalo en{" "}
                <Link href={`/app/${projectId}`} className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
                  Datos del proyecto
                </Link>{" "}
                para saber cuánto te queda.
              </dd>
            </>
          )}
        </div>
      </dl>

      {categoriesWithTotals.length === 0 ? (
        /* ------------------------------------------------ vacío */
        <section aria-labelledby="empezar" className="mt-14 max-w-2xl">
          <p className="eyebrow text-accent">Para empezar</p>
          <h2 id="empezar" className="mt-2 font-display text-2xl font-black tracking-tight sm:text-3xl">
            Parte de las categorías de siempre
          </h2>
          <p className="mt-3 font-sans text-[15px] leading-relaxed text-muted">
            Creo las categorías típicas de {project.type ? `un proyecto de tipo «${project.type}»` : "un rodaje"}: equipo,
            reparto, localizaciones, alquiler, arte, catering, postproducción… Solo los títulos; los importes los pones tú, y
            puedes borrar o añadir las que quieras.
          </p>
          <div className="mt-6">
            <ActionButtonForm
              action={createStarterBudget.bind(null, projectId)}
              pendingLabel="Creando…"
              className="btn btn-primary"
            >
              Crear las categorías
            </ActionButtonForm>
          </div>
          <div className="mt-12 border-t border-line pt-6">
            <p className="mb-4 font-sans text-sm text-muted">¿Prefieres hacerlo a tu manera? Crea la primera categoría:</p>
            {newCategoryForm}
          </div>
        </section>
      ) : (
        /* ------------------------------------------------ hoja */
        <>
          <div className="sheet mt-10 px-5 pb-2 sm:px-8">
            <div className={`hidden gap-x-6 border-b border-line pt-5 pb-3 lg:grid ${COLS}`}>
              <span className="eyebrow">Partida</span>
              <span className="eyebrow">Cantidad × precio</span>
              <span className="eyebrow text-right">Previsto</span>
              <span className="eyebrow">Gasto real</span>
              <span />
            </div>

            {categoriesWithTotals.map((category, index) => {
              const createItemAction = createBudgetItem.bind(null, projectId, category.id);
              const share = grandTotal > 0 ? (category.categoryTotal / grandTotal) * 100 : 0;
              return (
                <section
                  key={category.id}
                  aria-labelledby={`cat-${category.id}`}
                  className={index > 0 ? "border-t border-line" : ""}
                >
                  {/* Cabecera de la categoría */}
                  <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-end gap-x-6 gap-y-1 pt-7 pb-3 ${COLS}`}>
                    <div className="min-w-0 lg:col-span-2">
                      <h2 id={`cat-${category.id}`} className="font-display text-xl font-black tracking-tight">
                        {category.name}
                      </h2>
                      <p className="mt-1 flex items-center gap-3 font-mono text-[11px] text-muted">
                        <span className="h-1 w-16 overflow-hidden rounded-full bg-line" aria-hidden>
                          <span className="block h-full bg-accent" style={{ width: `${share}%` }} />
                        </span>
                        {Math.round(share)}% del total · {category.items.length} partida
                        {category.items.length === 1 ? "" : "s"}
                      </p>
                    </div>
                    <p className="text-right font-display text-xl font-bold tabular-nums">
                      {currency(category.categoryTotal)}
                    </p>
                    <p className="hidden font-mono text-sm text-muted tabular-nums lg:block">
                      <span className="inline-block w-24 text-right">
                        {category.categoryActual > 0 ? currency(category.categoryActual) : "—"}
                      </span>
                    </p>
                    <form
                      action={deleteBudgetCategory.bind(null, projectId, category.id)}
                      className="col-span-2 justify-self-start lg:col-span-1 lg:justify-self-end print:hidden"
                    >
                      <DeleteButton
                        confirmMessage="¿Eliminar esta categoría y todas sus partidas?"
                        className="link-action -ml-1 lg:ml-0"
                      >
                        Borrar
                      </DeleteButton>
                    </form>
                  </div>

                  {/* Partidas */}
                  {category.items.length > 0 && (
                    <ul className="divide-y divide-line/70 border-t border-line/70">
                      {category.items.map((item) => (
                        <li
                          key={item.id}
                          className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-3 ${COLS}`}
                        >
                          <div className="min-w-0">
                            <p className="font-sans text-[15px]">{item.description}</p>
                            {item.linked.length > 0 && (
                              <p className="mt-0.5 font-mono text-[11px] text-accent">{item.linked.join(" · ")}</p>
                            )}
                            <p className="mt-0.5 font-mono text-[11px] text-muted tabular-nums lg:hidden">
                              {item.quantity} × {currency(item.unitPrice)}
                              {item.taxRate > 0 ? ` + ${item.taxRate}% IVA` : ""}
                            </p>
                          </div>
                          <p className="hidden font-mono text-xs text-muted tabular-nums lg:block">
                            {item.quantity} × {currency(item.unitPrice)}
                            {item.taxRate > 0 ? ` + ${item.taxRate}% IVA` : ""}
                          </p>
                          <p className="text-right font-mono text-sm tabular-nums">{currency(item.total)}</p>
                          <div className="col-span-2 flex items-center justify-between gap-2 lg:contents print:hidden">
                            <BudgetActualField
                              projectId={projectId}
                              itemId={item.id}
                              description={item.description}
                              planned={item.total}
                              actual={item.actual}
                            />
                            <form
                              action={deleteBudgetItem.bind(null, projectId, item.id)}
                              className="justify-self-end"
                            >
                              <DeleteButton confirmMessage="¿Eliminar esta partida de presupuesto?" className="link-action">
                                Quitar
                              </DeleteButton>
                            </form>
                          </div>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Nueva partida, plegada */}
                  <details className="group pb-5 print:hidden">
                    <summary className="link-action -ml-1 mt-1 cursor-pointer list-none !text-accent [&::-webkit-details-marker]:hidden">
                      <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-45">
                        +
                      </span>
                      <span className="group-open:hidden">Añadir partida a {category.name}</span>
                      <span className="hidden group-open:inline">Cerrar</span>
                    </summary>
                    <form
                      action={createItemAction}
                      className="mt-3 grid gap-x-5 gap-y-4 border-l-2 border-accent pl-5 sm:grid-cols-2 lg:grid-cols-6"
                    >
                      <FormField label="Concepto" className="sm:col-span-2 lg:col-span-3">
                        <input name="description" required placeholder="Ej. Alquiler de grúa" className={FIELD} />
                      </FormField>
                      <FormField label="Cantidad">
                        <input name="quantity" type="number" step="0.01" defaultValue="1" className={FIELD} />
                      </FormField>
                      <FormField label="Precio unidad (€)">
                        <input name="unitPrice" type="number" step="0.01" placeholder="0,00" className={FIELD} />
                      </FormField>
                      <FormField label="IVA (%)">
                        <input name="taxRate" type="number" step="0.01" placeholder="21" className={FIELD} />
                      </FormField>
                      <p className="eyebrow sm:col-span-2 lg:col-span-6">Vincular a (opcional)</p>
                      <FormField label="Actor" className="lg:col-span-3 xl:col-span-3">
                        <select name="actorId" defaultValue="" className={FIELD}>
                          <option value="" className="bg-bg">Ninguno</option>
                          {actors.map((a) => (
                            <option key={a.id} value={a.id} className="bg-bg">{a.name}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Localización" className="lg:col-span-3">
                        <select name="locationId" defaultValue="" className={FIELD}>
                          <option value="" className="bg-bg">Ninguna</option>
                          {locations.map((l) => (
                            <option key={l.id} value={l.id} className="bg-bg">{l.name}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Equipo técnico" className="lg:col-span-3">
                        <select name="crewMemberId" defaultValue="" className={FIELD}>
                          <option value="" className="bg-bg">Nadie</option>
                          {crewMembers.map((c) => (
                            <option key={c.id} value={c.id} className="bg-bg">{c.name}</option>
                          ))}
                        </select>
                      </FormField>
                      <FormField label="Elemento de desglose" className="lg:col-span-3">
                        <select name="breakdownElementId" defaultValue="" className={FIELD}>
                          <option value="" className="bg-bg">Ninguno</option>
                          {breakdownElements.map((b) => (
                            <option key={b.id} value={b.id} className="bg-bg">{b.name}</option>
                          ))}
                        </select>
                      </FormField>
                      <div className="sm:col-span-2 lg:col-span-6">
                        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadida" className="btn btn-secondary btn-sm">
                          Añadir partida
                        </SubmitButton>
                      </div>
                    </form>
                  </details>
                </section>
              );
            })}

            {/* Totales */}
            <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-t-2 border-fg py-5 ${COLS}`}>
              <p className="font-display text-lg font-black tracking-tight uppercase lg:col-span-2">Total</p>
              <p className="text-right font-display text-2xl font-black tabular-nums text-accent">{currency(grandTotal)}</p>
              <p className="col-span-2 text-right font-mono text-sm text-muted tabular-nums lg:col-span-1 lg:text-left">
                <span className="lg:hidden">Gastado </span>
                <span className="lg:inline-block lg:w-24 lg:text-right">{currency(grandActual)}</span>
              </p>
            </div>
          </div>

          <details className="group mt-6 print:hidden">
            <summary className="link-action -ml-1 cursor-pointer list-none [&::-webkit-details-marker]:hidden">
              <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-45">
                +
              </span>
              Nueva categoría
            </summary>
            <div className="mt-3">{newCategoryForm}</div>
          </details>
        </>
      )}
    </div>
  );
}
