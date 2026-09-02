import { prisma } from "@/lib/prisma";
import { isPro, PRO_PLANS } from "@/lib/plan";
import {
  SCRIPT_ANALYSIS_FREE_DAILY_LIMIT,
  SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT,
  SCRIPT_ANALYSIS_HOURLY_LIMIT,
  SCRIPT_ANALYSIS_PRO_DAILY_LIMIT,
} from "@/lib/limits";

// Precios actuales del plan PRO (Lemon Squeezy) — no guardamos qué
// variante (mensual/anual) eligió cada organización, así que el
// ingreso mensual recurrente se muestra como rango entre los dos
// precios en vez de una cifra falsamente exacta. El pago único (PRO
// para siempre, 120€) no es recurrente, así que no entra en el MRR —
// se cuenta aparte como ingreso puntual.
const PRICE_MONTHLY = 6.99;
const PRICE_YEARLY_MONTHLY_EQUIVALENT = 69.99 / 12;
const PRICE_LIFETIME = 120;

function currency(value: number) {
  return value.toLocaleString("es-ES", { style: "currency", currency: "EUR" });
}

const TOOL_LABELS: Record<string, string> = {
  scenes: "Guion (escenas)",
  breakdownElements: "Desglose",
  characters: "Personajes",
  shots: "Shot list",
  storyboardFrames: "Storyboard",
  shootingDays: "Plan de rodaje",
  callSheets: "Call sheets",
  budgetItems: "Presupuesto",
  clapLogs: "Claqueta",
  tasks: "Tareas",
  documents: "Biblioteca de archivos",
  calendarEvents: "Calendario",
};

