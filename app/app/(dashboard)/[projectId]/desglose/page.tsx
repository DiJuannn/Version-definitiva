import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { DeleteButton } from "@/components/DeleteButton";
import {
  createBreakdownElement,
  deleteBreakdownElement,
  updateBreakdownElementCategory,
} from "@/lib/actions/breakdown";
import { BREAKDOWN_CATEGORY_LABELS } from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { BreakdownCategorySelect } from "@/components/BreakdownCategorySelect";

// El desglose es una sola hoja con todos los elementos agrupados por
// categoría (antes, una pestaña por categoría: con pocos elementos obligaba a
// ir abriendo pestañas para ver qué había). Arriba, la cuenta por categoría
// sirve de índice. Añadir es un botón que abre un formulario pequeño.

// Nombres cortos para el índice; el nombre completo sigue siendo
// BREAKDOWN_CATEGORY_LABELS (aparece en el selector "mover a").
const SHORT_LABELS: Record<BreakdownCategory, string> = {
  PROP: "Atrezzo",
  WARDROBE: "Vestuario",
  MAKEUP_HAIR: "Maquillaje",
  VEHICLE: "Vehículos",
  SOUND: "Sonido",
  VFX: "Efectos",
  LIGHTING: "Iluminación",
  EQUIPMENT: "Material técnico",
};

const POPOVER =
  "sheet absolute left-0 z-30 mt-2 w-[min(22rem,calc(100vw-2rem))] p-5 shadow-[0_18px_40px_-16px_rgba(0,0,0,0.6)] sm:left-auto sm:right-0";

