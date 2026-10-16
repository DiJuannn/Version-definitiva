import { describe, expect, it } from "vitest";
import * as Y from "yjs";
import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import { scenesFromBlocks } from "@/lib/screenplay/story";
import { layoutScreenplay } from "@/lib/screenplay/layout";
import { toFountain } from "@/lib/screenplay/fountain";
import { storyMaps } from "@/lib/screenplay/story-doc";
import {
  ENDING_IDEA_ID,
  ROUTES,
  START_KEY,
  assembleLogline,
  cardView,
  checkWant,
  defaultRoute,
  displayName,
  draftProgress,
  missingForDraft,
  newSkeleton,
  personalize,
  reachedMilestones,
  readSkeleton,
  sceneState,
  sceneRanges,
  scenesToCreate,
  stepPages,
  switchRoute,
  type Skeleton,
} from "@/components/screenplay/guided/guided";
import { markSkeletonMoments, saveStart, type GuidedCharacter } from "@/components/screenplay/guided/guided-doc";

describe("la historia en una frase (logline) con las palabras de quien escribe", () => {
  it("quién + qué quiere + qué se lo impide", () => {
    expect(
      assembleLogline({ name: "nora", trait: "11 años, terca", want: "Arreglar la bicicleta roja antes de que la vendan", obstacle: "Su abuelo quiere venderla." }),
    ).toBe("Nora, 11 años, terca, quiere arreglar la bicicleta roja antes de que la vendan, pero su abuelo quiere venderla.");
  });

  it("no repite «quiere» ni «pero» si ya lo escribió la persona", () => {
    expect(assembleLogline({ name: "JULIÁN", want: "quiere llegar a la boda", obstacle: "pero se le ha muerto el coche" })).toBe(
      "Julián quiere llegar a la boda, pero se le ha muerto el coche.",
    );
  });

  it("sin obstáculo se queda sin esa parte (no se inventa)", () => {
    expect(assembleLogline({ name: "Amaia", want: "Que su hija la llame" })).toBe("Amaia quiere que su hija la llame.");
  });

  it("si no hay protagonista ni deseo, usa la idea", () => {
    expect(assembleLogline({ idea: "dos hermanos vacían la casa del padre" })).toBe("Dos hermanos vacían la casa del padre.");
    expect(assembleLogline({})).toBe("");
  });
});

describe("comprobaciones suaves, sin IA", () => {
  it("lo que pasa por dentro no se ve", () => {
    const [c] = checkWant("Ser feliz otra vez", "nora");
    expect(c.ok).toBe(false);
    expect(c.text).toContain("Nora");
  });
  it("se puede ver y, con plazo, tiene tensión", () => {
    expect(checkWant("Arreglar la bici antes del sábado", "Nora").map((c) => c.ok)).toEqual([true, true]);
    expect(checkWant("Arreglar la bici", "Nora")).toHaveLength(1);
    expect(checkWant("bici", "Nora")).toEqual([]);
  });
  it("las preguntas hablan del protagonista por su nombre", () => {
    expect(personalize("¿Qué quiere {P}?", "NORA")).toBe("¿Qué quiere Nora?");
    expect(personalize("¿Qué quiere {P}?", "")).toBe("¿Qué quiere tu protagonista?");
    expect(displayName("maría josé")).toBe("María José");
  });
});

