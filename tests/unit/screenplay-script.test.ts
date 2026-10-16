import { describe, expect, it } from "vitest";
import {
  BLOCK_HINTS,
  BLOCK_LABELS,
  BLOCK_TECH,
  BLOCK_TYPES,
  UNTITLED_HEADING,
  blockShortcutKeys,
  characterLooksLikeSentence,
  headingLooksLikeSentence,
  looksLikeTransition,
  sceneNumbering,
  shortcutLabel,
  type ScreenplayBlock,
} from "@/lib/screenplay/blocks";
import { formatDuration, layoutScreenplay, screenplayStats, scriptLength } from "@/lib/screenplay/layout";
import { parsePastedText, toFountain } from "@/lib/screenplay/fountain";
import { scenesFromBlocks } from "@/lib/screenplay/story";

describe("vocabulario", () => {
  it("cada tipo tiene nombre llano, técnico y pista", () => {
    for (const t of BLOCK_TYPES) {
      expect(BLOCK_LABELS[t]).toBeTruthy();
      expect(BLOCK_TECH[t]).toBeTruthy();
      expect(BLOCK_HINTS[t]).toBeTruthy();
    }
    expect(BLOCK_LABELS.sceneHeading).toBe("Lugar y hora");
    expect(BLOCK_LABELS.action).toBe("Lo que se ve");
    expect(BLOCK_TECH.parenthetical).toBe("Acotación");
  });

  it("atajos Ctrl+Alt (⌘⌥ en Mac), no Ctrl+número", () => {
    expect(blockShortcutKeys("character")).toBe("Mod-Alt-3");
    expect(shortcutLabel("character")).toBe("Ctrl+Alt+3");
    expect(shortcutLabel("character", true)).toBe("⌘⌥3");
  });
});

describe("reglas de forma", () => {
  it.each([
    ["Mi abuela vive sola en un pueblo de montaña.", true],
    ["Hace sol.", true],
    ["Llueve", false],
    ["COCINA", false],
    ["cocina de la casa de Lucía y Juan - noche", false],
    ["INT. Mi abuela vive sola en un pueblo.", false],
    ["CASA DE LA ABUELA DE LUCÍA", false],
  ])("«%s» parece una frase: %s", (text, out) => expect(headingLooksLikeSentence(text)).toBe(out));

  it.each([
    ["Lucía cierra la ventana y suspira.", true],
    ["LUCÍA", false],
    ["EL HOMBRE DEL SOMBRERO GRIS", false],
    ["Lucía (V.O.)", false],
  ])("«%s» como personaje parece descripción: %s", (text, out) => expect(characterLooksLikeSentence(text)).toBe(out));

  it.each([
    ["CORTE A:", true],
    ["corte a:", true],
    ["FUNDIDO A NEGRO.", true],
    ["DISOLVENCIA A:", true],
    ["Le dijo a:", false],
  ])("«%s» es transición: %s", (text, out) => expect(looksLikeTransition(text)).toBe(out));
});

// Escena 2 sin encabezado (nace de una idea suelta) y un encabezado vacío
// sin nada debajo (no cuenta).
const blocks: ScreenplayBlock[] = [
  { type: "sceneHeading", text: "INT. CASA - DÍA", id: "a" },
  { type: "action", text: "Algo pasa." },
  { type: "sceneHeading", text: "", id: "b" },
  { type: "note", text: "Una idea suelta." },
  { type: "sceneHeading", text: "", id: "c" },
  { type: "sceneHeading", text: "EXT. CALLE - NOCHE", id: "d" },
  ...Array.from({ length: 40 }, (_, i) => ({ type: "action" as const, text: `Línea ${i} de una escena larga que ocupa espacio en la página.` })),
];

