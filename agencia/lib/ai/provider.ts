import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { z } from "zod";
import { env } from "@/lib/env";
import { AppError } from "@/lib/http/errors";

/**
 * Capa de IA desacoplada del proveedor. La IA solo PROPONE: ninguna función
 * cambia datos; las personas deciden en la interfaz.
 */
export const CATEGORIES = ["VIDEO", "AUDIO", "COLOR", "SUBTITLES", "MOTION_GRAPHICS", "BRANDING", "OTHER"] as const;

export type CategorySuggestion = { category: (typeof CATEGORIES)[number]; reason: string };

export interface AIProvider {
  readonly name: string;
  suggestCategory(text: string): Promise<CategorySuggestion>;
  summarize(conversation: string): Promise<string>;
}

class AnthropicProvider implements AIProvider {
  readonly name = "Anthropic";
  private client: Anthropic;
  private model: string;
  constructor(apiKey: string, model?: string) {
    this.client = new Anthropic({ apiKey });
    this.model = model || "claude-opus-5-5";
  }

  async suggestCategory(text: string) {
    const schema = z.object({ category: z.enum(CATEGORIES), reason: z.string() });
    const res = await this.client.messages.parse({
      model: this.model,
      max_tokens: 1024,
      output_config: { effort: "low", format: zodOutputFormat(schema) },
      system:
        "Clasificas correcciones de clientes sobre un vídeo en una categoría de postproducción. Responde en español con una razón de una frase.",
      messages: [{ role: "user", content: `Corrección: """${text}"""` }],
    });
    if (res.stop_reason === "refusal" || !res.parsed_output) throw new AppError(502, "La IA no devolvió una sugerencia válida", "ai_invalid");
    return res.parsed_output;
  }

  async summarize(conversation: string) {
    const res = await this.client.messages.create({
      model: this.model,
      max_tokens: 4000,
      output_config: { effort: "low" },
      system:
        "Resumes en español, para el editor de vídeo, las correcciones pedidas en una revisión. Lista breve de cambios concretos con su tiempo. No inventes nada que no esté en la conversación.",
      messages: [{ role: "user", content: conversation }],
    });
    if (res.stop_reason === "refusal") throw new AppError(502, "La IA rechazó la petición", "ai_refusal");
    return res.content.map((b) => (b.type === "text" ? b.text : "")).join("").trim();
  }
}

/** Devuelve el proveedor solo si el servidor tiene credenciales Y la organización lo autorizó. */
export function aiProviderFor(org: { aiEnabled: boolean }): AIProvider | null {
  const e = env();
  if (!org.aiEnabled || e.AI_PROVIDER !== "anthropic" || !e.ANTHROPIC_API_KEY) return null;
  return new AnthropicProvider(e.ANTHROPIC_API_KEY, e.AI_MODEL);
}

export function aiUnavailable() {
  return new AppError(503, "La IA no está activada: hace falta configurar un proveedor y autorizarlo en Ajustes. Puedes seguir trabajando manualmente.", "ai_unavailable");
}
