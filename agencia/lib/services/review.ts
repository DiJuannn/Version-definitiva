import "server-only";
import { db } from "@/lib/db";
import { isEditor, isInternal, isManager, type Actor } from "@/lib/authz/actor";
import { loadVersion } from "@/lib/authz/guards";
import { commentVisibility, versionScope } from "@/lib/authz/scope";
import { isDecidable } from "@/lib/domain/version-status";
import type { Annotation } from "@/lib/domain/annotation";
import { mediaUrl, signMedia } from "@/lib/storage/signed-url";
import { canDecide } from "./approvals";
import { reviewParticipants } from "./participants";

export function mediaSubject(a: Actor) {
  return a.kind === "user" ? `u:${a.sessionId}` : `g:${a.id}`;
}

export type ReviewPayload = Awaited<ReturnType<typeof getReviewPayload>>;

/** Todo lo que necesita la sala de revisión, ya filtrado por permisos en servidor. */
export async function getReviewPayload(a: Actor, versionId: string) {
  const v = await loadVersion(a, versionId);
  const internal = isInternal(a);
  const piece = v.piece;

  const [versions, comments, approvals, org, priorOpen, uploader, preview] = await Promise.all([
    db.version.findMany({
      where: { AND: [{ pieceId: piece.id }, versionScope(a)] },
      orderBy: { number: "desc" },
      select: { id: true, number: true, status: true, publishedAt: true, createdAt: true, changeSummary: true },
    }),
    db.comment.findMany({
      where: { versionId, ...commentVisibility(a) },
      orderBy: { createdAt: "asc" },
      include: {
        authorUser: { select: { id: true, name: true, role: true } },
        authorGuest: { select: { id: true, name: true } },
        correction: {
          include: {
            addressedInVersion: { select: { number: true } },
            assignee: { select: { id: true, name: true } },
            events: { orderBy: { createdAt: "asc" }, select: { fromStatus: true, toStatus: true, createdAt: true, note: true, actorUserId: true, actorGuestId: true } },
          },
        },
        mentions: { select: { userId: true } },
      },
    }),
    db.approval.findMany({ where: { versionId }, orderBy: { createdAt: "desc" } }),
    db.organization.findUniqueOrThrow({ where: { id: a.organizationId }, select: { approvalPolicy: true } }),
    db.correction.findMany({
      where: {
        pieceId: piece.id,
        originVersionId: { not: versionId },
        status: { in: ["PENDING", "IN_PROGRESS", "RESOLVED"] },
        comment: { deletedAt: null, ...(internal ? {} : { visibility: "CLIENT" }) },
        originVersion: versionScope(a),
      },
      include: {
        comment: { select: { id: true, body: true, timeMs: true, endMs: true, versionId: true, visibility: true } },
        originVersion: { select: { number: true } },
        addressedInVersion: { select: { number: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    db.user.findUnique({ where: { id: v.uploadedById }, select: { name: true } }),
    v.previewAssetId ? db.mediaAsset.findUnique({ where: { id: v.previewAssetId } }) : null,
  ]);

  const visibilityForParticipants = internal && !v.publishedAt ? "INTERNAL" : "CLIENT";
  const participants = await reviewParticipants(a, v, visibilityForParticipants);
  const internalParticipants = internal ? await reviewParticipants(a, v, "INTERNAL") : [];

  const guestNames = new Map<string, string>();
  const nameOf = (id: string | null, guestId: string | null) =>
    id ? (participants.find((p) => p.id === id)?.name ?? internalParticipants.find((p) => p.id === id)?.name ?? "Equipo") : guestId ? (guestNames.get(guestId) ?? "Invitado") : "Sistema";
  for (const c of comments) if (c.authorGuest) guestNames.set(c.authorGuest.id, c.authorGuest.name);

  const isTeam = isManager(a) || (isEditor(a) && piece.editorId === a.id);
  const mine = (c: { authorUserId: string | null; authorGuestId: string | null }) =>
    a.kind === "user" ? c.authorUserId === a.id : c.authorGuestId === a.id;

  const mapped = comments.map((c) => ({
    id: c.id,
    parentId: c.parentId,
    author: c.authorUser
      ? { name: c.authorUser.name, kind: "user" as const, role: c.authorUser.role }
      : { name: c.authorGuest?.name ?? "Invitado", kind: "guest" as const, role: null },
    body: c.deletedAt ? "" : c.body,
    deleted: !!c.deletedAt,
    timeMs: c.timeMs,
    endMs: c.endMs,
    visibility: c.visibility,
    annotation: (c.deletedAt ? null : c.annotation) as Annotation | null,
    links: c.deletedAt ? [] : c.links,
    mentionIds: c.mentions.map((m) => m.userId),
    editedAt: c.editedAt?.toISOString() ?? null,
    createdAt: c.createdAt.toISOString(),
    lastActivityAt: c.lastActivityAt.toISOString(),
    mine: mine(c),
    correction: c.correction
      ? {
          id: c.correction.id,
          status: c.correction.status,
          category: c.correction.category,
          assignee: c.correction.assignee,
          addressedIn: c.correction.addressedInVersion?.number ?? null,
          history: c.correction.events.map((e) => ({
            from: e.fromStatus,
            to: e.toStatus,
            at: e.createdAt.toISOString(),
            note: e.note,
            by: nameOf(e.actorUserId, e.actorGuestId),
          })),
        }
      : null,
  }));

  const canComment = a.kind === "guest" ? a.link.canComment && !!v.publishedAt : internal || !!v.publishedAt;
  const decidable = !!v.publishedAt && isDecidable(v.status);

  let media: { assetId: string; url: string; mimeType: string | null; status: string; downloadable: boolean } | null = null;
  if (preview && !preview.deletedAt) {
    media = {
      assetId: preview.id,
      url: preview.status === "READY" ? mediaUrl(signMedia({ assetId: preview.id, subject: mediaSubject(a), download: false })) : "",
      mimeType: preview.mimeType,
      status: preview.status,
      downloadable: internal || (a.kind === "guest" && a.link.canDownload),
    };
  }

  return {
    me: {
      kind: a.kind,
      id: a.id,
      name: a.name,
      role: a.kind === "user" ? a.role : null,
      internal,
      linkId: a.kind === "guest" ? a.link.id : null,
    },
    version: {
      id: v.id,
      number: v.number,
      status: v.status,
      publishedAt: v.publishedAt?.toISOString() ?? null,
      changeSummary: v.changeSummary,
      durationMs: v.durationMs,
      width: v.width,
      height: v.height,
      fps: v.fps,
      fpsVerified: v.fpsVerified,
      lockedAt: v.lockedAt?.toISOString() ?? null,
      createdAt: v.createdAt.toISOString(),
      uploadedBy: uploader?.name ?? "",
    },
    piece: {
      id: piece.id,
      title: piece.title,
      status: piece.status,
      aspectRatio: piece.aspectRatio,
      projectId: piece.projectId,
      projectName: piece.project.name,
      currentVersionId: piece.currentVersionId,
      clientVersionId: piece.clientVersionId,
      approvedVersionId: piece.approvedVersionId,
    },
    versions: versions.map((x) => ({ ...x, publishedAt: x.publishedAt?.toISOString() ?? null, createdAt: x.createdAt.toISOString() })),
    media,
    comments: mapped,
    approvals: approvals.map((ap) => ({
      id: ap.id,
      decision: ap.decision,
      actorName: ap.actorName,
      note: ap.note,
      openCorrections: ap.openCorrections,
      acknowledgedOpen: ap.acknowledgedOpen,
      createdAt: ap.createdAt.toISOString(),
      revokedAt: ap.revokedAt?.toISOString() ?? null,
      revokeReason: ap.revokeReason,
    })),
    priorCorrections: priorOpen.map((c) => ({
      id: c.id,
      status: c.status,
      category: c.category,
      body: c.comment.body,
      timeMs: c.comment.timeMs,
      commentId: c.comment.id,
      versionId: c.comment.versionId,
      visibility: c.comment.visibility,
      originNumber: c.originVersion.number,
      addressedIn: c.addressedInVersion?.number ?? null,
    })),
    participants: participants.map((p) => ({ id: p.id, name: p.name })),
    internalParticipants: internalParticipants.map((p) => ({ id: p.id, name: p.name })),
    policy: org.approvalPolicy,
    perms: {
      comment: canComment && !v.lockedAt,
      internalComments: internal && !!v.publishedAt,
      team: isTeam,
      reviewer: !internal && canComment,
      decide: decidable && canDecide(a, piece.project.clientId),
      decideOnBehalf: decidable && isManager(a),
      publish: isManager(a) && (v.status === "INTERNAL_REVIEW" || v.status === "INTERNAL_CHANGES"),
      internalChanges: isManager(a) && v.status === "INTERNAL_REVIEW",
      revoke: a.kind === "user" && a.role === "ADMIN",
      share: isManager(a),
    },
  };
}
