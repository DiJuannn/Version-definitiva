import "server-only";
import { db } from "@/lib/db";
import type { UserActor } from "@/lib/authz/actor";
import { pieceScope, projectScope } from "@/lib/authz/scope";
import { ACTIVE_PIECE_STATUSES, pieceRisk } from "@/lib/domain/piece-status";
import { editorsWithLoad } from "./pieces";

const pieceCard = {
  id: true,
  title: true,
  status: true,
  priority: true,
  dueDate: true,
  editor: { select: { id: true, name: true } },
  project: { select: { id: true, name: true, client: { select: { name: true } } } },
  currentVersion: { select: { id: true, number: true, status: true } },
  clientVersion: { select: { id: true, number: true } },
  blockers: { where: { resolvedAt: null }, select: { id: true, kind: true, reason: true } },
  _count: { select: { corrections: { where: { status: { in: ["PENDING", "IN_PROGRESS"] as ("PENDING" | "IN_PROGRESS")[] } } } } },
} as const;

function dayBounds(now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 86400_000);
  return { start, end };
}

export async function managerDashboard(a: UserActor) {
  const scope = pieceScope(a);
  const pieces = await db.piece.findMany({
    where: { AND: [scope, { status: { in: ACTIVE_PIECE_STATUSES } }] },
    select: pieceCard,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
  });
  const { start, end } = dayBounds();
  const week = new Date(start.getTime() + 8 * 86400_000);
  const requests = await db.project.findMany({
    where: { AND: [projectScope(a), { status: "REQUESTED" }] },
    select: { id: true, name: true, client: { select: { name: true } }, createdAt: true },
  });
  const activity = await db.auditLog.findMany({
    where: { organizationId: a.organizationId, ...(a.role === "COORDINATOR" ? { projectId: { in: (await db.project.findMany({ where: projectScope(a), select: { id: true } })).map((p) => p.id) } } : {}) },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
  return {
    requests,
    unassigned: pieces.filter((p) => p.status === "PENDING_ASSIGNMENT"),
    internalReview: pieces.filter((p) => p.status === "INTERNAL_REVIEW"),
    awaitingDelivery: pieces.filter((p) => p.status === "APPROVED"),
    dueToday: pieces.filter((p) => p.dueDate && p.dueDate >= start && p.dueDate < end),
    upcoming: pieces.filter((p) => p.dueDate && p.dueDate >= end && p.dueDate < week),
    atRisk: pieces.filter((p) => ["late", "at_risk"].includes(pieceRisk(p.status, p.dueDate))),
    blocked: pieces.filter((p) => p.blockers.length > 0),
    withClient: pieces.filter((p) => p.status === "CLIENT_REVIEW"),
    openCorrections: pieces.reduce((acc, p) => acc + p._count.corrections, 0),
    activePieces: pieces.length,
    editors: await editorsWithLoad(a),
    activity,
  };
}

export async function editorDashboard(a: UserActor) {
  const pieces = await db.piece.findMany({
    where: { organizationId: a.organizationId, editorId: a.id, status: { in: ACTIVE_PIECE_STATUSES } },
    select: pieceCard,
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
  });
  const corrections = await db.correction.findMany({
    where: { piece: { organizationId: a.organizationId, editorId: a.id }, status: { in: ["PENDING", "IN_PROGRESS"] }, comment: { deletedAt: null } },
    include: {
      comment: { select: { id: true, body: true, timeMs: true, versionId: true, visibility: true } },
      piece: { select: { id: true, title: true } },
      originVersion: { select: { number: true } },
    },
    orderBy: { createdAt: "asc" },
  });
  const internalChanges = await db.version.findMany({
    where: { status: "INTERNAL_CHANGES", piece: { editorId: a.id, organizationId: a.organizationId } },
    select: { id: true, number: true, piece: { select: { id: true, title: true } } },
  });
  // "Qué hago ahora": lo que depende de mí, ordenado por urgencia.
  const now = pieces.filter((p) => ["ASSIGNED", "IN_EDIT", "CHANGES_REQUESTED", "IN_CORRECTION"].includes(p.status));
  return { pieces, now, corrections, internalChanges };
}

export async function clientDashboard(a: UserActor) {
  const scope = pieceScope(a);
  const pieces = await db.piece.findMany({
    where: { AND: [scope, { status: { notIn: ["DRAFT", "CANCELLED"] } }] },
    select: {
      id: true,
      title: true,
      status: true,
      dueDate: true,
      project: { select: { id: true, name: true } },
      clientVersion: { select: { id: true, number: true, status: true, publishedAt: true } },
      approvedVersion: { select: { id: true, number: true } },
      deliveries: { select: { id: true, createdAt: true } },
    },
    orderBy: [{ updatedAt: "desc" }],
  });
  const projects = await db.project.findMany({
    where: projectScope(a),
    select: { id: true, name: true, status: true, dueDate: true, brief: { select: { status: true } } },
    orderBy: { updatedAt: "desc" },
  });
  const activity = await db.auditLog.findMany({
    where: { organizationId: a.organizationId, clientVisible: true, projectId: { in: projects.map((p) => p.id) } },
    orderBy: { createdAt: "desc" },
    take: 10,
  });
  return {
    toReview: pieces.filter((p) => p.status === "CLIENT_REVIEW" && p.clientVersion),
    inProgress: pieces.filter((p) => !["CLIENT_REVIEW", "COMPLETED", "FINAL_DELIVERY"].includes(p.status)),
    delivered: pieces.filter((p) => p.deliveries.length > 0),
    projects,
    activity,
  };
}
