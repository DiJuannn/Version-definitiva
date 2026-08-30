import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";

export async function getProjectForCurrentUser(projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return prisma.project.findFirst({
    where: { id: projectId, organizationId: profile.organizationId },
  });
}
