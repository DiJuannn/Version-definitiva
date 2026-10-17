// «¿Y ahora qué?»: qué sugerir según cómo va el guion. Reglas simples, sin
// IA, con una acción concreta. Puro (se prueba en tests/unit/ayudas-next-step.test.ts).

import type { ScreenplayBlock } from "@/lib/screenplay/blocks";
import type { SceneInfo } from "@/lib/screenplay/story";
import { KEY_MOMENTS, plural } from "@/lib/screenplay/moments";

export type NextStepAction = "write" | "ideas" | "dialogue" | "newScene" | "idea" | "moments" | "review" | "export";

export type NextStepId =
  | "empty"
  | "no-dialogue"
  | "first-scene"
  | "want"
  | "next-scene"
  | "no-moments"
  | "ideas"
  | "moments-left"
  | "draft";

export type NextStep = {
  id: NextStepId;
  title: string;
  text: string;
  actions: { id: NextStepAction; label: string }[];
};

export type NextStepInput = {
  blocks: ScreenplayBlock[];
  scenes: SceneInfo[];
  beats: Record<string, string>; // momento → sid
  looseUnused: number; // ideas sueltas aún sin usar
  hasIdea: boolean; // hay algo en la Idea (de qué va, logline)
  moments?: boolean; // la estructura usa los momentos (tres actos); con «5 actos» o «Libre», no
};

export const DRAFT_MIN_SCENES = 5;

export function nextStep({ blocks, scenes, beats, looseUnused, hasIdea, moments = true }: NextStepInput): NextStep {
  const written = blocks.filter((b) => b.type !== "note" && b.text.trim());
  if (!written.length) {
    return {
      id: "empty",
      title: "Un guion es una lista de escenas",
      text: "Cada una dice dónde pasa, lo que se ve y lo que se dice. Empieza por la que tengas más clara: el orden se decide después.",
      actions: [
        { id: "write", label: "Escribir una escena" },
        { id: "ideas", label: "Apuntar ideas sueltas" },
      ],
    };
  }

  const hasDialogue = written.some((b) => b.type === "dialogue");
  const hasAction = written.some((b) => b.type === "action");
  if (!hasDialogue && hasAction && scenes.length <= 2) {
    return {
      id: "no-dialogue",
      title: "¿Quién está en esta escena?",
      text: "Para que alguien hable: en una línea vacía pulsa Tab, escribe su nombre y Enter.",
      actions: [{ id: "dialogue", label: "Probar ahora" }],
    };
  }

  const ideasAction = looseUnused > 0 ? [{ id: "ideas" as const, label: `Ver ideas sueltas (${looseUnused})` }] : [];

  if (scenes.length <= 1) {
    return {
      id: "first-scene",
      title: "Primera escena escrita",
      text: "Lo más difícil ya está hecho. ¿Qué pasa después? Escribe INT. o EXT. en una línea nueva y empieza otra.",
      actions: [{ id: "newScene", label: "Nueva escena" }, ...ideasAction],
    };
  }

  const scenesWith = new Set(scenes.map((s) => s.sid));
  const marked = moments ? KEY_MOMENTS.filter((m) => beats[m.id] && scenesWith.has(beats[m.id])) : [...KEY_MOMENTS];
  const missing = KEY_MOMENTS.filter((m) => !marked.includes(m));

  if (scenes.length < 3) {
    if (!hasIdea) {
      return {
        id: "want",
        title: "¿Qué quiere tu protagonista?",
        text: "Contéstalo en una frase y todo lo demás sale más fácil. Puedes cambiarlo cuando quieras.",
        actions: [{ id: "idea", label: "Responder en la Idea" }],
      };
    }
    return {
      id: "next-scene",
      title: "¿Otra escena?",
      text: "Escribe INT. o EXT. en una línea nueva y empieza otra, o conviértela desde una de tus ideas sueltas.",
      actions: [{ id: "newScene", label: "Nueva escena" }, ...ideasAction],
    };
  }

  if (!marked.length) {
    const first = KEY_MOMENTS[0];
    return {
      id: "no-moments",
      title: "Tu película ya tiene forma",
      text: `Abajo ves tus escenas en orden: las más anchas duran más. ¿En cuál «${first.plain}»? ${first.what}`,
      actions: [{ id: "moments", label: "Elegir la escena" }],
    };
  }

  if ((missing.length || scenes.length < DRAFT_MIN_SCENES) && looseUnused > 0) {
    return {
      id: "ideas",
      title: `Tienes ${plural(looseUnused, "idea suelta", "ideas sueltas")}`,
      text: `¿${looseUnused === 1 ? "Es" : "Alguna es"} la siguiente escena? Conviértela en escena desde el panel con un clic.`,
      actions: [{ id: "ideas", label: "Ver ideas sueltas" }],
    };
  }

  if (missing.length || scenes.length < DRAFT_MIN_SCENES) {
    const next = missing[0];
    return {
      id: "moments-left",
      title: missing.length ? `${marked.length} de 5 momentos decididos` : "Casi un borrador",
      text: next
        ? `¿Ya sabes dónde va «${next.plain}»? ${next.question}`
        : "Ya están los cinco momentos. Escribe las escenas que faltan entre ellos y tendrás un borrador.",
      actions: next ? [{ id: "moments", label: "Ver Tu historia" }] : [{ id: "newScene", label: "Nueva escena" }],
    };
  }

  return {
    id: "draft",
    title: "Tienes un borrador completo",
    text: "Léelo de corrido o pide una revisión al Asistente: te señala cabos sueltos, nunca reescribe.",
    actions: [
      { id: "review", label: "Revisar mi guion" },
      { id: "export", label: "Descargar PDF" },
    ],
  };
}
