// Cuánto lleva hecho cada fase de un proyecto, para la tira de película
// (Inicio, portada). Cada fase se mide con unas pocas comprobaciones de
// verdad («hay escenas», «x de y escenas tienen planos»…), cada una de 0 a 1;
// la fase vale la media. No pretende ser exacto: dice de un vistazo por
// dónde va el proyecto.

import { prisma } from "@/lib/prisma";
import { computeStage } from "@/lib/tool-rules";
import type { PhaseId } from "@/lib/project-phases";

export type ProjectProgress = {
  stage: PhaseId;
  // De 0 a 1, una por fase.
  phases: [number, number, number, number];
  // Lo que la tira dice en palabras: «Rodando · día 2 de 3».
  label: string;
};

const ratio = (a: number, b: number) => (b > 0 ? Math.min(1, a / b) : 0);
const avg = (xs: number[]) => xs.reduce((n, x) => n + x, 0) / xs.length;

export async function getProjectProgress(projectId: string): Promise<ProjectProgress> {
  const now = new Date();
  const [project, scenes, characters, cast, breakdown, scenesWithShots, scenesWithLocation, crew, budget, days, pastDays, sheets, cuts, submissions, documents, screenplay] =
    await Promise.all([
      prisma.project.findUnique({ where: { id: projectId }, select: { status: true } }),
      prisma.scene.count({ where: { projectId } }),
      prisma.character.count({ where: { projectId } }),
      prisma.character.count({ where: { projectId, actorId: { not: null } } }),
      prisma.breakdownElement.count({ where: { projectId } }),
      prisma.scene.count({ where: { projectId, shots: { some: {} } } }),
      prisma.scene.count({ where: { projectId, locationId: { not: null } } }),
      prisma.crewMember.count({ where: { projectId } }),
      prisma.budgetCategory.count({ where: { projectId } }),
      prisma.shootingDay.count({ where: { projectId } }),
      prisma.shootingDay.count({ where: { projectId, date: { lt: now } } }),
      prisma.callSheet.count({ where: { shootingDay: { projectId } } }),
      prisma.editCut.count({ where: { projectId } }),
      prisma.festivalSubmission.count({ where: { projectId } }),
      prisma.document.count({ where: { projectId } }),
      prisma.screenplay.findFirst({ where: { projectId }, select: { pageCount: true } }),
    ]);
  const status = project?.status ?? "DEVELOPMENT";
  const stage = computeStage({ status, scenes, characters, days, pastDays });
  const finished = status === "FINISHED";

  const phases: [number, number, number, number] = [
    stage > 1 ? 1 : avg([scenes > 0 || (screenplay?.pageCount ?? 0) > 0 ? 1 : 0.3 * Number(Boolean(screenplay)), characters > 0 ? 1 : 0]),
    stage > 2
      ? Math.max(0.85, avg([breakdown > 0 ? 1 : 0, ratio(scenesWithShots, scenes), crew > 0 ? 1 : 0, ratio(scenesWithLocation, scenes), budget > 0 ? 1 : 0, ratio(cast, characters)]))
      : avg([breakdown > 0 ? 1 : 0, ratio(scenesWithShots, scenes), crew > 0 ? 1 : 0, ratio(scenesWithLocation, scenes), budget > 0 ? 1 : 0, ratio(cast, characters)]),
    stage > 3 ? 1 : days ? avg([1, ratio(sheets, days), ratio(pastDays, days)]) : 0,
    finished ? 1 : stage === 4 ? avg([cuts > 0 ? 1 : 0, submissions > 0 ? 1 : 0, documents > 0 ? 1 : 0]) : 0,
  ];

  const label =
    stage === 1
      ? scenes > 0
        ? `Escribiendo · ${scenes} escenas`
        : "Escribiendo"
      : stage === 2
        ? `Preparando · ${scenesWithShots}/${scenes} escenas con planos`
        : stage === 3
          ? days
            ? `Rodando · día ${Math.min(pastDays + 1, days)} de ${days}`
            : "Rodando"
          : finished
            ? "Terminado"
            : "Entregando";
  return { stage, phases, label };
}
