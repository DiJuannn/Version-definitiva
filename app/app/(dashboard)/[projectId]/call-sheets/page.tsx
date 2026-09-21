import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { ActionButtonForm } from "@/components/ActionButtonForm";
import { generateAllCallSheets } from "@/lib/actions/call-sheets";

export default async function CallSheetsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const days = await prisma.shootingDay.findMany({
    where: { projectId },
    orderBy: { date: "asc" },
    include: { callSheet: { select: { id: true, generalCallTime: true } }, _count: { select: { scenes: true } } },
  });

  const pendingDays = days.filter((day) => !day.callSheet && day._count.scenes > 0).length;

  return (
    <div>
      <PageHeader
        backHref={`/app/${projectId}`}
        backLabel={`← ${project.name}`}
        eyebrow="Producción"
        title="Call sheets"
        description={
          <>
            Un call sheet por día de rodaje, generado a partir del{" "}
            <Link
              href={`/app/${projectId}/plan-de-rodaje`}
              className="text-fg underline decoration-accent/50 underline-offset-4 hover:decoration-accent"
            >
              Plan de rodaje
            </Link>
            .
          </>
        }
      />

      {pendingDays > 0 && (
        <section className="mt-8 border border-accent/40 bg-bg-raised/40 p-6">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">Te lo preparo yo</p>
          <h2 className="mt-1.5 font-display text-xl font-black tracking-tight sm:text-2xl">
            Genera las hojas de llamada de {pendingDays === 1 ? "tu día" : `tus ${pendingDays} días`} de rodaje
          </h2>
          <p className="mt-3 max-w-xl font-sans text-sm text-muted">
            Creo una hoja por cada día con escenas y le pongo una hora de llamada según la luz (por ejemplo, las 8:00 para
            escenas de día). Puedes cambiarla en cada hoja, y desde ahí compartirla con el equipo con un enlace.
          </p>
          <div className="mt-5">
            <ActionButtonForm
              action={generateAllCallSheets.bind(null, projectId)}
              pendingLabel="Generando…"
              className="btn btn-primary"
            >
              Generar {pendingDays === 1 ? "la hoja" : "todas las hojas"}
            </ActionButtonForm>
          </div>
        </section>
      )}

      {days.length === 0 ? (
        <EmptyState
          title="Todavía no hay días de rodaje planificados"
          description="Crea un día de rodaje para poder generar su hoja de convocatoria."
          actionLabel="Ir a Plan de rodaje"
          actionHref={`/app/${projectId}/plan-de-rodaje`}
        />
      ) : (
        <div className="mt-8 grid gap-3 sm:grid-cols-2">
          {days.map((day) => (
            <Link
              key={day.id}
              href={`/app/${projectId}/call-sheets/${day.id}`}
              className="group flex items-center gap-5 border border-line bg-bg-raised/40 p-5 transition-colors hover:border-accent/60 hover:bg-accent/5"
            >
              <div className="w-16 shrink-0 border-r border-line pr-5 text-center">
                <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                  {day.date.toLocaleDateString("es-ES", { month: "short" })}
                </p>
                <p className="font-display text-3xl leading-none font-black tabular-nums">
                  {day.date.toLocaleDateString("es-ES", { day: "2-digit" })}
                </p>
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-display text-base font-bold transition-colors group-hover:text-accent">
                  {day.date.toLocaleDateString("es-ES", { weekday: "long" })}
                </p>
                <p className="mt-1 font-mono text-[11px] text-muted">
                  {day._count.scenes} escena{day._count.scenes === 1 ? "" : "s"}
                  {day.callSheet?.generalCallTime
                    ? ` · Llamada ${day.callSheet.generalCallTime}`
                    : ""}
                </p>
              </div>
              <span
                className={`shrink-0 border px-2 py-1 font-mono text-[10px] tracking-widest uppercase ${
                  day.callSheet
                    ? "border-accent/50 text-accent"
                    : "border-line text-muted"
                }`}
              >
                {day.callSheet ? "Generado" : "Sin generar"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
