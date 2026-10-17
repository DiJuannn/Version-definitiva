// IA del camino guiado: el compañero que acompaña a quien escribe su PRIMER
// guion. Pregunta (una cosa cada vez) y, si se le pide, propone; nunca
// escribe guion. Todo es opcional: sin IA, el arranque y el esqueleto salen
// igual, con la plantilla y las palabras de quien escribe.

import { callScreenplayJson, SCREENPLAY_GUARDRAIL } from "@/lib/screenplay-ai";

export type GuidedContext = { title: string; format: string };

// Lo que ya ha contado quien escribe (las respuestas del arranque).
export type GuidedAnswers = {
  idea?: string;
  name?: string;
  trait?: string;
  want?: string;
  obstacle?: string;
  ending?: string;
};

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export function cleanAnswers(v: unknown): GuidedAnswers {
  const a = v && typeof v === "object" ? (v as Record<string, unknown>) : {};
  return {
    idea: s(a.idea, 500),
    name: s(a.name, 60),
    trait: s(a.trait, 160),
    want: s(a.want, 500),
    obstacle: s(a.obstacle, 500),
    ending: s(a.ending, 500),
  };
}

function answersText(a: GuidedAnswers): string {
  const lines = [
    a.idea && `De qué va: ${a.idea}`,
    (a.name || a.trait) && `Protagonista: ${[a.name, a.trait].filter(Boolean).join(", ")}`,
    a.want && `Qué quiere: ${a.want}`,
    a.obstacle && `Qué se lo impide: ${a.obstacle}`,
    a.ending && `Cómo se imagina el final: ${a.ending}`,
  ].filter(Boolean);
  return lines.length ? ["LO QUE HA CONTADO QUIEN ESCRIBE:", ...lines].join("\n") : "";
}

function header(ctx: GuidedContext) {
  return `Título: ${ctx.title}\nFormato: ${ctx.format}`;
}

const TEACHER = `Eres un profesor de guion paciente que acompaña a alguien que escribe su PRIMER guion. Hablas en español, de tú, con frases cortas y sin jerga (si usas un término técnico, explícalo en seis palabras).

${SCREENPLAY_GUARDRAIL}`;

// ------------------------------------------------------------------ una pregunta, no una respuesta

export type CoachFocus =
  | { kind: "answer"; question: string; text: string }
  | { kind: "card"; title: string; question: string; text: string };

const COACH_SCHEMA = {
  type: "object",
  properties: { pregunta: { type: "string" }, motivo: { type: "string" } },
  required: ["pregunta", "motivo"],
};

const COACH_SYSTEM = `${TEACHER}

Devuelve UNA sola pregunta (máximo 25 palabras) que ayude a quien escribe a concretar o profundizar en el FOCO. Debe:
- nombrar a los personajes u objetos reales de lo que ha contado;
- poder contestarse en una línea;
- no contener la respuesta ni ofrecer dos opciones cerradas;
- si el FOCO ya es concreto y claro, preguntar por el porqué emocional.
Devuelve también "motivo": por qué lo preguntas (máximo 20 palabras), empezando por "Lo pregunto porque".
Responde solo con el JSON pedido.`;

export async function coachQuestion(ctx: GuidedContext, answers: GuidedAnswers, focus: CoachFocus) {
  const foco =
    focus.kind === "answer"
      ? `FOCO: acaba de contestar «${focus.question}» con: «${focus.text}»`
      : `FOCO: la tarjeta «${focus.title}» de su esqueleto de escenas. La pregunta guía es «${focus.question}» y ha escrito: «${focus.text || "(nada todavía)"}»`;
  const raw = await callScreenplayJson("guiado_pregunta", COACH_SYSTEM, [header(ctx), answersText(answers), foco].filter(Boolean).join("\n\n"), COACH_SCHEMA, 0.7);
  return { question: s(raw.pregunta, 240), why: s(raw.motivo, 200) };
}

// ------------------------------------------------------------------ la frase de la historia, más clara

const LOGLINE_SCHEMA = {
  type: "object",
  properties: { logline: { type: "string" } },
  required: ["logline"],
};

const LOGLINE_SYSTEM = `${TEACHER}

Excepción acotada: aquí SÍ devuelves una frase, la logline (la historia en una frase: quién, qué quiere y qué se lo impide), pero SOLO con lo que ha contado quien escribe. No añades hechos, personajes, lugares, giros ni finales nuevos; no cambias lo que quiere ni lo que se lo impide. Solo ordenas y unes sus palabras para que se entienda a la primera.
- Una sola frase, de 15 a 40 palabras, en presente.
- Si falta algo (no hay obstáculo, por ejemplo), no lo inventes: deja la frase sin esa parte.
- No reveles el final.
Responde solo con el JSON pedido.`;

export async function polishLogline(ctx: GuidedContext, answers: GuidedAnswers, current: string) {
  const user = [header(ctx), answersText(answers), current && `SU FRASE ACTUAL: ${current}`].filter(Boolean).join("\n\n");
  const raw = await callScreenplayJson("guiado_logline", LOGLINE_SYSTEM, user, LOGLINE_SCHEMA, 0.4);
  return s(raw.logline, 400);
}

// ------------------------------------------------------------------ preguntas guía a medida

const TAILOR_SCHEMA = {
  type: "object",
  properties: { preguntas: { type: "array", items: { type: "string" } } },
  required: ["preguntas"],
};

const TAILOR_SYSTEM = `${TEACHER}

Quien escribe tiene un esqueleto de escenas con un PASO por escena (su nombre y la pregunta guía genérica). Reescribe cada pregunta guía para SU historia: misma intención que la genérica, pero con sus personajes, objetos y lugares.
- Una pregunta por paso, en el mismo orden y el mismo número de pasos.
- Máximo 20 palabras cada una. Que se pueda contestar con una línea.
- Ninguna pregunta puede contener la respuesta ni sugerir qué pasa: solo preguntar.
Responde solo con el JSON pedido.`;

export async function tailorQuestions(ctx: GuidedContext, answers: GuidedAnswers, steps: { title: string; question: string }[]) {
  const list = steps.map((x, i) => `${i + 1}. ${x.title} — ${x.question}`).join("\n");
  const raw = await callScreenplayJson("guiado_esqueleto", TAILOR_SYSTEM, [header(ctx), answersText(answers), `PASOS:\n${list}`].filter(Boolean).join("\n\n"), TAILOR_SCHEMA, 0.6);
  const items = (Array.isArray(raw.preguntas) ? raw.preguntas : []).map((q) => s(q, 220));
  // Si no viene una por paso, no sirve (se quedan las de la plantilla).
  return items.length === steps.length && items.every(Boolean) ? items : [];
}
