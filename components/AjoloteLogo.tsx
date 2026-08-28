"use client";

import { motion } from "motion/react";
import {
  AJOLOTE_BODY_PATHS,
  AJOLOTE_EYE,
  AJOLOTE_EYE_2,
  AJOLOTE_PUPIL_2_RADIUS,
  AJOLOTE_PUPIL_RADIUS,
  AJOLOTE_PUPIL_REST_OFFSET,
  AJOLOTE_TAIL_GROOVE,
  AJOLOTE_VIEWBOX,
} from "@/lib/ajolote-shape";

type AjoloteLogoProps = {
  className?: string;
  animate?: boolean;
};

export function AjoloteLogo({ className, animate = true }: AjoloteLogoProps) {
  return (
    <motion.svg
      viewBox={AJOLOTE_VIEWBOX}
      className={className}
      role="img"
      aria-label="Versión definitiva"
      initial={animate ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      {AJOLOTE_BODY_PATHS.map((d, i) => (
        <path key={i} d={d} fill="currentColor" />
      ))}
      <path
        d={AJOLOTE_TAIL_GROOVE}
        stroke="var(--bg)"
        strokeWidth={1.5}
        fill="none"
        strokeLinecap="round"
      />
      <circle
        cx={AJOLOTE_EYE.cx}
        cy={AJOLOTE_EYE.cy}
        r={AJOLOTE_EYE.r}
        fill="var(--bg)"
      />
      <circle
        cx={AJOLOTE_EYE.cx + AJOLOTE_PUPIL_REST_OFFSET.x}
        cy={AJOLOTE_EYE.cy + AJOLOTE_PUPIL_REST_OFFSET.y}
        r={AJOLOTE_PUPIL_RADIUS}
        fill="currentColor"
      />
      <circle
        cx={AJOLOTE_EYE_2.cx}
        cy={AJOLOTE_EYE_2.cy}
        r={AJOLOTE_EYE_2.r}
        fill="var(--bg)"
      />
      <circle
        cx={AJOLOTE_EYE_2.cx + AJOLOTE_PUPIL_REST_OFFSET.x}
        cy={AJOLOTE_EYE_2.cy + AJOLOTE_PUPIL_REST_OFFSET.y}
        r={AJOLOTE_PUPIL_2_RADIUS}
        fill="currentColor"
      />
    </motion.svg>
  );
}
