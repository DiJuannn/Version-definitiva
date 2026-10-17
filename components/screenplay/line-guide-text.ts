// Lo que dice la «Guía de la línea»: qué es la línea donde escribes, qué se
// pone en ella y qué hacen Enter y Tab ahí. Puro, sin React (se prueba en
// tests/unit/ayudas-line-guide.test.ts).

import { BLOCK_HINTS, BLOCK_LABELS, BLOCK_TECH, type BlockType } from "@/lib/screenplay/blocks";
import { lineKeyHints } from "@/components/screenplay/editor-chrome";

export type GuideKey = { key: "Enter" | "Tab"; text: string };

export type LineGuideText = {
  name: string; // nombre llano: «Lugar y hora»
  technical: string; // pequeño al lado: «encabezado»
  hint: string; // qué se escribe
  tip: string | null; // un truco de esa línea
  keys: GuideKey[];
};

// Un consejo por tipo de línea, para quien no ha visto nunca un guion.
const TIPS: Record<BlockType, string | null> = {
  sceneHeading: "INT. = dentro · EXT. = fuera · luego « - DÍA» o « - NOCHE». Si aún no lo sabes, Enter y sigue.",
  action: "Solo lo que se puede ver u oír, como si lo contaras desde la butaca.",
  character: "Solo el nombre. Si ya ha salido, te lo sugiero: Tab o → para aceptarlo.",
  dialogue: "Sin comillas. Escribe «(» al empezar para un gesto o un tono.",
  parenthetical: "Muy breve, y úsalo poco: la actriz o el actor ya lo harán suyo.",
  transition: "El corte entre escenas se da por hecho: solo para algo especial.",
  shot: "Solo si un plano es imprescindible para entender algo.",
  note: "No sale en el PDF ni en el Fountain.",
};

// Lo que hacen Enter y Tab en esta línea (las mismas reglas que el editor:
// ver lineKeyHints en editor-chrome.ts).
export function guideKeys(type: BlockType, empty: boolean): GuideKey[] {
  return lineKeyHints(type, empty).map((h): GuideKey => {
    if (h.key === "Enter") {
      if (type === "sceneHeading" && empty) return { key: "Enter", text: `lo dejas para luego y sigues con «${h.label}»` };
      return { key: "Enter", text: h.change ? `esta línea pasa a «${h.label}»` : `línea nueva de «${h.label}»` };
    }
    // En una línea vacía de «Lo que se ve», Tab es la manera de que hable alguien.
    if (type === "action" && empty) return { key: "Tab", text: `que hable alguien («${h.label}»)` };
    if (type === "dialogue" && empty) return { key: "Tab", text: `un gesto antes de hablar («${h.label}»)` };
    return { key: "Tab", text: empty ? `esta línea pasa a «${h.label}»` : `convierte esta línea en «${h.label}»` };
  });
}

export function lineGuideText(type: BlockType, empty: boolean): LineGuideText {
  return {
    name: BLOCK_LABELS[type],
    technical: BLOCK_TECH[type].toLowerCase(),
    hint: BLOCK_HINTS[type],
    tip: TIPS[type],
    keys: guideKeys(type, empty),
  };
}

// La guía sale sola mientras el guion es corto (menos de 3 escenas), salvo
// que se haya apagado; «siempre» la deja aunque el guion crezca.
export const LINE_GUIDE_MAX_SCENES = 3;

export function lineGuideVisible(pref: "auto" | "always" | "off", sceneCount: number): boolean {
  if (pref === "off") return false;
  if (pref === "always") return true;
  return sceneCount < LINE_GUIDE_MAX_SCENES;
}
