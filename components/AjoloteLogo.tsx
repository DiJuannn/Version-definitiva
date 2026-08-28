"use client";

import { motion } from "motion/react";

type AjoloteLogoProps = {
  className?: string;
  animate?: boolean;
};

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
  "M12,52 C38,44 64,52 84,63 C93,68 98,73 102,80 C93,81 84,79 76,81 C57,74 36,68 16,62 Z";

const BODY =
  "M85,97 C85,59 117,42 158,42 C200,42 219,64 219,97 C219,130 200,152 158,152 C117,152 85,135 85,97 Z";

const UPPER_GILLS = [
  petal(199, 55, 226, 26, 7),
  petal(202, 60, 235, 40, 7),
  petal(203, 67, 238, 58, 6),
];

const LOWER_GILLS = [petal(191, 118, 212, 142, 6), petal(196, 123, 226, 130, 6)];

const TOP_LEGS = [petal(128, 46, 116, 20, 6), petal(143, 43, 146, 17, 6)];

const BACK_LEG = [petal(97, 140, 76, 163, 6)];

const EYE = { cx: 187, cy: 79, r: 11 };
const PUPIL = { cx: 190, cy: 82, r: 4.5 };

const ALL_PATHS = [TAIL, BODY, ...TOP_LEGS, ...BACK_LEG, ...UPPER_GILLS, ...LOWER_GILLS];

export function AjoloteLogo({ className, animate = true }: AjoloteLogoProps) {
  return (
    <motion.svg
      viewBox="0 0 240 180"
      className={className}
      role="img"
      aria-label="Versión definitiva"
      initial={animate ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {ALL_PATHS.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
      <circle cx={EYE.cx} cy={EYE.cy} r={EYE.r} fill="var(--bg)" />
      <circle cx={PUPIL.cx} cy={PUPIL.cy} r={PUPIL.r} fill="currentColor" />
    </motion.svg>
  );
}
