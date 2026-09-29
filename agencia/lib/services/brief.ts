import "server-only";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isInternal, isManager, type Actor } from "@/lib/authz/actor";
import { loadProject } from "@/lib/authz/guards";
import { briefDataSchema, missingBriefFields, parseBriefData } from "@/lib/domain/brief";
import { badRequest, forbidden } from "@/lib/http/errors";
import { audit } from "./audit";

/** Gestión y el cliente del proyecto pueden editar el brief; el editor solo lo lee. */
export async function saveBrief(a: Actor, projectId: string, raw: unknown, submit: boolean) {
  const project = await loadProject(a, projectId);
  const canEdit = isManager(a) || (a.kind === "user" && a.role === "CLIENT" && a.clientId === project.clientId);
  if (!canEdit) throw forbidden("No puedes editar este brief");
  const data = briefDataSchema.parse(raw);
  if (submit) {
    const missing = missingBriefFields(data);
    if (missing.length) throw badRequest(`Faltan campos: ${missing.map((m) => m.label).join(", ")}`);
  }
  const actorId = a.kind === "user" ? a.id : null;
  return db.$transaction(async (tx) => {
    const brief = await tx.brief.upsert({
      where: { projectId },
      create: { projectId, data: data as Prisma.InputJsonValue, updatedById: actorId, status: submit ? "SUBMITTED" : "DRAFT", submittedAt: submit ? new Date() : null },
      update: {
        data: data as Prisma.InputJsonValue,
        updatedById: actorId,
        ...(submit ? { status: "SUBMITTED", submittedAt: new Date() } : {}),
      },
    });
    await audit(tx, a, { action: submit ? "brief.submit" : "brief.save", entityType: "Brief", entityId: brief.id, projectId, clientVisible: true });
    return brief;
  });
}

export async function getBrief(a: Actor, projectId: string) {
  await loadProject(a, projectId);
  const brief = await db.brief.findUnique({ where: { projectId } });
  const data = parseBriefData(brief?.data);
  return { brief, data, missing: missingBriefFields(data), canSeeInternal: isInternal(a) };
}
