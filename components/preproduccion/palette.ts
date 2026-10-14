import { BreakdownCategory, DayPart, IntExt } from "@/lib/generated/prisma";

// Colores de producción de Guion, Desglose, Lista de planos y Storyboard.
// Son la excepción razonada a «todo por tokens» (docs/DISENO.md): en un
// desglose cada categoría tiene su color de siempre (reparto rojo, atrezzo
// violeta, vestuario azul…), y en la tira de escenas el color dice si es
// interior o exterior y de día o de noche, como en un stripboard. Todos
// están elegidos para leerse bien sobre la mesa oscura; un solo sitio para
// cambiarlos.

// Columnas del desglose: reparto y figuración salen de la escena (personajes
// marcados, notas de extras); el resto son las categorías de BreakdownElement.
export type BreakdownColumn = "CAST" | "EXTRAS" | BreakdownCategory;

export const BREAKDOWN_COLUMNS: {
  key: BreakdownColumn;
  short: string;
  label: string;
  color: string;
}[] = [
  { key: "CAST", short: "Reparto", label: "Reparto", color: "#f0716a" },
  { key: "EXTRAS", short: "Figur.", label: "Figuración", color: "#7fcf8e" },
  { key: "PROP", short: "Atrezzo", label: "Atrezzo", color: "#cf8ef2" },
  { key: "WARDROBE", short: "Vestuario", label: "Vestuario", color: "#6fb4f2" },
  { key: "MAKEUP_HAIR", short: "Maquill.", label: "Maquillaje y peluquería", color: "#f4a3be" },
  { key: "VEHICLE", short: "Vehíc.", label: "Vehículos", color: "#f2a65a" },
  { key: "VFX", short: "Efectos", label: "Efectos especiales", color: "#5fd0d9" },
  { key: "SOUND", short: "Sonido", label: "Sonido", color: "#c9a27a" },
  { key: "LIGHTING", short: "Luz", label: "Iluminación", color: "#ecd06a" },
  { key: "EQUIPMENT", short: "Material", label: "Material técnico", color: "#a9a8b4" },
];

export const CATEGORY_COLOR = Object.fromEntries(
  BREAKDOWN_COLUMNS.map((c) => [c.key, c.color]),
) as Record<BreakdownColumn, string>;

// Tira de escena: el color de stripboard de toda la vida (día interior
// claro, día exterior amarillo, noche interior azul, noche exterior verde),
// con atardecer/amanecer en naranja. Se usa como franja a la izquierda.
export function stripColor(intExt: IntExt, dayPart: DayPart): string {
  if (dayPart === "DUSK" || dayPart === "DAWN") return "#eba15c";
  const ext = intExt !== "INT";
  if (dayPart === "NIGHT") return ext ? "#5fbf86" : "#6e8ff0";
  return ext ? "#e8cf5e" : "#e6e3da";
}

export const STRIP_LEGEND: { label: string; color: string }[] = [
  { label: "Día int.", color: stripColor("INT", "DAY") },
  { label: "Día ext.", color: stripColor("EXT", "DAY") },
  { label: "Noche int.", color: stripColor("INT", "NIGHT") },
  { label: "Noche ext.", color: stripColor("EXT", "NIGHT") },
  { label: "Amanecer / atardecer", color: stripColor("EXT", "DUSK") },
];
