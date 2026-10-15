import { prisma } from "@/lib/prisma";
import { ydocFromBlocks } from "@/lib/screenplay/ydoc";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";

// Una organización y un proyecto de usar y tirar para cada prueba.
export async function makeProject(name = "Prueba") {
  const tag = `test-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  const org = await prisma.organization.create({ data: { name: `Org ${tag}` } });
  const project = await prisma.project.create({ data: { organizationId: org.id, name: `${name} ${tag}` } });
  return { org, project };
}

export async function makeScreenplay(organizationId: string, projectId: string | null, blocks: ScreenplayBlock[]) {
  return prisma.screenplay.create({
    data: { organizationId, projectId, title: "Guion de prueba", ydoc: Buffer.from(ydocFromBlocks(blocks)) },
  });
}

export async function setScreenplayBlocks(id: string, blocks: ScreenplayBlock[]) {
  await prisma.screenplay.update({ where: { id }, data: { ydoc: Buffer.from(ydocFromBlocks(blocks)) } });
}

// Borra todo lo de la organización, en el orden que piden las claves ajenas.
export async function dropOrganization(organizationId: string) {
  const projects = (await prisma.project.findMany({ where: { organizationId }, select: { id: true } })).map((p) => p.id);
  const inProjects = { projectId: { in: projects } };
  await prisma.$transaction([
    prisma.scene.deleteMany({ where: inProjects }),
    prisma.shootingDay.deleteMany({ where: inProjects }),
    prisma.character.deleteMany({ where: inProjects }),
    prisma.actor.deleteMany({ where: inProjects }),
    prisma.breakdownElement.deleteMany({ where: inProjects }),
    prisma.crewMember.deleteMany({ where: inProjects }),
    prisma.budgetCategory.deleteMany({ where: inProjects }),
    prisma.document.deleteMany({ where: inProjects }),
    prisma.scriptFile.deleteMany({ where: inProjects }),
    prisma.screenplay.deleteMany({ where: { organizationId } }),
    prisma.project.deleteMany({ where: { organizationId } }),
    prisma.location.deleteMany({ where: { organizationId } }),
    prisma.organization.delete({ where: { id: organizationId } }),
  ]);
}

// Un guion corto: tres escenas con sus personajes.
export const SCRIPT: ScreenplayBlock[] = [
  { type: "sceneHeading", text: "EXT. AZOTEA - DÍA", id: "sAzotea" },
  { type: "action", text: "MARA mira la ciudad desde el borde." },
  { type: "character", text: "MARA" },
  { type: "dialogue", text: "Desde aquí no se oye nada." },
  { type: "sceneHeading", text: "INT. COCINA - NOCHE", id: "sCocina" },
  { type: "action", text: "LEO abre el horno y encuentra una carta." },
  { type: "character", text: "LEO" },
  { type: "dialogue", text: "¿Y esto?" },
  { type: "sceneHeading", text: "EXT. ESTACIÓN - ATARDECER", id: "sEstacion" },
  { type: "action", text: "MARA sube al último tren. LEO llega tarde." },
];
