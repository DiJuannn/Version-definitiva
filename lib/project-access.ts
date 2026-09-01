import { prisma } from "@/lib/prisma";
import { getCurrentProfile, type Profile } from "@/lib/current-user";

// Un proyecto es tuyo si es de tu organización, o si alguien te lo ha
// compartido directamente (ProjectShare aceptado) — en ese segundo caso
// tienes acceso solo a ESE proyecto, no al resto de la organización dueña.
//
// Recibe el `profile` ya resuelto (en vez de leerlo él mismo) para que
// tanto la web (cookie, getCurrentProfile) como la API de la app móvil
// (token, getMobileProfile) compartan exactamente la misma comprobación
// de acceso sin duplicarla.
export async function getProjectForProfile(profile: Profile, projectId: string) {
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

export async function getProjectForCurrentUser(projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const project = await getProjectForProfile(profile, projectId);

  // No se espera esta escritura (no debe ralentizar la página) ni
  // importa si falla — es solo para que el dashboard sepa cuál fue el
  // último proyecto que este usuario abrió de verdad, en vez de
  // enseñar siempre el más reciente por fecha de creación/edición.
  if (project && profile.lastVisitedProjectId !== projectId) {
    prisma.user
      .update({ where: { id: profile.id }, data: { lastVisitedProjectId: projectId } })
      .catch(() => {});
  }

  return project;
}

// Misma idea que getProjectForProfile pero para el listado — usada por
// /app/proyectos y por la API de la app móvil.
export function listProjectsForProfile(profile: Profile) {
  return prisma.project.findMany({
    where: {
      OR: [
        { organizationId: profile.organizationId },
        { shares: { some: { userId: profile.id } } },
      ],
    },
    orderBy: { createdAt: "desc" },
    include: {
      organization: { select: { name: true } },
      createdBy: { select: { fullName: true, email: true } },
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
