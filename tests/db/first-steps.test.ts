import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { getFirstSteps } from "@/lib/first-steps";
import { dropOrganization, makeProject } from "./fixtures";

let orgId: string | null = null;
afterEach(async () => {
  if (orgId) await dropOrganization(orgId);
  orgId = null;
});

describe("primeros pasos", () => {
  it("se tachan solos según lo que ya hay hecho", async () => {
    const { org, project } = await makeProject();
    orgId = org.id;
    const done = async () => (await getFirstSteps(project.id)).filter((s) => s.done).map((s) => s.key);
    expect(await done()).toEqual([]);

    const scene = await prisma.scene.create({ data: { projectId: project.id, number: "1" } });
    expect(await done()).toEqual(["guion"]);

    const prop = await prisma.breakdownElement.create({ data: { projectId: project.id, category: "PROP", name: "Carta" } });
    await prisma.sceneBreakdownElement.create({ data: { sceneId: scene.id, breakdownElementId: prop.id } });
    const day = await prisma.shootingDay.create({ data: { projectId: project.id, date: new Date("2026-11-07") } });
    await prisma.shot.create({ data: { sceneId: scene.id, number: "1", shootingDayId: day.id } });
    expect(await done()).toEqual(["guion", "desglose", "planos", "plan"]);

    await prisma.callSheet.create({ data: { shootingDayId: day.id } });
    expect(await done()).toHaveLength(5);
  });
});