describe("esqueleto", () => {
  it("la ruta por defecto depende del formato", () => {
    expect(defaultRoute("SHORT")).toBe("short5");
    expect(defaultRoute("FEATURE")).toBe("feature8");
  });

  it("la imagen del final rellena la última tarjeta y los momentos usan el vocabulario común", () => {
    const sk = newSkeleton("short5", { ending: "El abuelo le sujeta el sillín", name: "Nora" });
    expect(sk.cards).toHaveLength(5);
    expect(sk.cards[4].line).toBe("El abuelo le sujeta el sillín.");
    expect(cardView(sk, sk.cards[1], "Nora")).toMatchObject({ plain: "Algo cambia", technical: "detonante", question: "¿Qué pasa que obliga a Nora a actuar ya?" });
    expect(cardView(sk, sk.cards[3], "Nora").plain).toBe("El gran final");
  });

  it("páginas orientativas", () => {
    expect(stepPages(ROUTES.short5.steps[0], 8)).toBe("≈ pág. 1");
    expect(stepPages(ROUTES.short5.steps[1], 8)).toBe("≈ pág. 1–2");
  });

  it("cambiar de ruta no pierde lo escrito", () => {
    const sk = newSkeleton("short5", {});
    sk.cards[2].line = "Intenta arreglarla sola";
    sk.cards[1].line = "El abuelo pone un anuncio";
    const big = switchRoute(sk, "feature8");
    expect(big.cards.find((c) => c.step === "inciting")?.line).toBe("El abuelo pone un anuncio");
    expect(big.cards.find((c) => c.step === "tries")?.line).toBe("Intenta arreglarla sola");
    const small = switchRoute(big, "short3");
    expect(small.cards.some((c) => c.line === "Intenta arreglarla sola")).toBe(true);
  });

  it("las tarjetas nuevas se crean delante de la siguiente que ya tiene escena", () => {
    const sk: Skeleton = {
      route: "short5",
      at: 0,
      cards: [
        { id: "a", step: "start", line: "", sid: "s1" },
        { id: "x", step: "extra", line: "" },
        { id: "b", step: "inciting", line: "", sid: "s2" },
        { id: "c", step: "tries", line: "" },
      ],
    };
    expect(scenesToCreate(sk, new Set(["s1", "s2"]))).toEqual([
      { cardId: "x", beforeSid: "s2" },
      { cardId: "c", beforeSid: null },
    ]);
  });

  it("lee con cuidado lo guardado", () => {
    expect(readSkeleton(null)).toBeNull();
    expect(readSkeleton({ route: "nada", cards: [] })).toBeNull();
    expect(readSkeleton({ route: "short3", cards: [{ id: "a" }, null] })?.cards).toEqual([{ id: "a", line: "", step: "extra" }]);
  });
});

// Las escenas del esqueleto nacen vacías: encabezado sin texto + una línea
// vacía. No pueden salir en el PDF, en Fountain ni pasar a producción.
describe("escenas vacías del esqueleto: no se exportan ni pasan a producción", () => {
  const skeletonBlocks: ScreenplayBlock[] = [
    { type: "sceneHeading", text: "", id: "s1" },
    { type: "action", text: "" },
    { type: "sceneHeading", text: "", id: "s2" },
    { type: "action", text: "" },
    { type: "sceneHeading", text: "", id: "s3" },
    { type: "action", text: "" },
  ];

  it("sin escribir nada, no hay escenas para producción, ni páginas, ni texto en Fountain", () => {
    expect(scenesFromBlocks(skeletonBlocks)).toEqual([]);
    expect(scenesFromBlocks(skeletonBlocks, "A4", { untitled: true })).toEqual([]);
    expect(layoutScreenplay(skeletonBlocks).flatMap((p) => p.lines).filter((l) => l.text)).toEqual([]);
    expect(toFountain(skeletonBlocks).trim()).toBe("");
  });

  it("solo pasa a producción la que tiene lugar y hora", () => {
    const blocks: ScreenplayBlock[] = [
      { type: "sceneHeading", text: "INT. GARAJE - NOCHE", id: "s1" },
      { type: "action", text: "Nora engrasa una cadena a escondidas." },
      { type: "sceneHeading", text: "", id: "s2" },
      { type: "action", text: "" },
      { type: "sceneHeading", text: "", id: "s3" },
      { type: "action", text: "" },
    ];
    expect(scenesFromBlocks(blocks).map((s) => s.sid)).toEqual(["s1"]);
    const sceneNumbers = layoutScreenplay(blocks)
      .flatMap((p) => p.lines)
      .filter((l) => l.sceneNumber);
    expect(sceneNumbers.map((l) => l.text)).toEqual(["INT. GARAJE - NOCHE"]);
    expect(toFountain(blocks)).not.toMatch(/^\.\s*$/m);
  });
});

