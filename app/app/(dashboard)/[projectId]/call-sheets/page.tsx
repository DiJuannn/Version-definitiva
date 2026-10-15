import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GUIDES } from "@/lib/tool-guides";
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
      scenes: {
        orderBy: { order: "asc" },
        select: {
          scene: {
            select: { number: true, location: { select: { name: true } } },
          },
        },
      },
    },
  });

  const pendingDays = days.filter(
    (day) => !day.callSheet && day._count.scenes > 0,
  ).length;
  const ready = days.filter((day) => day.callSheet).length;

  const dayShort = (d: Date) =>
    d.toLocaleDateString("es-ES", {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  const missing = days
    .map((day, index) => ({ day, index }))
    .filter(({ day }) => !day.callSheet);

  // Estado de cada hoja, de menos a más avanzada.
  function stateOf(day: (typeof days)[number]) {
    if (!day.callSheet)
      return day._count.scenes > 0
        ? { label: "Sin crear", tone: "text-warn", dot: "border border-warn" }
        : {
            label: "Día sin escenas",
            tone: "text-muted",
            dot: "border border-muted",
          };
    if (day.reminderSentAt)
      return { label: "Enviada", tone: "text-success", dot: "bg-success" };
    if (day.shareToken)
      return { label: "Compartida", tone: "text-accent", dot: "bg-accent" };
    return { label: "Creada", tone: "text-fg", dot: "bg-fg" };
  }

  return (
    <div>
      <PageHeader
        guide={TOOL_GUIDES["call-sheets"]}
        eyebrow="Rodar"
        title="Hojas de llamada"
        description="La hoja que recibe el equipo la víspera: a qué hora, dónde y qué se rueda. Hay una por jornada del plan de rodaje y se rellena sola."
      />

      {/* Cómo voy. */}
      {days.length > 0 && (
        <p className="mt-8 font-sans text-[15px] text-muted">
          <strong
            className={`font-semibold ${ready === days.length ? "text-success" : "text-fg"}`}
          >
            {ready} de {days.length} hojas creadas
          </strong>
          {missing.length > 0 && missing.length <= 3
            ? ` · ${missing.length === 1 ? "falta la del" : "faltan las de los"} ${missing
                .map(
                  ({ day, index }) =>
                    `día ${index + 1} (${dayShort(day.date)})`,
                )
                .join(", ")}`
            : missing.length > 3
              ? ` · faltan ${missing.length}`
              : " · todas listas para mandar"}
          .
        </p>
      )}

      {/* Aviso con barra lateral: lo pendiente y la acción que lo resuelve. */}
      {pendingDays > 0 && (
        <section className="mt-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-l-2 border-warn pl-5">
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
          <h2 id="dias" className="sr-only">
            Hojas por jornada
          </h2>
          <ol className="border-t border-line">
            {days.map((day, index) => {
              const state = stateOf(day);
              const places = [
                ...new Set(
                  day.scenes
                    .map((s) => s.scene.location?.name)
                    .filter((n): n is string => Boolean(n)),
                ),
              ];
              return (
                <li key={day.id} className="border-b border-line">
                  <Link
                    href={`/app/${projectId}/call-sheets/${day.id}`}
                    className="group grid grid-cols-[2.25rem_3.25rem_minmax(0,1fr)] items-center gap-x-4 gap-y-2 py-5 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent sm:grid-cols-[2.5rem_4rem_minmax(0,1fr)_7rem_9rem_1rem] sm:gap-x-6"
                  >
                    {/* Miniatura de la hoja: papel si existe, contorno si falta. */}
                    <span
                      aria-hidden
                      className={`flex h-11 w-8 flex-col gap-1 rounded-[3px] px-1.5 pt-2 transition-transform group-hover:-translate-y-0.5 motion-reduce:transition-none sm:h-12 sm:w-9 ${
                        day.callSheet
                          ? "bg-[#e6e4df] shadow-md"
                          : "border border-dashed border-muted/60"
                      }`}
                    >
                      {day.callSheet && (
                        <>
                          <span className="h-1 w-full rounded-full bg-[#1d1c21]" />
                          <span className="h-0.5 w-3/4 rounded-full bg-[#1d1c21]/40" />
                          <span className="h-0.5 w-full rounded-full bg-[#1d1c21]/40" />
                          <span className="h-0.5 w-2/3 rounded-full bg-[#1d1c21]/40" />
                        </>
                      )}
                    </span>
                    {/* La fecha como en un calendario de pared. */}
                    <span className="text-center">
                      <span className="block font-display text-3xl leading-none font-black tabular-nums">
                        {day.date.toLocaleDateString("es-ES", {
                          day: "numeric",
                        })}
                      </span>
                      <span className="eyebrow mt-1 block">
                        {day.date.toLocaleDateString("es-ES", {
                          month: "short",
                        })}
                      </span>
                    </span>
                    <span className="min-w-0">
                      <span className="block font-display text-lg leading-tight font-bold transition-colors group-hover:text-accent">
                        Día {index + 1}{" "}
                        <span className="font-sans text-base font-normal text-muted first-letter:uppercase">
                          ·{" "}
                          {day.date.toLocaleDateString("es-ES", {
                            weekday: "long",
                          })}
                        </span>
                      </span>
                      <span className="mt-0.5 block truncate font-sans text-sm text-muted">
                        {day._count.scenes === 0
                          ? "Sin escenas en el plan"
                          : `Esc. ${day.scenes.map((s) => s.scene.number).join(", ")}${places.length > 0 ? ` · ${places.join(", ")}` : ""}`}
                      </span>
                      {/* En el móvil, hora y estado bajo el título. */}
                      <span className="mt-1.5 flex items-center gap-3 font-mono text-[11px] tracking-widest uppercase sm:hidden">
                        {day.callSheet?.generalCallTime && (
                          <span className="tabular-nums">
                            {day.callSheet.generalCallTime}
                          </span>
                        )}
                        <span
                          className={`flex items-center gap-1.5 ${state.tone}`}
                        >
                          <span
                            aria-hidden
                            className={`h-2 w-2 rounded-full ${state.dot}`}
                          />
                          {state.label}
                        </span>
                      </span>
                    </span>
                    <span className="hidden sm:block">
                      <span className="eyebrow block">Citación</span>
                      <span className="font-mono text-lg tabular-nums">
                        {day.callSheet?.generalCallTime ?? (
                          <span className="text-muted">—:—</span>
                        )}
                      </span>
                    </span>
                    <span
                      className={`hidden items-center gap-2 font-mono text-[11px] tracking-widest uppercase sm:flex ${state.tone}`}
                    >
                      <span
                        aria-hidden
                        className={`h-2 w-2 shrink-0 rounded-full ${state.dot}`}
                      />
                      {state.label}
                    </span>
                    <span
                      aria-hidden
                      className="hidden font-mono text-sm text-muted transition-transform group-hover:translate-x-1 group-hover:text-accent motion-reduce:transition-none sm:block"
                    >
                      →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ol>
          <p className="mt-4 font-sans text-xs text-muted">
            Creada: la hoja existe · Compartida: tiene enlace para el equipo ·
            Enviada: el equipo ya recibió el recordatorio por email.
          </p>

          <p className="mt-14 border-t border-line pt-5 font-sans text-sm text-muted">
            Siguiente, el día del rodaje:{" "}
            <Link
              href={`/app/${projectId}/claqueta`}
              className="font-medium text-fg underline decoration-accent/50 underline-offset-4 transition-colors hover:text-accent hover:decoration-accent"
            >
              Claqueta →
            </Link>
          </p>
        </section>
      )}
    </div>
  );
}
