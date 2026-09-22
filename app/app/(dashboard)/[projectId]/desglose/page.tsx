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
import { FormField } from "@/components/FormField";
import { BreakdownCategorySelect } from "@/components/BreakdownCategorySelect";
import { SectionTabs, type SectionTab } from "@/components/SectionTabs";

// Nombres cortos para la lista lateral; el nombre completo sigue siendo
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

const inputClass =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

export default async function DesglosePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { projectId } = await params;
  const { tab } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const elements = await prisma.breakdownElement.findMany({
    where: { projectId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      category: true,
      _count: { select: { scenes: true } },
    },
  });

  const createElementAction = createBreakdownElement.bind(null, projectId);

  const categoryTabs: SectionTab[] = Object.values(BreakdownCategory).map((category) => {
    const items = elements.filter((el) => el.category === category);
    const label = SHORT_LABELS[category];
    return {
      id: category.toLowerCase(),
      label,
      count: items.length,
      group: "Elementos",
      content: (
        <div>
          <form
            action={createElementAction}
            className="grid gap-3 border border-line p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          >
            <input type="hidden" name="category" value={category} />
            <FormField label={`Añadir a ${BREAKDOWN_CATEGORY_LABELS[category].toLowerCase()}`}>
              <input name="name" required placeholder="Nombre del elemento" className={inputClass} />
            </FormField>
            <FormField label="Notas (opcional)">
              <input name="notes" className={inputClass} />
            </FormField>
            <SubmitButton
              pendingLabel="Añadiendo…"
              savedLabel="✓ Añadido"
              className="btn btn-secondary"
            >
              Añadir
            </SubmitButton>
          </form>

          {items.length === 0 ? (
            <p className="mt-6 font-mono text-sm text-muted">
              Aún no hay elementos de {BREAKDOWN_CATEGORY_LABELS[category].toLowerCase()}.
              Añade el primero arriba, o asígnalos a cada escena desde{" "}
              <Link href={`/app/${projectId}/guion`} className="text-fg hover:text-accent">
                Guion
              </Link>
              .
            </p>
          ) : (
            <div className="mt-4 border-t border-line">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2 border-b border-line py-3"
                >
                  <span className="min-w-0 font-mono text-sm">{item.name}</span>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[11px] text-muted">
                      {item._count.scenes} escena{item._count.scenes === 1 ? "" : "s"}
                    </span>
                    <BreakdownCategorySelect
                      category={item.category}
                      action={updateBreakdownElementCategory.bind(null, projectId, item.id)}
                    />
                    <form action={deleteBreakdownElement.bind(null, projectId, item.id)}>
                      <DeleteButton
                        confirmMessage="¿Eliminar este elemento del desglose?"
                        className="link-action"
                      />
                    </form>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ),
    };
  });

  const tabs = categoryTabs;
  // Si no se pide ninguna, se abre la primera categoría que ya tenga algo.
  const firstFilled = tabs.find((t) => Number(t.count ?? 0) > 0)?.id;

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Preproducción"
        title="Desglose"
        description={
          <>
            Atrezzo, vestuario, material técnico y más, por categorías. Se asigna a cada escena
            desde{" "}
            <Link href={`/app/${projectId}/guion`} className="text-fg hover:text-accent">
              Guion
            </Link>
            . El equipo técnico ahora tiene su propio apartado:{" "}
            <Link href={`/app/${projectId}/equipo`} className="text-fg hover:text-accent">
              Equipo técnico
            </Link>
            .
          </>
        }
      />

      <div className="mt-8">
        <SectionTabs
          tabs={tabs}
          initial={tab ?? firstFilled}
          layout="side"
          ariaLabel="Categorías del desglose"
        />
      </div>
    </div>
  );
}
