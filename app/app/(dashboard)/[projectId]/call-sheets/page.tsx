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
    include: {
      callSheet: { select: { id: true, generalCallTime: true } },
      _count: { select: { scenes: true } },
    },
  });

  const pendingDays = days.filter(
    (day) => !day.callSheet && day._count.scenes > 0,
  ).length;
  const ready = days.filter((day) => day.callSheet).length;

  return (
    <div>
      <PageHeader
        eyebrow="Producción"
        title="Hojas de llamada"
        description={
          <>
            La hoja que recibe el equipo la víspera: a qué hora, dónde y qué se
            rueda. Hay una por cada día del{" "}
            <Link
              href={`/app/${projectId}/plan-de-rodaje`}
              className="text-fg underline decoration-accent/50 underline-offset-4 hover:decoration-accent"
            >
              plan de rodaje
            </Link>
            , y se rellena sola con lo que ya está planificado.
          </>
        }
      />

      {/* Aviso con barra lateral: lo pendiente y la acción que lo resuelve. */}
      {pendingDays > 0 && (
        <section className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-l-2 border-accent pl-5">
          <div className="max-w-xl">
            <h2 className="font-display text-lg font-bold">
              {pendingDays === 1
                ? "Falta 1 hoja por generar"
                : `Faltan ${pendingDays} hojas por generar`}
            </h2>
            <p className="mt-1 font-sans text-sm leading-relaxed text-muted">
              Creo una hoja por cada día con escenas y le pongo la hora de
              llamada según la luz (las 8:00 en escenas de día, por ejemplo).
              Luego puedes cambiarla y compartirla con un enlace.
            </p>
          </div>
          <ActionButtonForm
            action={generateAllCallSheets.bind(null, projectId)}
            pendingLabel="Generando…"
            className="btn btn-primary"
          >
            Generar {pendingDays === 1 ? "la hoja" : "las hojas"}
          </ActionButtonForm>
        </section>
      )}

      {days.length === 0 ? (
        <EmptyState
          title="Todavía no hay días de rodaje"
          description="Crea los días en el plan de rodaje y aquí aparecerá la hoja de llamada de cada uno."
          actionLabel="Ir a Plan de rodaje"
          actionHref={`/app/${projectId}/plan-de-rodaje`}
        />
      ) : (
        <section aria-labelledby="dias" className="mt-12">
          <div className="flex items-baseline justify-between gap-4 border-b border-line pb-3">
            <h2 id="dias" className="eyebrow">
              Días de rodaje
            </h2>
            <p className="eyebrow">
              {ready} de {days.length} listas
            </p>
          </div>
          <ol>
            {days.map((day, index) => (
              <li key={day.id} className="border-b border-line">
                <Link
                  href={`/app/${projectId}/call-sheets/${day.id}`}
                  className="group grid grid-cols-[3.5rem_1fr_auto] items-center gap-x-5 gap-y-1 py-5 sm:grid-cols-[4.5rem_1fr_8rem_7rem_8rem]"
                >
                  {/* La fecha como en un calendario de pared. */}
                  <span className="text-center">
                    <span className="block font-display text-3xl leading-none font-black tabular-nums sm:text-4xl">
                      {day.date.toLocaleDateString("es-ES", { day: "numeric" })}
                    </span>
                    <span className="eyebrow mt-1 block">
                      {day.date.toLocaleDateString("es-ES", { month: "short" })}
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="eyebrow block">Día {index + 1}</span>
                    <span className="mt-0.5 block font-display text-lg font-bold first-letter:uppercase transition-colors group-hover:text-accent">
                      {day.date.toLocaleDateString("es-ES", {
                        weekday: "long",
                      })}
                    </span>
                    <span className="block font-sans text-sm text-muted sm:hidden">
                      {day._count.scenes} escena
                      {day._count.scenes === 1 ? "" : "s"}
                      {day.callSheet?.generalCallTime
                        ? ` · llamada ${day.callSheet.generalCallTime}`
                        : ""}
                    </span>
                  </span>
                  <span className="hidden font-sans text-sm text-muted sm:block">
                    {day._count.scenes} escena
                    {day._count.scenes === 1 ? "" : "s"}
                  </span>
                  <span className="hidden sm:block">
                    {day.callSheet?.generalCallTime ? (
                      <>
                        <span className="eyebrow block">Llamada</span>
                        <span className="font-mono text-base tabular-nums">
                          {day.callSheet.generalCallTime}
                        </span>
                      </>
                    ) : (
                      <span className="font-sans text-sm text-muted">
                        Sin hora
                      </span>
                    )}
                  </span>
                  <span
                    className={`flex items-center gap-2 justify-self-end font-mono text-[11px] tracking-widest uppercase ${
                      day.callSheet ? "text-success" : "text-muted"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`h-2 w-2 rounded-full ${day.callSheet ? "bg-success" : "border border-muted"}`}
                    />
                    {day.callSheet ? "Lista" : "Sin generar"}
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </section>
      )}
    </div>
  );
}
