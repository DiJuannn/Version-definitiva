"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { logActivity } from "@/lib/activity-log";
import { notifyCallSheetChange } from "@/lib/call-sheet-change-alert";
import { generateAllCallSheetsCore, setCallSheetSharingCore, upsertCallSheetCore } from "@/lib/call-sheets-core";

export async function upsertCallSheet(
  projectId: string,
  shootingDayId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await upsertCallSheetCore(projectId, shootingDayId, {
    generalCallTime: optionalString(formData.get("generalCallTime")),
    transportNotes: optionalString(formData.get("transportNotes")),
    cateringNotes: optionalString(formData.get("cateringNotes")),
    additionalNotes: optionalString(formData.get("additionalNotes")),
  });

  const profile = await getCurrentProfile();
  await logActivity(projectId, profile?.id, `editó el call sheet`);
  await notifyCallSheetChange(projectId, shootingDayId);

  revalidatePath(`/app/${projectId}/call-sheets/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets`);
}

// Crea la hoja de convocatoria del día (vacía: hora, transporte y catering se
// rellenan después) si todavía no existe. Es lo que significa "Generar".
async function ensureCallSheet(projectId: string, shootingDayId: string): Promise<boolean> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return false;

  const existing = await prisma.callSheet.findUnique({ where: { shootingDayId } });
  if (!existing) {
    const created = await upsertCallSheetCore(projectId, shootingDayId, {
      generalCallTime: null,
      transportNotes: null,
      cateringNotes: null,
      additionalNotes: null,
    });
    if (!created) return false;
    const profile = await getCurrentProfile();
    await logActivity(projectId, profile?.id, `creó el call sheet`);
  }

  revalidatePath(`/app/${projectId}/call-sheets/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets`);
  revalidatePath(`/app/${projectId}/plan-de-rodaje/${shootingDayId}`);
  revalidatePath(`/app/${projectId}`);
  return true;
}

export async function generateCallSheet(projectId: string, shootingDayId: string) {
  await ensureCallSheet(projectId, shootingDayId);
}

export async function generateCallSheetAndOpen(projectId: string, shootingDayId: string) {
  if (await ensureCallSheet(projectId, shootingDayId)) {
    redirect(`/app/${projectId}/call-sheets/${shootingDayId}`);
  }
}

export type GenerateAllState = { error: string } | undefined;

// Crea de una vez el call sheet de todos los días con escenas que aún no lo tienen, con una hora
// de llamada sugerida por la luz (se puede cambiar en cada uno). Los que ya existen no se tocan.
export async function generateAllCallSheets(
  projectId: string,
  // Firma exigida por useActionState (prevState, formData), sin usarlos.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: GenerateAllState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<GenerateAllState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const created = await generateAllCallSheetsCore(projectId);
  if (created === 0) return { error: "No hay días con escenas que estén sin call sheet." };

  const profile = await getCurrentProfile();
  await logActivity(projectId, profile?.id, `generó ${created} call sheet${created === 1 ? "" : "s"} de una vez`);
  revalidatePath(`/app/${projectId}/call-sheets`);
  revalidatePath(`/app/${projectId}`);
  return undefined;
}

// Activa o desactiva el enlace público de solo lectura del call sheet.
export async function setCallSheetSharing(
  projectId: string,
  shootingDayId: string,
  enabled: boolean,
): Promise<{ error?: string }> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  const result = await setCallSheetSharingCore(projectId, shootingDayId, enabled);
  if (!result) return { error: "No se encontró el día." };

  const profile = await getCurrentProfile();
  await logActivity(
    projectId,
    profile?.id,
    enabled ? "creó un enlace público del call sheet" : "quitó el enlace público del call sheet",
  );

  revalidatePath(`/app/${projectId}/call-sheets/${shootingDayId}`);
  return {};
}
