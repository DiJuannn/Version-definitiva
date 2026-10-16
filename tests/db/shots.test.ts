import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { createGuidedShotsCore } from "@/lib/shots-core";
import { dropOrganization, makeProject } from "./fixtures";

let orgId: string | null = null;
afterEach(async () => {
  if (orgId) await dropOrganization(orgId);
  orgId = null;
});

describe("crear planos con la guía", () => {
  it("numera detrás del último plano y guarda audio, duración y quién sale", async () => {
    const { org, project } = await makeProject();
    orgId = org.id;
    const [mara, leo] = await Promise.all([
      prisma.character.create({ data: { projectId: project.id, name: "MARA" } }),
      prisma.character.create({ data: { projectId: project.id, name: "LEO" } }),
    ]);
    const scene = await prisma.scene.create({
      data: {
        projectId: project.id,
        number: "4",
        characters: { create: [{ characterId: mara.id }, { characterId: leo.id }] },
        shots: { create: [{ number: "2", shotSize: "PG" }] },
      },
    });
    const outsider = await prisma.character.create({ data: { projectId: project.id, name: "TAXISTA" } });

    const created = await createGuidedShotsCore(project.id, scene.id, [
      { shotSize: "PM", angle: "Normal", movement: "Fijo", description: "Mara", characterIds: [mara.id, outsider.id], audio: "MARA: Hola", durationSec: 7 },
      { shotSize: "PP", angle: "Picado", movement: "Fijo", description: "Leo" },
    ]);
    expect(created).toBe(2);

    const shots = await prisma.shot.findMany({
      where: { sceneId: scene.id },
      orderBy: { order: "asc" },
      include: { characters: true },
    });
    expect(shots.map((s) => s.number)).toEqual(["2", "3", "4"]);
    expect(shots[1]).toMatchObject({ audio: "MARA: Hola", durationSec: 7 });
    // Solo personajes que están en la escena; sin decir nada, todo el reparto.
    expect(shots[1].characters.map((c) => c.characterId)).toEqual([mara.id]);
    expect(shots[2].characters).toHaveLength(2);
  });
});
