function petal(bx: number, by: number, tx: number, ty: number, width: number) {
  const dx = tx - bx;
  const dy = ty - by;
  const len = Math.hypot(dx, dy) || 1;
  const nx = (-dy / len) * width;
  const ny = (dx / len) * width;
  const midx = bx + dx * 0.5;
  const midy = by + dy * 0.5;
  return `M${bx},${by} Q${midx + nx},${midy + ny} ${tx},${ty} Q${midx - nx},${
    midy - ny
  } ${bx},${by} Z`;
}

const TAIL =
  "M15,52 C40,46 66,54 88,72 C95,78 97,82 98,86 C90,86 82,83 74,84 C55,78 34,70 17,63 Z";

const TAIL_GROOVE = "M22,57 C46,54 68,62 87,78";

const BODY =
  "M88,92 C86,64 108,52 138,54 C162,56 160,76 158,92 C157,116 152,148 122,158 C97,166 79,150 77,122 C76,110 80,99 88,92 Z";

const UPPER_GILLS = [
  petal(150, 80, 169, 72, 5),
  petal(153, 84, 175, 82, 5),
  petal(154, 90, 168, 94, 4.5),
  petal(152, 96, 158, 102, 4),
];

const LOWER_GILLS = [
  petal(131, 149, 151, 155, 5),
  petal(133, 154, 144, 163, 4.5),
  petal(129, 158, 135, 168, 4),
];

const TOP_LEGS = [petal(100, 76, 87, 69, 5), petal(112, 71, 98, 66, 5)];

const BACK_LEG = [petal(88, 106, 70, 113, 5), petal(96, 138, 89, 148, 4.5)];

export const AJOLOTE_VIEWBOX = "0 0 220 200";

export const AJOLOTE_BODY_PATHS = [
  TAIL,
  BODY,
  ...TOP_LEGS,
  ...BACK_LEG,
  ...UPPER_GILLS,
  ...LOWER_GILLS,
];

export const AJOLOTE_TAIL_GROOVE = TAIL_GROOVE;

export const AJOLOTE_EYE = { cx: 143, cy: 104, r: 9 };
export const AJOLOTE_EYE_2 = { cx: 140, cy: 140, r: 5.5 };
export const AJOLOTE_PUPIL_RADIUS = 3.6;
export const AJOLOTE_PUPIL_2_RADIUS = 2.2;
export const AJOLOTE_PUPIL_REST_OFFSET = { x: 2, y: 2 };
