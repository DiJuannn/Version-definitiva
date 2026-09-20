import { prisma } from "@/lib/prisma";
import { getMistralClient } from "@/lib/mistral";
import { DAY_PART_LABELS, INT_EXT_LABELS } from "@/lib/labels";
import { REFERENCE_KINDS } from "@/lib/moodboard-types";

// Referencias del moodboard con IA: se le da a Mistral un resumen corto del
// proyecto (no el guion entero) y devuelve tono, paleta, referencias de obras
// y ideas de arte/fotografía/sonido. Lo que devuelve son SUGERENCIAS: la IA
// puede equivocarse con títulos o años, así que la pantalla lo avisa y la
// persona elige qué añade.

export type MoodboardProposal = {
  tone: string;
  palette: string[];
  references: { title: string; year: string; kind: string; why: string }[];
  ideas: { topic: string; text: string }[];
};

const IDEA_TOPICS = ["Fotografía", "Vestuario y arte", "Sonido y música", "Ritmo y montaje"] as const;

const schema = {
  type: "object",
  properties: {
    tono: { type: "string" },
    paleta: { type: "array", items: { type: "string" } },
    referencias: {
      type: "array",
      items: {
        type: "object",
        properties: {
          titulo: { type: "string" },
          anio: { type: "string" },
          tipo: { type: "string", enum: [...REFERENCE_KINDS] },
          porque: { type: "string" },
        },
        required: ["titulo", "anio", "tipo", "porque"],
      },
    },
    ideas: {
      type: "array",
      items: {
        type: "object",
        properties: {
          tema: { type: "string", enum: [...IDEA_TOPICS] },
          texto: { type: "string" },
        },
        required: ["tema", "texto"],
      },
    },
  },
  required: ["tono", "paleta", "referencias", "ideas"],
};

const SYSTEM_PROMPT = `Eres un asesor de dirección de arte y fotografía para producciones audiovisuales. Recibes un resumen de un proyecto y propones referencias visuales para su moodboard.

Reglas:
- Propón entre 5 y 6 referencias de obras REALES y conocidas (películas, series, videoclips, anuncios o fotógrafos). Solo cita una obra si estás seguro de que existe y de su año; si dudas, no la incluyas. No inventes títulos.
- En "porque" explica en una o dos frases qué tiene esa referencia que sirva a ESTE proyecto (luz, color, encuadre, ritmo, atmósfera), mencionando escenas o personajes del resumen cuando ayude.
- "tono" es una frase corta que resume la atmósfera visual y emocional.
- "paleta" son 5 colores en formato hexadecimal #rrggbb coherentes con el tono.
- "ideas" son 4 a 6 ideas concretas y breves (fotografía, vestuario y arte, sonido y música, ritmo y montaje).
- Escribe en español. No repitas el resumen. Responde únicamente con el JSON solicitado.`;

const HEX = /^#[0-9a-fA-F]{6}$/;

export async function buildMoodboardBrief(
  projectId: string,
): Promise<{ brief: string; hasSubstance: boolean } | null> {
  const project = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      name: true,
      type: true,
      director: true,
      durationLabel: true,
      notes: true,
      scenes: {
        orderBy: [{ order: "asc" }, { number: "asc" }],
        take: 60,
        select: {
          number: true,
          intExt: true,
          dayPart: true,
          description: true,
          location: { select: { name: true } },
        },
      },
      characters: { take: 30, select: { name: true, notes: true } },
    },
  });
  if (!project) return null;

  const lines: string[] = [`Proyecto: ${project.name}`];
  if (project.type) lines.push(`Tipo: ${project.type}`);
  if (project.durationLabel) lines.push(`Duración: ${project.durationLabel}`);
  if (project.director) lines.push(`Dirección: ${project.director}`);
  if (project.notes) lines.push(`Notas del proyecto: ${project.notes.slice(0, 1200)}`);

  if (project.characters.length > 0) {
    lines.push("Personajes:");
    for (const c of project.characters) lines.push(`- ${c.name}${c.notes ? `: ${c.notes.slice(0, 140)}` : ""}`);
  }
  if (project.scenes.length > 0) {
    lines.push("Escenas:");
    for (const s of project.scenes) {
      const place = s.location?.name ? ` · ${s.location.name}` : "";
      const description = s.description ? `: ${s.description.slice(0, 200)}` : "";
      lines.push(`- ${s.number} ${INT_EXT_LABELS[s.intExt]} ${DAY_PART_LABELS[s.dayPart]}${place}${description}`);
    }
  }

  const described = project.scenes.some((s) => s.description);
  return { brief: lines.join("\n"), hasSubstance: Boolean(project.notes) || described };
}

function clean(value: unknown, max: number): string {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

export async function suggestMoodboardReferences(brief: string): Promise<MoodboardProposal> {
  const mistral = getMistralClient();
  const response = await mistral.chat.complete({
    model: "mistral-small-latest",
    temperature: 0.6,
    messages: [
      { role: "system", content: SYSTEM_PROMPT },
      { role: "user", content: brief },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: { name: "moodboard_references", schemaDefinition: schema, strict: true },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content.map((chunk) => ("text" in chunk ? chunk.text : "")).join("")
        : "";
  if (!text) throw new Error("Mistral no devolvió contenido");

  const raw = JSON.parse(text) as {
    tono?: unknown;
    paleta?: unknown;
    referencias?: unknown;
    ideas?: unknown;
  };

  const references = (Array.isArray(raw.referencias) ? raw.referencias : [])
    .map((r) => {
      const o = (r ?? {}) as Record<string, unknown>;
      const kind = clean(o.tipo, 20);
      return {
        title: clean(o.titulo, 160),
        year: clean(o.anio, 12),
        kind: (REFERENCE_KINDS as readonly string[]).includes(kind) ? kind : "Otro",
        why: clean(o.porque, 700),
      };
    })
    .filter((r) => r.title)
    .slice(0, 8);

  const ideas = (Array.isArray(raw.ideas) ? raw.ideas : [])
    .map((i) => {
      const o = (i ?? {}) as Record<string, unknown>;
      const topic = clean(o.tema, 40);
      return {
        topic: (IDEA_TOPICS as readonly string[]).includes(topic) ? topic : "Fotografía",
        text: clean(o.texto, 600),
      };
    })
    .filter((i) => i.text)
    .slice(0, 8);

  const palette = (Array.isArray(raw.paleta) ? raw.paleta : [])
    .filter((c): c is string => typeof c === "string" && HEX.test(c.trim()))
    .map((c) => c.trim().toLowerCase())
    .slice(0, 8);

  return { tone: clean(raw.tono, 200), palette, references, ideas };
}
