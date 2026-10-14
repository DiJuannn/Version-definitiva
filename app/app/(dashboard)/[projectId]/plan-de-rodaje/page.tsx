import Link from "next/link";
import { notFound } from "next/navigation";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { createShootingDay } from "@/lib/actions/shooting-days";
import { getScheduleData } from "@/lib/schedule-data";
import { computeDayTimeline, dayWarnings } from "@/lib/schedule-plan";
import { ScheduleAssistant } from "@/components/ScheduleAssistant";
import { EmptyState } from "@/components/EmptyState";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { ScheduleEditor } from "@/components/schedule/ScheduleEditor";
import { ScheduleCalendar, ScheduleCoverage } from "@/components/schedule/ScheduleOverview";

// Mover planos en el plan de rodaje recalcula y guarda varias cosas a la vez.
export const maxDuration = 30;

type View = "jornada" | "calendario" | "cobertura";

export default async function PlanDeRodajePage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ vista?: string; dia?: string }>;
}) {
  const { projectId } = await params;
  const sp = await searchParams;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const [profile, data] = await Promise.all([getCurrentProfile(), getScheduleData(projectId)]);
  const view: View = sp.vista === "calendario" || sp.vista === "cobertura" ? sp.vista : "jornada";

  // Jornada abierta: la pedida o, si no, la próxima (o la última si ya pasaron todas).
  const todayISO = new Date().toISOString().slice(0, 10);
  const upcoming = data.days.find((d) => d.dateISO.slice(0, 10) >= todayISO) ?? data.days[data.days.length - 1];
  const day = data.days.find((d) => d.id === sp.dia) ?? upcoming;

  const pending = data.pool.shots.length + data.pool.scenes.length;
  const warningsTotal = data.days.reduce((n, d) => {
    const hasShots = d.blocks.some((b) => b.shots.length > 0 || b.scene);
    const tl = computeDayTimeline({ date: new Date(d.dateISO), callTime: d.callTime, prepMin: d.prepMin, blocks: d.blocks, lat: d.lat, lng: d.lng });
    return n + dayWarnings(tl, { workdayHours: data.workdayHours, hasShots }).length + d.conflicts.length + (d.sheet.outdated ? 1 : 0);
  }, 0);
  const unscheduledScenes = Object.keys(data.scenes).filter((id) => {
    const cov = data.coverage.find((c) => c.sceneId === id);
    const inDay = data.days.some((d) => d.blocks.some((b) => b.scene?.id === id || b.shots.some((s) => s.sceneId === id)));
    return !inDay && !(cov?.shots.some((s) => s.done));
  }).length;

  const createAction = createShootingDay.bind(null, projectId);
  const tab = (v: View, label: string, meta?: string) => (
    <Link
      href={`/app/${projectId}/plan-de-rodaje?vista=${v}${day && v === "jornada" ? `&dia=${day.id}` : ""}`}
      aria-current={view === v ? "page" : undefined}
      className={`-mb-px border-b-2 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap transition-colors ${
        view === v ? "border-accent text-fg" : "border-transparent text-muted hover:text-fg"
      }`}
    >
      {label}
      {meta && <span className="ml-1.5 font-normal text-muted">{meta}</span>}
    </Link>
  );

  return (
    <div>
      <PageHeader
        eyebrow="Producción"
        title="Plan de rodaje"
        description={
          data.days.length > 0 ? (
            <>
              {data.days.length} jornada{data.days.length === 1 ? "" : "s"} · {data.totals.scheduled} de {data.totals.shots} planos programados
              {data.totals.done > 0 && ` · ${data.totals.done} rodados`}
              {pending > 0 && <span className="text-warn"> · {pending} por programar</span>}
              {data.totals.retakes > 0 && <span className="text-danger"> · {data.totals.retakes} a repetir</span>}
              {warningsTotal > 0 && <span className="text-warn"> · {warningsTotal} aviso{warningsTotal === 1 ? "" : "s"}</span>}
            </>
          ) : undefined
        }
      />

      <form action={createAction} className="mt-5 flex flex-wrap items-end gap-2 print:hidden">
        <label className="flex flex-col gap-1">
          <span className="text-xs text-muted">Nueva jornada de rodaje</span>
          <input
            type="date"
            name="date"
            required
            className="h-9 rounded-md border border-line bg-transparent px-3 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <SubmitButton pendingLabel="Añadiendo…" className="btn btn-primary">
          + Añadir jornada
        </SubmitButton>
      </form>

      {unscheduledScenes > 0 && (
        <ScheduleAssistant projectId={projectId} unscheduled={unscheduledScenes} hasDays={data.days.length > 0} />
      )}

      {Object.keys(data.scenes).length === 0 ? (
        <EmptyState
          title="Todavía no hay escenas"
          description="Créalas en Guion (o importa tu guion técnico en Lista de planos) para poder programarlas en jornadas de rodaje."
          actionLabel="Ir a Guion"
          actionHref={`/app/${projectId}/guion`}
        />
      ) : data.days.length === 0 ? (
        <EmptyState
          title="Aún no hay jornadas de rodaje"
          description="Añade la primera jornada con su fecha (arriba) o deja que el asistente las proponga. Luego reparte los planos en el orden en que se ruedan."
        />
      ) : (
        <>
          <nav aria-label="Vistas del plan de rodaje" className="mt-7 flex gap-1 overflow-x-auto border-b border-line">
            {tab("jornada", "Jornada")}
            {tab("calendario", "Calendario", String(data.days.length))}
            {tab("cobertura", "Cobertura por escenas", pending > 0 ? `${pending} pendientes` : undefined)}
          </nav>

          {view === "jornada" && day && (
            <>
              <nav aria-label="Jornadas" className="mt-4 flex gap-2 overflow-x-auto pb-1">
                {data.days.map((d) => {
                  const count = d.blocks.reduce((n, b) => n + b.shots.length + (b.scene ? 1 : 0), 0);
                  const done = d.blocks.reduce((n, b) => n + b.shots.filter((s) => s.done).length, 0);
                  return (
                    <Link
                      key={d.id}
                      href={`/app/${projectId}/plan-de-rodaje?dia=${d.id}`}
                      aria-current={d.id === day.id ? "page" : undefined}
                      className={`min-w-36 shrink-0 rounded-lg border px-3 py-2 text-[13px] transition-colors ${
                        d.id === day.id ? "border-accent bg-accent/10" : "border-line hover:border-accent/60"
                      }`}
                    >
                      <b className="block text-fg">{d.shortLabel}</b>
                      <span className="block truncate text-muted">
                        {d.locations[0] ?? "Sin sitio"} · {count} plano{count === 1 ? "" : "s"}
                      </span>
                      <span className="mt-1.5 block h-1 overflow-hidden rounded-full bg-line">
                        <span className="block h-full rounded-full bg-success" style={{ width: `${count ? Math.round((done / count) * 100) : 0}%` }} />
                      </span>
                    </Link>
                  );
                })}
              </nav>
              <ScheduleEditor
                key={day.id}
                projectId={projectId}
                data={data}
                dayId={day.id}
                viewerLabel={profile?.fullName || profile?.email || "Alguien"}
              />
            </>
          )}
          {view === "calendario" && <ScheduleCalendar projectId={projectId} data={data} />}
          {view === "cobertura" && <ScheduleCoverage projectId={projectId} data={data} />}
        </>
      )}
    </div>
  );
}
