import { describe, expect, it } from "vitest";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import { scenesFromBlocks } from "@/lib/screenplay/story";
import { nextStep, type NextStepInput } from "@/components/screenplay/next-step-rules";

function scene(id: string, extra: ScreenplayBlock[] = []): ScreenplayBlock[] {
  return [{ type: "sceneHeading", text: `INT. SITIO ${id} - DÍA`, id }, { type: "action", text: "Algo pasa." }, ...extra];
}
const talk: ScreenplayBlock[] = [
  { type: "character", text: "LUCÍA" },
  { type: "dialogue", text: "Hola." },
];

function input(blocks: ScreenplayBlock[], patch: Partial<NextStepInput> = {}): NextStepInput {
  return { blocks, scenes: scenesFromBlocks(blocks, "A4", { untitled: true }), beats: {}, looseUnused: 0, hasIdea: false, ...patch };
}

describe("«¿Y ahora qué?»", () => {
  it("vacío: empezar por la escena más clara", () => {
    const s = nextStep(input([{ type: "sceneHeading", text: "", id: "a" }]));
    expect(s.id).toBe("empty");
    expect(s.actions.map((a) => a.id)).toEqual(["write", "ideas"]);
  });

  it("sin diálogo: cómo hacer que alguien hable", () => {
    const s = nextStep(input(scene("a")));
    expect(s.id).toBe("no-dialogue");
    expect(s.text).toContain("Tab");
  });

  it("primera escena: la siguiente", () => {
    const s = nextStep(input(scene("a", talk), { looseUnused: 2 }));
    expect(s.id).toBe("first-scene");
    expect(s.actions.map((a) => a.label)).toEqual(["Nueva escena", "Ver ideas sueltas (2)"]);
  });

  it("dos escenas sin idea: qué quiere el protagonista", () => {
    expect(nextStep(input([...scene("a", talk), ...scene("b")])).id).toBe("want");
    expect(nextStep(input([...scene("a", talk), ...scene("b")], { hasIdea: true })).id).toBe("next-scene");
  });

  it("tres escenas sin momentos marcados: «Algo cambia»", () => {
    const s = nextStep(input([...scene("a", talk), ...scene("b"), ...scene("c")], { hasIdea: true }));
    expect(s.id).toBe("no-moments");
    expect(s.text).toContain("«Algo cambia»");
    expect(s.actions[0].id).toBe("moments");
  });

  it("momentos a medias: el siguiente por decidir (o ideas sin usar antes)", () => {
    const blocks = [...scene("a", talk), ...scene("b"), ...scene("c")];
    const s = nextStep(input(blocks, { beats: { inciting: "b" } }));
    expect(s.id).toBe("moments-left");
    expect(s.title).toBe("1 de 5 momentos decididos");
    expect(s.text).toContain("«No hay vuelta atrás»");
    expect(nextStep(input(blocks, { beats: { inciting: "b" }, looseUnused: 3 })).title).toBe("Tienes 3 ideas sueltas");
    // Un momento marcado en una escena que ya no existe no cuenta.
    expect(nextStep(input(blocks, { beats: { inciting: "zz" } })).id).toBe("no-moments");
  });

  it("borrador listo: cinco escenas y los cinco momentos", () => {
    const ids = ["a", "b", "c", "d", "e"];
    const blocks = ids.flatMap((id, i) => scene(id, i === 0 ? talk : []));
    const beats = { inciting: "a", turn1: "b", midpoint: "c", turn2: "d", climax: "e" };
    const s = nextStep(input(blocks, { beats }));
    expect(s.id).toBe("draft");
    expect(s.actions.map((a) => a.id)).toEqual(["review", "export"]);
    // Con «5 actos» o «Libre» no hay momentos: basta con las escenas.
    expect(nextStep(input(blocks, { moments: false })).id).toBe("draft");
  });
});
