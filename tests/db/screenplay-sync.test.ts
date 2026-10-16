import { afterEach, describe, expect, it } from "vitest";
import { prisma } from "@/lib/prisma";
import { syncScreenplayScenesCore } from "@/lib/screenplay-scenes";
import { SCRIPT, dropOrganization, makeProject, makeScreenplay, setScreenplayBlocks } from "./fixtures";

let orgId: string | null = null;
afterEach(async () => {
  if (orgId) await dropOrganization(orgId);
  orgId = null;
});

const scenesOf = (projectId: string) =>
  prisma.scene.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: { characters: { include: { character: true } }, shots: true, location: true },
  });

describe("guion de Guiones → escenas de producción", () => {
  it("crea las escenas con su encabezado, momento del día y quién sale", async () => {
    const { org, project } = await makeProject();
    orgId = org.id;
    await makeScreenplay(org.id, project.id, SCRIPT);
    const res = await syncScreenplayScenesCore(project.id, org.id);
    expect(res).toMatchObject({ ok: true, added: 3 });
    const scenes = await scenesOf(project.id);
    expect(scenes.map((s) => [s.number, s.intExt, s.dayPart, s.location?.name])).toEqual([
      ["1", "EXT", "DAY", "Azotea"],
      ["2", "INT", "NIGHT", "Cocina"],
      ["3", "EXT", "DUSK", "Estación"],
    ]);
    expect(scenes[2].characters.map((c) => c.character.name).sort()).toEqual(["LEO", "MARA"]);
  });

  it("reordenar y reescribir no mueve los planos de escena ni borra nada", async () => {
    const { org, project } = await makeProject();
    orgId = org.id;
    const sp = await makeScreenplay(org.id, project.id, SCRIPT);
    await syncScreenplayScenesCore(project.id, org.id);
    const cocina = await prisma.scene.findFirstOrThrow({ where: { projectId: project.id, scriptSid: "sCocina" } });
    await prisma.shot.create({ data: { sceneId: cocina.id, number: "1", shotSize: "PD", description: "La carta" } });

    // La cocina pasa a ser la primera escena, cambia a DÍA y desaparece la estación.
    await setScreenplayBlocks(sp.id, [
      { type: "sceneHeading", text: "INT. COCINA - DÍA", id: "sCocina" },
      { type: "action", text: "LEO abre el horno." },
      { type: "sceneHeading", text: "EXT. AZOTEA - DÍA", id: "sAzotea" },
      { type: "action", text: "MARA mira la ciudad." },
    ]);
    const res = await syncScreenplayScenesCore(project.id, org.id);
    expect(res).toMatchObject({ ok: true, gone: 1 });

    const after = await prisma.scene.findUniqueOrThrow({ where: { id: cocina.id }, include: { shots: true } });
    expect(after).toMatchObject({ number: "1", dayPart: "DAY" });
    expect(after.shots).toHaveLength(1);
    // La escena que ya no está en el guion no se borra.
    expect(await prisma.scene.count({ where: { projectId: project.id } })).toBe(3);
  });

  it("dos sincronizaciones a la vez no fallan ni duplican escenas ni personajes", async () => {
    // Varias rondas: las carreras no salen siempre a la primera.
    for (let round = 0; round < 5; round++) {
      const { org, project } = await makeProject();
      orgId = org.id;
      await makeScreenplay(org.id, project.id, SCRIPT);
      const results = await Promise.all([syncScreenplayScenesCore(project.id, org.id), syncScreenplayScenesCore(project.id, org.id)]);
      expect(results.every((r) => r.ok)).toBe(true);
      expect(await prisma.scene.count({ where: { projectId: project.id } })).toBe(3);
      expect(await prisma.character.count({ where: { projectId: project.id } })).toBe(2);
      await dropOrganization(org.id);
      orgId = null;
    }
  });

  it("adopta la escena que ya existía con el mismo número en vez de duplicarla", async () => {
    const { org, project } = await makeProject();
    orgId = org.id;
    const manual = await prisma.scene.create({ data: { projectId: project.id, number: "2", description: "Hecha a mano" } });
    await makeScreenplay(org.id, project.id, SCRIPT);
    await syncScreenplayScenesCore(project.id, org.id);
    const adopted = await prisma.scene.findUniqueOrThrow({ where: { id: manual.id } });
    expect(adopted.scriptSid).toBe("sCocina");
    expect(await prisma.scene.count({ where: { projectId: project.id } })).toBe(3);
  });
});
