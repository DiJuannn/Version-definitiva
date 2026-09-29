import { z } from "zod";

export const STYLE_FIELDS = [
  { key: "subtitles", label: "Subtítulos" },
  { key: "typography", label: "Tipografías" },
  { key: "colors", label: "Colores" },
  { key: "pacing", label: "Ritmo" },
  { key: "transitions", label: "Transiciones" },
  { key: "zooms", label: "Zooms" },
  { key: "music", label: "Música" },
  { key: "audio", label: "Tratamiento de audio" },
  { key: "logoPosition", label: "Posición del logo" },
  { key: "cta", label: "CTA" },
  { key: "approvedExamples", label: "Ejemplos aprobados" },
  { key: "avoid", label: "Evitar" },
] as const;

export type StyleKey = (typeof STYLE_FIELDS)[number]["key"];
export type StyleData = Partial<Record<StyleKey, string>>;

export const styleDataSchema = z
  .object(Object.fromEntries(STYLE_FIELDS.map((f) => [f.key, z.string().max(4000).optional()])) as Record<StyleKey, z.ZodOptional<z.ZodString>>)
  .strict();

export function parseStyleData(raw: unknown): StyleData {
  const r = styleDataSchema.safeParse(raw ?? {});
  return r.success ? r.data : {};
}

/**
 * Detección de patrones POR REGLAS (no IA): busca temas que se repiten en las
 * correcciones de un cliente. Solo produce sugerencias; una persona decide.
 */
const PATTERNS: { field: StyleKey; test: RegExp; text: string }[] = [
  { field: "zooms", test: /\bzoom/i, text: "Pide a menudo cambios sobre los zooms (revisar si evitar zooms digitales)." },
  { field: "music", test: /\bm[uú]sica|canci[oó]n|track/i, text: "Pide a menudo cambios sobre la música." },
  { field: "subtitles", test: /subt[ií]tulo|caption|rótulo/i, text: "Pide a menudo cambios en los subtítulos." },
  { field: "logoPosition", test: /\blogo/i, text: "Pide a menudo cambios sobre el logo." },
  { field: "transitions", test: /transici[oó]n|fundido/i, text: "Pide a menudo cambios en las transiciones." },
  { field: "pacing", test: /ritmo|m[aá]s r[aá]pido|m[aá]s lento|lento|acelera/i, text: "Pide a menudo cambios de ritmo." },
  { field: "colors", test: /\bcolor|saturad|contraste|tono/i, text: "Pide a menudo cambios de color." },
  { field: "audio", test: /\bvolumen|audio|ruido|voz/i, text: "Pide a menudo cambios de audio." },
];

export function detectStylePatterns(
  corrections: { id: string; body: string; projectId: string }[],
  minOccurrences = 3,
  minProjects = 2,
) {
  const out: { field: StyleKey; text: string; evidence: string[] }[] = [];
  for (const p of PATTERNS) {
    const hits = corrections.filter((c) => p.test.test(c.body));
    const projects = new Set(hits.map((h) => h.projectId));
    if (hits.length >= minOccurrences && projects.size >= minProjects) {
      out.push({ field: p.field, text: p.text, evidence: hits.map((h) => h.id) });
    }
  }
  return out;
}
