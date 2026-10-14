import type { DayPart, IntExt } from "@/lib/generated/prisma";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";

// Color de tira de cada escena: el código clásico del plan de rodaje
// (interior día blanco, exterior día amarillo, interior noche azul, exterior
// noche verde), y naranja para amanecer/atardecer. INT/EXT cuenta como
// exterior. Las variables están en globals.css.
export function sceneStripColor(intExt: IntExt, dayPart: DayPart): string {
  if (dayPart === "DAWN" || dayPart === "DUSK") return "var(--strip-twilight)";
  const ext = intExt !== "INT";
  if (dayPart === "NIGHT") return ext ? "var(--strip-ext-night)" : "var(--strip-int-night)";
  return ext ? "var(--strip-ext-day)" : "var(--strip-int-day)";
}

// Etiqueta "EXT · Día" con el color de la tira.
export function SceneTag({
  intExt,
  dayPart,
  className = "",
}: {
  intExt: IntExt;
  dayPart: DayPart;
  className?: string;
}) {
  return (
    <span
      className={`inline-flex h-[1.375rem] shrink-0 items-center rounded px-2 text-xs font-semibold whitespace-nowrap text-bg ${className}`}
      style={{ background: sceneStripColor(intExt, dayPart) }}
    >
      {INT_EXT_LABELS[intExt]} · {DAY_PART_LABELS[dayPart]}
    </span>
  );
}
