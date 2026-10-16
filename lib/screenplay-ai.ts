// IA de Guiones: lee el guion para ENTENDER la historia y, a partir de ahí,
// propone referencias, preguntas y observaciones. Nunca escribe guion: ni
// diálogos, ni acciones, ni escenas, ni frases para copiar. Esa regla está en
// todas las instrucciones de abajo y la pantalla lo deja claro.
//
// Todo lo que devuelve son SUGERENCIAS: los títulos y años de obras pueden
// estar mal, por eso llegan a una bandeja y el equipo decide qué se queda.

import * as Y from "yjs";
import { getMistralClient } from "@/lib/mistral";
import { characterName, type ScreenplayBlock } from "@/lib/screenplay/blocks";
import { toFountain } from "@/lib/screenplay/fountain";
import { blocksFromYDoc } from "@/lib/screenplay/ydoc";
import { readReading, readReferences, storyMaps } from "@/lib/screenplay/story-doc";
import {
  REFERENCE_KINDS,
  characterThread,
  isReferenceKind,
  referenceId,
  scenesFromBlocks,
  type ReferenceAnchor,
  REVIEW_KINDS,
  type ReviewItem,
  type ReviewKind,
  type StoryReading,
  type Suggestion,
  BEATS,
  LOOSE_KINDS,
  OPENINGS,
  type BeatKey,
  type LooseIdea,
  type OpeningKey,
} from "@/lib/screenplay/story";

export const SCREENPLAY_AI_MODEL = "mistral-small-latest";

// Por encima de esto el guion se resume escena a escena (largos enteros).
const FULL_TEXT_MAX = 45_000;

const GUARDRAIL = `Regla absoluta: NUNCA escribes texto del guion. No propones diálogos, frases, acciones, escenas, finales ni giros redactados. No reescribes nada. Tu trabajo es entender la historia y ayudar a quien escribe con referencias, preguntas y observaciones; la historia es suya.`;

// ------------------------------------------------------------------ contexto

type Context = {
  title: string;
  format: string;
  logline: string | null;
};

function scriptText(blocks: ScreenplayBlock[]): string {
  const full = toFountain(blocks);
  if (full.length <= FULL_TEXT_MAX) return full;
  // Guion largo: encabezado, quién habla y el arranque de cada escena.
  const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
  return scenes
    .map((s) => {
      const body = blocks
        .slice(s.start + 1, s.end)
        .filter((b) => b.type === "action" || b.type === "dialogue")
        .map((b) => b.text)
        .join(" ")
        .slice(0, 420);
      return `${s.number}. ${s.heading}\nPersonajes: ${s.present.join(", ") || "—"}\n${body}`;
    })
    .join("\n\n")
    .slice(0, FULL_TEXT_MAX);
}

// La historia entera en pocas líneas: una por escena (sinopsis del equipo si
// la hay, si no el arranque de la escena) — para cuando el foco es una sola
// escena o un personaje y la IA necesita saber qué pasa en todo el guion.
function outlineText(doc: Y.Doc, blocks: ScreenplayBlock[]): string {
  const meta = storyMaps(doc).scenes;
  return scenesFromBlocks(blocks, "A4", { untitled: true })
    .map((s) => {
      const synopsis = meta.get(s.sid)?.synopsis?.trim();
      const start = blocks
        .slice(s.start + 1, s.end)
        .filter((b) => b.type === "action" || b.type === "dialogue")
        .map((b) => b.text)
        .join(" ")
        .slice(0, 220);
      return `${s.number}. ${s.heading} [${s.present.join(", ") || "—"}]: ${synopsis || start}`;
    })
    .join("\n");
}

// Una escena entera con la anterior y la siguiente, para que la IA sepa de
// dónde viene y a dónde va.
function sceneWithNeighbours(blocks: ScreenplayBlock[], sid: string): { number: number; text: string } | null {
  const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
  const i = scenes.findIndex((s) => s.sid === sid);
  if (i === -1) return null;
  const part = (k: number, label: string) => {
    const s = scenes[k];
    return s ? `${label} (escena ${s.number}):\n${toFountain(blocks.slice(s.start, s.end)).slice(0, 6000)}` : "";
  };
  return {
    number: scenes[i].number,
    text: [part(i - 1, "ESCENA ANTERIOR"), part(i, "ESCENA EN FOCO"), part(i + 1, "ESCENA SIGUIENTE")].filter(Boolean).join("\n\n"),
  };
}

