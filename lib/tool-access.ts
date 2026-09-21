import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { ProjectFacts, ToolMode } from "@/lib/tool-rules";

// Lectura de datos del proyecto y de la preferencia de modo (solo servidor). Las reglas viven en tool-rules.ts.

export const TOOL_MODE_COOKIE = "taller_tools";
export const WELCOME_COOKIE = "taller_welcome";

export async function hasSeenWelcome(): Promise<boolean> {
  return (await cookies()).get(WELCOME_COOKIE)?.value === "1";
}

export async function getProjectFacts(projectId: string): Promise<ProjectFacts> {
  const endOfToday = new Date();
  endOfToday.setHours(23, 59, 59, 999);
  const [project, scenes, characters, days, pastDays] = await Promise.all([
    prisma.project.findUnique({ where: { id: projectId }, select: { status: true } }),
    prisma.scene.count({ where: { projectId } }),
    prisma.character.count({ where: { projectId } }),
    prisma.shootingDay.count({ where: { projectId } }),
    prisma.shootingDay.count({ where: { projectId, date: { lte: endOfToday } } }),
  ]);
  return { status: project?.status ?? "DEVELOPMENT", scenes, characters, days, pastDays };
}

// Simple por defecto; completo si la persona lo eligió o ya es de casa (3 o más proyectos).
export async function getToolMode(organizationId: string): Promise<ToolMode> {
  const stored = (await cookies()).get(TOOL_MODE_COOKIE)?.value;
  if (stored === "full" || stored === "simple") return stored;
  const projects = await prisma.project.count({ where: { organizationId } });
  return projects >= 3 ? "full" : "simple";
}

