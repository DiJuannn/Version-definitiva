"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.project.create({
    data: { name, organizationId: profile.organizationId },
  });

  revalidatePath("/app");
  revalidatePath("/app/proyectos");
}
