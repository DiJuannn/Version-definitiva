"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring } from "motion/react";

const HOVER_SELECTOR = "a, button, [data-cursor-hover]";

type RecMark = { id: number; x: number; y: number };

export function CustomCursor() {
  const [enabled, setEnabled] = useState(false);
  const [hovering, setHovering] = useState(false);
  const [marks, setMarks] = useState<RecMark[]>([]);
  const nextId = useRef(0);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const springX = useSpring(x, { stiffness: 900, damping: 50, mass: 0.4 });
  const springY = useSpring(y, { stiffness: 900, damping: 50, mass: 0.4 });

  useEffect(() => {
    if (!window.matchMedia("(pointer: fine)").matches) return;
    // matchMedia solo existe en el cliente: el estado inicial debe ser
    // `false` (igual que en el servidor) para no desajustar la hidratación.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnabled(true);
    document.documentElement.classList.add("custom-cursor-active");

    function handleMove(e: PointerEvent) {
      x.set(e.clientX);
      y.set(e.clientY);
      const target = e.target as HTMLElement | null;
      setHovering(!!target?.closest(HOVER_SELECTOR));
    }

    function handleClick(e: MouseEvent) {
      const id = nextId.current++;
      setMarks((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setMarks((prev) => prev.filter((m) => m.id !== id));
      }, 900);
    }

    window.addEventListener("pointermove", handleMove, { passive: true });
    window.addEventListener("click", handleClick);
    return () => {
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("click", handleClick);
      document.documentElement.classList.remove("custom-cursor-active");
    };
  }, [x, y]);

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
      {enabled && (
        <motion.svg
          width="26"
          height="26"
          viewBox="0 0 24 24"
          fill="none"
          className={hovering ? "fixed left-0 top-0 text-accent" : "fixed left-0 top-0 text-fg"}
          style={{ x: springX, y: springY, translateX: "-50%", translateY: "-50%" }}
          animate={{ scale: hovering ? 1.35 : 1 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
        >
          <path d="M2 8V2H8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M16 2H22V8" stroke="currentColor" strokeWidth="1.5" />
          <path d="M22 16V22H16" stroke="currentColor" strokeWidth="1.5" />
          <path d="M8 22H2V16" stroke="currentColor" strokeWidth="1.5" />
        </motion.svg>
      )}
      <AnimatePresence>
        {marks.map((mark) => (
          <motion.div
            key={mark.id}
            className="absolute flex items-center gap-1.5 font-mono text-[11px] tracking-widest text-accent uppercase"
            style={{ left: mark.x, top: mark.y }}
            initial={{ opacity: 0, y: 0, scale: 0.9 }}
            animate={{ opacity: 1, y: -14, scale: 1 }}
            exit={{ opacity: 0, y: -26 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            REC
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
