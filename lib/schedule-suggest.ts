// Propuesta automática de plan de rodaje: reparte las escenas sin día en jornadas, juntando las de
// una misma localización y ordenando cada jornada por luz (amanecer → día → atardecer → noche).
// Solo propone: quien la use la revisa y la confirma. Sin base de datos ni fechas del servidor.

export type SuggestScene = {
  id: string;
  number: string;
  intExt: string;
  dayPart: "DAWN" | "DAY" | "DUSK" | "NIGHT" | string;
  locationId: string | null;
  locationName: string | null;
};

export type SuggestOptions = {
  // «YYYY-MM-DD»: primer día posible.
  startDate: string;
  perDay: number;
  weekendsOnly: boolean;
  // Fechas («YYYY-MM-DD») que ya tienen jornada y no se usan.
  takenDates?: string[];
};

export type SuggestedDay = { date: string; scenes: SuggestScene[]; locations: string[] };

const LIGHT_ORDER: Record<string, number> = { DAWN: 0, DAY: 1, DUSK: 2, NIGHT: 3 };

export function isValidDateKey(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(`${value}T00:00:00Z`).getTime());
}

function nextDate(key: string): string {
  const d = new Date(`${key}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

function isWeekend(key: string): boolean {
  const day = new Date(`${key}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

// `scenes` llega en el orden de la historia.
export function suggestSchedule(scenes: SuggestScene[], options: SuggestOptions): SuggestedDay[] {
  const perDay = Math.min(12, Math.max(1, Math.floor(options.perDay)));
  if (scenes.length === 0 || !isValidDateKey(options.startDate)) return [];

  const storyIndex = new Map(scenes.map((s, i) => [s.id, i]));

  // 1. Grupos por localización (las escenas sin localización, juntas y al final).
  const groups = new Map<string, SuggestScene[]>();
  for (const scene of scenes) {
    const key = scene.locationId ?? "__none__";
    groups.set(key, [...(groups.get(key) ?? []), scene]);
  }
  const ordered = [...groups.entries()].sort(([ka, a], [kb, b]) => {
    if (ka === "__none__") return 1;
    if (kb === "__none__") return -1;
    return b.length - a.length || storyIndex.get(a[0].id)! - storyIndex.get(b[0].id)!;
  });

  // 2. Trozos que caben en una jornada (un grupo grande se parte).
  const chunks: SuggestScene[][] = [];
  for (const [, group] of ordered) {
    for (let i = 0; i < group.length; i += perDay) chunks.push(group.slice(i, i + perDay));
  }
  // Los más grandes primero (mejor encaje); a igualdad, se respeta el orden anterior.
  chunks.sort((a, b) => b.length - a.length);

  // 3. Cada trozo, en la primera jornada donde quepa.
  const bins: SuggestScene[][] = [];
  for (const chunk of chunks) {
    const bin = bins.find((b) => b.length + chunk.length <= perDay);
    if (bin) bin.push(...chunk);
    else bins.push([...chunk]);
  }

  // 4. Dentro de cada jornada, por luz y después por historia; las jornadas, por donde empieza la historia.
  const days = bins.map((bin) =>
    [...bin].sort(
      (a, b) =>
        (LIGHT_ORDER[a.dayPart] ?? 1) - (LIGHT_ORDER[b.dayPart] ?? 1) || storyIndex.get(a.id)! - storyIndex.get(b.id)!,
    ),
  );
  days.sort((a, b) => Math.min(...a.map((s) => storyIndex.get(s.id)!)) - Math.min(...b.map((s) => storyIndex.get(s.id)!)));

  // 5. Fechas: desde la de inicio, saltando las ya ocupadas (y los días entre semana si se pide).
  const taken = new Set(options.takenDates ?? []);
  let cursor = options.startDate;
  return days.map((dayScenes) => {
    while (taken.has(cursor) || (options.weekendsOnly && !isWeekend(cursor))) cursor = nextDate(cursor);
    const date = cursor;
    cursor = nextDate(cursor);
    const locations = [...new Set(dayScenes.map((s) => s.locationName ?? "Sin localización"))];
    return { date, scenes: dayScenes, locations };
  });
}
