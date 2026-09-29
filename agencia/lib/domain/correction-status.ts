import type { CorrectionStatus } from "@prisma/client";

/**
 * PENDIENTE → EN CURSO → RESUELTA (por el equipo) → VERIFICADA (por quien la pidió
 * o por coordinación). "Resuelta" NUNCA equivale a "vídeo aprobado".
 */
export type CorrectionActorKind = "team" | "reviewer";

type Rule = { to: CorrectionStatus; by: CorrectionActorKind[] };

export const CORRECTION_TRANSITIONS: Record<CorrectionStatus, Rule[]> = {
  PENDING: [
    { to: "IN_PROGRESS", by: ["team"] },
    { to: "RESOLVED", by: ["team"] },
    { to: "DISMISSED", by: ["team", "reviewer"] },
  ],
  IN_PROGRESS: [
    { to: "RESOLVED", by: ["team"] },
    { to: "PENDING", by: ["team"] },
    { to: "DISMISSED", by: ["team", "reviewer"] },
  ],
  RESOLVED: [
    { to: "VERIFIED", by: ["reviewer", "team"] },
    { to: "PENDING", by: ["reviewer", "team"] },
  ],
  VERIFIED: [{ to: "PENDING", by: ["reviewer", "team"] }],
  DISMISSED: [{ to: "PENDING", by: ["reviewer", "team"] }],
};

export function canTransitionCorrection(
  from: CorrectionStatus,
  to: CorrectionStatus,
  by: CorrectionActorKind,
): boolean {
  return CORRECTION_TRANSITIONS[from].some((r) => r.to === to && r.by.includes(by));
}

export function allowedCorrectionTargets(from: CorrectionStatus, by: CorrectionActorKind): CorrectionStatus[] {
  return CORRECTION_TRANSITIONS[from].filter((r) => r.by.includes(by)).map((r) => r.to);
}

/** Abiertas = aún requieren trabajo del equipo. */
export const OPEN_CORRECTION: CorrectionStatus[] = ["PENDING", "IN_PROGRESS"];
/** Esperando verificación (resueltas por el equipo, no confirmadas). */
export const AWAITING_VERIFICATION: CorrectionStatus[] = ["RESOLVED"];
