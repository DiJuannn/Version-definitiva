import { describe, expect, it } from "vitest";
import { applyEdits, findMatches, nearestMatch, planRename, titleCase, type FindLine } from "@/lib/screenplay-find";

const LINES: FindLine[] = [
  { type: "sceneHeading", text: "INT. CASA DE ANA - NOCHE" },
  { type: "action", text: "ANA entra. Anabel la mira. Ana sonríe." },
  { type: "character", text: "ANA (V.O.)" },
  { type: "dialogue", text: "No soy Anabel, soy Ana." },
  { type: "character", text: "ANABEL" },
  { type: "note", text: "¿Ana o Anabel? Decidir." },
  { type: "character", text: "ana" },
];

describe("Buscar en el guion", () => {
  it("sin distinguir mayúsculas, en todo el guion", () => {
    expect(findMatches(LINES, { query: "ana" })).toHaveLength(11);
  });
  it("palabra entera: «Ana» no casa dentro de «Anabel»", () => {
    const m = findMatches(LINES, { query: "ana", wholeWord: true });
    expect(m.map((x) => x.line)).toEqual([0, 1, 1, 2, 3, 5, 6]);
  });
  it("mayúsculas exactas y solo en lo que dicen", () => {
    expect(findMatches(LINES, { query: "Ana", caseSensitive: true, wholeWord: true, types: ["dialogue"] })).toEqual([{ line: 3, from: 19, to: 22 }]);
  });
  it("caracteres especiales se buscan tal cual", () => {
    expect(findMatches(LINES, { query: "(V.O.)" })).toEqual([{ line: 2, from: 4, to: 10 }]);
    expect(findMatches(LINES, { query: "" })).toEqual([]);
  });
  it("la más cercana al cursor", () => {
    const m = findMatches(LINES, { query: "ana", wholeWord: true });
    expect(nearestMatch(m, 1, 12)).toBe(2);
    expect(nearestMatch(m, 99, 0)).toBe(0);
  });
});

describe("Renombrar un personaje", () => {
  it("cambia quién habla, las menciones y respeta notas y otros nombres", () => {
    const plan = planRename(LINES, "ana", "Lucía")!;
    expect(plan.from).toBe("ANA");
    expect(plan.to).toBe("LUCÍA");
    expect(plan.speaking).toBe(2);
    expect(plan.mentions).toBe(4);
    const out = applyEdits(LINES, plan.edits).map((l) => l.text);
    expect(out).toEqual([
      "INT. CASA DE LUCÍA - NOCHE",
      "LUCÍA entra. Anabel la mira. Lucía sonríe.",
      "LUCÍA (V.O.)",
      "No soy Anabel, soy Lucía.",
      "ANABEL",
      "¿Ana o Anabel? Decidir.",
      "LUCÍA",
    ]);
  });
  it("nada que hacer con el mismo nombre o vacío", () => {
    expect(planRename(LINES, "ANA", "ana")).toBeNull();
    expect(planRename(LINES, "ANA", "  ")).toBeNull();
  });
  it("nombres compuestos como nombre propio", () => {
    expect(titleCase("DON PEDRO")).toBe("Don Pedro");
    expect(titleCase("JEAN-LUC")).toBe("Jean-Luc");
  });
});
