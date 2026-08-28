"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";

type RecMark = { id: number; x: number; y: number };

export function CustomCursor() {
  const [marks, setMarks] = useState<RecMark[]>([]);
  const nextId = useRef(0);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const id = nextId.current++;
      setMarks((prev) => [...prev, { id, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setMarks((prev) => prev.filter((m) => m.id !== id));
      }, 900);
    }

    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, []);

  return (
    <div className="pointer-events-none fixed inset-0 z-[90]">
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
