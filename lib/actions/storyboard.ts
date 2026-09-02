"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { optionalString } from "@/lib/form-utils";
import { uploadProjectFile } from "@/lib/storage";
import { createStoryboardFrameCore, deleteStoryboardFrameCore } from "@/lib/storyboard-core";

export async function addStoryboardFrame(
  projectId: string,
  shotId: string,
  formData: FormData,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const shot = await prisma.shot.findFirst({
    where: { id: shotId, scene: { projectId } },
  });
  if (!shot) return;

  const file = formData.get("image");
  let imageUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadProjectFile(projectId, file);
    imageUrl = uploaded?.url ?? null;
  }

  await createStoryboardFrameCore(shotId, {
    imageUrl,
    description: optionalString(formData.get("description")),
  });

  revalidatePath(`/app/${projectId}/storyboard`);
}

export async function deleteStoryboardFrame(
  projectId: string,
  frameId: string,
) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  await deleteStoryboardFrameCore(projectId, frameId);

  revalidatePath(`/app/${projectId}/storyboard`);
}
