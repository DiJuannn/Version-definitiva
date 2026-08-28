"use client";

import Image from "next/image";
import { motion } from "motion/react";
import {
  AJOLOTE_IMAGE_HEIGHT,
  AJOLOTE_IMAGE_SRC,
  AJOLOTE_IMAGE_WIDTH,
} from "@/lib/ajolote-image";

type AjoloteLogoProps = {
  className?: string;
  animate?: boolean;
  priority?: boolean;
};

export function AjoloteLogo({
  className,
  animate = true,
  priority,
}: AjoloteLogoProps) {
  return (
    <motion.span
      className={`inline-block ${className ?? ""}`}
      initial={animate ? { opacity: 0, scale: 0.85 } : false}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
    >
      <Image
        src={AJOLOTE_IMAGE_SRC}
        alt="Versión definitiva"
        width={AJOLOTE_IMAGE_WIDTH}
        height={AJOLOTE_IMAGE_HEIGHT}
        priority={priority}
        className="h-full w-auto"
      />
    </motion.span>
  );
}