describe("«Tu borrador»", () => {
  const sk: Skeleton = {
    route: "short3",
    at: 0,
    cards: [
      { id: "a", step: "start", line: "", sid: "s1" },
      { id: "b", step: "inciting", line: "El abuelo pone un anuncio", sid: "s2" },
      { id: "c", step: "climax", line: "", sid: "s3" },
    ],
  };
  const blocks: ScreenplayBlock[] = [
    { type: "sceneHeading", text: "INT. GARAJE - NOCHE", id: "s1" },
    { type: "action", text: "Nora engrasa una cadena." },
    { type: "character", text: "NORA" },
    { type: "dialogue", text: "Ya casi." },
    { type: "sceneHeading", text: "", id: "s2" },
    { type: "action", text: "" },
    { type: "sceneHeading", text: "", id: "s3" },
    { type: "note", text: "Solo una nota, no cuenta" },
  ];

  it("vacía, esbozada o escrita", () => {
    const r = sceneRanges(blocks);
    expect(sceneState(blocks, r[0])).toBe("written");
    expect(sceneState(blocks, r[1], "El abuelo pone un anuncio")).toBe("sketched");
    expect(sceneState(blocks, r[2])).toBe("empty");
  });

  it("cuenta por tarjetas, marca dónde estás y dice qué falta", () => {
    const p = draftProgress(blocks, sk, "s2", { name: "Nora" });
    expect(p.items.map((i) => [i.label, i.state, i.here])).toEqual([
      ["Empieza", "written", false],
      ["Algo cambia", "sketched", true],
      ["El gran final", "empty", false],
    ]);
    expect(p.written).toBe(1);
    expect(missingForDraft(p, { name: "Nora", want: "", pages: 1 })).toEqual([
      "escribir 2 escenas",
      "el final",
      "decir qué quiere Nora",
      "≈ 2 páginas para llegar al mínimo de un corto (3)",
    ]);
    expect(reachedMilestones(p)).toEqual(["first"]);
  });

  it("sin esqueleto, cuenta las escenas que hay", () => {
    const p = draftProgress(blocks, null, null);
    expect(p.total).toBe(1);
    expect(p.fromSkeleton).toBe(false);
  });
});

describe("las respuestas van donde ya se leen", () => {
  it("idea, ficha del protagonista (también al cambiarle el nombre) e idea suelta del final", () => {
    const doc = new Y.Doc();
    const maps = storyMaps(doc);
    saveStart(maps, { idea: "Una niña y una bici", name: "Nora", trait: "11 años", want: "Arreglar la bici", ending: "El abuelo le sujeta el sillín" }, "Marta");
    expect(maps.dev.get("idea")).toBe("Una niña y una bici");
    expect(maps.characters.get("NORA")).toMatchObject({ added: true, role: "protagonista", want: "Arreglar la bici", notes: "11 años" });
    expect(maps.loose.get(ENDING_IDEA_ID)).toMatchObject({ kind: "final", text: "El abuelo le sujeta el sillín" });

    // Lo que el equipo escribió a mano no se pisa.
    maps.dev.set("idea", "Otra idea escrita en la Idea");
    saveStart(maps, { idea: "Una niña y una bici roja", name: "Lucía", obstacle: "Su abuelo la vende" }, "Marta");
    expect(maps.dev.get("idea")).toBe("Otra idea escrita en la Idea");
    expect(maps.characters.get("NORA")).toBeUndefined();
    expect(maps.characters.get("LUCÍA") as GuidedCharacter).toMatchObject({ want: "Arreglar la bici", obstacle: "Su abuelo la vende" });
    expect((maps.structure.get(START_KEY) as { name: string }).name).toBe("Lucía");
  });

  it("al crear las escenas, los momentos quedan marcados en ellas (no en porcentajes)", () => {
    const doc = new Y.Doc();
    const maps = storyMaps(doc);
    const sk = newSkeleton("feature8", {});
    sk.cards.forEach((c, i) => (c.sid = `s${i + 1}`));
    markSkeletonMoments(maps, sk, sk.cards.map((c) => ({ sid: c.sid! })));
    expect(maps.beats.toJSON()).toEqual({ inciting: "s2", turn1: "s3", midpoint: "s5", turn2: "s6", climax: "s7" });
    expect(maps.acts.toJSON()).toEqual({ s4: "Acto II", s7: "Acto III" });
    expect(maps.structure.get("targetPages")).toBe(95);
  });
});