function readingText(r: StoryReading | null): string {
  if (!r) return "";
  const lines = [
    r.editedBy
      ? "LECTURA DE LA HISTORIA (corregida por el equipo; tómala como verdad):"
      : "LECTURA PREVIA DE LA HISTORIA (de una lectura anterior; contrástala con el guion):",
    `Premisa: ${r.premise}`,
    `Temas: ${r.themes.join(", ")}`,
    `Tono: ${r.tone} · Género: ${r.genre}`,
    ...r.characters.map((c) => `- ${c.name}: quiere ${c.want}; se lo impide ${c.obstacle}; arco: ${c.arc}`),
  ];
  return lines.join("\n");
}

function charactersText(doc: Y.Doc): string {
  const entries = [...storyMaps(doc).characters.entries()].filter(([, m]) => m && Object.values(m).some(Boolean));
  if (!entries.length) return "";
  return [
    "FICHAS DE PERSONAJE (escritas por el equipo):",
    ...entries.map(
      ([name, m]) =>
        `- ${name}: ${[
          m.want && `quiere ${m.want}`,
          m.need && `necesita ${m.need}`,
          m.fear && `teme ${m.fear}`,
          m.secret && `oculta ${m.secret}`,
          m.arc && `arco: ${m.arc}`,
        ]
          .filter(Boolean)
          .join("; ")}`,
    ),
  ].join("\n");
}

// Lo escrito en el paso "Idea": idea, tesis, logline, sinopsis, tono.
function devText(doc: Y.Doc): string {
  const dev = storyMaps(doc).dev;
  const labels: Record<string, string> = { idea: "Idea", thesis: "Lo que quiere contar (tesis)", logline: "Logline", synopsis: "Sinopsis", tone: "Tono y mundo" };
  const lines = Object.entries(labels)
    .map(([k, label]) => {
      const v = dev.get(k);
      return typeof v === "string" && v.trim() ? `${label}: ${v.trim().slice(0, 2500)}` : "";
    })
    .filter(Boolean);
  return lines.length ? ["DESARROLLO (escrito por el equipo):", ...lines].join("\n") : "";
}

function header(ctx: Context): string {
  return [`Título: ${ctx.title}`, `Formato: ${ctx.format}`, ctx.logline ? `Logline: ${ctx.logline}` : ""]
    .filter(Boolean)
    .join("\n");
}

// ------------------------------------------------------------------ llamada

// Proveedor de IA: Mistral (por defecto), Gemini o Groq, con
// SCREENPLAY_AI_PROVIDER. Todos devuelven JSON con la misma forma.
export type AiProvider = "mistral" | "gemini" | "groq";

export function aiProvider(): AiProvider {
  const p = process.env.SCREENPLAY_AI_PROVIDER;
  return p === "gemini" || p === "groq" ? p : "mistral";
}

export function aiConfigured(): boolean {
  const p = aiProvider();
  return Boolean(p === "gemini" ? process.env.GEMINI_API_KEY : p === "groq" ? process.env.GROQ_API_KEY : process.env.MISTRAL_API_KEY);
}

