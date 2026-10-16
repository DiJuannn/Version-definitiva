import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { CalendarEventType, TaskStatus } from "@/lib/generated/prisma";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { NewProjectPanel } from "@/components/NewProjectPanel";
import { ProjectPoster } from "@/components/ProjectPoster";
import { Clapperboard } from "@/components/Clapperboard";
import { getScheduleData } from "@/lib/schedule-data";
import { computeDayTimeline, dayWarnings, formatDuration, formatHHMM, sunriseMinutes } from "@/lib/schedule-plan";
import { liveForecast, REST_MIN_HOURS } from "@/lib/live-day";
import { FilmStrip, PHASE_COLORS } from "@/components/FilmStrip";
import { COVER_SHADOW } from "@/components/screenplay/cover-shadow";
import { courierPrime } from "@/lib/screenplay/font";
import { getProjectProgress } from "@/lib/project-progress";
import { PHASES } from "@/lib/project-phases";

const EVENT_LABELS: Record<CalendarEventType, string> = {
  REHEARSAL: "Ensayo",
  MEETING: "Reunión",
  DEADLINE: "Plazo",
  DELIVERY: "Entrega",
  OTHER: "Evento",
};
function greeting(hour: number): string {
  if (hour < 6) return "Buenas noches";
  if (hour < 12) return "Buenos días";
  if (hour < 20) return "Buenas tardes";
  return "Buenas noches";
}

const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const daysBetween = (a: Date, b: Date) => Math.round((dayStart(b).getTime() - dayStart(a).getTime()) / 86_400_000);

