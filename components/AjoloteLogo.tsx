"use client";

import { motion } from "motion/react";

type AjoloteLogoProps = {
  className?: string;
  playOnce?: boolean;
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

const ease = [0.65, 0, 0.35, 1] as const;

function strokeThenFill(delay: number, duration = 0.9) {
  return {
    initial: { pathLength: 0, opacity: 1, fillOpacity: 0 },
    animate: { pathLength: 1, fillOpacity: 1 },
    transition: {
      pathLength: { delay, duration, ease },
      fillOpacity: {
        delay: delay + duration,
        duration: 0.35,
        ease: "easeOut" as const,
      },
    },
  };
}

export function AjoloteLogo({ className, playOnce = true }: AjoloteLogoProps) {
  return (
    <motion.svg
      viewBox="0 0 240 180"
      className={className}
      role="img"
      aria-label="Versión definitiva"
      initial={playOnce ? "hidden" : false}
      animate="visible"
    >
      <motion.path
        d={TAIL}
        stroke="var(--ink)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="var(--ink)"
        {...strokeThenFill(0, 0.7)}
      />
      <motion.path
        d={BODY}
        stroke="var(--ink)"
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="var(--ink)"
        {...strokeThenFill(0.5, 1)}
      />
      {[...TOP_LEGS, ...BACK_LEG].map((d, i) => (
        <motion.path
          key={`leg-${i}`}
          d={d}
          stroke="var(--ink)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="var(--ink)"
          {...strokeThenFill(1.2 + i * 0.08, 0.4)}
        />
      ))}
      {[...UPPER_GILLS, ...LOWER_GILLS].map((d, i) => (
        <motion.path
          key={`gill-${i}`}
          d={d}
          stroke="var(--ink)"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          fill="var(--ink)"
          {...strokeThenFill(1.4 + i * 0.08, 0.4)}
        />
      ))}
      <motion.circle
        cx={EYE.cx}
        cy={EYE.cy}
        r={EYE.r}
        fill="var(--paper)"
        stroke="var(--ink)"
        strokeWidth={3}
        initial={{ pathLength: 0, opacity: 0 }}
        animate={{ pathLength: 1, opacity: 1 }}
        transition={{ delay: 1.7, duration: 0.5, ease }}
      />
      <motion.circle
        cx={PUPIL.cx}
        cy={PUPIL.cy}
        r={PUPIL.r}
        fill="var(--ink)"
        style={{ originX: `${PUPIL.cx}px`, originY: `${PUPIL.cy}px` }}
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 2, duration: 0.5, type: "spring", stiffness: 320, damping: 14 }}
      />
    </motion.svg>
  );
}
