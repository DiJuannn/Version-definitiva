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

// Función 2 (plan Free, sin restricciones): bloque compacto, no una
// página aparte — solo las últimas entradas, sin paginación ni filtros.
export function ActivityFeed({ entries }: { entries: ActivityEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="mt-6 border border-line p-4">
      <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
        Actividad reciente
      </p>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => (
          <p key={entry.id} className="font-mono text-xs text-muted">
            <span className="text-fg">{entry.userName ?? "Alguien"}</span> {entry.summary} ·{" "}
            {relativeTime(entry.createdAt)}
          </p>
        ))}
      </div>
    </div>
  );
}
