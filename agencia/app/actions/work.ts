"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { PieceStatus, ProjectStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/current";
import { formToObject, runAction, type ActionState } from "@/lib/http/action";
import { addBlocker, assignEditor, changePieceStatus, createPiece, resolveBlocker, updatePiece } from "@/lib/services/pieces";
import { createClientRequest, createProject, setProjectStatus, updateProject } from "@/lib/services/projects";
import { saveBrief } from "@/lib/services/brief";
import { applyLatestStyleToProject } from "@/lib/services/clients";
import { addExternalLink, createDelivery, setMaterialVisibility } from "@/lib/services/media";
import { createShareLink, revokeShareLink } from "@/lib/services/shares";
import { BRIEF_FIELDS } from "@/lib/domain/brief";

export async function createProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  let id = "";
  const res = await runAction(async () => {
    id = (await createProject(me, formToObject(fd))).id;
  });
  if (res?.ok) redirect(`/proyectos/${id}`);
  return res;
}

export async function requestProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["CLIENT"]);
  let id = "";
  const res = await runAction(async () => {
    id = (await createClientRequest(me, formToObject(fd))).id;
  });
  if (res?.ok) redirect(`/proyectos/${id}/brief`);
  return res;
}

export async function updateProjectAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const projectId = String(fd.get("projectId"));
  return runAction(async () => {
    await updateProject(me, projectId, formToObject(fd));
    revalidatePath(`/proyectos/${projectId}`);
  }, "Proyecto guardado");
}

export async function setProjectStatusAction(fd: FormData) {
  const me = await requireUser();
  const projectId = String(fd.get("projectId"));
  await setProjectStatus(me, projectId, String(fd.get("status")) as ProjectStatus);
  revalidatePath(`/proyectos/${projectId}`);
}

export async function createPieceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const projectId = String(fd.get("projectId"));
  return runAction(async () => {
    await createPiece(me, projectId, formToObject(fd));
    revalidatePath(`/proyectos/${projectId}`);
  }, "Pieza creada");
}

export async function updatePieceAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const pieceId = String(fd.get("pieceId"));
  return runAction(async () => {
    await updatePiece(me, pieceId, formToObject(fd));
    revalidatePath(`/piezas/${pieceId}`);
  }, "Pieza guardada");
}

export async function assignEditorAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const pieceId = String(fd.get("pieceId"));
  const editorId = String(fd.get("editorId") ?? "") || null;
  return runAction(async () => {
    await assignEditor(me, pieceId, editorId, String(fd.get("note") ?? "") || undefined);
    revalidatePath(`/piezas/${pieceId}`);
    revalidatePath("/inicio");
  }, editorId ? "Editor asignado" : "Asignación retirada");
}

export async function pieceStatusAction(fd: FormData) {
  const me = await requireUser();
  const pieceId = String(fd.get("pieceId"));
  await changePieceStatus(me, pieceId, String(fd.get("status")) as PieceStatus);
  revalidatePath(`/piezas/${pieceId}`);
  revalidatePath("/inicio");
}

export async function addBlockerAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const pieceId = String(fd.get("pieceId"));
  return runAction(async () => {
    await addBlocker(me, pieceId, formToObject(fd));
    revalidatePath(`/piezas/${pieceId}`);
  }, "Bloqueo registrado");
}

export async function resolveBlockerAction(fd: FormData) {
  const me = await requireUser();
  await resolveBlocker(me, String(fd.get("blockerId")));
  revalidatePath(`/piezas/${String(fd.get("pieceId"))}`);
}

export async function saveBriefAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const projectId = String(fd.get("projectId"));
  const submit = fd.get("intent") === "submit";
  const data: Record<string, string> = {};
  for (const f of BRIEF_FIELDS) {
    const v = fd.get(f.key);
    if (typeof v === "string" && v.trim()) data[f.key] = v.trim();
  }
  return runAction(async () => {
    await saveBrief(me, projectId, data, submit);
    revalidatePath(`/proyectos/${projectId}/brief`);
    revalidatePath(`/proyectos/${projectId}`);
  }, submit ? "Brief enviado" : "Borrador guardado");
}

export async function applyStyleAction(fd: FormData) {
  const me = await requireUser();
  const projectId = String(fd.get("projectId"));
  await applyLatestStyleToProject(me, projectId);
  revalidatePath(`/proyectos/${projectId}`);
}

export async function addLinkAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const projectId = String(fd.get("projectId"));
  return runAction(async () => {
    await addExternalLink(me, formToObject(fd));
    revalidatePath(`/proyectos/${projectId}`);
  }, "Enlace añadido");
}

export async function materialVisibilityAction(fd: FormData) {
  const me = await requireUser();
  await setMaterialVisibility(me, String(fd.get("assetId")), fd.get("visibility") === "CLIENT" ? "CLIENT" : "INTERNAL");
  revalidatePath(`/proyectos/${String(fd.get("projectId"))}`);
}

export async function createShareAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const o = formToObject(fd);
  const projectId = String(o.projectId);
  return runAction(async () => {
    const days = o.expiresInDays ? Number(o.expiresInDays) : null;
    const { token } = await createShareLink(me, {
      ...o,
      canComment: o.canComment === true,
      canApprove: o.canApprove === true,
      canDownload: o.canDownload === true,
      requireIdentity: o.requireIdentity === true,
      expiresInDays: days,
    });
    revalidatePath(`/proyectos/${projectId}/compartir`);
    return { token };
  }, "Enlace creado. Cópialo ahora: por seguridad no se volverá a mostrar completo.");
}

export async function revokeShareAction(fd: FormData) {
  const me = await requireUser();
  await revokeShareLink(me, String(fd.get("linkId")));
  revalidatePath(`/proyectos/${String(fd.get("projectId"))}/compartir`);
}

export async function createDeliveryAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  const pieceId = String(fd.get("pieceId"));
  return runAction(async () => {
    await createDelivery(me, pieceId, String(fd.get("assetId")), String(fd.get("note") ?? ""));
    revalidatePath(`/piezas/${pieceId}`);
  }, "Entrega registrada");
}
