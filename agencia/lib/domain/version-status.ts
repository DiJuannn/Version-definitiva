import type { VersionStatus } from "@prisma/client";

/**
 * Estados de la VERSIÓN (un montaje concreto: V1, V2...).
 * - Interna hasta que alguien la publica (publishedAt).
 * - APPROVED es definitiva: la versión queda bloqueada.
 */
export const VERSION_TRANSITIONS: Record<VersionStatus, VersionStatus[]> = {
  INTERNAL_REVIEW: ["CLIENT_REVIEW", "INTERNAL_CHANGES", "SUPERSEDED"],
  INTERNAL_CHANGES: ["CLIENT_REVIEW", "SUPERSEDED"],
  CLIENT_REVIEW: ["APPROVED", "CHANGES_REQUESTED", "SUPERSEDED"],
  CHANGES_REQUESTED: ["APPROVED", "SUPERSEDED"],
  // Solo por revocación explícita de administración (queda registrada).
  APPROVED: ["CLIENT_REVIEW"],
  SUPERSEDED: [],
};

export function canTransitionVersion(from: VersionStatus, to: VersionStatus): boolean {
  return VERSION_TRANSITIONS[from].includes(to);
}

export function isPublished(v: { publishedAt: Date | null }): boolean {
  return v.publishedAt !== null;
}

/** Versiones sobre las que el cliente todavía puede decidir. */
export function isDecidable(status: VersionStatus): boolean {
  return status === "CLIENT_REVIEW" || status === "CHANGES_REQUESTED";
}

export function versionLabel(n: number): string {
  return `V${n}`;
}
