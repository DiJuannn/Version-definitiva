// Tipos como literales (no del cliente de Prisma) para poder usarlo en
// componentes de cliente.
type IntExt = "INT" | "EXT" | "INT_EXT";
type DayPart = "DAY" | "NIGHT" | "DUSK" | "DAWN";

// Colores de las tiras del plan de rodaje (stripboard). Es la convención de
// producción de toda la vida, con tonos algo apagados para que no deslumbren
// sobre la mesa oscura:
//   INT día → blanco roto · EXT día → amarillo · INT noche → azul ·
//   EXT noche → verde. Amanecer y atardecer (luz mágica) van aparte: rosa en
//   interior, naranja en exterior. INT/EXT cuenta como exterior.
// Todas llevan texto oscuro (contraste AA de sobra). Es el único sitio donde
// se definen: plan de rodaje, ficha del día y hoja de llamada leen de aquí.

export type StripTone = {
  key: string;
  label: string;
  bg: string;
  fg: string;
};

const TONES = {
  intDay: { key: "intDay", label: "INT día", bg: "#e7e3d8", fg: "#1b1a1f" },
  extDay: { key: "extDay", label: "EXT día", bg: "#e6cd6a", fg: "#1b1a1f" },
  intNight: {
    key: "intNight",
    label: "INT noche",
    bg: "#86a8de",
    fg: "#10141f",
  },
  extNight: {
    key: "extNight",
    label: "EXT noche",
    bg: "#7fc092",
    fg: "#0f1a13",
  },
  intMagic: {
    key: "intMagic",
    label: "INT amanecer/atardecer",
    bg: "#e4b6c8",
    fg: "#1f1217",
  },
  extMagic: {
    key: "extMagic",
    label: "EXT amanecer/atardecer",
    bg: "#e8a873",
    fg: "#21140a",
  },
} satisfies Record<string, StripTone>;

export const STRIP_LEGEND: StripTone[] = [
  TONES.intDay,
  TONES.extDay,
  TONES.intNight,
  TONES.extNight,
  { ...TONES.extMagic, label: "Amanecer / atardecer" },
];

// Tira del día (separa jornadas): negra, como en el tablero de verdad.
export const DAY_STRIP = { bg: "#060607", fg: "#f2f0ea" } as const;

export function stripTone(
  intExt: IntExt | string,
  dayPart: DayPart | string,
): StripTone {
  const exterior = intExt !== "INT";
  if (dayPart === "NIGHT") return exterior ? TONES.extNight : TONES.intNight;
  if (dayPart === "DAWN" || dayPart === "DUSK")
    return exterior ? TONES.extMagic : TONES.intMagic;
  return exterior ? TONES.extDay : TONES.intDay;
}
