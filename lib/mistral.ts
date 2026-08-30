import { Mistral } from "@mistralai/mistralai";

let client: Mistral | null = null;

function getClient() {
  if (!client) {
    client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  }
  return client;
}

export type ScriptAnalysisProposal = {
  characters: { name: string; notes?: string }[];
  locations: { name: string; notes?: string }[];
  props: { name: string }[];
  scenes: {
    number: string;
    intExt?: "INT" | "EXT" | "INT_EXT";
    dayPart?: "DAY" | "NIGHT" | "DUSK" | "DAWN";
    locationName?: string;
    description?: string;
    action?: string;
    dialogueNotes?: string;
    characterNames?: string[];
    propNames?: string[];
  }[];
};

const schema = {
  type: "object",
  properties: {
    characters: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
      },
    },
    locations: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          notes: { type: "string" },
        },
        required: ["name"],
      },
    },
    props: {
      type: "array",
      items: {
        type: "object",
        properties: { name: { type: "string" } },
        required: ["name"],
      },
    },
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "string" },
          intExt: { type: "string", enum: ["INT", "EXT", "INT_EXT"] },
          dayPart: { type: "string", enum: ["DAY", "NIGHT", "DUSK", "DAWN"] },
          locationName: { type: "string" },
          description: { type: "string" },
          action: { type: "string" },
          dialogueNotes: { type: "string" },
          characterNames: { type: "array", items: { type: "string" } },
          propNames: { type: "array", items: { type: "string" } },
        },
        required: ["number"],
      },
    },
  },
  required: ["characters", "locations", "props", "scenes"],
};

const PROMPT = `Analiza este guion audiovisual y extrae su estructura de producción.

Para cada escena identifica: número, si es interior/exterior (INT, EXT o INT_EXT), si es de día o de noche (DAY, NIGHT, DUSK o DAWN), la localización, una breve descripción, la acción principal, notas de diálogo, los personajes que aparecen y los objetos de atrezzo relevantes mencionados explícitamente.

Lista también, de forma consolidada, todos los personajes, localizaciones y elementos de atrezzo distintos que aparecen en todo el guion (sin duplicados).

Usa los nombres tal como aparecen en el guion (en mayúsculas si así están escritos). No inventes información que no esté en el texto. Si un dato no aparece, omite ese campo.

Responde únicamente con el JSON solicitado.`;

export async function analyzeScriptPdf(
  documentUrl: string,
): Promise<ScriptAnalysisProposal> {
  const mistral = getClient();

  const response = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "user",
        content: [
          { type: "document_url", documentUrl },
          { type: "text", text: PROMPT },
        ],
      },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "script_analysis",
        schemaDefinition: schema,
        strict: true,
      },
    },
  });

  const content = response.choices?.[0]?.message?.content;
  const text =
    typeof content === "string"
      ? content
      : Array.isArray(content)
        ? content
            .map((chunk) => ("text" in chunk ? chunk.text : ""))
            .join("")
        : "";

  if (!text) throw new Error("Mistral no devolvió contenido");

  return JSON.parse(text) as ScriptAnalysisProposal;
}

export type ContinuitySceneInput = {
  number: string;
  intExt: string;
  dayPart: string;
  locationName: string | null;
  characterNames: string[];
  items: { name: string; category: string; condition: string | null }[];
  description: string | null;
  action: string | null;
};

export type ContinuityIssueProposal = {
  type: string;
  title: string;
  description: string;
  sceneNumbers: string[];
};

const continuitySchema = {
  type: "object",
  properties: {
    issues: {
      type: "array",
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["wardrobe", "prop", "other"] },
          title: { type: "string" },
          description: { type: "string" },
          sceneNumbers: { type: "array", items: { type: "string" } },
        },
        required: ["type", "title", "description", "sceneNumbers"],
      },
    },
  },
  required: ["issues"],
};

const CONTINUITY_SYSTEM_PROMPT = `Eres un supervisor de continuidad de cine y televisión. Te paso la lista de escenas de un proyecto audiovisual, en el orden en que ocurren dentro de la historia (no necesariamente el orden de rodaje ni el orden del guion).

Cada escena incluye: personajes presentes, atrezzo/vestuario/otros elementos asociados (con su estado si se conoce, por ejemplo "roto", "perdido", "intacto"), localización, y el texto libre de descripción/acción tal como lo escribió el equipo.

Tu tarea es señalar posibles errores de continuidad, por ejemplo:
- Un personaje lleva una prenda distinta sin motivo aparente entre escenas cercanas en la cronología.
- Un objeto marcado como roto/perdido/usado en una escena aparece intacto en una escena posterior de la historia.
- Cualquier otra inconsistencia lógica evidente a partir de estos datos (localización, hora del día, objetos que desaparecen y reaparecen sin explicación, etc.).

Reglas importantes:
- No inventes información que no esté en los datos proporcionados.
- Si no hay suficiente información para juzgar un caso con razonable confianza, no lo reportes — es preferible no decir nada a dar una falsa alarma.
- Cada alerta debe referenciar los números de escena exactos implicados.
- Responde únicamente con el JSON solicitado.`;

export async function analyzeContinuity(
  scenes: ContinuitySceneInput[],
): Promise<ContinuityIssueProposal[]> {
  const mistral = getClient();

  const scenesText = JSON.stringify(scenes, null, 2);

  const response = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      { role: "system", content: CONTINUITY_SYSTEM_PROMPT },
      {
        role: "user",
        content: `Escenas en orden cronológico de la historia:\n${scenesText}`,
      },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "continuity_check",
        schemaDefinition: continuitySchema,
        strict: true,
      },
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

  const parsed = JSON.parse(text) as { issues: ContinuityIssueProposal[] };
  return parsed.issues;
}
