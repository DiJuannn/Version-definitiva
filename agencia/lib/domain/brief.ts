import { z } from "zod";

/** Campos del brief guiado. `required` marca lo que el editor necesita para empezar. */
export const BRIEF_FIELDS = [
  { key: "objective", label: "Objetivo", hint: "¿Qué debe conseguir el vídeo?", required: true, section: "Propósito", multiline: true },
  { key: "contentType", label: "Tipo de contenido", hint: "Reel, anuncio, entrevista, tutorial…", required: true, section: "Propósito" },
  { key: "audience", label: "Audiencia", hint: "¿Quién lo va a ver y dónde?", required: true, section: "Propósito", multiline: true },
  { key: "duration", label: "Duración", hint: "Por ejemplo: 30–45 s", required: true, section: "Formato" },
  { key: "format", label: "Formato y resolución", hint: "9:16 1080×1920, 16:9 4K…", required: true, section: "Formato" },
  { key: "deadline", label: "Fecha deseada", hint: "Cuándo lo necesitáis publicado", required: true, section: "Formato", type: "date" },
  { key: "styleAndPace", label: "Estilo y ritmo", hint: "Dinámico, pausado, cortes al beat…", required: false, section: "Estilo", multiline: true },
  { key: "references", label: "Referencias", hint: "Enlaces a vídeos que os gusten y por qué", required: false, section: "Estilo", multiline: true },
  { key: "music", label: "Música", hint: "Estilo, pista concreta o licencia", required: false, section: "Sonido" },
  { key: "audio", label: "Audio", hint: "Voz en off, limpieza, niveles…", required: false, section: "Sonido" },
  { key: "subtitles", label: "Subtítulos", hint: "Idiomas, estilo, quemados o archivo aparte", required: false, section: "Sonido" },
  { key: "branding", label: "Branding", hint: "Normas de marca a respetar", required: false, section: "Marca", multiline: true },
  { key: "logos", label: "Logos", hint: "Dónde están y en qué posición van", required: false, section: "Marca" },
  { key: "fonts", label: "Tipografías", hint: "Nombres o archivos", required: false, section: "Marca" },
  { key: "colors", label: "Colores", hint: "Hex o descripción", required: false, section: "Marca" },
  { key: "cta", label: "Llamada a la acción", hint: "Qué debe hacer quien lo vea al final", required: false, section: "Marca" },
  { key: "material", label: "Material", hint: "Dónde está el material bruto (enlace o subida)", required: true, section: "Material", multiline: true },
  { key: "specialInstructions", label: "Instrucciones especiales", hint: "Cualquier cosa que no encaje arriba", required: false, section: "Material", multiline: true },
] as const;

export type BriefKey = (typeof BRIEF_FIELDS)[number]["key"];
export type BriefData = Partial<Record<BriefKey, string>>;

export const briefDataSchema = z
  .object(Object.fromEntries(BRIEF_FIELDS.map((f) => [f.key, z.string().max(5000).optional()])) as Record<BriefKey, z.ZodOptional<z.ZodString>>)
  .strict();

export function parseBriefData(raw: unknown): BriefData {
  const r = briefDataSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

export function missingBriefFields(data: BriefData) {
  return BRIEF_FIELDS.filter((f) => f.required && !data[f.key]?.trim());
}

export function briefCompleteness(data: BriefData): number {
  const filled = BRIEF_FIELDS.filter((f) => data[f.key]?.trim()).length;
  return Math.round((filled / BRIEF_FIELDS.length) * 100);
}

export function briefSections() {
  const map = new Map<string, (typeof BRIEF_FIELDS)[number][]>();
  for (const f of BRIEF_FIELDS) map.set(f.section, [...(map.get(f.section) ?? []), f]);
  return [...map.entries()];
}
