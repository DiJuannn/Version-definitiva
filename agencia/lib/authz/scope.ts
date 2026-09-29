import type { Prisma } from "@prisma/client";
import type { Actor } from "./actor";

/**
 * Filtros de alcance: TODA consulta de datos de negocio debe combinarse con
 * estos filtros. Son la única fuente de verdad de "qué puede ver quién".
 */

export function projectScope(a: Actor): Prisma.ProjectWhereInput {
  const org = { organizationId: a.organizationId };
  if (a.kind === "guest") return { ...org, id: a.link.projectId };
  switch (a.role) {
    case "ADMIN":
      return org;
    case "COORDINATOR":
      return { ...org, OR: [{ coordinatorId: a.id }, { team: { coordinatorId: a.id } }] };
    case "EDITOR":
      return { ...org, pieces: { some: { editorId: a.id } } };
    case "CLIENT":
      // Los borradores internos de la agencia no se muestran al cliente.
      return a.clientId ? { ...org, clientId: a.clientId, status: { not: "DRAFT" } } : { id: "__none__" };
  }
}

export function pieceScope(a: Actor): Prisma.PieceWhereInput {
  const org = { organizationId: a.organizationId };
  if (a.kind === "guest") {
    if (a.link.scope === "PROJECT") return { ...org, projectId: a.link.projectId };
    if (a.link.scope === "PIECE") return { ...org, id: a.link.pieceId ?? "__none__" };
    return { ...org, versions: { some: { id: a.link.versionId ?? "__none__" } } };
  }
  switch (a.role) {
    case "ADMIN":
      return org;
    case "COORDINATOR":
      return { ...org, project: projectScope(a) };
    case "EDITOR":
      return { ...org, editorId: a.id };
    case "CLIENT":
      return { ...org, project: projectScope(a), status: { notIn: ["DRAFT"] } };
  }
}

export function versionScope(a: Actor): Prisma.VersionWhereInput {
  const base: Prisma.VersionWhereInput = { piece: pieceScope(a) };
  if (a.kind === "guest") {
    const published: Prisma.VersionWhereInput = { ...base, publishedAt: { not: null } };
    return a.link.scope === "VERSION" ? { ...published, id: a.link.versionId ?? "__none__" } : published;
  }
  if (a.role === "CLIENT") return { ...base, publishedAt: { not: null } };
  return base;
}

/** Visibilidad de comentarios: los internos nunca salen de la agencia. */
export function commentVisibility(a: Actor): Prisma.CommentWhereInput {
  if (a.kind === "user" && a.role !== "CLIENT") return {};
  return { visibility: "CLIENT" };
}

export function canSeeInternal(a: Actor): boolean {
  return a.kind === "user" && a.role !== "CLIENT";
}
