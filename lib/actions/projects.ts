"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteProjectFile } from "@/lib/storage";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.project.create({
    data: { name, organizationId: profile.organizationId, createdById: profile.id },
  });

  revalidatePath("/app");
  revalidatePath("/app/proyectos");
}

// Borrar un Project no cascada solo con la FK en la base de datos: Actor,
// Character, ScriptFile, Scene, BreakdownElement, CrewMember, ShootingDay,
// BudgetCategory y Document apuntan a Project sin onDelete Cascade (para no
// arrastrar sin querer datos compartidos entre proyectos como Location o
// Person, que sí cascadean desde ahí). Por eso se borran a mano aquí, en
// orden seguro, antes de borrar el Project — lo demás (ScriptAnalysis,
// ContinuityCheck, Task, CalendarEvent, y todo lo colgado de Scene/
// ShootingDay/BudgetCategory) sí tiene Cascade declarado y se borra solo.
export async function deleteProject(projectId: string, formData: FormData) {
  void formData;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  const [scriptFiles, documents, storyboardFrames] = await Promise.all([
    prisma.scriptFile.findMany({ where: { projectId }, select: { fileUrl: true } }),
    prisma.document.findMany({ where: { projectId }, select: { fileUrl: true } }),
    prisma.storyboardFrame.findMany({
      where: { shot: { scene: { projectId } } },
      select: { imageUrl: true },
    }),
  ]);

  await prisma.$transaction([
    prisma.scriptFile.deleteMany({ where: { projectId } }),
    prisma.document.deleteMany({ where: { projectId } }),
    prisma.character.deleteMany({ where: { projectId } }),
    prisma.actor.deleteMany({ where: { projectId } }),
    prisma.breakdownElement.deleteMany({ where: { projectId } }),
    prisma.crewMember.deleteMany({ where: { projectId } }),
    prisma.budgetCategory.deleteMany({ where: { projectId } }),
    prisma.shootingDay.deleteMany({ where: { projectId } }),
    prisma.scene.deleteMany({ where: { projectId } }),
    prisma.project.delete({ where: { id: projectId } }),
  ]);

  const fileUrls = [
    ...scriptFiles.map((f) => f.fileUrl),
    ...documents.map((d) => d.fileUrl),
    ...storyboardFrames.flatMap((s) => (s.imageUrl ? [s.imageUrl] : [])),
  ];
  // allSettled a propósito: el proyecto ya quedó borrado de la base de
  // datos (lo importante), un fallo limpiando el storage no debe romper esto.
  await Promise.allSettled(fileUrls.map((url) => deleteProjectFile(url)));

  revalidatePath("/app");
  revalidatePath("/app/proyectos");
}
