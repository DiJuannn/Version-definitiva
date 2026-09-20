// Tipos y constantes del moodboard sin dependencias de servidor, para poder
// usarlos tanto en el editor (cliente) como en lib/moodboard-core.ts (servidor).

export const CARD_TYPES = ["note", "image", "palette", "reference", "scene", "character", "location"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const REFERENCE_KINDS = ["Película", "Serie", "Videoclip", "Publicidad", "Fotografía", "Otro"] as const;
export const NOTE_COLORS = ["#f3e7a6", "#cfe8d5", "#cfe0f3", "#f3cfd9", "#e0d4f3"] as const;

export type MoodboardCard = {
  id: string;
  type: CardType;
  x: number;
  y: number;
  w: number;
  h: number;
  // note
  text?: string;
  color?: string;
  // image
  url?: string;
  caption?: string;
  // palette / reference
  title?: string;
  colors?: string[];
  year?: string;
  kind?: string;
  why?: string;
  // tarjetas vivas del proyecto: refId es el id; label (número de escena o nombre)
  // sirve para volver a encontrarla si el id cambió (p. ej. al restaurar un guion)
  refId?: string;
  label?: string;
};

export type MoodboardData = { v: 1; cards: MoodboardCard[] };

// Lo que el editor necesita saber del proyecto para las tarjetas vivas.
export type MoodboardLookup = {
  scenes: { id: string; number: string; heading: string; location: string | null; description: string | null }[];
  characters: { id: string; name: string; actor: string | null }[];
  locations: { id: string; name: string; address: string | null }[];
};
