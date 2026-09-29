import type { PieceStatus, Role } from "@prisma/client";

/**
 * Máquina de estados de la PIEZA (unidad de trabajo que se entrega).
 * El proyecto y la versión tienen estados propios (ver project-status.ts y
 * version-status.ts); aquí solo se decide el flujo operativo de la pieza.
 *
 * `auto` = la transición la dispara el sistema como consecuencia de otra
 * acción (asignar editor, subir versión, publicar, aprobar...).
 */
type Rule = { to: PieceStatus; roles: Role[]; auto?: boolean };

const M: Role[] = ["ADMIN", "COORDINATOR"];
const ME: Role[] = ["ADMIN", "COORDINATOR", "EDITOR"];

export const PIECE_TRANSITIONS: Record<PieceStatus, Rule[]> = {
  DRAFT: [
    { to: "PENDING_ASSIGNMENT", roles: M },
    { to: "CANCELLED", roles: M },
  ],
  PENDING_ASSIGNMENT: [
    { to: "ASSIGNED", roles: M, auto: true },
    { to: "CANCELLED", roles: M },
  ],
  ASSIGNED: [
    { to: "IN_EDIT", roles: ME },
    { to: "PENDING_ASSIGNMENT", roles: M, auto: true },
    { to: "INTERNAL_REVIEW", roles: ME, auto: true },
    { to: "CANCELLED", roles: M },
  ],
  IN_EDIT: [
    { to: "INTERNAL_REVIEW", roles: ME, auto: true },
    // Publicar una versión con cambios internos pendientes (decisión de coordinación).
    { to: "CLIENT_REVIEW", roles: M, auto: true },
    { to: "PENDING_ASSIGNMENT", roles: M, auto: true },
    { to: "CANCELLED", roles: M },
  ],
  INTERNAL_REVIEW: [
    { to: "CLIENT_REVIEW", roles: M, auto: true },
    { to: "IN_EDIT", roles: M, auto: true },
    { to: "IN_CORRECTION", roles: M, auto: true },
    { to: "INTERNAL_REVIEW", roles: ME, auto: true },
    { to: "CANCELLED", roles: M },
  ],
  CLIENT_REVIEW: [
    { to: "CHANGES_REQUESTED", roles: ["ADMIN", "COORDINATOR", "CLIENT"], auto: true },
    { to: "APPROVED", roles: ["ADMIN", "COORDINATOR", "CLIENT"], auto: true },
    { to: "INTERNAL_REVIEW", roles: ME, auto: true },
    { to: "CANCELLED", roles: M },
  ],
  CHANGES_REQUESTED: [
    { to: "IN_CORRECTION", roles: ME },
    { to: "INTERNAL_REVIEW", roles: ME, auto: true },
    { to: "APPROVED", roles: ["ADMIN", "COORDINATOR", "CLIENT"], auto: true },
    { to: "CANCELLED", roles: M },
  ],
  IN_CORRECTION: [
    { to: "INTERNAL_REVIEW", roles: ME, auto: true },
    { to: "CLIENT_REVIEW", roles: M, auto: true },
    { to: "CANCELLED", roles: M },
  ],
  APPROVED: [
    { to: "FINAL_DELIVERY", roles: M, auto: true },
    { to: "INTERNAL_REVIEW", roles: ME, auto: true },
    { to: "CLIENT_REVIEW", roles: ["ADMIN"], auto: true },
  ],
  FINAL_DELIVERY: [
    { to: "COMPLETED", roles: M },
    { to: "APPROVED", roles: ["ADMIN"] },
  ],
  COMPLETED: [{ to: "FINAL_DELIVERY", roles: ["ADMIN"] }],
  CANCELLED: [{ to: "PENDING_ASSIGNMENT", roles: ["ADMIN"] }],
};

export function canTransitionPiece(from: PieceStatus, to: PieceStatus, role: Role | "SYSTEM"): boolean {
  const rule = PIECE_TRANSITIONS[from].find((r) => r.to === to);
  if (!rule) return false;
  if (role === "SYSTEM") return true;
  return rule.roles.includes(role);
}

/** Transiciones que una persona puede pedir manualmente desde la interfaz. */
export function manualPieceTransitions(from: PieceStatus, role: Role): PieceStatus[] {
  return PIECE_TRANSITIONS[from].filter((r) => !r.auto && r.roles.includes(role)).map((r) => r.to);
}

export const ACTIVE_PIECE_STATUSES: PieceStatus[] = [
  "PENDING_ASSIGNMENT",
  "ASSIGNED",
  "IN_EDIT",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "CHANGES_REQUESTED",
  "IN_CORRECTION",
  "APPROVED",
  "FINAL_DELIVERY",
];

/** Estados en los que la pieza consume capacidad del editor. */
export const LOAD_PIECE_STATUSES: PieceStatus[] = [
  "ASSIGNED",
  "IN_EDIT",
  "INTERNAL_REVIEW",
  "CLIENT_REVIEW",
  "CHANGES_REQUESTED",
  "IN_CORRECTION",
];

/** Con quién está la pelota: sirve para "próximas acciones". */
export function pieceBallInCourt(status: PieceStatus): "agency" | "editor" | "coordinator" | "client" | "none" {
  switch (status) {
    case "DRAFT":
    case "PENDING_ASSIGNMENT":
    case "INTERNAL_REVIEW":
    case "APPROVED":
      return "coordinator";
    case "ASSIGNED":
    case "IN_EDIT":
    case "CHANGES_REQUESTED":
    case "IN_CORRECTION":
      return "editor";
    case "CLIENT_REVIEW":
      return "client";
    case "FINAL_DELIVERY":
      return "agency";
    default:
      return "none";
  }
}

/** Riesgo de retraso según fecha y estado. */
export function pieceRisk(
  status: PieceStatus,
  dueDate: Date | null,
  now = new Date(),
): "late" | "at_risk" | "ok" | "none" {
  if (!dueDate || status === "COMPLETED" || status === "CANCELLED") return "none";
  const ms = dueDate.getTime() - now.getTime();
  if (ms < 0 && status !== "FINAL_DELIVERY") return "late";
  if (ms < 0) return "ok";
  const days = ms / 86400_000;
  const early = ["DRAFT", "PENDING_ASSIGNMENT", "ASSIGNED", "IN_EDIT"].includes(status);
  if (days < 2 && early) return "at_risk";
  if (days < 1 && status !== "APPROVED" && status !== "FINAL_DELIVERY") return "at_risk";
  return "ok";
}
