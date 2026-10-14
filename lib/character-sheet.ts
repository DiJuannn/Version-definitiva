// Ficha de personaje de Taller: lo que necesitan producción, vestuario,
// maquillaje y casting. Se guarda en Character.sheet (JSON) y no la toca la
// sincronización con Guiones, que escribe en Character.profile.

export const ROLE_TYPES = {
  LEAD: "Protagonista",
  MAIN: "Principal",
  SECONDARY: "Secundario",
  SUPPORTING: "Reparto",
  BIT: "Figuración con frase",
  EXTRA: "Figuración",
} as const;
export type RoleType = keyof typeof ROLE_TYPES;

export const CASTING_STATUS = {
  OPEN: "Sin buscar",
  SEARCHING: "En casting",
  CHOSEN: "Elegido",
  CONFIRMED: "Confirmado",
} as const;
export type CastingStatus = keyof typeof CASTING_STATUS;

export type CharacterSheet = {
  role?: RoleType;
  age?: string; // edad aparente: "30-35"
  description?: string; // quién es, en dos líneas
  look?: string; // aspecto físico
  // Solo si el personaje no viene de un guion de Guiones (si viene, manda el guion).
  want?: string;
  fear?: string;
  arc?: string;
  wardrobe?: string;
  makeup?: string; // maquillaje y peluquería
  props?: string; // atrezzo personal
  special?: string; // dobles, especialistas, menor, desnudo, animales…
  casting?: CastingStatus;
  castingNotes?: string; // referencias de casting
};

const TEXT_FIELDS = ["age", "description", "look", "want", "fear", "arc", "wardrobe", "makeup", "props", "special", "castingNotes"] as const;

export function sheetOf(value: unknown): CharacterSheet {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const raw = value as Record<string, unknown>;
  const sheet: CharacterSheet = {};
  for (const key of TEXT_FIELDS) {
    const v = raw[key];
    if (typeof v === "string" && v.trim()) sheet[key] = v.trim().slice(0, 2000);
  }
  if (typeof raw.role === "string" && raw.role in ROLE_TYPES) sheet.role = raw.role as RoleType;
  if (typeof raw.casting === "string" && raw.casting in CASTING_STATUS) sheet.casting = raw.casting as CastingStatus;
  return sheet;
}

export function sheetFromForm(formData: FormData): CharacterSheet {
  const raw: Record<string, unknown> = {};
  for (const key of [...TEXT_FIELDS, "role", "casting"]) raw[key] = String(formData.get(key) ?? "");
  return sheetOf(raw);
}