export default async function AdminMetricsPage() {
  const now = new Date();
  const hourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  const [
    totalUsers,
    orgsByPlan,
    usersByPlan,
    toolCounts,
    totalAnalyses,
    hourlyGroups,
    dailyGroups,
    lifetimeGroups,
    recentUsers,
    recentProjects,
    newUsersThisWeek,
    newProjectsThisWeek,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.organization.groupBy({ by: ["plan"], _count: true }),
    Promise.all([
      prisma.user.count({ where: { organization: { plan: "FREE" } } }),
      prisma.user.count({ where: { organization: { plan: { in: PRO_PLANS } } } }),
    ]),
    Promise.all([
      prisma.scene.count(),
      prisma.breakdownElement.count(),
      prisma.character.count(),
      prisma.shot.count(),
      prisma.storyboardFrame.count(),
      prisma.shootingDay.count(),
      prisma.callSheet.count(),
      prisma.budgetItem.count(),
      prisma.clapLog.count(),
      prisma.task.count(),
      prisma.document.count(),
      prisma.calendarEvent.count(),
    ]),
    prisma.scriptAnalysis.count(),
    prisma.scriptAnalysis.groupBy({
      by: ["createdById"],
      _count: true,
      where: { createdAt: { gte: hourAgo } },
    }),
    prisma.scriptAnalysis.groupBy({
      by: ["createdById"],
      _count: true,
      where: { createdAt: { gte: dayAgo } },
    }),
    prisma.scriptAnalysis.groupBy({ by: ["createdById"], _count: true }),
    prisma.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, email: true, fullName: true, createdAt: true, organization: { select: { name: true, plan: true } } },
    }),
    prisma.project.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      select: { id: true, name: true, createdAt: true, organization: { select: { name: true } } },
    }),
    prisma.user.count({ where: { createdAt: { gte: weekAgo } } }),
    prisma.project.count({ where: { createdAt: { gte: weekAgo } } }),
  ]);

  const freeOrgs = orgsByPlan.find((o) => o.plan === "FREE")?._count ?? 0;
  const subscriptionProOrgs = orgsByPlan.find((o) => o.plan === "PRO")?._count ?? 0;
  const lifetimeOrgs = orgsByPlan.find((o) => o.plan === "PRO_LIFETIME")?._count ?? 0;
  const proOrgs = subscriptionProOrgs + lifetimeOrgs;
  const [freeUsers, proUsers] = usersByPlan;

  // Solo las suscripciones (mensual/anual) generan ingreso recurrente — el
  // pago único ya se cobró una vez y no vuelve a sumar cada mes.
  const mrrLow = subscriptionProOrgs * PRICE_YEARLY_MONTHLY_EQUIVALENT;
  const mrrHigh = subscriptionProOrgs * PRICE_MONTHLY;
  const lifetimeRevenue = lifetimeOrgs * PRICE_LIFETIME;

  const [
    scenes,
    breakdownElements,
    characters,
    shots,
    storyboardFrames,
    shootingDays,
    callSheets,
    budgetItems,
    clapLogs,
    tasks,
    documents,
    calendarEvents,
  ] = toolCounts;

  const toolUsage = Object.entries({
    scenes,
    breakdownElements,
    characters,
    shots,
    storyboardFrames,
    shootingDays,
    callSheets,
    budgetItems,
    clapLogs,
    tasks,
    documents,
    calendarEvents,
  })
    .map(([key, count]) => ({ label: TOOL_LABELS[key], count }))
    .sort((a, b) => b.count - a.count);
  const maxToolUsage = Math.max(1, ...toolUsage.map((t) => t.count));

  // Cuántos análisis lleva cada usuario esta hora / hoy / de por vida —
  // para marcar quién está cerca de sus topes (misma lógica de límites
  // que lib/actions/script-analysis.ts).
  const hourlyByUser = new Map(hourlyGroups.map((g) => [g.createdById, g._count]));
  const dailyByUser = new Map(dailyGroups.map((g) => [g.createdById, g._count]));
  const lifetimeByUser = new Map(lifetimeGroups.map((g) => [g.createdById, g._count]));

  const involvedUserIds = [
    ...new Set([...hourlyByUser.keys(), ...dailyByUser.keys()]),
  ].filter((id): id is string => id !== null);
  const involvedUsers = involvedUserIds.length
    ? await prisma.user.findMany({
        where: { id: { in: involvedUserIds } },
        select: { id: true, email: true, organization: { select: { plan: true } } },
      })
    : [];

  const nearLimit = involvedUsers
    .map((u) => {
      const hourly = hourlyByUser.get(u.id) ?? 0;
      const daily = dailyByUser.get(u.id) ?? 0;
      const lifetime = lifetimeByUser.get(u.id) ?? 0;
      const userIsPro = isPro(u.organization.plan);
      const dailyLimit = userIsPro ? SCRIPT_ANALYSIS_PRO_DAILY_LIMIT : SCRIPT_ANALYSIS_FREE_DAILY_LIMIT;
      const flags: string[] = [];
      if (hourly >= SCRIPT_ANALYSIS_HOURLY_LIMIT) flags.push(`${hourly}/${SCRIPT_ANALYSIS_HOURLY_LIMIT} esta hora`);
      if (daily >= dailyLimit) flags.push(`${daily}/${dailyLimit} hoy`);
      if (!userIsPro && lifetime >= SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT) {
        flags.push(`${lifetime}/${SCRIPT_ANALYSIS_FREE_LIFETIME_LIMIT} de por vida`);
      }
      return { email: u.email, plan: u.organization.plan, hourly, daily, lifetime, flags };
    })
    .filter((u) => u.flags.length > 0)
    .sort((a, b) => b.hourly - a.hourly);

  return (
    <div>
      <p className="font-mono text-xs tracking-widest text-accent uppercase">Admin</p>
      <h1 className="mt-1 font-display text-2xl font-bold uppercase">Métricas de la plataforma</h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Solo lectura — foto del estado actual, sin gestión de usuarios.
      </p>

      <section className="mt-10 grid gap-4 sm:grid-cols-3">
        <div className="border border-line p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">Usuarios totales</p>
          <p className="mt-1 font-display text-3xl font-bold">{totalUsers}</p>
          <p className="mt-1 font-mono text-xs text-muted">+{newUsersThisWeek} esta semana</p>
        </div>
        <div className="border border-line p-5">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Organizaciones — Free / PRO
          </p>
          <p className="mt-1 font-display text-3xl font-bold">
            {freeOrgs} / {proOrgs}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            {freeUsers} usuarios en Free · {proUsers} en PRO
          </p>
          {lifetimeOrgs > 0 && (
            <p className="mt-1 font-mono text-xs text-muted">
              {subscriptionProOrgs} PRO por suscripción · {lifetimeOrgs} PRO de pago único
            </p>
          )}
        </div>
        <div className="border border-accent p-5">
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Ingreso mensual recurrente (estimado)
          </p>
          <p className="mt-1 font-display text-3xl font-bold text-accent">
            {currency(mrrLow)} – {currency(mrrHigh)}
          </p>
          <p className="mt-1 font-mono text-xs text-muted">
            {subscriptionProOrgs} organizaciones PRO por suscripción · rango según mensual (6,99€)
            o anual (69,99€/año) — no distinguimos cuál eligió cada una.
            {lifetimeOrgs > 0 && (
              <>
                {" "}
                Además, {currency(lifetimeRevenue)} en pagos únicos ({lifetimeOrgs} × 120€, no
                recurrente).
              </>
            )}
          </p>
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Herramientas más usadas
        </h2>
        <p className="mt-1 font-mono text-xs text-muted">
          Aproximación por volumen de datos creados en cada una, no analítica de pantallas
          visitadas.
        </p>
        <div className="mt-4 space-y-2">
          {toolUsage.map((tool) => (
            <div key={tool.label} className="flex items-center gap-3">
              <span className="w-40 shrink-0 font-mono text-xs">{tool.label}</span>
              <div className="h-3 flex-1 border border-line">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${(tool.count / maxToolUsage) * 100}%` }}
                />
              </div>
              <span className="w-12 shrink-0 text-right font-mono text-xs text-muted">
                {tool.count}
              </span>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Análisis de guion con IA
        </h2>
        <p className="mt-2 font-mono text-xs text-muted">
          {totalAnalyses} análisis en total, en toda la vida de la plataforma.
        </p>

        {nearLimit.length === 0 ? (
          <p className="mt-4 font-mono text-xs text-muted">
            Nadie está cerca de sus topes ahora mismo.
          </p>
        ) : (
          <div className="mt-4 border-t border-line">
            {nearLimit.map((u) => (
              <div
                key={u.email}
                className="flex flex-wrap items-center justify-between gap-2 border-b border-line py-3"
              >
                <span className="font-mono text-sm">
                  {u.email}{" "}
                  <span className="text-muted">({isPro(u.plan) ? "PRO" : "Gratis"})</span>
                </span>
                <span className="font-mono text-xs text-accent">{u.flags.join(" · ")}</span>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10 grid gap-8 sm:grid-cols-2">
        <div>
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Usuarios recientes
          </h2>
          <p className="mt-1 font-mono text-xs text-muted">
            +{newUsersThisWeek} en los últimos 7 días.
          </p>
          <div className="mt-4 border-t border-line">
            {recentUsers.map((u) => (
              <div key={u.id} className="border-b border-line py-3">
                <p className="font-mono text-sm">{u.fullName || u.email}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">
                  {u.organization.name} · {isPro(u.organization.plan) ? "PRO" : "Gratis"} ·{" "}
                  {u.createdAt.toLocaleDateString("es-ES")}
                </p>
              </div>
            ))}
          </div>
        </div>
        <div>
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Proyectos recientes
          </h2>
          <p className="mt-1 font-mono text-xs text-muted">
            +{newProjectsThisWeek} en los últimos 7 días.
          </p>
          <div className="mt-4 border-t border-line">
            {recentProjects.map((p) => (
              <div key={p.id} className="border-b border-line py-3">
                <p className="font-mono text-sm">{p.name}</p>
                <p className="mt-0.5 font-mono text-xs text-muted">
                  {p.organization.name} · {p.createdAt.toLocaleDateString("es-ES")}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
