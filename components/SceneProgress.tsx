import { SCENE_STEPS, type SceneStatus } from "@/lib/scene-status";

// El estado de una escena en un círculo de cuatro cuartos, en el orden en que
// se hacen (desglose, planos, día, rodada) y con los colores de las fases.
// Cada cuarto se llena cuando ese paso está hecho.
export function SceneProgress({ status, size = 16, className = "" }: { status: SceneStatus; size?: number; className?: string }) {
  const r = 7;
  const done = SCENE_STEPS.filter((s) => status[s.key]);
  const label = done.length
    ? `${done.map((s) => s.label).join(", ")}${done.length < 4 ? ` · falta: ${SCENE_STEPS.filter((s) => !status[s.key]).map((s) => s.label.toLowerCase()).join(", ")}` : ""}`
    : "Sin empezar";
  // Cuarto i: de -90° + 90·i a -90° + 90·(i+1).
  const quarter = (i: number) => {
    const a0 = ((-90 + 90 * i) * Math.PI) / 180;
    const a1 = ((-90 + 90 * (i + 1)) * Math.PI) / 180;
    const p = (a: number) => `${8 + r * Math.cos(a)} ${8 + r * Math.sin(a)}`;
    return `M8 8 L${p(a0)} A${r} ${r} 0 0 1 ${p(a1)} Z`;
  };
  return (
    <svg viewBox="0 0 16 16" width={size} height={size} role="img" aria-label={label} className={`shrink-0 ${className}`}>
      <title>{label}</title>
      <circle cx="8" cy="8" r={r} fill="none" stroke="currentColor" strokeOpacity="0.28" strokeWidth="1" />
      {SCENE_STEPS.map((s, i) =>
        status[s.key] ? <path key={s.key} d={quarter(i)} fill={s.color} stroke="var(--bg, #111)" strokeWidth="0.6" /> : null,
      )}
    </svg>
  );
}
