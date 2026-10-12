// Iniciales de una persona o personaje en un círculo de color. El color sale
// del nombre (siempre el mismo para la misma persona en todas las pantallas).
const COLORS = ["#f0a6c8", "#8fd3d0", "#c7b8f0", "#f2c48d", "#a6d98f", "#9fbef2", "#f29a8f", "#d9d08f"];

function colorFor(name: string): string {
  // FNV-1a: reparte mejor nombres parecidos (Sara / Samuel) entre colores.
  let hash = 0x811c9dc5;
  for (const ch of name.trim().toLowerCase()) hash = Math.imul(hash ^ ch.charCodeAt(0), 0x01000193) >>> 0;
  return COLORS[hash % COLORS.length];
}

export function initialsOf(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[1][0]).toUpperCase();
}

export function PersonInitials({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      title={name}
      aria-hidden
      className={`inline-grid shrink-0 place-items-center rounded-full font-bold text-bg ${
        size === "sm" ? "h-6 w-6 text-[0.6875rem]" : "h-7 w-7 text-xs"
      }`}
      style={{ background: colorFor(name) }}
    >
      {initialsOf(name)}
    </span>
  );
}

// Varias personas superpuestas (con sus nombres para el lector de pantalla).
export function PeopleStack({ names, max = 4 }: { names: string[]; max?: number }) {
  if (names.length === 0) return <span className="text-muted">—</span>;
  const shown = names.slice(0, max);
  return (
    <span className="inline-flex items-center" title={names.join(", ")}>
      <span className="sr-only">{names.join(", ")}</span>
      {shown.map((name, i) => (
        <span key={name + i} className={`rounded-full ring-2 ring-bg ${i > 0 ? "-ml-1.5" : ""}`}>
          <PersonInitials name={name} size="sm" />
        </span>
      ))}
      {names.length > max && <span className="ml-1.5 text-xs text-muted">+{names.length - max}</span>}
    </span>
  );
}
