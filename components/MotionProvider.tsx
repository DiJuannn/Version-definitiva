"use client";

import type { ReactNode } from "react";
import { MotionConfig } from "motion/react";

// Para TODA la web (pública y Taller): si el sistema pide "reducir
// movimiento", Motion quita los desplazamientos y escalados y deja solo los
// fundidos. La regla CSS de globals.css cubre las animaciones CSS; esto,
// las de Motion (que van por JavaScript y no las frena esa regla).
export function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}
