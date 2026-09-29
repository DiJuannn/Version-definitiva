import "server-only";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/http/errors";
import { isManager, type Actor, type UserActor } from "./actor";
import { pieceScope, projectScope, versionScope } from "./scope";

/** Carga un proyecto dentro del alcance del actor o lanza 404. */
export async function loadProject(a: Actor, projectId: string) {
  const p = await db.project.findFirst({ where: { AND: [{ id: projectId }, projectScope(a)] } });
  if (!p) throw notFound("Proyecto");
  return p;
}

export async function loadPiece(a: Actor, pieceId: string) {
  const p = await db.piece.findFirst({ where: { AND: [{ id: pieceId }, pieceScope(a)] }, include: { project: true } });
  if (!p) throw notFound("Pieza");
  return p;
}

export async function loadVersion(a: Actor, versionId: string) {
  const v = await db.version.findFirst({
    where: { AND: [{ id: versionId }, versionScope(a)] },
    include: { piece: { include: { project: true } } },
  });
  if (!v) throw notFound("Versión");
  return v;
}

/** Gestión (admin o coordinador con el proyecto en su ámbito). */
export async function requireProjectManager(a: Actor, projectId: string): Promise<UserActor> {
  if (!isManager(a)) throw forbidden();
  await loadProject(a, projectId);
  return a;
}

export function canViewProjectFinance(a: Actor): boolean {
  return a.kind === "user" && (a.role === "ADMIN" || (a.role === "COORDINATOR" && a.canViewFinance));
}
