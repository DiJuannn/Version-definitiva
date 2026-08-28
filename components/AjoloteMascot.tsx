"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { motion, useMotionValue, useSpring } from "motion/react";
import {
  AJOLOTE_EYES,
  AJOLOTE_IMAGE_HEIGHT,
  AJOLOTE_IMAGE_SRC,
  AJOLOTE_IMAGE_WIDTH,
  AJOLOTE_MAX_PUPIL_OFFSET_FRAC,
  AJOLOTE_PUPIL_COVER_RADIUS_FRAC,
  AJOLOTE_PUPIL_RADIUS_FRAC,
} from "@/lib/ajolote-image";

function useGazeSpring() {
  const value = useMotionValue(0);
  return { value, spring: useSpring(value, { stiffness: 220, damping: 18 }) };
}

function Pupil({
  eye,
  offsetX,
  offsetY,
}: {
  eye: { xFrac: number; yFrac: number };
  offsetX: ReturnType<typeof useGazeSpring>["spring"];
  offsetY: ReturnType<typeof useGazeSpring>["spring"];
}) {
  const coverSize = `${AJOLOTE_PUPIL_COVER_RADIUS_FRAC * 2 * 100}%`;
  const pupilSize = `${AJOLOTE_PUPIL_RADIUS_FRAC * 2 * 100}%`;

  return (
    <div
      className="absolute rounded-full bg-black"
      style={{
        left: `${eye.xFrac * 100}%`,
        top: `${eye.yFrac * 100}%`,
        width: coverSize,
        height: coverSize,
        transform: "translate(-50%, -50%)",
      }}
    >
      <motion.div
        className="absolute rounded-full bg-black"
        style={{
          left: "50%",
          top: "50%",
          width: pupilSize,
          height: pupilSize,
          marginLeft: `-${AJOLOTE_PUPIL_RADIUS_FRAC * 100}%`,
          marginTop: `-${AJOLOTE_PUPIL_RADIUS_FRAC * 100}%`,
          x: offsetX,
          y: offsetY,
        }}
      />
    </div>
  );
}

export function AjoloteMascot() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  const leftX = useGazeSpring();
  const leftY = useGazeSpring();
  const rightX = useGazeSpring();
  const rightY = useGazeSpring();

  useEffect(() => {
    // El seguimiento del cursor responde directamente a una acción del
    // usuario (no es una animación autónoma), así que se mantiene activo
    // incluso con prefers-reduced-motion.
    let frame = 0;
    function handlePointerMove(e: PointerEvent) {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const el = wrapperRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const maxOffset = AJOLOTE_MAX_PUPIL_OFFSET_FRAC * rect.width;

        const gaze = (eye: { xFrac: number; yFrac: number }) => {
          const eyeScreenX = rect.left + eye.xFrac * rect.width;
          const eyeScreenY = rect.top + eye.yFrac * rect.height;
          const angle = Math.atan2(
            e.clientY - eyeScreenY,
            e.clientX - eyeScreenX,
          );
          return {
            x: Math.cos(angle) * maxOffset,
            y: Math.sin(angle) * maxOffset,
          };
        };

        const gl = gaze(AJOLOTE_EYES.left);
        leftX.value.set(gl.x);
        leftY.value.set(gl.y);

        const gr = gaze(AJOLOTE_EYES.right);
        rightX.value.set(gr.x);
        rightY.value.set(gr.y);
      });
    }

    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });
    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      cancelAnimationFrame(frame);
    };
  }, [leftX.value, leftY.value, rightX.value, rightY.value]);

  return (
    <div className="pointer-events-none fixed bottom-6 left-6 z-30 hidden sm:block">
      <motion.div
        animate={{ y: [0, -6, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
      >
        <div ref={wrapperRef} className="relative inline-block h-28 w-auto">
          <Image
            src={AJOLOTE_IMAGE_SRC}
            alt=""
            width={AJOLOTE_IMAGE_WIDTH}
            height={AJOLOTE_IMAGE_HEIGHT}
            aria-hidden
            priority
            className="block h-28 w-auto drop-shadow-[0_2px_8px_rgba(0,0,0,0.4)]"
          />
          <Pupil eye={AJOLOTE_EYES.left} offsetX={leftX.spring} offsetY={leftY.spring} />
          <Pupil eye={AJOLOTE_EYES.right} offsetX={rightX.spring} offsetY={rightY.spring} />
        </div>
      </motion.div>
    </div>
  );
}
