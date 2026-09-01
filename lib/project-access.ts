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

// El propietario que se muestra a un colaborador es la persona que creó
// el proyecto, no la productora entera — createdById es opcional porque
// los proyectos creados antes de esta función no lo tienen, así que en
// ese caso caemos al nombre de la organización.
export async function getProjectOwnerLabel(project: {
  createdById: string | null;
  organizationId: string;
}): Promise<string | null> {
  if (project.createdById) {
    const creator = await prisma.user.findUnique({
      where: { id: project.createdById },
      select: { fullName: true, email: true },
    });
    if (creator) return creator.fullName ?? creator.email;
  }

  const org = await prisma.organization.findUnique({
    where: { id: project.organizationId },
    select: { name: true },
  });
  return org?.name ?? null;
}
