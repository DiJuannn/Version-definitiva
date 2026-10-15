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
import { CloseOnSaved, FormModal, ModalCancel } from "@/components/gestion/FormModal";
import { Notice, Notices, StatusLine } from "@/components/gestion/ToolStatus";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function signedCurrency(value: number) {
  const abs = currency(Math.abs(value));
  return value > 0 ? `+${abs}` : `−${abs}`;
}

const FIELD = "field w-full";

// Colores fijos por orden de categoría (siempre el mismo color para la misma
// posición, nunca un arcoíris generado). Validados para la mesa oscura:
// misma luminosidad, contraste ≥ 3:1 y separables con daltonismo entre
// vecinos. A partir de la octava categoría, gris «otras».
const CATEGORY_COLORS = ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9"];
const OTHER_COLOR = "#6b6a72";
const colorFor = (index: number) => CATEGORY_COLORS[index] ?? OTHER_COLOR;

// Columnas del libro en pantalla ancha: partida, cálculo, previsto, gasto
// real, desviación y quitar. Las filas de categoría usan las mismas para que
// sus totales caigan justo bajo cada cifra.
const COLS = "lg:grid-cols-[minmax(0,1fr)_11.5rem_7.5rem_16rem_6rem_3.5rem]";

// Desviación de una partida: positiva = te has pasado. Más de un 10 % por
// encima es un problema (rojo); por encima pero poco, un aviso (ámbar).
function deviationTone(planned: number, actual: number) {
  const diff = actual - planned;
  if (Math.abs(diff) < 0.005) return { diff: 0, cls: "text-muted", label: "Justo" };
  if (diff < 0) return { diff, cls: "text-success", label: signedCurrency(diff) };
  const ratio = planned > 0 ? diff / planned : 1;
  return { diff, cls: ratio > 0.1 ? "text-danger" : "text-warn", label: signedCurrency(diff) };
}

