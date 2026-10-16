// Tipos y constantes del moodboard sin dependencias de servidor, para poder
// usarlos tanto en el editor (cliente) como en lib/moodboard-core.ts (servidor).

export const CARD_TYPES = ["note", "image", "palette", "reference", "scene", "character", "location"] as const;
export type CardType = (typeof CARD_TYPES)[number];

export const REFERENCE_KINDS = ["Película", "Serie", "Videoclip", "Publicidad", "Fotografía", "Otro"] as const;
export const NOTE_COLORS = ["#f3e7a6", "#cfe8d5", "#cfe0f3", "#f3cfd9", "#e0d4f3"] as const;

// Qué define una referencia: es lo que la lleva a cada departamento (la luz y
// el encuadre a Planos, el vestuario y el arte al Desglose…) y lo que ordena
// la Biblia visual.
export const FACETS = [
  { key: "tono", label: "Tono" },
  { key: "color", label: "Color" },
  { key: "luz", label: "Luz" },
  { key: "encuadre", label: "Encuadre" },
  { key: "vestuario", label: "Vestuario" },
  { key: "arte", label: "Arte" },
  { key: "lugar", label: "Lugar" },
  { key: "sonido", label: "Sonido" },
] as const;
export type Facet = (typeof FACETS)[number]["key"];
export const FACET_KEYS = FACETS.map((f) => f.key) as Facet[];

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
  // Notas, imágenes, paletas y referencias: qué definen y para qué escenas,
  // personajes y localizaciones del proyecto son (ids).
  facets?: Facet[];
  scenes?: string[];
  characters?: string[];
  locations?: string[];
};

export type MoodboardData = { v: 1; cards: MoodboardCard[] };

// Lo que el editor necesita saber del proyecto para las tarjetas vivas.
export type MoodboardLookup = {
  scenes: { id: string; number: string; heading: string; location: string | null; description: string | null }[];
  characters: { id: string; name: string; actor: string | null }[];
  locations: { id: string; name: string; address: string | null }[];
};
