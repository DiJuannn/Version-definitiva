import type { Role, ShareScope } from "@prisma/client";

export type UserActor = {
  kind: "user";
  id: string;
  organizationId: string;
  role: Role;
  name: string;
  email: string;
  clientId: string | null;
  canViewFinance: boolean;
  canViewOwnPay: boolean;
  sessionId: string;
};

export type GuestLink = {
  id: string;
  scope: ShareScope;
  projectId: string;
  pieceId: string | null;
  versionId: string | null;
  canComment: boolean;
  canApprove: boolean;
  canDownload: boolean;
};

export type GuestActor = {
  kind: "guest";
  id: string;
  organizationId: string;
  name: string;
  email: string | null;
  link: GuestLink;
};

export type Actor = UserActor | GuestActor;

export const INTERNAL_ROLES: Role[] = ["ADMIN", "COORDINATOR", "EDITOR"];

/** Miembro de la agencia (ve contenido interno dentro de su ámbito). */
type WithRole<R extends Role> = UserActor & { role: R };

export function isInternal(a: Actor): a is WithRole<"ADMIN" | "COORDINATOR" | "EDITOR"> {
  return a.kind === "user" && INTERNAL_ROLES.includes(a.role);
}

export function isAdmin(a: Actor): a is WithRole<"ADMIN"> {
  return a.kind === "user" && a.role === "ADMIN";
}

export function isCoordinator(a: Actor): a is WithRole<"COORDINATOR"> {
  return a.kind === "user" && a.role === "COORDINATOR";
}

export function isEditor(a: Actor): a is WithRole<"EDITOR"> {
  return a.kind === "user" && a.role === "EDITOR";
}

export function isClientUser(a: Actor): a is WithRole<"CLIENT"> {
  return a.kind === "user" && a.role === "CLIENT";
}

/** Coordinador o administración: gestionan proyectos. */
export function isManager(a: Actor): a is WithRole<"ADMIN" | "COORDINATOR"> {
  return a.kind === "user" && (a.role === "ADMIN" || a.role === "COORDINATOR");
}

export function actorLabel(a: Actor): string {
  return a.kind === "guest" ? `${a.name} (invitado)` : a.name;
}