// Presupuesto en dos piezas: arriba el reparto (en qué se va el dinero y
// cuánto llevas gastado, en dos barras a la misma escala) y debajo el libro
// de cuentas, por categorías, con las cifras alineadas como en un libro
// contable y la desviación de cada partida a la vista.

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

  const categoriesWithTotals = categories.map((category, index) => {
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
    // Lo previsto de las partidas que ya tienen gasto: para comparar
    // manzanas con manzanas al calcular la desviación de la categoría.
    const plannedOfPaid = items.reduce((sum, item) => sum + (item.actual !== null ? item.total : 0), 0);
    const paidCount = items.filter((i) => i.actual !== null).length;
    return { ...category, items, categoryTotal, categoryActual, plannedOfPaid, paidCount, color: colorFor(index) };
  });

  const grandTotal = categoriesWithTotals.reduce((sum, c) => sum + c.categoryTotal, 0);
  const grandActual = categoriesWithTotals.reduce((sum, c) => sum + c.categoryActual, 0);
  const grandPlannedOfPaid = categoriesWithTotals.reduce((sum, c) => sum + c.plannedOfPaid, 0);
  const itemCount = categoriesWithTotals.reduce((n, c) => n + c.items.length, 0);
  const itemsWithActual = categoriesWithTotals.reduce((n, c) => n + c.paidCount, 0);
  const target = project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  const remaining = target !== null ? target - grandActual : null;
  const overTarget = remaining !== null && remaining < 0;
  const plannedOverTarget = target !== null && grandTotal > target;
  const spentPct = grandTotal > 0 ? Math.round((grandActual / grandTotal) * 100) : 0;

  // Partidas que ya se han pasado de lo previsto, de mayor a menor.
  const overruns = categoriesWithTotals
    .flatMap((c) => c.items)
    .filter((i) => i.actual !== null && i.actual - i.total > 0.005)
    .map((i) => ({ description: i.description, diff: (i.actual as number) - i.total, pct: i.total > 0 ? ((i.actual as number) - i.total) / i.total : 1 }))
    .sort((a, b) => b.diff - a.diff);
  const emptyCategories = categoriesWithTotals.filter((c) => c.items.length === 0);

  // Escala común de las dos barras: lo mayor entre previsto, gastado y objetivo.
  const scale = Math.max(grandTotal, grandActual, target ?? 0, 1);
  const pctOf = (v: number) => (v / scale) * 100;

  const categoryForm = (inModal: boolean) => (
    <form action={createCategoryAction} className={inModal ? "mt-5 space-y-5" : "flex max-w-md items-end gap-4"}>
      <label className={inModal ? "block" : "block min-w-0 flex-1"}>
        <span className="eyebrow">Nombre de la categoría</span>
        <input name="name" placeholder="Ej. Localizaciones" required className="field-line" />
      </label>
      <div className={inModal ? "flex items-center justify-end gap-4" : "shrink-0"}>
        {inModal && <ModalCancel />}
        <SubmitButton
          pendingLabel="Creando…"
          savedLabel="✓ Creada"
          className={inModal ? "btn btn-primary" : "btn btn-outline btn-sm shrink-0"}
        >
          Crear categoría
        </SubmitButton>
        {inModal && <CloseOnSaved />}
      </div>
    </form>
  );

  const empty = categoriesWithTotals.length === 0;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preparar"
        title="Presupuesto"
        description="Cuánto cuesta el rodaje y cuánto llevas gastado, partida a partida."
        actions={
          <>
            <PdfLink href={`/api/pdf/presupuesto/${projectId}`} />
            <ExcelExport href={`/api/xlsx/presupuesto/${projectId}`} />
            {!empty && (
              <FormModal
                label="+ Nueva categoría"
                title="Nueva categoría"
                description="Un capítulo del presupuesto: equipo, reparto, localizaciones… Las partidas se añaden dentro."
              >
                {categoryForm(true)}
              </FormModal>
            )}
          </>
        }
      />

      {/* ------------------------------------------------ cómo voy */}
      {!empty && (
        <>
          <StatusLine tone={overTarget || overruns.some((o) => o.pct > 0.1) ? "danger" : overruns.length > 0 || plannedOverTarget ? "warn" : "ok"}>
            Llevas gastado <strong className="font-semibold tabular-nums">{currency(grandActual)}</strong> de{" "}
            <strong className="font-semibold tabular-nums">{currency(grandTotal)}</strong> previstos ({spentPct} %) ·{" "}
            {itemsWithActual} de {itemCount} partida{itemCount === 1 ? "" : "s"} pagada{itemCount === 1 ? "" : "s"}
            {target !== null && remaining !== null && (
              <>
                {" · "}
                {overTarget ? (
                  <span className="text-danger">te has pasado {currency(-remaining)} del objetivo</span>
                ) : (
                  <>te quedan {currency(remaining)} del objetivo de {currency(target)}</>
                )}
              </>
            )}
            .
          </StatusLine>
          <Notices>
            {overruns.slice(0, 3).map((o) => (
              <Notice key={o.description} tone={o.pct > 0.1 ? "danger" : "warn"}>
                «{o.description}» se ha pasado {currency(o.diff)} de lo previsto (+{Math.round(o.pct * 100)} %).
              </Notice>
            ))}
            {overruns.length > 3 && <Notice>Y {overruns.length - 3} partidas más por encima de lo previsto.</Notice>}
            {plannedOverTarget && target !== null && (
              <Notice tone="danger">
                Lo previsto ya supera el objetivo en {currency(grandTotal - target)}: recorta partidas o sube el objetivo.
              </Notice>
            )}
            {target === null && (
              <Notice action={{ label: "Fijar objetivo", href: `/app/${projectId}` }}>
                Sin objetivo de presupuesto no puedo decirte cuánto te queda.
              </Notice>
            )}
            {emptyCategories.length > 0 && (
              <Notice>
                {emptyCategories.length === 1
                  ? `«${emptyCategories[0].name}» no tiene partidas todavía.`
                  : `${emptyCategories.length} categorías sin partidas: ${emptyCategories.map((c) => c.name).join(", ")}.`}
              </Notice>
            )}
          </Notices>
        </>
      )}

      {empty ? (
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
            {categoryForm(false)}
          </div>
        </section>
      ) : (
        <>
          {/* ------------------------------------------------ reparto */}
          <section aria-labelledby="reparto-title" className="mt-12">
            <h2 id="reparto-title" className="sr-only">
              Reparto por categorías
            </h2>

            <div className="grid gap-x-6 gap-y-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_11rem] sm:items-center">
              {/* Previsto */}
              <p className="eyebrow">Previsto</p>
              <div className="relative">
                <div className="flex h-9 gap-[2px] overflow-hidden rounded-md" aria-hidden>
                  {categoriesWithTotals
                    .filter((c) => c.categoryTotal > 0)
                    .map((c) => (
                      <span
                        key={c.id}
                        title={`${c.name}: ${currency(c.categoryTotal)} (${Math.round((c.categoryTotal / grandTotal) * 100)} %)`}
                        className="block h-full transition-[filter] first:rounded-l-md last:rounded-r-md hover:brightness-125"
                        style={{ width: `${pctOf(c.categoryTotal)}%`, background: c.color }}
                      />
                    ))}
                </div>
                {target !== null && (
                  <span
                    aria-hidden
                    title={`Objetivo: ${currency(target)}`}
                    className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-fg"
                    style={{ left: `calc(${pctOf(target)}% - 1px)` }}
                  />
                )}
              </div>
              <p className="font-display text-xl font-black tabular-nums sm:text-right">{currency(grandTotal)}</p>

              {/* Gastado, a la misma escala */}
              <p className="eyebrow mt-3 sm:mt-0">Gastado</p>
              <div className="relative">
                <div className="flex h-9 gap-[2px] overflow-hidden rounded-md bg-fg/[0.04]" aria-hidden>
                  {categoriesWithTotals
                    .filter((c) => c.categoryActual > 0)
                    .map((c) => (
                      <span
                        key={c.id}
                        title={`${c.name}: ${currency(c.categoryActual)} gastado de ${currency(c.categoryTotal)}`}
                        className="block h-full transition-[filter] first:rounded-l-md last:rounded-r-md hover:brightness-125"
                        style={{ width: `${pctOf(c.categoryActual)}%`, background: c.color }}
                      />
                    ))}
                </div>
                {target !== null && (
                  <span
                    aria-hidden
                    className="absolute -top-1.5 -bottom-1.5 w-0.5 rounded-full bg-fg"
                    style={{ left: `calc(${pctOf(target)}% - 1px)` }}
                  />
                )}
              </div>
              <p className="font-display text-xl font-black whitespace-nowrap tabular-nums sm:text-right">
                {currency(grandActual)}
                <span className="ml-2 font-mono text-[11px] font-normal text-muted">{spentPct} %</span>
              </p>
            </div>
            {target !== null && (
              <p className="mt-3 flex items-center gap-2 font-mono text-[11px] text-muted sm:pl-[8rem]">
                <span aria-hidden className="h-3 w-0.5 rounded-full bg-fg" />
                Objetivo {currency(target)}
              </p>
            )}

            {/* Leyenda: nombre, %, previsto y gastado por categoría */}
            <ul className="mt-8 grid gap-x-10 gap-y-3 sm:grid-cols-2 lg:grid-cols-4">
              {categoriesWithTotals.map((c) => {
                const share = grandTotal > 0 ? Math.round((c.categoryTotal / grandTotal) * 100) : 0;
                return (
                  <li key={c.id} className="min-w-0">
                    <a href={`#cat-${c.id}`} className="group flex items-start gap-2.5">
                      <span aria-hidden className="mt-1 h-3 w-3 shrink-0 rounded-[3px]" style={{ background: c.color }} />
                      <span className="min-w-0">
                        <span className="block truncate font-sans text-sm font-medium transition-colors group-hover:text-accent">
                          {c.name}
                        </span>
                        <span className="block font-mono text-[11px] text-muted tabular-nums">
                          {share} % · {currency(c.categoryTotal)}
                          {c.categoryActual > 0 && <> · gastado {currency(c.categoryActual)}</>}
                        </span>
                      </span>
                    </a>
                  </li>
                );
              })}
            </ul>
          </section>

          {/* ------------------------------------------------ libro de cuentas */}
          <section aria-labelledby="libro-title" className="mt-14">
            <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
              <h2 id="libro-title" className="font-display text-xl font-black tracking-tight sm:text-2xl">
                Libro de cuentas
              </h2>
              <p className="font-sans text-sm text-muted">Cuando pagues algo, apunta el gasto real en su fila.</p>
            </div>

            <div className="sheet mt-5 px-5 pb-2 sm:px-8">
              <div className={`hidden gap-x-6 border-b border-line pt-5 pb-3 lg:grid ${COLS}`}>
                <span className="eyebrow">Partida</span>
                <span className="eyebrow">Cantidad × precio</span>
                <span className="eyebrow text-right">Previsto</span>
                <span className="eyebrow"><span className="inline-block w-[6.75rem] text-right">Gastado</span></span>
                <span className="eyebrow text-right">Desviación</span>
                <span />
              </div>

              {categoriesWithTotals.map((category, index) => {
                const createItemAction = createBudgetItem.bind(null, projectId, category.id);
                const share = grandTotal > 0 ? (category.categoryTotal / grandTotal) * 100 : 0;
                const catDev = category.paidCount > 0 ? deviationTone(category.plannedOfPaid, category.categoryActual) : null;
                return (
                  <section
                    key={category.id}
                    id={`cat-${category.id}`}
                    aria-labelledby={`cat-title-${category.id}`}
                    className={`scroll-mt-32 ${index > 0 ? "border-t border-line" : ""}`}
                  >
                    {/* Fila de la categoría, con sus totales en las columnas */}
                    <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 pt-7 pb-3 ${COLS}`}>
                      <div className="min-w-0 lg:col-span-2">
                        <h3 id={`cat-title-${category.id}`} className="flex items-center gap-2.5 font-display text-lg font-black tracking-tight sm:text-xl">
                          <span aria-hidden className="h-3 w-3 shrink-0 rounded-[3px]" style={{ background: category.color }} />
                          {category.name}
                        </h3>
                        <p className="mt-0.5 pl-[1.375rem] font-mono text-[11px] text-muted tabular-nums">
                          {Math.round(share)} % del total · {category.items.length} partida
                          {category.items.length === 1 ? "" : "s"}
                        </p>
                      </div>
                      <p className="text-right font-mono text-base font-semibold tabular-nums">
                        {currency(category.categoryTotal)}
                      </p>
                      <p className="hidden font-mono text-base tabular-nums text-muted lg:block">
                        <span className="inline-block w-[6.75rem] text-right">
                          {category.categoryActual > 0 ? currency(category.categoryActual) : "—"}
                        </span>
                      </p>
                      <p className={`hidden text-right font-mono text-xs tabular-nums lg:block ${catDev ? catDev.cls : "text-muted"}`}>
                        {catDev ? catDev.label : ""}
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
                        {category.items.map((item) => {
                          const dev = item.actual !== null ? deviationTone(item.total, item.actual) : null;
                          return (
                            <li
                              key={item.id}
                              className={`grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-6 gap-y-2 py-3 ${COLS}`}
                            >
                              <div className="min-w-0 lg:pl-[1.375rem]">
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
                              <div className="col-span-2 flex items-center justify-between gap-3 lg:contents print:hidden">
                                <BudgetActualField
                                  projectId={projectId}
                                  itemId={item.id}
                                  description={item.description}
                                  planned={item.total}
                                  actual={item.actual}
                                  overrun={dev !== null && dev.diff > 0}
                                />
                                <p className={`font-mono text-xs tabular-nums lg:text-right ${dev ? dev.cls : "text-muted/60"}`}>
                                  {dev ? (
                                    <>
                                      <span className="sr-only">Desviación: </span>
                                      {dev.label}
                                    </>
                                  ) : (
                                    <span className="hidden lg:inline" aria-hidden>
                                      ·
                                    </span>
                                  )}
                                </p>
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
                          );
                        })}
                      </ul>
                    )}

                    {/* Nueva partida, plegada */}
                    <details className="group pb-5 print:hidden">
                      <summary className="link-action -ml-1 mt-1 cursor-pointer list-none !text-accent lg:ml-[1.125rem] [&::-webkit-details-marker]:hidden">
                        <span aria-hidden className="mr-1.5 inline-block transition-transform group-open:rotate-45 motion-reduce:transition-none">
                          +
                        </span>
                        <span className="group-open:hidden">Añadir partida</span>
                        <span className="hidden group-open:inline">Cerrar</span>
                      </summary>
                      <form
                        action={createItemAction}
                        className="mt-3 grid gap-x-5 gap-y-4 border-l-2 border-accent pl-5 sm:grid-cols-2 lg:ml-[1.375rem] lg:grid-cols-6"
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
                            Añadir partida a {category.name}
                          </SubmitButton>
                        </div>
                      </form>
                    </details>
                  </section>
                );
              })}

              {/* Totales: doble raya, como en un libro de cuentas */}
              <div className={`grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-6 gap-y-1 border-t-[3px] border-double border-fg/70 py-5 ${COLS}`}>
                <p className="font-display text-lg font-black tracking-tight uppercase lg:col-span-2">Total</p>
                <p className="text-right font-mono text-lg font-bold tabular-nums">{currency(grandTotal)}</p>
                <p className="col-span-2 text-right font-mono text-sm tabular-nums lg:col-span-1 lg:text-left">
                  <span className="text-muted lg:hidden">Gastado </span>
                  <span className="font-semibold lg:inline-block lg:w-[6.75rem] lg:text-right lg:text-base">{currency(grandActual)}</span>
                </p>
                {itemsWithActual > 0 ? (
                  (() => {
                    const dev = deviationTone(grandPlannedOfPaid, grandActual);
                    return (
                      <p className={`col-span-2 text-right font-mono text-xs tabular-nums lg:col-span-1 ${dev.cls}`}>
                        <span className="text-muted lg:hidden">Desviación en lo pagado </span>
                        {dev.label}
                      </p>
                    );
                  })()
                ) : (
                  <span className="hidden lg:block" />
                )}
              </div>
            </div>
            <p className="mt-3 font-sans text-xs text-muted">
              La desviación compara lo gastado con lo previsto solo en las partidas ya pagadas.
              {target === null && (
                <>
                  {" "}
                  El objetivo se fija en{" "}
                  <Link href={`/app/${projectId}`} className="text-fg underline decoration-line underline-offset-4 hover:decoration-accent">
                    Datos del proyecto
                  </Link>
                  .
                </>
              )}
            </p>
          </section>
        </>
      )}
    </div>
  );
}
