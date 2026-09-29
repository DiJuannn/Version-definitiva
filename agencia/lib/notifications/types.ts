export const NOTIFICATION_TYPES = {
  ASSIGNED: "Asignación de trabajo",
  NEW_VERSION: "Nueva versión para revisar internamente",
  VERSION_PUBLISHED: "Nueva versión publicada",
  INTERNAL_CHANGES: "Cambios internos solicitados",
  COMMENT: "Nuevo comentario",
  MENTION: "Mención",
  REPLY: "Respuesta a tu comentario",
  CORRECTION_RESOLVED: "Corrección resuelta",
  CORRECTION_REOPENED: "Corrección reabierta",
  CHANGES_REQUESTED: "El cliente pidió cambios",
  APPROVED: "Versión aprobada",
  BLOCKER: "Bloqueo",
  DUE_SOON: "Entrega próxima",
  DELIVERY: "Entrega final disponible",
} as const;

export type NotificationType = keyof typeof NOTIFICATION_TYPES;
