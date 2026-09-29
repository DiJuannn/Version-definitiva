import type {
  Availability,
  BlockerKind,
  CorrectionCategory,
  CorrectionStatus,
  FinanceKind,
  FinanceLineStatus,
  PieceStatus,
  Priority,
  ProjectStatus,
  Role,
  VersionStatus,
} from "@prisma/client";

/** Tono visual de un estado: define el color del chip. */
export type Tone = "neutral" | "info" | "progress" | "attention" | "success" | "danger" | "muted" | "marker";

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: "Administración",
  COORDINATOR: "Coordinación",
  EDITOR: "Edición",
  CLIENT: "Cliente",
};

export const PROJECT_STATUS: Record<ProjectStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Borrador", tone: "muted" },
  REQUESTED: { label: "Solicitado", tone: "attention" },
  ACTIVE: { label: "En marcha", tone: "progress" },
  ON_HOLD: { label: "En pausa", tone: "attention" },
  COMPLETED: { label: "Completado", tone: "success" },
  CANCELLED: { label: "Cancelado", tone: "muted" },
};

export const PIECE_STATUS: Record<PieceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "Borrador", tone: "muted" },
  PENDING_ASSIGNMENT: { label: "Pendiente de asignación", tone: "attention" },
  ASSIGNED: { label: "Asignada", tone: "info" },
  IN_EDIT: { label: "En edición", tone: "progress" },
  INTERNAL_REVIEW: { label: "Revisión interna", tone: "info" },
  CLIENT_REVIEW: { label: "En revisión del cliente", tone: "marker" },
  CHANGES_REQUESTED: { label: "Cambios solicitados", tone: "danger" },
  IN_CORRECTION: { label: "En corrección", tone: "progress" },
  APPROVED: { label: "Aprobada", tone: "success" },
  FINAL_DELIVERY: { label: "Entrega final", tone: "success" },
  COMPLETED: { label: "Completada", tone: "success" },
  CANCELLED: { label: "Cancelada", tone: "muted" },
};

/** Lo que ve el cliente: sin detalles del flujo interno de la agencia. */
export const CLIENT_PIECE_STATUS: Record<PieceStatus, { label: string; tone: Tone }> = {
  DRAFT: { label: "En preparación", tone: "muted" },
  PENDING_ASSIGNMENT: { label: "En preparación", tone: "muted" },
  ASSIGNED: { label: "En preparación", tone: "info" },
  IN_EDIT: { label: "En edición", tone: "progress" },
  INTERNAL_REVIEW: { label: "En edición", tone: "progress" },
  CLIENT_REVIEW: { label: "Lista para revisar", tone: "marker" },
  CHANGES_REQUESTED: { label: "Cambios pedidos", tone: "attention" },
  IN_CORRECTION: { label: "Aplicando cambios", tone: "progress" },
  APPROVED: { label: "Aprobada", tone: "success" },
  FINAL_DELIVERY: { label: "Entregada", tone: "success" },
  COMPLETED: { label: "Completada", tone: "success" },
  CANCELLED: { label: "Cancelada", tone: "muted" },
};

export function pieceStatusFor(role: string | null | undefined, status: PieceStatus) {
  return role === "CLIENT" ? CLIENT_PIECE_STATUS[status] : PIECE_STATUS[status];
}

export const VERSION_STATUS: Record<VersionStatus, { label: string; tone: Tone }> = {
  INTERNAL_REVIEW: { label: "Revisión interna", tone: "info" },
  INTERNAL_CHANGES: { label: "Cambios internos", tone: "danger" },
  CLIENT_REVIEW: { label: "Con el cliente", tone: "marker" },
  CHANGES_REQUESTED: { label: "Cambios solicitados", tone: "danger" },
  APPROVED: { label: "Aprobada", tone: "success" },
  SUPERSEDED: { label: "Sustituida", tone: "muted" },
};

export const CORRECTION_STATUS: Record<CorrectionStatus, { label: string; tone: Tone }> = {
  PENDING: { label: "Pendiente", tone: "attention" },
  IN_PROGRESS: { label: "En curso", tone: "progress" },
  RESOLVED: { label: "Resuelta por el equipo", tone: "info" },
  VERIFIED: { label: "Verificada", tone: "success" },
  DISMISSED: { label: "Descartada", tone: "muted" },
};

export const CATEGORY_LABEL: Record<CorrectionCategory, string> = {
  VIDEO: "Vídeo",
  AUDIO: "Audio",
  COLOR: "Color",
  SUBTITLES: "Subtítulos",
  MOTION_GRAPHICS: "Motion graphics",
  BRANDING: "Branding",
  OTHER: "Otro",
};

export const PRIORITY: Record<Priority, { label: string; tone: Tone }> = {
  LOW: { label: "Baja", tone: "muted" },
  NORMAL: { label: "Normal", tone: "neutral" },
  HIGH: { label: "Alta", tone: "attention" },
  URGENT: { label: "Urgente", tone: "danger" },
};

export const AVAILABILITY: Record<Availability, { label: string; tone: Tone }> = {
  AVAILABLE: { label: "Disponible", tone: "success" },
  LIMITED: { label: "Disponibilidad limitada", tone: "attention" },
  UNAVAILABLE: { label: "No disponible", tone: "muted" },
};

export const BLOCKER_KIND: Record<BlockerKind, string> = {
  MISSING_MATERIAL: "Falta material",
  PENDING_DECISION: "Falta decisión",
  OTHER: "Otro bloqueo",
};

export const FINANCE_KIND: Record<FinanceKind, string> = {
  REVENUE: "Precio al cliente",
  DISCOUNT: "Descuento",
  EDITOR_COST: "Coste de edición",
  OTHER_COST: "Otro coste",
};

export const FINANCE_STATUS: Record<FinanceLineStatus, string> = {
  ESTIMATED: "Estimado",
  CONFIRMED: "Confirmado",
  SETTLED: "Liquidado",
};
