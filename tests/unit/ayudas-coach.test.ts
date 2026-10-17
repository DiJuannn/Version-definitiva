import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import { scenesFromBlocks } from "@/lib/screenplay/story";
import { storyMaps } from "@/lib/screenplay/story-doc";
import { fillYDoc } from "@/lib/screenplay/ydoc";
import {
  COACH_MIN_GAP_MS,
  cleanCoachFocus,
  coachDue,
  coachIdeaText,
  isGoodQuestion,
  localCoachQuestion,
  looksLikeScript,
  parseCoachQuestion,
  parseSceneCheck,
  sceneWrittenLines,
} from "@/lib/screenplay-coach";
import { COACH_SYSTEM, GUARDRAIL, coachQuestionPrompt, coachSceneCheckPrompt, sceneGuide } from "@/lib/screenplay-ai";

const BLOCKS: ScreenplayBlock[] = [
  { type: "sceneHeading", text: "INT. CUARTO DE LUCÍA - DÍA", id: "s1" },
  { type: "action", text: "LUCÍA mira una bici roja por la ventana. Hace sol." },
  { type: "character", text: "LUCÍA" },
  { type: "dialogue", text: "Algún día será mía." },
  { type: "action", text: "Entra MARCOS con dos helados." },
  { type: "sceneHeading", text: "EXT. CALLE - DÍA", id: "s2" },
  { type: "action", text: "La bici ya no está." },
];
const scenes = scenesFromBlocks(BLOCKS, "A4", { untitled: true });
const ctx = { title: "La bici roja", format: "Cortometraje", logline: null };

function doc(blocks = BLOCKS) {
  const d = new Y.Doc();
  fillYDoc(d, blocks);
  return d;
}

describe("Compañero: lo que llega del navegador", () => {
  it("acepta solo focos bien formados", () => {
    expect(cleanCoachFocus({ kind: "scene", sid: "s1" })).toEqual({ kind: "scene", sid: "s1" });
    expect(cleanCoachFocus({ kind: "answer", step: 3, text: "  Quiere la bici  " })).toEqual({ kind: "answer", step: 3, text: "Quiere la bici" });
    expect(cleanCoachFocus({ kind: "answer", step: 5, text: "x" })).toBeNull();
    expect(cleanCoachFocus({ kind: "card", index: 99, text: "x" })).toEqual({ kind: "card", index: 40, text: "x" });
    expect(cleanCoachFocus({ kind: "scene", sid: "" })).toBeNull();
    expect(cleanCoachFocus("scene")).toBeNull();
  });
});

describe("Compañero: lo que devuelve la IA", () => {
  it("una pregunta con su motivo", () => {
    expect(parseCoachQuestion({ pregunta: "¿Por qué le importa a Nora esa bicicleta y no otra?", motivo: "lo que quiere se entiende mejor si sabemos qué significa" })).toEqual({
      question: "¿Por qué le importa a Nora esa bicicleta y no otra?",
      why: "Lo pregunto porque lo que quiere se entiende mejor si sabemos qué significa.",
    });
  });

  it("rechaza lo que no es una pregunta o parece guion (GUARDRAIL)", () => {
    expect(parseCoachQuestion({ pregunta: "Nora debería coger la bici.", motivo: "x" })).toBeNull();
    expect(parseCoachQuestion({ pregunta: "—¿Me la devuelves? —dice Nora.", motivo: "x" })).toBeNull();
    expect(parseCoachQuestion({ pregunta: "NORA: ¿Me la devuelves?", motivo: "x" })).toBeNull();
    expect(parseCoachQuestion({})).toBeNull();
    expect(looksLikeScript("INT. COCINA - NOCHE")).toBe(true);
    expect(isGoodQuestion("¿Qué quiere Nora?")).toBe(true);
    expect(isGoodQuestion(`¿${"palabra ".repeat(40)}?`)).toBe(false);
  });

  it("revisión de escena: ok o una observación en forma de pregunta", () => {
    expect(parseSceneCheck({ ok: true })).toEqual({ ok: true });
    expect(parseSceneCheck({ ok: false, observacion: "¿Nora ya sabía que la iba a vender, o se entera ahora?", formato: "Acción en presente." })).toEqual({
      ok: false,
      observation: "¿Nora ya sabía que la iba a vender, o se entera ahora?",
      format: "Acción en presente.",
    });
    expect(parseSceneCheck({ ok: false, observacion: "Falta una reacción." })).toBeNull();
  });
});

