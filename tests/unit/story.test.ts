import { describe, expect, it } from "vitest";
import { formatEighths, guessLooseKind, scenesFromBlocks } from "@/lib/screenplay/story";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";

describe("ideas sueltas: tipo adivinado", () => {
  it.each([
    ["—No vuelvas a llamarme hermano.", "dialogo"],
    ["«Ya es tarde»", "dialogo"],
    ["LEO, 40, conductor de grúa.", "personaje"],
    ["Al final ella se va en el último tren.", "final"],
    ["Una bicicleta roja tirada en la nieve.", "imagen"],
    ["Mara descubre la carta en el horno.", "momento"],
  ])("«%s» → %s", (text, kind) => {
    expect(guessLooseKind(text)).toBe(kind);
  });
});

describe("escenas a partir de los bloques", () => {
  const blocks: ScreenplayBlock[] = [
    { type: "sceneHeading", text: "INT. CASA - DÍA", id: "a" },
    { type: "action", text: "Algo pasa." },
    { type: "sceneHeading", text: "", id: "b" },
    { type: "note", text: "Una idea suelta." },
    { type: "sceneHeading", text: "", id: "c" },
  ];

  it("para producción solo cuentan las que tienen encabezado", () => {
    expect(scenesFromBlocks(blocks).map((s) => s.sid)).toEqual(["a"]);
  });

  it("al escribir cuentan también las que aún no tienen encabezado pero sí texto", () => {
    const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
    expect(scenes.map((s) => s.sid)).toEqual(["a", "b"]);
    expect(scenes.map((s) => s.number)).toEqual([1, 2]);
  });
});

describe("octavos de página", () => {
  it.each([
    [0, "—"],
    [3, "3/8"],
    [8, "1"],
    [13, "1 5/8"],
  ])("%i → %s", (n, out) => expect(formatEighths(n)).toBe(out));
});
