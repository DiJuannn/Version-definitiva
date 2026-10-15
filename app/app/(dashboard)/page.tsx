import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { CalendarEventType, TaskStatus } from "@/lib/generated/prisma";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { NewProjectPanel } from "@/components/NewProjectPanel";
import { ProjectPoster } from "@/components/ProjectPoster";
import { ShootSlate } from "@/components/ShootSlate";
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
// Color de cada cosa de la agenda, con los de las fases: rodaje en rojo,
// preparación en amarillo, entregas y plazos en verde.
const EVENT_COLOR: Record<string, string> = {
  Rodaje: "var(--phase-3)",
  Ensayo: "var(--phase-2)",
  Reunión: "var(--phase-2)",
  Plazo: "var(--phase-4)",
  Entrega: "var(--phase-4)",
  Evento: "var(--phase-1)",
  Tarea: "var(--phase-1)",
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
        project: { select: { name: true } },
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
          `${shootProject}, ${nextShoot.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", timeZone: "Europe/Madrid" })}`,
          callTime ? ` a las ${callTime}` : "",
          place ? ` en ${place.toLowerCase()}` : "",
          ".",
          nextShoot.callSheet ? "" : " Falta la hoja de llamada.",
          overdue ? ` Y ${overdue === 1 ? "hay 1 tarea vencida" : `hay ${overdue} tareas vencidas`}.` : "",
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
        <div className="grid gap-10 py-12 lg:grid-cols-[minmax(0,1fr)_360px] lg:items-end lg:gap-16">
          <div className="min-w-0">
            <p className="font-mono text-[11px] tracking-[0.18em] text-accent uppercase">
              {greeting(now.getHours())}
              {profile.fullName ? `, ${profile.fullName.split(" ")[0]}` : ""} ·{" "}
              {now.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Madrid" })}
            </p>
            <h1 className="poster-title mt-3 text-[64px] sm:text-[96px]">
              {headline[0]}
              <br />
              <span style={{ color: nextIn !== null && nextIn <= 14 ? "var(--phase-3)" : PHASE_COLORS[progress[0].stage - 1] }}>
                {headline[1]}
              </span>
            </h1>
            <p className="mt-5 max-w-2xl font-sans text-[17px] leading-relaxed text-fg/80 first-letter:uppercase">{subline}</p>
            <p className="mt-6 flex flex-wrap gap-3">
              {nextShoot && nextIn !== null && nextIn <= 14 ? (
                <>
                  <Link
                    href={nextShoot.callSheet ? `/app/${nextShoot.projectId}/plan-de-rodaje?dia=${nextShoot.id}` : `/app/${nextShoot.projectId}/call-sheets/${nextShoot.id}`}
                    className="btn btn-primary"
                  >
                    {nextShoot.callSheet ? "Ver el orden de rodaje →" : "Preparar la hoja de llamada →"}
                  </Link>
                  <Link href={`/app/${nextShoot.projectId}`} className="btn btn-outline">
                    Ir al proyecto
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
            <ShootSlate
              eyebrow={`${nextShoot.project.name} · día ${dayIndex + 1} de ${dayCount}`}
              date={nextShoot.date}
              callTime={callTime}
              scenes={nextShoot.scenes.map((s) => s.scene.number).join(" · ")}
              shots={nextShoot._count.shots}
              warning={nextShoot.callSheet ? null : "Falta la hoja de llamada"}
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
        <ol className="mt-5 grid grid-cols-2 border-t border-line sm:grid-cols-4 lg:grid-cols-7">
          {week.map(({ date, items }, i) => (
            <li key={i} className="min-h-28 border-b border-line py-3.5 pr-3 lg:border-r lg:border-b-0 lg:pl-3.5 lg:first:pl-0 lg:last:border-r-0">
              <p className={`poster-title text-[30px] ${i === 0 ? "text-accent" : ""}`}>
                {date.getDate()}
                <span className="ml-1.5 font-mono text-[9.5px] font-normal tracking-[0.14em] text-muted">
                  {date.toLocaleDateString("es-ES", { weekday: "short", timeZone: "Europe/Madrid" }).replace(".", "").toUpperCase()}
                  {i === 0 ? " · HOY" : ""}
                </span>
              </p>
              {items.slice(0, 3).map((it) => (
                <Link
                  key={it.id}
                  href={it.href}
                  className="mt-2.5 block border-l-[3px] pl-2 font-sans text-[13px] leading-snug font-semibold hover:text-accent"
                  style={{ borderColor: EVENT_COLOR[it.kind] ?? "var(--phase-1)" }}
                >
                  {it.title}
                  <span className="block text-[11.5px] font-normal text-muted">
                    {it.kind}
                    {it.sub ? ` · ${it.sub}` : ""}
                  </span>
                </Link>
              ))}
            </li>
          ))}
        </ol>
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
                      <span className="mt-[14%] line-clamp-2 font-[family-name:var(--font-courier)] text-[9.5px] text-[#4a4842]">
                        escrito por {s.author}
                      </span>
                    )}
                    <span className="mt-auto text-left font-[family-name:var(--font-courier)] text-[9px] text-[#8f897c]">
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
