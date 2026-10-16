import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getScheduleData } from "@/lib/schedule-data";
import { computeDayTimeline, sunriseMinutes } from "@/lib/schedule-plan";
import { BREAKDOWN_CATEGORY_LABELS } from "@/lib/labels";
import { EmptyState } from "@/components/EmptyState";
import { LiveDay, type LiveDayData } from "@/components/schedule/LiveDay";

export const metadata = { title: "Día de rodaje" };

// El día de rodaje en directo: la jornada de hoy (o la próxima) frente al
// reloj, con los planos del bloque en curso, sus tomas y lo que se cae del
// día a este ritmo. Se recarga sola mientras está abierta.
export default async function LiveDayPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ dia?: string }>;
}) {
  const { projectId } = await params;
  const { dia } = await searchParams;
  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const data = await getScheduleData(projectId);
  const todayISO = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date());
  const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid" }).format(new Date(iso));
  const index = Math.max(
    0,
    dia ? data.days.findIndex((d) => d.id === dia) : data.days.findIndex((d) => dayKey(d.dateISO) >= todayISO),
  );
  const day = data.days[index] ?? data.days[data.days.length - 1];

  if (!day || !day.blocks.some((b) => b.shots.length > 0 || b.scene)) {
    return (
      <EmptyState
        title="Aún no hay orden de rodaje"
        description="El día de rodaje en directo sigue el orden de rodaje de cada jornada. Organiza los planos en el plan de rodaje y vuelve aquí el día que ruedes."
        actionLabel="Ir al plan de rodaje"
        actionHref={`/app/${projectId}/plan-de-rodaje`}
        preview="jornadas"
      />
    );
  }

  const dayIdx = data.days.indexOf(day);
  const next = data.days[dayIdx + 1];
  const consecutive =
    next && Math.round((Date.parse(dayKey(next.dateISO)) - Date.parse(dayKey(day.dateISO))) / 86_400_000) === 1 ? next : null;

  const shotIds = day.blocks.flatMap((b) => b.shots.map((s) => s.id));
  const sceneIds = [...new Set(day.blocks.flatMap((b) => [...b.shots.map((s) => s.sceneId), ...(b.scene ? [b.scene.id] : [])]))];

  const [shotExtras, frames, takes, breakdown] = await Promise.all([
    prisma.shot.findMany({ where: { id: { in: shotIds } }, select: { id: true, lens: true, shotSize: true } }),
    prisma.storyboardFrame.findMany({
      where: { shotId: { in: shotIds }, imageUrl: { not: null } },
      orderBy: { order: "asc" },
      select: { shotId: true, imageUrl: true },
    }),
    prisma.clapLog.findMany({
      where: { projectId, sceneId: { in: sceneIds } },
      orderBy: [{ take: "asc" }, { createdAt: "asc" }],
      select: { id: true, sceneId: true, shotNumber: true, take: true, good: true, notes: true, createdAt: true },
    }),
    prisma.sceneBreakdownElement.findMany({
      where: { sceneId: { in: sceneIds } },
      select: { sceneId: true, breakdownElement: { select: { name: true, category: true } } },
    }),
  ]);

  const date = new Date(day.dateISO);
  const sunrise = sunriseMinutes(date, day.lat ?? undefined, day.lng ?? undefined);
  const firstFrame = new Map<string, string>();
  for (const f of frames) if (f.imageUrl && !firstFrame.has(f.shotId)) firstFrame.set(f.shotId, f.imageUrl);

  const nextTimeline = consecutive
    ? computeDayTimeline({ date: new Date(consecutive.dateISO), callTime: consecutive.callTime, prepMin: consecutive.prepMin, blocks: consecutive.blocks, lat: consecutive.lat, lng: consecutive.lng })
    : null;

  const live: LiveDayData = {
    projectId,
    projectName: project.name,
    day: {
      id: day.id,
      dateISO: day.dateISO,
      title: day.title,
      dateLabel: day.dateLabel,
      callTime: day.callTime,
      prepMin: day.prepMin,
      lat: day.lat,
      lng: day.lng,
      locations: day.locations,
      blocks: day.blocks,
    },
    dayNumber: dayIdx + 1,
    dayCount: data.days.length,
    days: data.days.map((d) => ({ id: d.id, label: d.shortLabel })),
    workdayHours: data.workdayHours,
    sunrise,
    next: nextTimeline ? { title: consecutive!.title, windows: Object.fromEntries(nextTimeline.characterWindows) } : null,
    nextDayId: next?.id ?? null,
    scenes: Object.fromEntries(
      sceneIds.map((id) => {
        const s = data.scenes[id];
        return [
          id,
          {
            number: s.number,
            intExt: s.intExt,
            dayPart: s.dayPart,
            location: s.location,
            breakdown: breakdown
              .filter((b) => b.sceneId === id)
              .map((b) => ({ name: b.breakdownElement.name, category: BREAKDOWN_CATEGORY_LABELS[b.breakdownElement.category] })),
          },
        ];
      }),
    ),
    characters: data.characters,
    shots: Object.fromEntries(
      shotExtras.map((s) => [s.id, { lens: s.lens, frame: firstFrame.get(s.id) ?? null }]),
    ),
    takes: takes.map((t) => ({
      id: t.id,
      sceneId: t.sceneId,
      shotNumber: t.shotNumber,
      take: t.take,
      good: t.good,
      notes: t.notes,
      at: t.createdAt.toISOString(),
    })),
  };

  return <LiveDay data={live} />;
}
