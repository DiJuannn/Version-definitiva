"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import {
  FOUNTAIN_MAX_BYTES,
  SCREENPLAY_LOGLINE_MAX,
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
  const file = formData.get("file");
  if (file instanceof File && file.size > 0) {
    if (file.size > FOUNTAIN_MAX_BYTES) return { error: "El archivo pesa más de 900 KB." };
    if (!/\.(fountain|spmd|txt)$/i.test(file.name)) {
      return { error: "Solo se pueden importar archivos Fountain (.fountain o .txt)." };
    }
    fountain = await file.text();
  }

  const result = await createScreenplayCore(profile.organizationId, profile.id, {
    title: String(formData.get("title") ?? ""),
    format: parseFormat(formData.get("format")),
    logline: optionalString(formData.get("logline")),
    // Al importar, manda el autor del archivo; en blanco, quien lo crea.
    author: optionalString(formData.get("author")) ?? (fountain ? null : profile.fullName),
    fountain,
  });
  if ("error" in result) return result;

  revalidatePath("/app/guiones");
  redirect(`/app/guiones/${result.id}`);
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
      logline: optionalString(formData.get("logline"))?.slice(0, SCREENPLAY_LOGLINE_MAX) ?? null,
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
