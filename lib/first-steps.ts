// Los cinco pasos que llevan un proyecto del guion al rodaje, en orden. Se
// tachan solos con lo que ya hay hecho; los enseña la portada mientras falte
// alguno.

import { prisma } from "@/lib/prisma";

export type FirstStep = {
  key: string;
  title: string;
  why: string;
  href: string;
  cta: string;
  done: boolean;
  detail: string;
};

export async function getFirstSteps(projectId: string): Promise<FirstStep[]> {
  const base = `/app/${projectId}`;
  const [scenes, broken, withShots, daysWithWork, sheets] = await Promise.all([
    prisma.scene.count({ where: { projectId } }),
    prisma.scene.count({ where: { projectId, breakdownElements: { some: {} } } }),
    prisma.scene.count({ where: { projectId, shots: { some: {} } } }),
    prisma.shootingDay.count({ where: { projectId, OR: [{ shots: { some: {} } }, { scenes: { some: {} } }] } }),
    prisma.callSheet.count({ where: { shootingDay: { projectId } } }),
  ]);
  const of = (n: number) => (scenes ? `${n} de ${scenes} escenas` : "");
  return [
    {
      key: "guion",
      title: "El guion",
      why: "Súbelo o escríbelo en Guiones: de sus escenas sale todo lo demás.",
      href: `${base}/guion`,
      cta: "Ir a Guion",
      done: scenes > 0,
      detail: scenes ? `${scenes} ${scenes === 1 ? "escena" : "escenas"}` : "",
    },
    {
      key: "desglose",
      title: "El desglose",
      why: "Marca en cada escena lo que hace falta: atrezzo, vestuario, vehículos…",
      href: `${base}/desglose`,
      cta: "Desglosar",
      done: broken > 0,
      detail: of(broken),
    },
    {
      key: "planos",
      title: "Los planos",
      why: "Decide cómo se rueda cada escena, plano a plano.",
      href: `${base}/shot-list`,
      cta: "Planificar",
      done: withShots > 0,
      detail: of(withShots),
    },
    {
      key: "plan",
      title: "El plan de rodaje",
      why: "Reparte los planos en jornadas; las horas se calculan solas.",
      href: `${base}/plan-de-rodaje`,
      cta: "Hacer el plan",
      done: daysWithWork > 0,
      detail: daysWithWork ? `${daysWithWork} ${daysWithWork === 1 ? "jornada" : "jornadas"}` : "",
    },
    {
      key: "hoja",
      title: "La hoja de llamada",
      why: "La que recibe el equipo la víspera: a qué hora, dónde y qué se rueda.",
      href: `${base}/call-sheets`,
      cta: "Ver hojas",
      done: sheets > 0,
      detail: sheets ? `${sheets} ${sheets === 1 ? "hoja" : "hojas"}` : "",
    },
  ];
}