async function callJson(name: string, system: string, user: string, schema: object, temperature: number) {
  const provider = aiProvider();
  let text = "";
  if (provider === "gemini") {
    const model = process.env.GEMINI_MODEL || "gemini-flash-latest";
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-goog-api-key": process.env.GEMINI_API_KEY ?? "" },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: system }] },
        contents: [{ role: "user", parts: [{ text: user }] }],
        generationConfig: { temperature, responseMimeType: "application/json", responseJsonSchema: schema },
      }),
    });
    if (!res.ok) throw new Error(`Gemini ${res.status}`);
    const data = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
    text = data.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  } else if (provider === "groq") {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${process.env.GROQ_API_KEY ?? ""}` },
      body: JSON.stringify({
        model: process.env.GROQ_MODEL || "openai/gpt-oss-120b",
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: `${system}\n\nResponde con un objeto JSON que cumpla este esquema:\n${JSON.stringify(schema)}` },
          { role: "user", content: user },
        ],
      }),
    });
    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    text = data.choices?.[0]?.message?.content ?? "";
  } else {
    const response = await getMistralClient().chat.complete({
      model: SCREENPLAY_AI_MODEL,
      temperature,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
      responseFormat: { type: "json_schema", jsonSchema: { name, schemaDefinition: schema, strict: true } },
    });
    const content = response.choices?.[0]?.message?.content;
    text =
      typeof content === "string"
        ? content
        : Array.isArray(content)
          ? content.map((chunk) => ("text" in chunk ? chunk.text : "")).join("")
          : "";
  }
  if (!text) throw new Error(`${provider}: respuesta vacía`);
  return JSON.parse(text) as Record<string, unknown>;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, max: number, count: number) =>
  (Array.isArray(v) ? v : []).map((x) => str(x, max)).filter(Boolean).slice(0, count);

// ------------------------------------------------------------------ 1. leer la historia

const READING_SCHEMA = {
  type: "object",
  properties: {
    premisa: { type: "string" },
    temas: { type: "array", items: { type: "string" } },
    tono: { type: "string" },
    genero: { type: "string" },
    personajes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          nombre: { type: "string" },
          quiere: { type: "string" },
          obstaculo: { type: "string" },
          arco: { type: "string" },
        },
        required: ["nombre", "quiere", "obstaculo", "arco"],
      },
    },
    estructura: { type: "string" },
    preguntasAbiertas: { type: "array", items: { type: "string" } },
  },
  required: ["premisa", "temas", "tono", "genero", "personajes", "estructura", "preguntasAbiertas"],
};

const READING_SYSTEM = `Eres analista de guion (script reader) para una productora. Lees un guion, que puede estar a medio escribir, y explicas con precisión de qué va según lo que hay en la página.

${GUARDRAIL}

Instrucciones:
- "premisa": 1-2 frases con la situación, quién la protagoniza y qué está en juego. Solo lo que se deduce del texto.
- "temas": 2-4 temas de fondo, palabras o expresiones cortas.
- "tono" y "genero": cortos.
- "personajes": los principales (máximo 6), con lo que quieren, qué se lo impide y el arco que se insinúa hasta ahora. Si algo aún no se ve en el texto, escribe "aún no está claro".
- "estructura": 2-3 frases sobre en qué punto de la historia está el guion y cómo se reparte (qué ya está planteado, qué falta). Observa, no propongas soluciones.
- "preguntasAbiertas": preguntas que el guion plantea al público y aún no responde (máximo 5).
- Si hay una lectura previa corregida por el equipo o fichas de personaje, respétalas.
- Escribe en español. Responde solo con el JSON pedido.`;

export async function readStory(doc: Y.Doc, ctx: Context): Promise<Omit<StoryReading, "at">> {
  const blocks = blocksFromYDoc(doc);
  const user = [header(ctx), devText(doc), readingText(readReading(doc)), charactersText(doc), "GUION:", scriptText(blocks)]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callJson("lectura_historia", READING_SYSTEM, user, READING_SCHEMA, 0.3);
  const characters = (Array.isArray(raw.personajes) ? raw.personajes : [])
    .map((c) => {
      const o = (c ?? {}) as Record<string, unknown>;
      return {
        name: characterName(str(o.nombre, 60)),
        want: str(o.quiere, 300),
        obstacle: str(o.obstaculo, 300),
        arc: str(o.arco, 300),
      };
    })
    .filter((c) => c.name)
    .slice(0, 8);
  return {
    premise: str(raw.premisa, 600),
    themes: strList(raw.temas, 60, 5),
    tone: str(raw.tono, 120),
    genre: str(raw.genero, 80),
    characters,
    structure: str(raw.estructura, 900),
    openQuestions: strList(raw.preguntasAbiertas, 300, 6),
  };
}

// Hace falta algo de lo que tirar: guion o lo escrito en la Idea.
export function hasEnoughText(doc: Y.Doc): boolean {
  const count = (t: string) => (t.trim() ? t.trim().split(/\s+/).length : 0);
  const script = blocksFromYDoc(doc)
    .filter((b) => b.type !== "note")
    .reduce((n, b) => n + count(b.text), 0);
  const maps = storyMaps(doc);
  const dev = [...maps.dev.values()].reduce((n, v) => n + (typeof v === "string" ? count(v) : 0), 0);
  const loose = [...maps.loose.values()].reduce((n, v) => n + (typeof v?.text === "string" ? count(v.text) : 0), 0);
  return script + dev + loose >= 30;
}

// ------------------------------------------------------------------ 2. referencias

const KIND_KEYS = Object.keys(REFERENCE_KINDS) as (keyof typeof REFERENCE_KINDS)[];

const REFS_SCHEMA = {
  type: "object",
  properties: {
    referencias: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: KIND_KEYS },
          titulo: { type: "string" },
          anio: { type: "string" },
          autor: { type: "string" },
          porque: { type: "string" },
        },
        required: ["tipo", "titulo", "anio", "autor", "porque"],
      },
    },
  },
  required: ["referencias"],
};

const REFS_SYSTEM = `Eres asesor de desarrollo de guion con una cultura cinematográfica, literaria y artística muy amplia. Propones REFERENCIAS que ayuden a quien escribe a ver mejor su propia historia.

${GUARDRAIL}

Tipos de referencia (campo "tipo"):
- film: película entera · scene: una escena concreta de una película (di cuál en "porque") · series: serie · book: libro · art: pintura o fotografía · music: tema o banda sonora · place: un escenario real o de otra obra · editing: idea de montaje vista en otra obra (cita la obra) · direction: decisión de dirección vista en otra obra · character: personaje de otra obra que recuerda a uno de esta historia (en "titulo" pon "Personaje — Obra").

Reglas:
- Entre 5 y 7 referencias, variadas en tipo, ajustadas al foco que se pide.
- Solo obras y personajes REALES de los que estés seguro (título, año y autor/director). Si dudas, no la incluyas. No inventes.
- "porque": 1-2 frases concretas sobre qué tiene que sirva a ESTA historia (situación, personaje, tono, ritmo, imagen). Nunca redactes cómo debería quedar el guion.
- No repitas referencias que ya están puestas.
- Escribe en español. Responde solo con el JSON pedido.`;

export type SuggestScope =
  | { type: "script" }
  | { type: "scene"; sid: string }
  | { type: "character"; name: string };

export async function suggestReferences(doc: Y.Doc, ctx: Context, scope: SuggestScope): Promise<Suggestion[]> {
  const blocks = blocksFromYDoc(doc);
  const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
  const existing = readReferences(doc).map((r) => `- ${r.title}${r.year ? ` (${r.year})` : ""}`);

  let focus = "FOCO: la historia completa.";
  let anchor: ReferenceAnchor = { type: "script" };
  if (scope.type === "scene") {
    const around = sceneWithNeighbours(blocks, scope.sid);
    if (around) {
      anchor = { type: "scene", sid: scope.sid };
      focus = `FOCO: la escena ${around.number}. Referencias para ESTA escena (situación, atmósfera, puesta en escena, montaje), teniendo en cuenta de dónde viene y a dónde va:\n${around.text}`;
    }
  } else if (scope.type === "character") {
    const name = characterName(scope.name);
    anchor = { type: "character", name };
    const thread = characterThread(blocks, scenes, name)
      .map((t) => `Escena ${t.scene.number} (${t.scene.heading}): ${t.lines.join(" / ").slice(0, 300) || "aparece sin hablar"}`)
      .join("\n");
    focus = `FOCO: el personaje ${name}. Personajes de otras obras que le recuerden, y obras que ayuden a entenderlo:\n${thread}`;
  }

  const user = [
    header(ctx),
    devText(doc),
    readingText(readReading(doc)),
    charactersText(doc),
    existing.length ? `REFERENCIAS YA PUESTAS:\n${existing.join("\n")}` : "",
    focus,
    scope.type === "script" ? `GUION:\n${scriptText(blocks)}` : `LA HISTORIA ENTERA, ESCENA A ESCENA:\n${outlineText(doc, blocks)}`,
  ]
    .filter(Boolean)
    .join("\n\n");

  const raw = await callJson("referencias_guion", REFS_SYSTEM, user, REFS_SCHEMA, 0.6);
  const at = Date.now();
  return (Array.isArray(raw.referencias) ? raw.referencias : [])
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const kind = isReferenceKind(o.tipo) ? o.tipo : "other";
      return {
        id: referenceId(),
        kind,
        title: str(o.titulo, 160),
        year: str(o.anio, 12) || undefined,
        author: str(o.autor, 120) || undefined,
        detail: str(o.porque, 600) || undefined,
        anchor,
        source: "ai" as const,
        at,
      };
    })
    .filter((r) => r.title)
    .slice(0, 8);
}

// ------------------------------------------------------------------ 3. preguntas para seguir

const QUESTIONS_SCHEMA = {
  type: "object",
  properties: { preguntas: { type: "array", items: { type: "string" } } },
  required: ["preguntas"],
};

const QUESTIONS_SYSTEM = `Eres un editor de guion que ayuda a quien escribe cuando no sabe cómo seguir. Solo haces PREGUNTAS: buenas preguntas de oficio, concretas para esta historia, que obliguen a quien escribe a decidir.

${GUARDRAIL}

Reglas:
- Entre 4 y 6 preguntas, cortas (una frase cada una), en segunda persona.
- Que nombren a los personajes, lugares u objetos reales del guion.
- Mezcla: deseo y obstáculo, lo que el público sabe y no sabe, siembras pendientes, qué cambia en la escena, qué se calla.
- Ninguna pregunta puede contener la respuesta ni sugerir una solución concreta.
- Escribe en español. Responde solo con el JSON pedido.`;

export async function askQuestions(doc: Y.Doc, ctx: Context, sid: string | null): Promise<{ scope: string; items: string[] }> {
  const blocks = blocksFromYDoc(doc);
  const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
  const scene = sid ? scenes.find((s) => s.sid === sid) : undefined;
  const around = scene ? sceneWithNeighbours(blocks, scene.sid) : null;
  const focus = scene && around
    ? `FOCO: quien escribe está atascado en la escena ${scene.number}:\n${around.text}`
    : "FOCO: quien escribe no sabe cómo seguir la historia a partir de donde está ahora (el final del texto).";
  const user = [header(ctx), devText(doc), readingText(readReading(doc)), charactersText(doc), focus, `GUION:\n${scriptText(blocks)}`]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callJson("preguntas_guion", QUESTIONS_SYSTEM, user, QUESTIONS_SCHEMA, 0.7);
  return {
    scope: scene ? `Escena ${scene.number} · ${scene.heading}` : "Cómo seguir la historia",
    items: strList(raw.preguntas, 300, 6),
  };
}

// ------------------------------------------------------------------ 4. revisar el guion

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    dudas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tipo: { type: "string", enum: Object.keys(REVIEW_KINDS) },
          escena: { type: "integer" },
          texto: { type: "string" },
        },
        required: ["tipo", "escena", "texto"],
      },
    },
  },
  required: ["dudas"],
};

const REVIEW_SYSTEM = `Eres un editor de guion (script doctor) que revisa un borrador con mucha atención y respeto. Lees el guion entero y señalas DUDAS concretas: cosas que el público podría no entender, cabos sueltos o incoherencias.

${GUARDRAIL}

Tipos (campo "tipo"):
- setup: algo que se planta (un objeto, una frase, un dato) y no se vuelve a usar o no se resuelve.
- character: un personaje que desaparece sin explicación, cambia sin motivo o cuyo deseo no se ve.
- continuity: contradicciones de tiempo, lugar, vestuario, objetos o hechos entre escenas.
- motivation: acciones que no se entienden por lo que el personaje quiere o sabe.
- clarity: momentos confusos de leer o de entender en pantalla.
- rhythm: escenas que no cambian nada en la historia o que repiten información.
- other: cualquier otra duda importante.

Reglas:
- Entre 5 y 10 dudas, las más importantes primero.
- "escena": el número de la escena donde se ve el problema (el de la lista de escenas); 0 si es de toda la historia.
- "texto": una observación o pregunta corta y concreta, nombrando personajes, objetos y escenas. Nunca propongas cómo reescribirlo ni redactes texto del guion.
- Si algo parece intencionado (un misterio, un salto en el tiempo), pregúntalo en vez de darlo por error.
- Escribe en español. Responde solo con el JSON pedido.`;

export async function reviewScript(doc: Y.Doc, ctx: Context): Promise<ReviewItem[]> {
  const blocks = blocksFromYDoc(doc);
  const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
  const user = [
    header(ctx),
    devText(doc),
    readingText(readReading(doc)),
    charactersText(doc),
    `LISTA DE ESCENAS:\n${scenes.map((s) => `${s.number}. ${s.heading}`).join("\n")}`,
    `GUION:\n${scriptText(blocks)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callJson("revision_guion", REVIEW_SYSTEM, user, REVIEW_SCHEMA, 0.3);
  return (Array.isArray(raw.dudas) ? raw.dudas : [])
    .map((d) => {
      const o = (d ?? {}) as Record<string, unknown>;
      const n = typeof o.escena === "number" ? Math.round(o.escena) : Number(o.escena);
      const scene = Number.isFinite(n) && n > 0 ? scenes.find((s) => s.number === n) ?? null : null;
      const kind = typeof o.tipo === "string" && o.tipo in REVIEW_KINDS ? (o.tipo as ReviewKind) : "other";
      return { id: referenceId(), kind, scene: scene?.number ?? null, sid: scene?.sid ?? null, text: str(o.texto, 400) };
    })
    .filter((d) => d.text)
    .slice(0, 12);
}


// ------------------------------------------------------------------ 6. ideas sueltas: cómo empezar

export type OpeningProposal = { way: OpeningKey; ideaId: string | null; why: string };

function looseList(doc: Y.Doc): LooseIdea[] {
  return [...storyMaps(doc).loose.values()].filter((l) => l && typeof l.text === "string" && l.text.trim()).sort((a, b) => a.at - b.at);
}

const OPENINGS_SCHEMA = {
  type: "object",
  properties: {
    aperturas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          forma: { type: "string", enum: OPENINGS.map((o) => o.key) },
          idea: { type: "integer" },
          porque: { type: "string" },
        },
        required: ["forma", "idea", "porque"],
      },
    },
  },
  required: ["aperturas"],
};