function relativeTime(date: Date): string {
  const min = Math.round((Date.now() - date.getTime()) / 60000);
  if (min < 60) return min <= 1 ? "Ahora mismo" : `Hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `Hace ${h} h`;
  const d = Math.round(h / 24);
  return d === 1 ? "Ayer" : `Hace ${d} días`;
}

// Inicio: lo primero es qué toca (una frase grande y la claqueta del próximo
// rodaje), luego la semana, tus proyectos como una cartelera (cada uno con su
// cartel y su tira de película) y los guiones que tienes sobre la mesa.
export default async function DashboardPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const organizationId = profile.organizationId;
  const now = new Date();
  const today = dayStart(now);
  const weekEnd = new Date(today.getTime() + 7 * 86_400_000);
  const visible = { OR: [{ organizationId }, { shares: { some: { userId: profile.id } } }] };

  const [projects, nextShoot, weekDays, events, tasks, overdue, screenplays] = await Promise.all([
    prisma.project.findMany({
      where: { ...visible, status: { not: "FINISHED" } },
      orderBy: { updatedAt: "desc" },
      take: 8,
      select: { id: true, name: true, coverUrl: true, type: true },
    }),
    prisma.shootingDay.findFirst({
      where: { project: { organizationId }, date: { gte: today } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        date: true,
        callTime: true,
        projectId: true,
        project: { select: { name: true, director: true } },
        callSheet: { select: { generalCallTime: true } },
        scenes: { orderBy: { order: "asc" }, select: { scene: { select: { number: true, location: { select: { name: true } } } } } },
        _count: { select: { shots: true } },
      },
    }),
    prisma.shootingDay.findMany({
      where: { project: { organizationId }, date: { gte: today, lt: weekEnd } },
      select: { id: true, date: true, callTime: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.calendarEvent.findMany({
      where: { organizationId, date: { gte: today, lt: weekEnd } },
      select: { id: true, title: true, type: true, date: true, project: { select: { name: true } } },
    }),
    prisma.task.findMany({
      where: { organizationId, status: { not: TaskStatus.DONE }, dueDate: { gte: today, lt: weekEnd } },
      select: { id: true, title: true, dueDate: true, project: { select: { name: true } } },
    }),
    prisma.task.count({ where: { organizationId, status: { not: TaskStatus.DONE }, dueDate: { lt: today } } }),
    prisma.screenplay.findMany({
      where: { organizationId },
      orderBy: { updatedAt: "desc" },
      take: 6,
      select: { id: true, title: true, author: true, pageCount: true, sceneCount: true, updatedAt: true },
    }),
  ]);

  if (projects.length === 0) {
    return (
      <div className="pb-8">
        <p className="eyebrow text-accent">
          {greeting(now.getHours())}
          {profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
        </p>
        <h1 className="poster-title mt-3 text-[64px] sm:text-[96px]">
          Tu primer
          <br />
          <span className="text-[var(--phase-2)]">proyecto</span>
        </h1>
        <p className="mt-5 max-w-xl font-sans text-[17px] leading-relaxed text-fg/80">
          Un corto, un largo, un videoclip… Todo en Taller —guion, plan de rodaje, presupuesto— cuelga de un proyecto. Tres
          preguntas y entras; te guiamos paso a paso.
        </p>
        <div className="paper mt-10 max-w-xl p-8">
          <NewProjectWizard />
        </div>
      </div>
    );
  }

  const progress = await Promise.all(projects.map((p) => getProjectProgress(p.id)));
  const nextIn = nextShoot ? daysBetween(today, nextShoot.date) : null;
  const shootProject = nextShoot?.project.name;
  const place = nextShoot?.scenes.map((s) => s.scene.location?.name).find(Boolean);
  const dayIndex = nextShoot
    ? await prisma.shootingDay.count({ where: { projectId: nextShoot.projectId, date: { lt: nextShoot.date } } })
    : 0;
  const dayCount = nextShoot ? await prisma.shootingDay.count({ where: { projectId: nextShoot.projectId } }) : 0;

  // El día del próximo rodaje con su orden: fin previsto, avisos (luz,
  // jornada larga), descanso del reparto antes del día siguiente y la hoja.
  const schedule = nextShoot ? await getScheduleData(nextShoot.projectId) : null;
  const sDayIdx = schedule && nextShoot ? schedule.days.findIndex((d) => d.id === nextShoot.id) : -1;
  const sDay = schedule && sDayIdx >= 0 ? schedule.days[sDayIdx] : null;
  const timelineOf = (d: NonNullable<typeof sDay>) =>
    computeDayTimeline({ date: new Date(d.dateISO), callTime: d.callTime, prepMin: d.prepMin, blocks: d.blocks, lat: d.lat, lng: d.lng });
  const tl = sDay ? timelineOf(sDay) : null;
  const hasWork = Boolean(sDay?.blocks.some((b) => b.shots.length > 0 || b.scene));
  const nextDay = schedule && sDay ? schedule.days[sDayIdx + 1] : undefined;
  const consecutive = nextDay && sDay && daysBetween(new Date(sDay.dateISO), new Date(nextDay.dateISO)) === 1 ? nextDay : null;
  const forecast =
    tl && schedule && hasWork
      ? liveForecast({ timeline: tl, now: null, workdayHours: schedule.workdayHours, next: consecutive ? { timeline: timelineOf(consecutive) } : null })
      : null;
  type Alert = { tone: "warn" | "ok" | "danger"; text: string; detail?: string; href?: string; cta?: string };
  const alerts: Alert[] = [];
  if (sDay && schedule && nextShoot) {
    const base = `/app/${nextShoot.projectId}`;
    for (const r of forecast?.rest.slice(0, 1) ?? []) {
      const who = schedule.characters[r.characterId];
      alerts.push({
        tone: "warn",
        text: `${who?.actor ?? who?.name ?? "Alguien del reparto"} tiene ${formatDuration(Math.max(0, r.restMinutes))} de descanso entre jornadas`,
        detail: `convenio: ${REST_MIN_HOURS} h`,
        href: `${base}/plan-de-rodaje?dia=${sDay.id}`,
        cta: "Ver el plan",
      });
    }
    if (tl && hasWork) {
      for (const w of dayWarnings(tl, { workdayHours: schedule.workdayHours, hasShots: true }).slice(0, 2)) {
        alerts.push({ tone: w.tone, text: w.text, detail: w.detail, href: `${base}/plan-de-rodaje?dia=${sDay.id}`, cta: "Ver el plan" });
      }
    }
    if (!sDay.sheet.exists) alerts.push({ tone: "warn", text: "Falta la hoja de llamada", href: `${base}/call-sheets/${sDay.id}`, cta: "Prepararla" });
    else if (sDay.sheet.outdated) alerts.push({ tone: "warn", text: "La hoja de llamada no recoge el último cambio del plan", href: `${base}/call-sheets/${sDay.id}`, cta: "Revisarla" });
    else if (sDay.sheet.shared) alerts.push({ tone: "ok", text: "Hoja de llamada enviada al equipo", href: `${base}/call-sheets/${sDay.id}` });
    else alerts.push({ tone: "warn", text: "Hoja de llamada hecha, sin enviar", href: `${base}/call-sheets/${sDay.id}`, cta: "Enviarla" });
  }
  if (overdue) alerts.push({ tone: "danger", text: overdue === 1 ? "1 tarea vencida" : `${overdue} tareas vencidas`, href: "/app/tareas", cta: "Ver tareas" });
  const sunrise = sDay ? sunriseMinutes(new Date(sDay.dateISO), sDay.lat ?? undefined, sDay.lng ?? undefined) : null;

  // La frase de arriba: lo más importante que viene.
  const lead = projects[0];
  const headline =
    nextIn !== null && nextIn <= 14
      ? nextIn === 0
        ? ["Hoy", "se rueda"]
        : nextIn === 1
          ? ["Rodáis", "mañana"]
          : ["Rodáis", `en ${nextIn} días`]
      : ["Seguimos con", lead.name];
  const callTime = nextShoot?.callTime ?? nextShoot?.callSheet?.generalCallTime ?? null;
  const subline =
    nextIn !== null && nextIn <= 14 && nextShoot
      ? [
          nextShoot.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" }),
        ].join("")
      : `${progress[0].label}.${overdue ? ` ${overdue === 1 ? "Hay 1 tarea vencida" : `Hay ${overdue} tareas vencidas`}.` : ""}`;

  // La semana: rodajes, eventos y tareas con fecha, día a día.
  const week = Array.from({ length: 7 }, (_, i) => {
    const date = new Date(today.getTime() + i * 86_400_000);
    const same = (d: Date) => daysBetween(date, d) === 0;
    const items = [
      ...weekDays.filter((d) => same(d.date)).map((d) => ({ id: d.id, kind: "Rodaje", title: d.project.name, sub: d.callTime ? `Citación ${d.callTime}` : null, href: `/app/${d.projectId}/plan-de-rodaje?dia=${d.id}` })),
      ...events.filter((e) => same(e.date)).map((e) => ({ id: e.id, kind: EVENT_LABELS[e.type], title: e.title, sub: e.project?.name ?? null, href: "/app/calendario" })),
      ...tasks.filter((t) => t.dueDate && same(t.dueDate)).map((t) => ({ id: t.id, kind: "Tarea", title: t.title, sub: t.project?.name ?? null, href: `/app/tareas/${t.id}` })),
    ];
    return { date, items };
  });

  return (
    <div className={`pb-12 ${courierPrime.variable}`}>
      {/* ------------------------------------------------ qué toca */}
      <section className="taller-ink relative -mt-8 mx-[calc(50%-50vw)] border-b border-line bg-bg px-[calc(50vw-50%)] text-fg sm:-mt-12">
        <div className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_400px] lg:items-center lg:gap-16">
          <div className="min-w-0">
            <p className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[11px] tracking-[0.18em] text-muted uppercase">
              <span>
                {greeting(now.getHours())}
                {profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""}
              </span>
              {nextShoot && nextIn !== null && nextIn <= 14 && (
                <>
                  <span aria-hidden>·</span>
                  <span className="text-fg">{shootProject}</span>
                  <span aria-hidden>·</span>
                  <span className="flex items-center gap-1.5 text-[var(--phase-3)]">
                    <span aria-hidden className="h-2 w-2 rounded-full bg-current" />
                    Rodar · día {dayIndex + 1} de {dayCount}
                  </span>
                </>
              )}
            </p>
            <h1 className="poster-title mt-3 text-[64px] sm:text-[112px]">
              {headline[0]}
              <br />
              <span style={{ color: nextIn !== null && nextIn <= 14 ? "var(--phase-3)" : PHASE_COLORS[progress[0].stage - 1] }}>
                {headline[1]}
              </span>
            </h1>
            <p className="mt-4 max-w-2xl font-sans text-[26px] leading-tight font-light text-fg first-letter:uppercase sm:text-[30px]">{subline}</p>
            {nextShoot && nextIn !== null && nextIn <= 14 && (place || sunrise !== null) && (
              <p className="mt-2 font-mono text-[12.5px] text-muted">
                {place && <>◎ {place}</>}
                {place && sunrise !== null && " · "}
                {sunrise !== null && `amanecer ${formatHHMM(sunrise)}`}
                {tl?.sunset != null && ` · puesta ${formatHHMM(tl.sunset)}`}
              </p>
            )}
            {alerts.length > 0 && (
              <ul className="mt-6 max-w-[38rem] space-y-2">
                {alerts.slice(0, 3).map((a) => (
                  <li
                    key={a.text}
                    className={`flex items-center gap-3 rounded-[var(--r-md)] border px-3.5 py-2.5 font-sans text-[14.5px] ${
                      a.tone === "ok" ? "border-line bg-ink-1" : a.tone === "danger" ? "border-danger/50 bg-ink-1" : "border-warn/50 bg-ink-1"
                    }`}
                  >
                    <span
                      aria-hidden
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-[var(--r-xs)] text-[13px] font-bold text-ink-0 ${
                        a.tone === "ok" ? "bg-success" : a.tone === "danger" ? "bg-danger" : "bg-warn"
                      }`}
                    >
                      {a.tone === "ok" ? "✓" : "!"}
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">
                      {a.text}
                      {a.detail && <span className="text-muted"> ({a.detail})</span>}
                    </span>
                    {a.href && a.cta && (
                      <Link href={a.href} className="shrink-0 text-[13px] font-semibold text-fg underline decoration-line underline-offset-4 hover:decoration-fg">
                        {a.cta}
                      </Link>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <p className="mt-6 flex flex-wrap gap-3">
              {nextShoot && nextIn !== null && nextIn <= 14 ? (
                <>
                  <Link href={`/app/${nextShoot.projectId}/plan-de-rodaje/directo?dia=${nextShoot.id}`} className="btn btn-primary">
                    {nextIn === 0 ? "Abrir el día de rodaje" : "Ver el día de rodaje"}
                  </Link>
                  <Link href={`/app/${nextShoot.projectId}/call-sheets/${nextShoot.id}`} className="btn btn-outline">
                    Hoja de llamada
                  </Link>
                </>
              ) : (
                <Link href={`/app/${lead.id}`} className="btn btn-primary">
                  Continuar con {lead.name} →
                </Link>
              )}
            </p>
          </div>
          {nextShoot ? (
            <Clapperboard
              production={nextShoot.project.name}
              day={dayIndex + 1}
              dayCount={dayCount}
              scenes={nextShoot.scenes.length}
              shots={nextShoot._count.shots}
              callTime={callTime}
              place={place ?? null}
              director={nextShoot.project.director}
              live={{ href: `/app/${nextShoot.projectId}/plan-de-rodaje/directo?dia=${nextShoot.id}`, on: nextIn === 0 }}
              meta={[
                `${nextShoot.scenes.length} ${nextShoot.scenes.length === 1 ? "escena" : "escenas"}`,
                `${nextShoot._count.shots} planos`,
                ...(tl && hasWork ? [`fin previsto ${formatHHMM(tl.wrap)}`, `${formatDuration(tl.workMinutes)} de jornada`] : []),
              ]}
            />
          ) : (
            <aside className="rounded-md border border-dashed border-line p-6">
              <p className="eyebrow">Próximo rodaje</p>
              <p className="poster-title mt-2 text-[34px] text-muted">Sin fecha</p>
              <p className="mt-2 font-sans text-sm text-muted">Cuando un proyecto tenga jornadas, aquí verás la claqueta del próximo día.</p>
            </aside>
          )}
        </div>
      </section>

      {/* ------------------------------------------------ esta semana */}
      <section aria-labelledby="semana" className="mt-14">
        <div className="flex items-baseline gap-4">
          <h2 id="semana" className="poster-sub text-[32px]">
            Esta semana
          </h2>
          <Link href="/app/calendario" className="eyebrow ml-auto hover:text-fg">
            Agenda →
          </Link>
        </div>
        {/* La semana como un trozo de película: un fotograma por día. Los días
            con algo son copia positiva (papel), el de rodaje lleva la gelatina
            roja y los libres quedan en negativo. */}
        <div className="mt-5 overflow-x-auto rounded-[var(--r-sm)] bg-[#2b211c] px-2.5 py-4">
          <div aria-hidden className="mx-0.5 mb-2 h-2 min-w-[980px] bg-[repeating-linear-gradient(90deg,#0b0b0d_0_9px,transparent_9px_20px)] lg:min-w-0" />
          <ol className="grid min-w-[980px] grid-cols-7 gap-2 lg:min-w-0">
            {week.map(({ date, items }, i) => {
              const shoot = items.some((it) => it.kind === "Rodaje");
              const tone = shoot ? "bg-[var(--phase-3)] text-ink-0" : items.length ? "bg-[#ece8dc] text-[#1c1b19]" : "bg-ink-0 text-fg";
              return (
                <li key={i} className={`relative flex min-h-36 flex-col rounded-[3px] p-3 ${tone} ${i === 0 ? "ring-2 ring-fg ring-offset-2 ring-offset-[#2b211c]" : ""}`}>
                  <p className="flex items-baseline justify-between gap-2">
                    <span className="font-mono text-[10.5px] tracking-[0.14em] uppercase opacity-70">
                      {date.toLocaleDateString("es-ES", { weekday: "short", timeZone: "Europe/Madrid" }).replace(".", "")}
                    </span>
                    <span className="poster-title text-[30px]">{date.getDate()}</span>
                  </p>
                  {i === 0 && (
                    <span className="mt-1 w-fit rounded-[2px] bg-fg px-1.5 py-px font-mono text-[10px] font-semibold tracking-[0.12em] text-ink-0">
                      HOY
                    </span>
                  )}
                  <div className="mt-auto space-y-2 pt-3">
                    {items.length === 0 ? (
                      <p className="font-mono text-[11px] opacity-50">— libre</p>
                    ) : (
                      items.slice(0, 2).map((it) => (
                        <Link key={it.id} href={it.href} className="block font-sans text-[13px] leading-snug font-semibold hover:underline">
                          {it.kind === "Rodaje" ? `Rodaje · ${it.title}` : it.title}
                          <span className="block text-[11.5px] font-normal opacity-75">
                            {it.kind === "Rodaje" ? (it.sub ?? "") : `${it.kind}${it.sub ? ` · ${it.sub}` : ""}`}
                          </span>
                        </Link>
                      ))
                    )}
                    {items.length > 2 && <p className="font-mono text-[10.5px] opacity-60">+{items.length - 2} más</p>}
                  </div>
                </li>
              );
            })}
          </ol>
          <div aria-hidden className="mx-0.5 mt-2 h-2 min-w-[980px] bg-[repeating-linear-gradient(90deg,#0b0b0d_0_9px,transparent_9px_20px)] lg:min-w-0" />
        </div>
      </section>

      {/* ------------------------------------------------ cartelera */}
      <section aria-labelledby="proyectos" className="mt-16">
        <div className="flex items-baseline gap-4">
          <h2 id="proyectos" className="poster-sub text-[32px]">
            Tus proyectos
          </h2>
          <Link href="/app/proyectos" className="eyebrow ml-auto hover:text-fg">
            Ver todos →
          </Link>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
          {projects.map((p, i) => {
            const pr = progress[i];
            return (
              <li key={p.id}>
                <Link href={`/app/${p.id}`} className="group block">
                  <div className="transition duration-300 group-hover:-translate-y-1">
                    <ProjectPoster name={p.name} coverUrl={p.coverUrl} caption={pr.label} accent={PHASE_COLORS[pr.stage - 1]} />
                  </div>
                  <FilmStrip
                    size="sm"
                    frames={6}
                    className="mt-3"
                    segments={PHASES.map((ph, k) => ({ color: PHASE_COLORS[k], done: pr.phases[k] }))}
                  />
                  <p className="mt-2 flex justify-between gap-2 font-sans text-[13px]">
                    <b className="font-semibold">{PHASES[pr.stage - 1].label}</b>
                    <span className="truncate text-muted">{p.type ?? "Proyecto"}</span>
                  </p>
                </Link>
              </li>
            );
          })}
          <li>
            <NewProjectPanel className="flex aspect-[2/3] w-full flex-col items-center justify-center gap-2 rounded-[4px] border-[1.5px] border-dashed border-line font-sans text-[15px] text-muted transition hover:border-accent hover:text-fg" />
          </li>
        </ul>
      </section>

      {/* ------------------------------------------------ escritorio */}
      {screenplays.length > 0 && (
        <section aria-labelledby="escritorio" className="mt-16">
          <div className="flex items-baseline gap-4">
            <h2 id="escritorio" className="poster-sub text-[32px]">
              Tus guiones
            </h2>
            <Link href="/app/guiones" className="eyebrow ml-auto hover:text-fg">
              Todos los guiones →
            </Link>
          </div>
          <ul className="mt-6 grid grid-cols-2 gap-6 sm:grid-cols-4 lg:grid-cols-6">
            {screenplays.map((s) => (
              <li key={s.id}>
                <Link href={`/app/guiones/${s.id}`} className="sp-cover group block">
                  <span className={`sp-cover-sheet flex flex-col px-[10%] pt-[34%] pb-[8%] text-center text-[#1c1b19] ${COVER_SHADOW}`}>
                    <span className="font-[family-name:var(--font-courier)] text-[12px] leading-tight font-bold uppercase underline underline-offset-4">
                      {s.title}
                    </span>
                    {s.author && (
                      <span className="mt-[14%] line-clamp-2 font-[family-name:var(--font-courier)] text-[10px] text-[#4a4842]">
                        escrito por {s.author}
                      </span>
                    )}
                    <span className="mt-auto text-left font-[family-name:var(--font-courier)] text-[10px] text-[#8f897c]">
                      {s.pageCount} págs. · {s.sceneCount} escenas
                    </span>
                  </span>
                </Link>
                <p className="mt-2 font-sans text-[12.5px] text-muted">{relativeTime(s.updatedAt)}</p>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
