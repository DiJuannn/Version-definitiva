import "server-only";
import { z } from "zod";
import type { Priority, ProjectStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdmin, isClientUser, isManager, type Actor, type UserActor } from "@/lib/authz/actor";
import { loadProject, requireProjectManager } from "@/lib/authz/guards";
import { projectScope } from "@/lib/authz/scope";
import { badRequest, forbidden, notFound } from "@/lib/http/errors";
import { audit } from "./audit";

const optionalDate = z
  .string()
  .optional()
  .transform((v) => (v ? new Date(v) : null))
  .refine((d) => d === null || !Number.isNaN(d.getTime()), "Fecha no válida");

export const projectInput = z.object({
  clientId: z.string().min(1, "Elige un cliente"),
  name: z.string().trim().min(2, "El nombre es demasiado corto").max(140),
  description: z.string().trim().max(4000).optional().default(""),
  contentType: z.string().trim().max(80).optional().default(""),
  priority: z.enum(["LOW", "NORMAL", "HIGH", "URGENT"]).default("NORMAL"),
  dueDate: optionalDate,
  coordinatorId: z.string().optional().transform((v) => v || null),
  teamId: z.string().optional().transform((v) => v || null),
  packageId: z.string().optional().transform((v) => v || null),
  internalNotes: z.string().trim().max(4000).optional().default(""),
});

export async function listProjects(a: Actor, filter: { status?: ProjectStatus; q?: string } = {}) {
  return db.project.findMany({
    where: {
      AND: [
        projectScope(a),
        filter.status ? { status: filter.status } : {},
        filter.q ? { name: { contains: filter.q, mode: "insensitive" } } : {},
      ],
    },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }, { updatedAt: "desc" }],
    include: {
      client: { select: { id: true, name: true } },
      coordinator: { select: { id: true, name: true } },
      pieces: {
        where: a.kind === "user" && a.role === "EDITOR" ? { editorId: a.id } : undefined,
        select: { id: true, status: true, dueDate: true },
      },
    },
  });
}

export async function createProject(a: UserActor, raw: unknown) {
  if (!isManager(a)) throw forbidden();
  const input = projectInput.parse(raw);
  const client = await db.client.findFirst({ where: { id: input.clientId, organizationId: a.organizationId } });
  if (!client) throw badRequest("Cliente no válido");
  let coordinatorId = input.coordinatorId;
  if (a.role === "COORDINATOR") coordinatorId = coordinatorId ?? a.id;
  if (coordinatorId) {
    const c = await db.user.findFirst({ where: { id: coordinatorId, organizationId: a.organizationId, role: { in: ["COORDINATOR", "ADMIN"] } } });
    if (!c) throw badRequest("Coordinador no válido");
  }
  if (input.teamId) {
    const t = await db.team.findFirst({ where: { id: input.teamId, organizationId: a.organizationId } });
    if (!t) throw badRequest("Equipo no válido");
  }
  // Instantánea del perfil de estilo vigente: los cambios futuros no afectan a este proyecto.
  const style = await db.styleProfile.findFirst({ where: { clientId: client.id }, orderBy: { version: "desc" } });

  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        organizationId: a.organizationId,
        clientId: client.id,
        name: input.name,
        description: input.description || null,
        contentType: input.contentType || null,
        priority: input.priority as Priority,
        dueDate: input.dueDate,
        coordinatorId,
        teamId: input.teamId,
        packageId: input.packageId,
        internalNotes: input.internalNotes || null,
        status: "ACTIVE",
        styleProfileId: style?.id ?? null,
        createdById: a.id,
        brief: { create: { data: {} } },
      },
    });
    await audit(tx, a, { action: "project.create", entityType: "Project", entityId: project.id, projectId: project.id, clientVisible: true });
    return project;
  });
}

export const clientRequestInput = z.object({
  name: z.string().trim().min(2, "Pon un nombre al proyecto").max(140),
  description: z.string().trim().max(4000).optional().default(""),
  dueDate: optionalDate,
});

