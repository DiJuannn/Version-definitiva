"use client";

import { useEffect, useRef } from "react";
import {
  motion,
  useMotionValue,
  useReducedMotion,
  useSpring,
} from "motion/react";
import {
  AJOLOTE_BODY_PATHS,
  AJOLOTE_EYE,
  AJOLOTE_EYE_2,
  AJOLOTE_PUPIL_2_RADIUS,
  AJOLOTE_PUPIL_RADIUS,
  AJOLOTE_TAIL_GROOVE,
  AJOLOTE_VIEWBOX,
} from "@/lib/ajolote-shape";

const MAX_PUPIL_OFFSET = 3.4;
const MAX_PUPIL_OFFSET_2 = 2.1;

function useGazeSpring(initial: number) {
  const value = useMotionValue(initial);
  return { value, spring: useSpring(value, { stiffness: 220, damping: 18 }) };
}

export function AjoloteMascot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const eye1X = useGazeSpring(2);
  const eye1Y = useGazeSpring(2);
  const eye2X = useGazeSpring(2);
  const eye2Y = useGazeSpring(2);

  const eyeScaleY = useMotionValue(1);

  useEffect(() => {
    // El seguimiento del cursor responde directamente a una acción del
    // usuario (no es una animación autónoma), así que se mantiene activo
    // incluso con prefers-reduced-motion.
    let frame = 0;
    function handlePointerMove(e: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const svg = svgRef.current;
        if (!svg) return;
        const rect = svg.getBoundingClientRect();
        const toScreen = (px: number, py: number) => ({
          x: rect.left + (px / 220) * rect.width,
          y: rect.top + (py / 200) * rect.height,
        });

        const p1 = toScreen(AJOLOTE_EYE.cx, AJOLOTE_EYE.cy);
        const angle1 = Math.atan2(e.clientY - p1.y, e.clientX - p1.x);
        eye1X.value.set(Math.cos(angle1) * MAX_PUPIL_OFFSET);
        eye1Y.value.set(Math.sin(angle1) * MAX_PUPIL_OFFSET);

        const p2 = toScreen(AJOLOTE_EYE_2.cx, AJOLOTE_EYE_2.cy);
        const angle2 = Math.atan2(e.clientY - p2.y, e.clientX - p2.x);
        eye2X.value.set(Math.cos(angle2) * MAX_PUPIL_OFFSET_2);
        eye2Y.value.set(Math.sin(angle2) * MAX_PUPIL_OFFSET_2);
      });
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(frame);
    };
  }, [eye1X.value, eye1Y.value, eye2X.value, eye2Y.value]);

  useEffect(() => {
    if (prefersReducedMotion) return;

    let timeout: ReturnType<typeof setTimeout>;
    function scheduleBlink() {
      timeout = setTimeout(
        () => {
          eyeScaleY.set(0.1);
          setTimeout(() => eyeScaleY.set(1), 120);
          scheduleBlink();
        },
        3000 + Math.random() * 4000,
      );
    }
    scheduleBlink();
    return () => clearTimeout(timeout);
  }, [prefersReducedMotion, eyeScaleY]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-30 hidden sm:block">
      <motion.div
        animate={prefersReducedMotion ? undefined : { y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          ref={svgRef}
          viewBox={AJOLOTE_VIEWBOX}
          className="h-14 w-auto text-fg drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
          role="img"
          aria-hidden="true"
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
          <motion.g
            style={{
              scaleY: eyeScaleY,
              originX: `${AJOLOTE_EYE.cx}px`,
              originY: `${AJOLOTE_EYE.cy}px`,
            }}
          >
            <circle
              cx={AJOLOTE_EYE.cx}
              cy={AJOLOTE_EYE.cy}
              r={AJOLOTE_EYE.r}
              fill="var(--bg)"
            />
            <motion.circle
              cx={AJOLOTE_EYE.cx}
              cy={AJOLOTE_EYE.cy}
              r={AJOLOTE_PUPIL_RADIUS}
              fill="currentColor"
              style={{ x: eye1X.spring, y: eye1Y.spring }}
            />
          </motion.g>
          <motion.g
            style={{
              scaleY: eyeScaleY,
              originX: `${AJOLOTE_EYE_2.cx}px`,
              originY: `${AJOLOTE_EYE_2.cy}px`,
            }}
          >
            <circle
              cx={AJOLOTE_EYE_2.cx}
              cy={AJOLOTE_EYE_2.cy}
              r={AJOLOTE_EYE_2.r}
              fill="var(--bg)"
            />
            <motion.circle
              cx={AJOLOTE_EYE_2.cx}
              cy={AJOLOTE_EYE_2.cy}
              r={AJOLOTE_PUPIL_2_RADIUS}
              fill="currentColor"
              style={{ x: eye2X.spring, y: eye2Y.spring }}
            />
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}
