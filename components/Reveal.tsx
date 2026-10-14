"use client";

import { motion } from "motion/react";
import { EASE, ENTER } from "@/lib/motion";
import type { ReactNode } from "react";

export function Reveal({
  children,
  delay = 0,
  className,
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
}) {
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: ENTER.public.y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0, margin: "0px 0px 200px 0px" }}
      transition={{ duration: ENTER.public.duration, delay, ease: EASE }}
    >
      {children}
    </motion.div>
  );
}
