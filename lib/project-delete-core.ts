import { prisma } from "@/lib/prisma";
import { deleteProjectFile } from "@/lib/storage";

// Compartido entre deleteProject (Server Action de la web,
// lib/actions/projects.ts) y DELETE /api/mobile/projects/:id — el borrado
// en cascada manual (ver el comentario original en deleteProject sobre
// por qué no es un onDelete: Cascade de la base de datos) es idéntico en
// las dos superficies, solo cambia quién comprueba el acceso antes de
// llamar a esto.
export async function deleteProjectCore(projectId: string): Promise<void> {
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
}
