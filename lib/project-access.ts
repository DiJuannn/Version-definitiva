import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";

// Un proyecto es tuyo si es de tu organización, o si alguien te lo ha
// compartido directamente (ProjectShare aceptado) — en ese segundo caso
// tienes acceso solo a ESE proyecto, no al resto de la organización dueña.
export async function getProjectForCurrentUser(projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  return prisma.project.findFirst({
    where: {
      id: projectId,
      OR: [
        { organizationId: profile.organizationId },
        { shares: { some: { userId: profile.id } } },
      ],
    },
  });
}
