"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { FREE_PROJECT_COLLABORATORS_LIMIT } from "@/lib/limits";
import { isPro } from "@/lib/plan";

export type CreateProjectShareState = { error: string } | undefined;

// Solo la organización dueña del proyecto puede generar o revocar enlaces
// para compartirlo — alguien que ya tiene acceso solo por un enlace
// compartido no puede generar más enlaces él mismo.
async function requireOwningOrg(projectId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const project = await prisma.project.findFirst({
    where: { id: projectId, organizationId: profile.organizationId },
    select: { id: true },
  });
  return project ? profile : null;
}

export async function createProjectShare(
  projectId: string,
  // Firma exigida por useActionState (prevState, formData), sin usarlos.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _prevState: CreateProjectShareState,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _formData: FormData,
): Promise<CreateProjectShareState> {
  const profile = await requireOwningOrg(projectId);
  if (!profile) return { error: "No tienes acceso a este proyecto." };

  if (!isPro(profile.organization.plan)) {
    const count = await prisma.projectShare.count({ where: { projectId } });
    if (count >= FREE_PROJECT_COLLABORATORS_LIMIT) {
      return {
        error: `El plan gratuito permite hasta ${FREE_PROJECT_COLLABORATORS_LIMIT} colaboradores por proyecto. Pásate a PRO para invitar a más gente.`,
      };
    }
  }

  await prisma.projectShare.create({ data: { projectId } });
  revalidatePath(`/app/${projectId}`);
  return undefined;
}

export async function revokeProjectShare(projectId: string, shareId: string) {
  const profile = await requireOwningOrg(projectId);
  if (!profile) return;

  await prisma.projectShare.deleteMany({ where: { id: shareId, projectId } });
  revalidatePath(`/app/${projectId}`);
}

// La página de aceptar ya ha comprobado que el enlace es válido y que está
// libre (o ya es tuyo) antes de mostrar el botón que llama a esto — aquí
// solo queda reclamarlo y entrar.
export async function acceptProjectShare(token: string) {
  const profile = await getCurrentProfile();
  if (!profile) {
    redirect(`/app/login?next=${encodeURIComponent(`/app/proyectos/compartido/${token}`)}`);
  }

  const share = await prisma.projectShare.findUnique({ where: { token } });
  if (!share) redirect(`/app/proyectos/compartido/${token}`);

  if (!share.userId) {
    await prisma.projectShare.update({
      where: { id: share.id },
      data: { userId: profile.id, acceptedAt: new Date() },
    });
  }

  redirect(`/app/${share.projectId}`);
}
