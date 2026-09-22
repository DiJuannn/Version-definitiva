import { Mistral } from "@mistralai/mistralai";
import { BreakdownCategory } from "@/lib/generated/prisma";
import { BREAKDOWN_CATEGORY_LABELS } from "@/lib/labels";

let client: Mistral | null = null;

function getClient() {
  if (!client) {
    client = new Mistral({ apiKey: process.env.MISTRAL_API_KEY });
  }
  return client;
}

// Para otros usos de Mistral fuera del guion (p. ej. las referencias del moodboard).
export function getMistralClient() {
  return getClient();
}

export type ScriptAnalysisProposal = {
  characters: { name: string; notes?: string }[];
  locations: { name: string; notes?: string }[];
  props: { name: string; category?: string }[];
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
        properties: {
          name: { type: "string" },
          category: { type: "string", enum: Object.values(BreakdownCategory) },
        },
        required: ["name", "category"],
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

Para cada escena identifica: número, si es interior/exterior (INT, EXT o INT_EXT), si es de día o de noche (DAY, NIGHT, DUSK o DAWN), la localización, una breve descripción, la acción principal, notas de diálogo, los personajes que aparecen y los elementos de desglose relevantes mencionados explícitamente (props, vestuario, vehículos, etc. — ver categorías abajo).

Lista también, de forma consolidada, todos los personajes, localizaciones y elementos de desglose distintos que aparecen en todo el guion (sin duplicados) — usa exactamente el mismo nombre, tal cual, tanto en esta lista consolidada como dentro de cada escena en la que aparezca, para que se puedan enlazar correctamente.

Para cada elemento de desglose, clasifícalo en UNA de estas categorías según lo que sea de verdad, no lo metas todo en "atrezzo" por defecto:
${Object.entries(BREAKDOWN_CATEGORY_LABELS)
  .map(([value, label]) => `- ${value}: ${label}`)
  .join("\n")}

Por ejemplo: una prenda de ropa, un uniforme o un disfraz es WARDROBE, no PROP. Un coche o una moto es VEHICLE. Un micrófono o un altavoz es SOUND. Un foco o un flash es LIGHTING. PROP es solo para objetos que los personajes manejan o que decoran la escena sin encajar en ninguna otra categoría (un arma de atrezzo, un libro, una maleta).

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

export type ShotListProposal = {
  scenes: {
    number: string;
    shots: {
      number: string;
      shotType?: string;
      shotSize?: string;
      angle?: string;
      movement?: string;
      camera?: string;
      lens?: string;
      description?: string;
      audio?: string;
      notes?: string;
    }[];
  }[];
};

const shotListSchema = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          number: { type: "string" },
          shots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                number: { type: "string" },
                shotType: { type: "string" },
                shotSize: { type: "string" },
                angle: { type: "string" },
                movement: { type: "string" },
                camera: { type: "string" },
                lens: { type: "string" },
                description: { type: "string" },
                audio: { type: "string" },
                notes: { type: "string" },
              },
              required: ["number"],
            },
          },
        },
        required: ["number", "shots"],
      },
    },
  },
  required: ["scenes"],
};

const SHOT_LIST_PROMPT = `Analiza este guion técnico (shot list / desglose de planos) de un proyecto audiovisual y extrae, escena por escena, todos los planos que aparecen.

Para cada escena indica su número tal como aparece en el documento (por ejemplo "1", "4A", "12"). Para cada plano dentro de esa escena indica:
- number: el número o identificador del plano dentro de la escena (por ejemplo "1", "2", "A", "1A"). Si el documento numera los planos de forma global en vez de por escena, usa ese mismo número tal cual.
- shotType: tipo de plano si se especifica (p. ej. "plano secuencia", "inserto", "recurso").
- shotSize: tamaño de plano (p. ej. "PG", "PGG", "PA", "PM", "PMC", "PP", "PPP", "plano detalle").
- angle: ángulo de cámara si se especifica (p. ej. "picado", "contrapicado", "cenital", "a nivel").
- movement: movimiento de cámara si se especifica (p. ej. "fijo", "panorámica", "travelling", "grúa", "steadicam", "zoom", "dolly", "mano").
- camera: cámara o unidad si se especifica.
- lens: óptica/lente si se especifica.
- description: qué ocurre en el plano (acción, encuadre).
- audio: notas de sonido si se especifican.
- notes: cualquier otra nota relevante (duración prevista, referencias, etc.).

No inventes datos que no estén en el documento — si un campo no aparece para un plano, omítelo. Usa los números de escena y de plano exactamente como están escritos en el documento, sin renumerar ni reordenar.

Responde únicamente con el JSON solicitado.`;

export async function analyzeShotListPdf(documentUrl: string): Promise<ShotListProposal> {
  const mistral = getClient();

  const response = await mistral.chat.complete({
    model: "mistral-small-latest",
    messages: [
      {
        role: "user",
        content: [
          { type: "document_url", documentUrl },
          { type: "text", text: SHOT_LIST_PROMPT },
        ],
      },
    ],
    responseFormat: {
      type: "json_schema",
      jsonSchema: {
        name: "shot_list_import",
        schemaDefinition: shotListSchema,
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

  return JSON.parse(text) as ShotListProposal;
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
