import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function getProjectForCurrentUser(projectId: string) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const profile = await prisma.user.findUnique({ where: { id: user.id } });
  if (!profile) return null;

  return prisma.project.findFirst({
    where: { id: projectId, organizationId: profile.organizationId },
  });
}