const OPENINGS_SYSTEM = `Eres asesor de guion. Quien escribe tiene ideas sueltas (imágenes, momentos, diálogos, personajes, un final) y no sabe con qué empezar su película.

${GUARDRAIL}

Instrucciones:
- Propón exactamente 3 maneras distintas de abrir la película usando SUS ideas sueltas. No inventes escenas nuevas.
- "forma" es una de: ${OPENINGS.map((o) => `"${o.key}" (${o.label.toLowerCase()})`).join(", ")}.
- "idea" es el número de la idea suelta con la que abrirías (de la lista numerada). Usa 0 solo si ninguna encaja.
- "porque": 1-2 frases sobre qué consigue esa apertura con esta historia (qué plantea, qué pregunta abre al público). No redactes la escena ni propongas diálogos.
- Si hay guion o desarrollo escrito, tenlo en cuenta.
- Escribe en español. Responde solo con el JSON pedido.`;

export async function proposeOpenings(doc: Y.Doc, ctx: Context): Promise<OpeningProposal[]> {
  const ideas = looseList(doc);
  const blocks = blocksFromYDoc(doc);
  const user = [
    header(ctx),
    devText(doc),
    `IDEAS SUELTAS:\n${ideas.map((l, i) => `${i + 1}. [${LOOSE_KINDS[l.kind]?.label ?? "Idea"}] ${l.text.slice(0, 400)}`).join("\n") || "(ninguna)"}`,
    scenesFromBlocks(blocks, "A4", { untitled: true }).length ? `LO QUE YA HAY ESCRITO (escena a escena):\n${outlineText(doc, blocks)}` : "",
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callJson("aperturas", OPENINGS_SYSTEM, user, OPENINGS_SCHEMA, 0.5);
  const ways = new Set<string>(OPENINGS.map((o) => o.key));
  return (Array.isArray(raw.aperturas) ? raw.aperturas : [])
    .map((a) => {
      const o = (a ?? {}) as Record<string, unknown>;
      const n = typeof o.idea === "number" ? Math.round(o.idea) : Number(o.idea);
      return {
        way: (typeof o.forma === "string" && ways.has(o.forma) ? o.forma : "accion") as OpeningKey,
        ideaId: Number.isFinite(n) && n >= 1 && n <= ideas.length ? ideas[n - 1].id : null,
        why: str(o.porque, 400),
      };
    })
    .filter((a) => a.why)
    .slice(0, 3);
}

// ------------------------------------------------------------------ 7. dónde están los actos

export type BeatProposal = { beat: BeatKey; sid: string | null; scene: number | null; why: string };

const STRUCTURE_SCHEMA = {
  type: "object",
  properties: {
    momentos: {
      type: "array",
      items: {
        type: "object",
        properties: {
          momento: { type: "string", enum: BEATS.map((b) => b.key) },
          escena: { type: "integer" },
          porque: { type: "string" },
        },
        required: ["momento", "escena", "porque"],
      },
    },
    observacion: { type: "string" },
  },
  required: ["momentos", "observacion"],
};

const STRUCTURE_SYSTEM = `Eres analista de guion. Lees un guion (puede estar a medio escribir) y señalas dónde están los momentos de una estructura en tres actos.

${GUARDRAIL}

Momentos:
${BEATS.map((b) => `- "${b.key}" (${b.label}): ${b.hint}`).join("\n")}

Instrucciones:
- Para cada momento, di en qué número de escena está YA en el guion. Si todavía no está escrito o no se reconoce, usa 0 y explica qué falta para que exista (sin redactarlo).
- "porque": 1-2 frases, citando lo que pasa en esa escena.
- "observacion": 1-3 frases sobre cómo se reparten los actos (si alguno es muy largo o muy corto). Observa, no reescribas.
- Escribe en español. Responde solo con el JSON pedido.`;

export async function findStructure(doc: Y.Doc, ctx: Context): Promise<{ beats: BeatProposal[]; note: string }> {
  const blocks = blocksFromYDoc(doc);
  const scenes = scenesFromBlocks(blocks, "A4", { untitled: true });
  const user = [
    header(ctx),
    devText(doc),
    readingText(readReading(doc)),
    `LISTA DE ESCENAS:\n${scenes.map((s) => `${s.number}. ${s.heading}`).join("\n")}`,
    `GUION:\n${scriptText(blocks)}`,
  ]
    .filter(Boolean)
    .join("\n\n");
  const raw = await callJson("estructura", STRUCTURE_SYSTEM, user, STRUCTURE_SCHEMA, 0.2);
  const keys = new Set<string>(BEATS.map((b) => b.key));
  const seen = new Set<string>();
  const beats = (Array.isArray(raw.momentos) ? raw.momentos : [])
    .map((m) => {
      const o = (m ?? {}) as Record<string, unknown>;
      const n = typeof o.escena === "number" ? Math.round(o.escena) : Number(o.escena);
      const scene = Number.isFinite(n) && n > 0 ? scenes.find((s) => s.number === n) ?? null : null;
      return {
        beat: (typeof o.momento === "string" ? o.momento : "") as BeatKey,
        sid: scene?.sid ?? null,
        scene: scene?.number ?? null,
        why: str(o.porque, 400),
      };
    })
    .filter((b) => keys.has(b.beat) && b.why && !seen.has(b.beat) && seen.add(b.beat));
  return { beats, note: str(raw.observacion, 600) };
}
