"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;

  const profile = await prisma.user.findUnique({ where: { id: user.id } });
  if (!profile) return;

  await prisma.project.create({
    data: { name, organizationId: profile.organizationId },
  });

  revalidatePath("/dashboard");
}
