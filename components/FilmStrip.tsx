// La tira de película de Taller: el avance de un proyecto (o de una fase)
// como fotogramas. Cada tramo tiene su color y cuántos fotogramas de su
// parte están encendidos (0..1). Es decoración con significado: el texto
// de al lado dice lo mismo en palabras, así que se oculta a los lectores.
export function FilmStrip({
  segments,
  frames = 16,
  size = "md",
  className = "",
  highlight,
}: {
  segments: { color: string; done: number }[];
  // Fotogramas por tramo.
  frames?: number;
  size?: "sm" | "md";
  className?: string;
  // Color del contorno para destacar la tira (la fase en curso).
  highlight?: string;
}) {
  const cells: { color?: string; half?: string }[] = [];
  for (const seg of segments) {
    const lit = Math.max(0, Math.min(1, seg.done)) * frames;
    for (let i = 0; i < frames; i++) {
      if (i + 1 <= lit) cells.push({ color: seg.color });
      else if (i < lit) cells.push({ half: seg.color });
      else cells.push({});
    }
  }
  return (
    <div
      aria-hidden
      className={`film-strip ${size === "sm" ? "film-strip-sm" : ""} ${className}`}
      style={highlight ? { boxShadow: `0 0 0 2px ${highlight}` } : undefined}
    >
      {cells.map((c, i) => (
        <i
          key={i}
          style={
            c.color
              ? { background: c.color }
              : c.half
                ? { background: `linear-gradient(90deg, ${c.half} 50%, #1d1c22 50%)` }
                : undefined
          }
        />
      ))}
    </div>
  );
}

export const PHASE_COLORS = ["var(--phase-1)", "var(--phase-2)", "var(--phase-3)", "var(--phase-4)"] as const;
