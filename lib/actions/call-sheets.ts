"use server";

import { revalidatePath } from "next/cache";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { upsertCallSheetCore } from "@/lib/call-sheets-core";

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

  revalidatePath(`/app/${projectId}/call-sheets/${shootingDayId}`);
  revalidatePath(`/app/${projectId}/call-sheets`);
}