describe("numeración única (M3)", () => {
  it("cuenta las escenas sin encabezado con texto, no las vacías", () => {
    expect([...sceneNumbering(blocks)]).toEqual([
      [0, 1],
      [2, 2],
      [5, 3],
    ]);
  });

  it("el PDF imprime un encabezado de relleno con el mismo número que el editor", () => {
    const pages = layoutScreenplay(blocks);
    const numbered = pages.flatMap((p) => p.lines).filter((l) => l.sceneNumber);
    expect(numbered.map((l) => [l.sceneNumber, l.text])).toEqual([
      ["1", "INT. CASA - DÍA"],
      ["2", UNTITLED_HEADING],
      ["3", "EXT. CALLE - NOCHE"],
    ]);
  });

  it("la tira y producción usan esos mismos números", () => {
    expect(scenesFromBlocks(blocks, "A4", { untitled: true }).map((s) => [s.sid, s.number])).toEqual([
      ["a", 1],
      ["b", 2],
      ["d", 3],
    ]);
    // Producción no recibe la escena sin encabezado, pero no renumera.
    expect(scenesFromBlocks(blocks).map((s) => [s.sid, s.number])).toEqual([
      ["a", 1],
      ["d", 3],
    ]);
    expect(screenplayStats(blocks).scenes).toBe(3);
  });

  it("una escena sin encabezado mide lo suyo, no desde el principio del guion", () => {
    const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
    const b = scenes.find((s) => s.sid === "b")!;
    const d = scenes.find((s) => s.sid === "d")!;
    expect(b.eighths).toBe(1);
    expect(d.eighths).toBeGreaterThan(b.eighths);
  });

  it("Fountain también lleva el encabezado de relleno", () => {
    expect(toFountain(blocks)).toContain(`.${UNTITLED_HEADING}`);
  });
});

describe("la medida del guion (M6)", () => {
  it("vacío", () => {
    expect(scriptLength([]).label).toBe("Sin páginas");
  });

  it("una sola cuenta para páginas, octavos y minutos", () => {
    const long: ScreenplayBlock[] = Array.from({ length: 120 }, (_, i) =>
      i % 10 === 0
        ? { type: "sceneHeading", text: `INT. SITIO ${i} - DÍA`, id: `s${i}` }
        : { type: "action", text: "Una acción de dos líneas que ocupa bastante en la página para que el guion crezca de verdad." },
    );
    const len = scriptLength(long);
    expect(len.printedPages).toBe(layoutScreenplay(long).length);
    expect(len.eighths).toBeLessThanOrEqual(len.printedPages * 8);
    expect(len.eighths).toBeGreaterThan((len.printedPages - 1) * 8);
    expect(len.label).toMatch(/^\d+( \d\/8)? págs\. · ≈ \d+ min$/);
    expect(screenplayStats(long).pages).toBe(len.printedPages);
    const sum = scenesFromBlocks(long).reduce((n, s) => n + s.eighths, 0);
    expect(Math.abs(sum - len.eighths)).toBeLessThanOrEqual(scenesFromBlocks(long).length);
  });

  it.each([
    [45, "45 s"],
    [120, "2 min"],
    [645, "10 min 45 s"],
  ])("%i s → %s", (s, out) => expect(formatDuration(s)).toBe(out));
});

describe("texto pegado (B2)", () => {
  it("un párrafo por línea", () => {
    expect(
      parsePastedText("INT. BAR - NOCHE\nMarta entra empapada.\nMARTA\n(sin aliento)\n¿Has visto a Lucía?\nJuan se gira.\nCORTE A:\next. calle - día"),
    ).toEqual([
      { type: "sceneHeading", text: "INT. BAR - NOCHE" },
      { type: "action", text: "Marta entra empapada." },
      { type: "character", text: "MARTA" },
      { type: "parenthetical", text: "(sin aliento)" },
      { type: "dialogue", text: "¿Has visto a Lucía?" },
      { type: "action", text: "Juan se gira." },
      { type: "transition", text: "CORTE A:" },
      { type: "sceneHeading", text: "EXT. CALLE - DÍA" },
    ]);
  });

  it("un texto normal se queda como «Lo que se ve»", () => {
    expect(parsePastedText("Hola Marta,\nte paso la escena.\nUn abrazo.").map((b) => b.type)).toEqual(["action", "action", "action"]);
  });

  it("mayúsculas sueltas al final no son un personaje", () => {
    expect(parsePastedText("Entra.\nFIN").map((b) => b.type)).toEqual(["action", "action"]);
  });
});