describe("Compañero: preguntas de oficio (sin IA)", () => {
  it("usa los nombres de la escena", () => {
    const q = localCoachQuestion(BLOCKS, scenes, "s1", { seed: 0 });
    expect(q.source).toBe("local");
    expect(q.sid).toBe("s1");
    expect(q.question).toMatch(/Lucía|escena 1/);
    expect(q.why).toMatch(/^Lo pregunto porque/);
  });

  it("no repite mientras haya otras", () => {
    const seen: string[] = [];
    for (let i = 0; i < 6; i++) seen.push(localCoachQuestion(BLOCKS, scenes, "s1", { skip: seen, seed: i }).question);
    expect(new Set(seen).size).toBe(6);
  });

  it("todas son preguntas válidas, también con dos personajes y sin diálogo", () => {
    for (let seed = 0; seed < 12; seed++) {
      expect(isGoodQuestion(localCoachQuestion(BLOCKS, scenes, "s1", { seed }).question)).toBe(true);
      expect(isGoodQuestion(localCoachQuestion(BLOCKS, scenes, "s2", { seed, stuck: true }).question)).toBe(true);
    }
  });

  it("la idea guardada se entiende sola", () => {
    expect(coachIdeaText({ question: "¿Qué quiere Lucía?" }, 2)).toBe("Escena 2 · Pregunta del Compañero: ¿Qué quiere Lucía?");
  });
});

describe("Compañero: cuándo sale una tarjeta", () => {
  const base = { mode: "auto" as const, muted: false, visible: false, lastShownAt: null, now: 1_000_000, trigger: "scene-end" as const, lines: 4 };
  it("al terminar una escena con 4 líneas o más", () => {
    expect(coachDue(base)).toBe(true);
    expect(coachDue({ ...base, lines: 3 })).toBe(false);
  });
  it("como mucho una cada 5 minutos", () => {
    expect(coachDue({ ...base, lastShownAt: base.now - COACH_MIN_GAP_MS + 1000 })).toBe(false);
    expect(coachDue({ ...base, lastShownAt: base.now - COACH_MIN_GAP_MS })).toBe(true);
  });
  it("nunca si está apagado, solo a petición, silenciado o ya hay una a la vista", () => {
    expect(coachDue({ ...base, mode: "ask" })).toBe(false);
    expect(coachDue({ ...base, mode: "off" })).toBe(false);
    expect(coachDue({ ...base, muted: true })).toBe(false);
    expect(coachDue({ ...base, visible: true })).toBe(false);
  });
  it("tras 2 minutos parada basta con algo escrito", () => {
    expect(coachDue({ ...base, trigger: "idle", lines: 1 })).toBe(true);
    expect(coachDue({ ...base, trigger: "idle", lines: 0 })).toBe(false);
  });
  it("cuenta las líneas escritas (sin notas)", () => {
    expect(sceneWrittenLines(BLOCKS, scenes[0])).toBe(4);
    expect(sceneWrittenLines([...BLOCKS.slice(0, 2), { type: "note", text: "Para mí" }], scenesFromBlocks(BLOCKS.slice(0, 2), "A4", { untitled: true })[0])).toBe(1);
  });
});

describe("Compañero: instrucciones para la IA", () => {
  it("el sistema lleva la regla de no escribir guion", () => {
    expect(COACH_SYSTEM).toContain(GUARDRAIL);
    expect(GUARDRAIL).toMatch(/NUNCA escribes texto del guion/);
  });

  it("la pregunta sobre una escena lleva la escena, sus vecinas y lo ya preguntado", () => {
    const user = coachQuestionPrompt(doc(), ctx, { kind: "scene", sid: "s1" }, ["¿Qué quiere Lucía?"])!;
    expect(user).toContain("FOCO: la escena 1");
    expect(user).toContain("Algún día será mía.");
    expect(user).toContain("ESCENA SIGUIENTE");
    expect(user).toContain("PREGUNTAS YA HECHAS:\n- ¿Qué quiere Lucía?");
    expect(coachQuestionPrompt(doc(), ctx, { kind: "scene", sid: "nope" })).toBeNull();
  });

  it("también sobre una respuesta del arranque guiado", () => {
    const user = coachQuestionPrompt(doc([]), ctx, { kind: "answer", step: 3, text: "Que su abuelo le deje arreglar la bici" })!;
    expect(user).toContain("qué quiere su protagonista");
    expect(user).toContain("Que su abuelo le deje arreglar la bici");
  });

  it("la revisión de escena solo se pide si hay una pregunta guía", () => {
    const d = doc();
    expect(coachSceneCheckPrompt(d, ctx, "s1")).toBeNull();
    storyMaps(d).scenes.set("s1", { synopsis: "Lucía decide que la bici será suya" });
    storyMaps(d).beats.set("inciting", "s1");
    const guide = sceneGuide(d, BLOCKS, "s1");
    expect(guide).toContain("Lo que quiere que pase: Lucía decide que la bici será suya");
    expect(guide).toContain("«Algo cambia»");
    expect(coachSceneCheckPrompt(d, ctx, "s1")).toContain("PREGUNTA GUÍA");
  });
});
