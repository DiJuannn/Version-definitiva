import "server-only";
import { z } from "zod";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdmin, isManager, type Actor } from "@/lib/authz/actor";
import { detectStylePatterns, parseStyleData, styleDataSchema } from "@/lib/domain/style";
import { badRequest, forbidden, notFound } from "@/lib/http/errors";
import { audit } from "./audit";

export const clientInput = z.object({
  name: z.string().trim().min(2, "Escribe el nombre del cliente").max(140),
  contactName: z.string().trim().max(120).optional().default(""),
  contactEmail: z.string().trim().toLowerCase().email("Email no válido").optional().or(z.literal("")),
  notes: z.string().trim().max(4000).optional().default(""),
});

export async function createClient(a: Actor, raw: unknown) {
  if (!isAdmin(a)) throw forbidden();
  const input = clientInput.parse(raw);
  return db.$transaction(async (tx) => {
    const c = await tx.client.create({
      data: {
        organizationId: a.organizationId,
        name: input.name,
        contactName: input.contactName || null,
        contactEmail: input.contactEmail || null,
        notes: input.notes || null,
      },
    });
    await audit(tx, a, { action: "client.create", entityType: "Client", entityId: c.id });
    return c;
  });
}

export async function listClients(a: Actor) {
  if (!isManager(a)) throw forbidden();
  return db.client.findMany({
    where: { organizationId: a.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { projects: true, users: true } } },
  });
}

export async function getClient(a: Actor, clientId: string) {
  if (!isManager(a)) throw forbidden();
  const c = await db.client.findFirst({
    where: { id: clientId, organizationId: a.organizationId },
    include: {
      users: { select: { id: true, name: true, email: true, active: true } },
      projects: { orderBy: { createdAt: "desc" }, select: { id: true, name: true, status: true, dueDate: true, styleProfile: { select: { version: true } } } },
      styleProfiles: { orderBy: { version: "desc" }, take: 10 },
      styleSuggestions: { where: { status: "PENDING" }, orderBy: { createdAt: "desc" } },
    },
  });
  if (!c) throw notFound("Cliente");
  return c;
}

/** Guardar el perfil de estilo crea una versión nueva; los proyectos existentes conservan la suya. */
export async function saveStyleProfile(a: Actor, clientId: string, raw: unknown) {
  if (!isManager(a)) throw forbidden();
  const data = styleDataSchema.parse(raw);
  const c = await db.client.findFirst({ where: { id: clientId, organizationId: a.organizationId } });
  if (!c) throw notFound("Cliente");
  return db.$transaction(async (tx) => {
    const last = await tx.styleProfile.findFirst({ where: { clientId }, orderBy: { version: "desc" } });
    const sp = await tx.styleProfile.create({
      data: { clientId, version: (last?.version ?? 0) + 1, data: data as Prisma.InputJsonValue, createdById: a.id },
    });
    await audit(tx, a, { action: "style.save", entityType: "Client", entityId: clientId, data: { version: sp.version } });
    return sp;
  });
}

/** Aplica la versión vigente del perfil a un proyecto (acción explícita, nunca automática). */
export async function applyLatestStyleToProject(a: Actor, projectId: string) {
  if (!isManager(a)) throw forbidden();
  const p = await db.project.findFirst({ where: { id: projectId, organizationId: a.organizationId } });
  if (!p) throw notFound("Proyecto");
  const latest = await db.styleProfile.findFirst({ where: { clientId: p.clientId }, orderBy: { version: "desc" } });
  if (!latest) throw badRequest("El cliente no tiene perfil de estilo");
  await db.$transaction(async (tx) => {
    await tx.project.update({ where: { id: projectId }, data: { styleProfileId: latest.id } });
    await audit(tx, a, { action: "style.apply", entityType: "Project", entityId: projectId, projectId, data: { version: latest.version } });
  });
}

/** Analiza correcciones históricas y crea sugerencias PENDIENTES (detección por reglas, no IA). */
export async function refreshStyleSuggestions(a: Actor, clientId: string) {
  if (!isManager(a)) throw forbidden();
  const c = await db.client.findFirst({ where: { id: clientId, organizationId: a.organizationId } });
  if (!c) throw notFound("Cliente");
  const corrections = await db.correction.findMany({
    where: { piece: { project: { clientId } }, comment: { deletedAt: null } },
    select: { id: true, comment: { select: { body: true } }, piece: { select: { projectId: true } } },
  });
  const found = detectStylePatterns(corrections.map((x) => ({ id: x.id, body: x.comment.body, projectId: x.piece.projectId })));
  const existing = await db.styleSuggestion.findMany({ where: { clientId, status: { in: ["PENDING", "REJECTED", "ACCEPTED"] } } });
  let created = 0;
  for (const f of found) {
    if (existing.some((e) => e.field === f.field && e.status !== "REJECTED")) continue;
    await db.styleSuggestion.create({
      data: { clientId, field: f.field, text: f.text, evidence: { correctionIds: f.evidence }, source: "rules" },
    });
    created++;
  }
  return { created, analysed: corrections.length };
}

export async function decideStyleSuggestion(a: Actor, suggestionId: string, accept: boolean, ruleText?: string) {
  if (!isManager(a)) throw forbidden();
  const s = await db.styleSuggestion.findFirst({ where: { id: suggestionId, client: { organizationId: a.organizationId } } });
  if (!s || s.status !== "PENDING") throw notFound("Sugerencia");
  await db.$transaction(async (tx) => {
    await tx.styleSuggestion.update({ where: { id: s.id }, data: { status: accept ? "ACCEPTED" : "REJECTED", decidedById: a.id, decidedAt: new Date() } });
    if (accept) {
      const last = await tx.styleProfile.findFirst({ where: { clientId: s.clientId }, orderBy: { version: "desc" } });
      const data = parseStyleData(last?.data);
      const key = s.field as keyof typeof data;
      const addition = (ruleText ?? s.text).trim();
      data[key] = data[key] ? `${data[key]}\n${addition}` : addition;
      await tx.styleProfile.create({
        data: { clientId: s.clientId, version: (last?.version ?? 0) + 1, data: data as Prisma.InputJsonValue, createdById: a.id },
      });
    }
    await audit(tx, a, { action: accept ? "style.suggestion_accept" : "style.suggestion_reject", entityType: "Client", entityId: s.clientId });
  });
}
