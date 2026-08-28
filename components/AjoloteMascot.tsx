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
  AJOLOTE_PUPIL_RADIUS,
  AJOLOTE_VIEWBOX,
} from "@/lib/ajolote-shape";

const MAX_PUPIL_OFFSET = 4.5;

export function AjoloteMascot() {
  const svgRef = useRef<SVGSVGElement>(null);
  const prefersReducedMotion = useReducedMotion();

  const pupilX = useMotionValue(3);
  const pupilY = useMotionValue(3);
  const springX = useSpring(pupilX, { stiffness: 220, damping: 18 });
  const springY = useSpring(pupilY, { stiffness: 220, damping: 18 });

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
        const eyeScreenX = rect.left + (AJOLOTE_EYE.cx / 240) * rect.width;
        const eyeScreenY = rect.top + (AJOLOTE_EYE.cy / 180) * rect.height;
        const angle = Math.atan2(
          e.clientY - eyeScreenY,
          e.clientX - eyeScreenX,
        );
        pupilX.set(Math.cos(angle) * MAX_PUPIL_OFFSET);
        pupilY.set(Math.sin(angle) * MAX_PUPIL_OFFSET);
      });
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(frame);
    };
  }, [pupilX, pupilY]);

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
        animate={
          prefersReducedMotion ? undefined : { y: [0, -6, 0] }
        }
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <svg
          ref={svgRef}
          viewBox={AJOLOTE_VIEWBOX}
          className="h-12 w-auto text-fg drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
          role="img"
          aria-hidden="true"
        >
          {AJOLOTE_BODY_PATHS.map((d, i) => (
            <path key={i} d={d} fill="currentColor" />
          ))}
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
              style={{ x: springX, y: springY }}
            />
          </motion.g>
        </svg>
      </motion.div>
    </div>
  );
}
