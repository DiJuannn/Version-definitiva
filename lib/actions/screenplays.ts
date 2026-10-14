"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { uploadProjectFile } from "@/lib/storage";
import { parseScreenplayPdf } from "@/lib/screenplay/pdf-import";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import { syncScreenplayToProjectCore, type SyncResult } from "@/lib/screenplay-taller";
import { syncScreenplayScenesCore, type SceneSyncResult } from "@/lib/screenplay-scenes";
import { getProjectForProfile } from "@/lib/project-access";
import {
  FOUNTAIN_MAX_BYTES,
  SCREENPLAY_TITLE_MAX,
  applyScreenplayUpdateCore,
  createScreenplayCore,
  parseFormat,
  type SaveScreenplayResult,
} from "@/lib/screenplay-core";

export type CreateScreenplayState = { error?: string } | undefined;

export async function createScreenplay(
  _prevState: CreateScreenplayState,
  formData: FormData,
): Promise<CreateScreenplayState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo crear el guion." };

  let fountain: string | null = null;
  let imported: { title: string | null; author: string | null; blocks: ScreenplayBlock[] } | null = null;
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > FOUNTAIN_MAX_BYTES) return { error: "El archivo pesa más de 900 KB." };
    if (/\.pdf$/i.test(file.name) || file.type === "application/pdf") {
      try {
        imported = await parseScreenplayPdf(new Uint8Array(await file.arrayBuffer()));
      } catch {
        return { error: "No se ha podido leer el PDF. Prueba a exportarlo de nuevo o súbelo en Fountain." };
      }
    } else if (/\.(fountain|spmd|txt)$/i.test(file.name)) {
      fountain = await file.text();
    } else {
      return { error: "Se pueden importar guiones en PDF o Fountain (.fountain, .txt)." };
    }
  }

  const result = await createScreenplayCore(profile.organizationId, profile.id, {
    title: String(formData.get("title") ?? ""),
    format: parseFormat(formData.get("format")),
    logline: optionalString(formData.get("logline")),
    // Al importar, manda el autor del archivo; en blanco, quien lo crea.
    author: optionalString(formData.get("author")) ?? (fountain || imported ? null : profile.fullName),
    fountain,
    imported,
  });
  if ("error" in result) return result;

  revalidatePath("/app/guiones");
  // Por dónde empieza: la idea, la escaleta o directamente el guion.
  const start = String(formData.get("start") ?? "");
  const step = fountain || imported ? "guion" : start === "idea" || start === "escaleta" ? start : "guion";
  redirect(`/app/guiones/${result.id}?paso=${step}`);
}

// Guardado automático del editor: llega solo lo nuevo desde el último
// guardado (update de Yjs en base64) y el servidor lo fusiona.
export async function saveScreenplayUpdate(id: string, update: string): Promise<SaveScreenplayResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Tu sesión ha caducado. Vuelve a entrar." };
  return applyScreenplayUpdateCore(profile.organizationId, id, update);
}

export type ScreenplayDetailsState = { error?: string; ok?: boolean } | undefined;

export async function updateScreenplayDetails(
  id: string,
  _prevState: ScreenplayDetailsState,
  formData: FormData,
): Promise<ScreenplayDetailsState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo guardar." };

  const title = String(formData.get("title") ?? "").trim().slice(0, SCREENPLAY_TITLE_MAX);
  if (!title) return { error: "El título no puede quedar vacío." };

  const { count } = await prisma.screenplay.updateMany({
    where: { id, organizationId: profile.organizationId },
    data: {
      title,
      format: parseFormat(formData.get("format")),
      author: optionalString(formData.get("author")),
    },
  });
  if (!count) return { error: "Este guion ya no existe." };

  revalidatePath("/app/guiones");
  revalidatePath(`/app/guiones/${id}`);
  return { ok: true };
}

export async function deleteScreenplay(id: string): Promise<void> {
  const profile = await getCurrentProfile();
  if (!profile) return;
  await prisma.screenplay.deleteMany({ where: { id, organizationId: profile.organizationId } });
  revalidatePath("/app/guiones");
  redirect("/app/guiones");
}

// ---------------------------------------------------------------- Taller

