export type ActivityEntry = {
  id: string;
  summary: string;
  createdAt: Date;
  userName: string | null;
};

// "Hace 2 horas", "ayer", "hace 3 días"... se calcula al mostrarlo, no al
// guardar el registro (ver lib/activity-log.ts).
function relativeTime(date: Date): string {
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "ahora mismo";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.round(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.round(diffHours / 24);
  if (diffDays === 1) return "ayer";
  if (diffDays < 7) return `hace ${diffDays} días`;
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// Función 2 (plan Free, sin restricciones): solo las últimas entradas, sin paginación ni filtros.
// Filas sobre el papel: quién y qué a la izquierda, cuándo a la derecha.
export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <section aria-labelledby="activity-title">
      <h2 id="activity-title" className="font-display text-xl font-black tracking-tight">
        Actividad
      </h2>
      <ul className="mt-4 divide-y divide-line border-y border-line">
        {entries.map((entry) => (
          <li key={entry.id} className="flex items-baseline justify-between gap-4 py-3">
            <p className="min-w-0 font-sans text-sm leading-snug text-muted">
              <span className="font-semibold text-fg">{entry.userName ?? "Alguien"}</span> {entry.summary}
            </p>
            <span className="shrink-0 font-mono text-[11px] text-muted">{relativeTime(entry.createdAt)}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}
