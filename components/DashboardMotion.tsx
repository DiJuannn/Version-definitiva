"use client";

import { Children, type ReactNode } from "react";
import { motion } from "motion/react";
import { EASE, ENTER, STAGGER } from "@/lib/motion";

const container = {
  hidden: {},
  show: { transition: { staggerChildren: STAGGER.taller } },
};

const item = {
  hidden: { opacity: 0, y: ENTER.taller.y },
  show: { opacity: 1, y: 0, transition: { duration: ENTER.taller.duration, ease: EASE } },
};

export function DashboardStagger({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <motion.div className={className} initial="hidden" animate="show" variants={container}>
      {Children.map(children, (child) => (
        <motion.div data-reveal className="contents" variants={item}>
          {child}
        </motion.div>
      ))}
    </motion.div>
  );
}

export function DashboardReveal({
  children,
  className,
  delay = 0,
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
}) {
  return (
    <motion.div
      data-reveal
      className={className}
      initial={{ opacity: 0, y: ENTER.taller.y }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: ENTER.taller.duration, ease: EASE, delay }}
    >
      {children}
    </motion.div>
  );
}