// Vincula (o desvincula, con null) el guion a un proyecto de la organización y
// sincroniza personajes y Moodboard en el momento.
export async function linkScreenplayProject(id: string, projectId: string | null): Promise<SyncResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Tu sesión ha caducado." };
  if (projectId) {
    const project = await prisma.project.findFirst({
      where: { id: projectId, organizationId: profile.organizationId },
      select: { id: true },
    });
    if (!project) return { ok: false, error: "Ese proyecto no existe." };
  }
  const { count } = await prisma.screenplay.updateMany({
    where: { id, organizationId: profile.organizationId },
    data: { projectId },
  });
  if (!count) return { ok: false, error: "Este guion ya no existe." };
  revalidatePath(`/app/guiones/${id}`);
  if (!projectId) return { ok: true, characters: 0, cards: 0 };
  const res = await syncScreenplayToProjectCore(id, profile.organizationId);
  // Al vincular, las escenas del guion pasan también a producción.
  if (res.ok) await syncScreenplayScenesCore(projectId, profile.organizationId);
  revalidateProjectScript(projectId);
  return res;
}

function revalidateProjectScript(projectId: string) {
  for (const tool of ["guion", "personajes", "moodboard", "desglose", "plan-de-rodaje", "shot-list", "storyboard"]) {
    revalidatePath(`/app/${projectId}/${tool}`);
  }
  revalidatePath(`/app/${projectId}`);
}

// Solo los guiones de la propia organización: un proyecto compartido desde
// otra se ve, pero su guion no es de quien lo mira.
async function ownProject(projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return null;
  const project = await getProjectForProfile(profile, projectId);
  if (!project || project.organizationId !== profile.organizationId) return null;
  return { profile, project };
}

// Desde la herramienta Guion de Taller: pasa a producción lo que ha cambiado
// en el guion (escenas nuevas, renumeradas o reescritas, y quién sale).
export async function syncProjectScriptScenes(projectId: string): Promise<SceneSyncResult> {
  const own = await ownProject(projectId);
  if (!own) return { ok: false, error: "No tienes acceso a este proyecto." };
  const res = await syncScreenplayScenesCore(projectId, own.profile.organizationId);
  revalidateProjectScript(projectId);
  return res;
}

// «Escribir el guion»: crea un guion en Guiones ya vinculado al proyecto y
// abre el editor.
export async function writeProjectScript(projectId: string): Promise<void> {
  const own = await ownProject(projectId);
  if (!own) redirect(`/app/${projectId}/guion`);
  const { profile, project } = own;
  const type = (project.type ?? "").toLowerCase();
  const result = await createScreenplayCore(profile.organizationId, profile.id, {
    title: project.name,
    format: type.includes("largo") ? "FEATURE" : type.includes("serie") ? "SERIES_EPISODE" : "SHORT",
    logline: null,
    author: profile.fullName,
  });
  if ("error" in result) redirect(`/app/${projectId}/guion`);
  await prisma.screenplay.update({ where: { id: result.id }, data: { projectId } });
  revalidatePath("/app/guiones");
  revalidatePath(`/app/${projectId}/guion`);
  redirect(`/app/guiones/${result.id}?paso=guion`);
}

// «Vincular un guion de Guiones» desde Taller.
export async function linkScriptToProject(projectId: string, formData: FormData): Promise<void> {
  const own = await ownProject(projectId);
  const screenplayId = String(formData.get("screenplayId") ?? "");
  if (!own || !screenplayId) return;
  await linkScreenplayProject(screenplayId, projectId);
}

// La llama el editor (con calma, unos segundos después de cambiar fichas o
// referencias) cuando el guion está vinculado.
export async function syncScreenplayToProject(id: string): Promise<SyncResult> {
  const profile = await getCurrentProfile();
  if (!profile) return { ok: false, error: "Tu sesión ha caducado." };
  return syncScreenplayToProjectCore(id, profile.organizationId);
}

const MAX_IMAGE_BYTES = 8 * 1024 * 1024;

// Imagen para una ficha de personaje o una referencia.
export async function uploadScreenplayImage(id: string, formData: FormData): Promise<{ url: string } | { error: string }> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "Tu sesión ha caducado." };
  const screenplay = await prisma.screenplay.findFirst({
    where: { id, organizationId: profile.organizationId },
    select: { id: true },
  });
  if (!screenplay) return { error: "Este guion ya no existe." };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "No se recibió ninguna imagen." };
  if (!file.type.startsWith("image/")) return { error: "Solo se pueden subir imágenes." };
  if (file.size > MAX_IMAGE_BYTES) return { error: "La imagen pesa más de 8 MB." };
  const uploaded = await uploadProjectFile(`guiones/${id}`, file);
  if (!uploaded) return { error: "No se pudo subir la imagen. Inténtalo de nuevo." };
  return { url: uploaded.url };
}