export default async function DesglosePage({
  params,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const elements = await prisma.breakdownElement.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      notes: true,
      category: true,
      _count: { select: { scenes: true } },
    },
  });

  const createElementAction = createBreakdownElement.bind(null, projectId);
  const groups = Object.values(BreakdownCategory).map((category) => ({
    category,
    items: elements.filter((el) => el.category === category),
  }));
  const filled = groups.filter((g) => g.items.length > 0);
  const emptyNames = groups.filter((g) => g.items.length === 0).map((g) => SHORT_LABELS[g.category]);
  const unassigned = elements.filter((el) => el._count.scenes === 0).length;

  const addForm = (
    <form action={createElementAction} className="grid gap-4">
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow text-muted">Categoría</span>
        <select name="category" defaultValue="PROP" className="field">
          {Object.values(BreakdownCategory).map((c) => (
            <option key={c} value={c} className="bg-bg">
              {BREAKDOWN_CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow text-muted">Nombre</span>
        <input name="name" required placeholder="Claqueta, chaqueta vaquera, grúa…" className="field" />
      </label>
      <label className="flex flex-col gap-1.5">
        <span className="eyebrow text-muted">Notas (opcional)</span>
        <input name="notes" placeholder="Dos unidades, de época…" className="field" />
      </label>
      <div>
        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-primary">
          Añadir al desglose
        </SubmitButton>
      </div>
    </form>
  );

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Preproducción"
        title="Desglose"
        description={
          <>
            Todo lo que hay que conseguir para rodar: atrezzo, vestuario, vehículos, material… Aquí está la lista; qué
            sale en cada escena se marca en la ficha de la escena, en{" "}
            <Link href={`/app/${projectId}/guion`} className="text-fg underline decoration-line underline-offset-4 hover:text-accent">
              Guion
            </Link>
            . Las personas del equipo están en{" "}
            <Link href={`/app/${projectId}/equipo`} className="text-fg underline decoration-line underline-offset-4 hover:text-accent">
              Equipo técnico
            </Link>
            .
          </>
        }
        actions={
          elements.length > 0 ? (
            <details className="group relative">
              <summary className="btn btn-primary list-none [&::-webkit-details-marker]:hidden">
                <span aria-hidden className="transition-transform group-open:rotate-45">
                  +
                </span>
                Añadir elemento
              </summary>
              <div className={POPOVER}>{addForm}</div>
            </details>
          ) : undefined
        }
      />

      {elements.length === 0 ? (
        <section className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1fr)_24rem]">
          <div className="max-w-md">
            <h2 className="font-display text-xl font-bold">Empieza la lista</h2>
            <p className="mt-2 font-sans text-[15px] leading-relaxed text-muted">
              Añade el primer elemento aquí. Si subes el guion en{" "}
              <Link href={`/app/${projectId}/guion`} className="text-accent hover:underline">
                Guion
              </Link>
              , la IA propone el atrezzo y el vestuario por ti.
            </p>
          </div>
          <div className="sheet p-6">{addForm}</div>
        </section>
      ) : (
        <>
          {/* Índice: cuántos hay de cada cosa, y salto a su grupo. */}
          <nav aria-label="Categorías" className="mt-10 flex flex-wrap gap-x-8 gap-y-4">
            {filled.map((g) => (
              <a
                key={g.category}
                href={`#cat-${g.category.toLowerCase()}`}
                className="group flex items-baseline gap-2"
              >
                <span className="font-display text-2xl font-black tabular-nums group-hover:text-accent">
                  {g.items.length}
                </span>
                <span className="eyebrow text-muted group-hover:text-fg">{SHORT_LABELS[g.category]}</span>
              </a>
            ))}
          </nav>
          {unassigned > 0 && (
            <p className="mt-6 border-l-2 border-warn pl-3 font-sans text-sm text-muted">
              {unassigned === 1 ? "1 elemento no está" : `${unassigned} elementos no están`} en ninguna escena todavía.
              Márcalos en la ficha de cada escena.
            </p>
          )}

          <div className="sheet mt-8">
            {filled.map((g) => (
              <section
                key={g.category}
                id={`cat-${g.category.toLowerCase()}`}
                aria-labelledby={`cat-${g.category.toLowerCase()}-t`}
                className="scroll-mt-40 border-t border-line first:border-t-0"
              >
                <h2
                  id={`cat-${g.category.toLowerCase()}-t`}
                  className="flex items-baseline justify-between gap-4 px-5 pt-6 pb-2 sm:px-7"
                >
                  <span className="font-display text-lg font-bold">{BREAKDOWN_CATEGORY_LABELS[g.category]}</span>
                  <span className="font-mono text-[11px] text-muted">{g.items.length}</span>
                </h2>
                <ul className="divide-y divide-line">
                  {g.items.map((item) => (
                    <li
                      key={item.id}
                      className="group grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4 gap-y-2 px-5 py-3 sm:grid-cols-[minmax(0,1fr)_7rem_11rem_auto] sm:px-7"
                    >
                      <span className="min-w-0">
                        <span className="block font-sans text-[15px] font-medium">{item.name}</span>
                        {item.notes && <span className="block font-sans text-[13px] text-muted">{item.notes}</span>}
                      </span>
                      <span
                        className={`text-right font-mono text-[11px] sm:text-left ${
                          item._count.scenes === 0 ? "text-warn" : "text-muted"
                        }`}
                      >
                        {item._count.scenes === 0
                          ? "Sin escena"
                          : `${item._count.scenes} escena${item._count.scenes === 1 ? "" : "s"}`}
                      </span>
                      <span className="min-w-0">
                        <BreakdownCategorySelect
                          category={item.category}
                          action={updateBreakdownElementCategory.bind(null, projectId, item.id)}
                        />
                      </span>
                      <form action={deleteBreakdownElement.bind(null, projectId, item.id)} className="justify-self-end">
                        <DeleteButton
                          confirmMessage="¿Eliminar este elemento del desglose?"
                          className="link-action hover:text-danger"
                        />
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>

          {emptyNames.length > 0 && (
            <p className="mt-5 font-sans text-sm text-muted">
              Sin elementos todavía: {emptyNames.join(", ")}.
            </p>
          )}
        </>
      )}
    </div>
  );
}
