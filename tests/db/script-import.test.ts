import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { importReviewedProposalCore } from "@/lib/script-analysis-core";
import { dropOrganization, makeProject } from "./fixtures";

const proposal = {
  characters: [{ name: "AUREL" }, { name: "DORIAN" }],
  locations: [{ name: "Pista de tenis" }],
  props: [{ name: "Raqueta", category: "PROP" }],
  scenes: [
    {
      number: "1",
      intExt: "EXT",
      dayPart: "DAY",
      locationName: "Pista de tenis",
      description: "Entrenan",
      action: "Aurel golpea",
      characterNames: ["AUREL", "DORIAN"],
      propNames: ["Raqueta"],
    },
    { number: "2", intExt: "INT", dayPart: "NIGHT", locationName: "Vestuario", characterNames: ["AUREL"] },
  ],
};

let orgId: string | null = null;
afterEach(async () => {
  if (orgId) await dropOrganization(orgId);
  orgId = null;
});

async function importOnce(projectId: string, organizationId: string, replace = false) {
  const analysis = await prisma.scriptAnalysis.create({ data: { projectId, proposedData: proposal } });
  return importReviewedProposalCore(projectId, organizationId, analysis.id, proposal, replace);
}

describe("importar un guion analizado", () => {
  it("crea escenas, personajes, sitios y desglose", async () => {
    const { org, project } = await makeProject();
    orgId = org.id;
    expect(await importOnce(project.id, org.id)).toBe(true);
    const scenes = await prisma.scene.findMany({
      where: { projectId: project.id },
      orderBy: { number: "asc" },
      include: { characters: true, breakdownElements: true, location: true },
    });
    expect(scenes).toHaveLength(2);
    expect(scenes[0]).toMatchObject({ intExt: "EXT", dayPart: "DAY", location: { name: "Pista de tenis" } });
    expect(scenes[0].characters).toHaveLength(2);
    expect(scenes[0].breakdownElements).toHaveLength(1);
    // Un sitio que solo cita una escena también se crea.
    expect(scenes[1].location?.name).toBe("Vestuario");
  });

  it("reimportar conserva el desglose hecho a mano y los planos", async () => {
    const { org, project } = await makeProject();
    orgId = org.id;
    await importOnce(project.id, org.id);
    const scene = await prisma.scene.findFirstOrThrow({ where: { projectId: project.id, number: "1" } });
    const wardrobe = await prisma.breakdownElement.create({ data: { projectId: project.id, category: "WARDROBE", name: "Muñequera verde" } });
    await prisma.sceneBreakdownElement.create({ data: { sceneId: scene.id, breakdownElementId: wardrobe.id } });
    await prisma.shot.create({ data: { sceneId: scene.id, number: "1", shotSize: "PG" } });

    expect(await importOnce(project.id, org.id)).toBe(true);
    const after = await prisma.scene.findUniqueOrThrow({ where: { id: scene.id }, include: { breakdownElements: true, shots: true } });
    expect(after.breakdownElements).toHaveLength(2);
    expect(after.shots).toHaveLength(1);
    expect(await prisma.scene.count({ where: { projectId: project.id } })).toBe(2);
  });

  it("reemplazar el guion conserva la ficha del personaje y la guarda en la copia", async () => {
    const { org, project } = await makeProject();
    orgId = org.id;
    await importOnce(project.id, org.id);
    const aurel = await prisma.character.findFirstOrThrow({ where: { projectId: project.id, name: "AUREL" } });
    await prisma.character.update({ where: { id: aurel.id }, data: { sheet: { role: "Protagonista" } } });

    expect(await importOnce(project.id, org.id, true)).toBe(true);
    const again = await prisma.character.findFirstOrThrow({ where: { projectId: project.id, name: "AUREL" } });
    expect(again.sheet).toMatchObject({ role: "Protagonista" });
    const backup = await prisma.projectBackup.findFirstOrThrow({ where: { projectId: project.id }, orderBy: { createdAt: "desc" } });
    const saved = (backup.data as { characters: { name: string; sheet?: { role?: string } }[] }).characters.find((c) => c.name === "AUREL");
    expect(saved?.sheet?.role).toBe("Protagonista");
  });
});