/** Solicitud de proyecto creada por un cliente (si la organización lo permite). */
export async function createClientRequest(a: UserActor, raw: unknown) {
  if (!isClientUser(a) || !a.clientId) throw forbidden();
  const org = await db.organization.findUniqueOrThrow({ where: { id: a.organizationId } });
  if (!org.clientRequests) throw forbidden("Tu agencia no tiene activadas las solicitudes desde el portal");
  const input = clientRequestInput.parse(raw);
  const style = await db.styleProfile.findFirst({ where: { clientId: a.clientId }, orderBy: { version: "desc" } });
  return db.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        organizationId: a.organizationId,
        clientId: a.clientId!,
        name: input.name,
        description: input.description || null,
        dueDate: input.dueDate,
        status: "REQUESTED",
        styleProfileId: style?.id ?? null,
        createdById: a.id,
        brief: { create: { data: {} } },
      },
    });
    await audit(tx, a, { action: "project.request", entityType: "Project", entityId: project.id, projectId: project.id, clientVisible: true });
    const admins = await tx.user.findMany({ where: { organizationId: a.organizationId, role: "ADMIN", active: true }, select: { id: true } });
    const { notify } = await import("@/lib/notifications/notify");
    await notify(tx, {
      organizationId: a.organizationId,
      type: "ASSIGNED",
      recipients: admins.map((x) => x.id),
      title: `Nueva solicitud: ${project.name}`,
      url: `/proyectos/${project.id}`,
      groupKey: `request:${project.id}`,
      eventKey: `request:${project.id}`,
      internal: true,
    });
    return project;
  });
}

export async function updateProject(a: Actor, projectId: string, raw: unknown) {
  const actor = await requireProjectManager(a, projectId);
  const input = projectInput.partial({ clientId: true }).parse(raw);
  const existing = await loadProject(actor, projectId);
  if (input.coordinatorId && input.coordinatorId !== existing.coordinatorId && !isAdmin(actor)) {
    throw forbidden("Solo administración puede cambiar el coordinador");
  }
  return db.$transaction(async (tx) => {
    const p = await tx.project.update({
      where: { id: projectId },
      data: {
        name: input.name,
        description: input.description,
        contentType: input.contentType,
        priority: input.priority as Priority | undefined,
        dueDate: input.dueDate,
        coordinatorId: input.coordinatorId ?? undefined,
        teamId: input.teamId ?? undefined,
        packageId: input.packageId ?? undefined,
        internalNotes: input.internalNotes,
      },
    });
    await audit(tx, actor, { action: "project.update", entityType: "Project", entityId: p.id, projectId: p.id });
    return p;
  });
}

const PROJECT_STATUS_ALLOWED: Record<ProjectStatus, ProjectStatus[]> = {
  DRAFT: ["ACTIVE", "CANCELLED"],
  REQUESTED: ["ACTIVE", "CANCELLED"],
  ACTIVE: ["ON_HOLD", "COMPLETED", "CANCELLED"],
  ON_HOLD: ["ACTIVE", "CANCELLED"],
  COMPLETED: ["ACTIVE"],
  CANCELLED: ["ACTIVE"],
};

export async function setProjectStatus(a: Actor, projectId: string, status: ProjectStatus) {
  const actor = await requireProjectManager(a, projectId);
  const p = await loadProject(actor, projectId);
  if (!PROJECT_STATUS_ALLOWED[p.status].includes(status)) throw badRequest("Cambio de estado no permitido");
  return db.$transaction(async (tx) => {
    const updated = await tx.project.update({ where: { id: projectId }, data: { status } });
    await audit(tx, actor, {
      action: "project.status",
      entityType: "Project",
      entityId: projectId,
      projectId,
      clientVisible: true,
      data: { from: p.status, to: status },
    });
    return updated;
  });
}

export async function getProjectDetail(a: Actor, projectId: string) {
  await loadProject(a, projectId);
  const editorOnly = a.kind === "user" && a.role === "EDITOR";
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      client: true,
      coordinator: { select: { id: true, name: true, email: true } },
      team: { select: { id: true, name: true } },
      brief: true,
      styleProfile: true,
      package: true,
      pieces: {
        where: editorOnly ? { editorId: a.id } : a.kind === "user" && a.role === "CLIENT" ? { status: { not: "DRAFT" } } : undefined,
        orderBy: { createdAt: "asc" },
        include: {
          editor: { select: { id: true, name: true } },
          blockers: { where: { resolvedAt: null } },
          currentVersion: { select: { id: true, number: true, status: true } },
          clientVersion: { select: { id: true, number: true, status: true } },
          approvedVersion: { select: { id: true, number: true } },
          _count: { select: { corrections: { where: { status: { in: ["PENDING", "IN_PROGRESS"] } } } } },
        },
      },
    },
  });
  if (!project) throw notFound("Proyecto");
  return project;
}

export async function projectActivity(a: Actor, projectId: string, take = 30) {
  await loadProject(a, projectId);
  const internal = a.kind === "user" && a.role !== "CLIENT";
  return db.auditLog.findMany({
    where: { projectId, ...(internal ? {} : { clientVisible: true }) },
    orderBy: { createdAt: "desc" },
    take,
  });
}
