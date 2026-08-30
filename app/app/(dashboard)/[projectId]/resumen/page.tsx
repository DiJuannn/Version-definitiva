import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getProjectSummary } from "@/lib/project-summary";
import { PdfLink } from "@/components/PdfLink";
import {
  DAY_PART_LABELS,
  INT_EXT_LABELS,
  BREAKDOWN_CATEGORY_LABELS,
  PROJECT_STATUS_LABELS,
} from "@/lib/labels";
import { BreakdownCategory } from "@/lib/generated/prisma";

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

function Section({
  title,
  teaser,
  children,
}: {
  title: string;
  teaser: string;
  children: React.ReactNode;
}) {
  return (
    <details className="group border border-line">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-4 transition-colors hover:text-accent [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 font-display text-sm font-bold uppercase">
          <span className="text-muted transition-transform group-open:rotate-90">
            →
          </span>
          {title}
        </span>
        <span className="font-mono text-xs text-muted">{teaser}</span>
      </summary>
      <div className="border-t border-line p-4">{children}</div>
    </details>
  );
}

export default async function ProjectSummaryPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const access = await getProjectForCurrentUser(projectId);
  if (!access) notFound();

  const {
    project,
    locations,
    shotsTotal,
    storyboardFramesCount,
    budgetCategoriesWithTotals,
    budgetGrandTotal,
  } = await getProjectSummary(projectId);

  const charactersWithActor = project.characters.filter((c) => c.actorId).length;
  const scenesWithLocation = project.scenes.filter((s) => s.locationId).length;
  const budgetTarget =
    project.budgetTarget !== null ? Number(project.budgetTarget) : null;

  const breakdownByCategory = Object.values(BreakdownCategory).map((category) => ({
    category,
    items: project.breakdownElements.filter((el) => el.category === category),
  }));

  return (
    <div>
      <div className="flex items-center justify-between">
        <Link
          href={`/app/${projectId}`}
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          ← {project.name}
        </Link>
        <PdfLink href={`/api/pdf/dossier/${projectId}`} label="Descargar dossier" />
      </div>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">Resumen</h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Todo el proyecto de un vistazo. Pulsa cada apartado para desplegarlo —
        nada se abre a la vez para que no se sienta pesado.
      </p>

      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Estado
          </p>
          <p className="mt-1 font-mono text-sm">{PROJECT_STATUS_LABELS[project.status]}</p>
        </div>
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Escenas
          </p>
          <p className="mt-1 font-mono text-sm">{project.scenes.length}</p>
        </div>
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Días de rodaje
          </p>
          <p className="mt-1 font-mono text-sm">{project.shootingDays.length}</p>
        </div>
        <div className="border border-line p-4">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Presupuesto
          </p>
          <p className="mt-1 font-mono text-sm">
            {budgetTarget
              ? `${currency(budgetGrandTotal)} / ${currency(budgetTarget)}`
              : currency(budgetGrandTotal)}
          </p>
        </div>
      </div>

      <div className="mt-8 space-y-3">
        <Section
          title="Escenas"
          teaser={`${scenesWithLocation}/${project.scenes.length} con localización`}
        >
          {project.scenes.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin escenas todavía.</p>
          ) : (
            <div className="divide-y divide-line">
              {project.scenes.map((scene) => (
                <div key={scene.id} className="flex items-center justify-between gap-4 py-2.5">
                  <div>
                    <span className="font-mono text-sm">Escena {scene.number}</span>
                    <span className="ml-2 font-mono text-xs text-muted">
                      {INT_EXT_LABELS[scene.intExt]} · {DAY_PART_LABELS[scene.dayPart]}
                      {scene.location ? ` · ${scene.location.name}` : ""}
                    </span>
                  </div>
                  <span className="font-mono text-xs text-muted">
                    {scene.characters.length} pj · {scene._count.shots} planos
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Reparto"
          teaser={`${charactersWithActor}/${project.characters.length} con actor`}
        >
          {project.characters.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin personajes todavía.</p>
          ) : (
            <div className="divide-y divide-line">
              {project.characters.map((character) => (
                <div key={character.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">{character.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {character.actor?.name ?? "Sin actor asignado"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section title="Localizaciones" teaser={`${locations.length} usadas`}>
          {locations.length === 0 ? (
            <p className="font-mono text-sm text-muted">
              Ninguna escena tiene localización todavía.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {locations.map((location) => (
                <div key={location.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">{location.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {location.sceneCount} escena{location.sceneCount === 1 ? "" : "s"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Desglose"
          teaser={`${project.breakdownElements.length} elementos`}
        >
          {project.breakdownElements.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin elementos todavía.</p>
          ) : (
            <div className="space-y-4">
              {breakdownByCategory
                .filter((group) => group.items.length > 0)
                .map((group) => (
                  <div key={group.category}>
                    <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
                      {BREAKDOWN_CATEGORY_LABELS[group.category]} ({group.items.length})
                    </p>
                    <p className="mt-1 font-mono text-xs text-muted">
                      {group.items.map((item) => item.name).join(", ")}
                    </p>
                  </div>
                ))}
            </div>
          )}
        </Section>

        <Section
          title="Presupuesto"
          teaser={
            budgetTarget
              ? `${currency(budgetGrandTotal)} / ${currency(budgetTarget)}`
              : currency(budgetGrandTotal)
          }
        >
          {budgetCategoriesWithTotals.length === 0 ? (
            <p className="font-mono text-sm text-muted">Sin categorías todavía.</p>
          ) : (
            <div className="divide-y divide-line">
              {budgetCategoriesWithTotals.map((category) => (
                <div key={category.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">{category.name}</span>
                  <span className="font-mono text-xs text-muted">
                    {currency(category.total)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between gap-4 py-2.5">
                <span className="font-mono text-sm font-bold uppercase">Total</span>
                <span className="font-mono text-sm text-accent">
                  {currency(budgetGrandTotal)}
                </span>
              </div>
            </div>
          )}
        </Section>

        <Section
          title="Plan de rodaje"
          teaser={`${project.shootingDays.length} días`}
        >
          {project.shootingDays.length === 0 ? (
            <p className="font-mono text-sm text-muted">
              Sin días de rodaje todavía.
            </p>
          ) : (
            <div className="divide-y divide-line">
              {project.shootingDays.map((day) => (
                <div key={day.id} className="flex items-center justify-between gap-4 py-2.5">
                  <span className="font-mono text-sm">
                    {day.date.toLocaleDateString("es-ES")}
                  </span>
                  <span className="font-mono text-xs text-muted">
                    {day.scenes.length} escena{day.scenes.length === 1 ? "" : "s"} ·{" "}
                    {day.callSheet ? "con call sheet" : "sin call sheet"}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          title="Shot list y storyboard"
          teaser={`${shotsTotal} planos · ${storyboardFramesCount} viñetas`}
        >
          <p className="font-mono text-sm">
            {shotsTotal} plano{shotsTotal === 1 ? "" : "s"} definido
            {shotsTotal === 1 ? "" : "s"} en total.
          </p>
          <p className="mt-1 font-mono text-sm">
            {storyboardFramesCount} viñeta{storyboardFramesCount === 1 ? "" : "s"} de
            storyboard.
          </p>
        </Section>
      </div>
    </div>
  );
}
