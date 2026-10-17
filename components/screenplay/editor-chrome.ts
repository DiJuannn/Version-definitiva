// Lo que dice la barra del guion (paneles, tipo de línea, pistas de teclado,
// guardado, exportar) y las cuentas de la pantalla (ir a una escena, barra
// encima del teclado). Puro, sin React: así se prueba en tests/unit.

import {
  BLOCK_LABELS,
  EMPTY_ENTER,
  ENTER_NEXT,
  SHIFT_TAB_NEXT,
  TAB_NEXT,
  type BlockType,
} from "@/lib/screenplay/blocks";

// ------------------------------------------------------------ paneles

// Los ids se guardan en localStorage desde antes del cambio de nombre: no se
// tocan (así cada cual reabre el panel que dejó).
export type PanelId = "estructura" | "ideas" | "notas" | "radiografia";

export const PANELS: readonly { id: PanelId; label: string; description: string }[] = [
  { id: "estructura", label: "Tu historia", description: "Tus escenas en orden y los momentos clave de la historia." },
  { id: "ideas", label: "Ideas sueltas", description: "Apunta lo que se te ocurra; luego lo conviertes en escena." },
  { id: "notas", label: "Esta escena", description: "De qué va la escena donde escribes, quién sale y ayuda si te atascas." },
  { id: "radiografia", label: "Rodaje", description: "Cuánto dura lo escrito y cuánto cuesta rodarlo." },
];

export const isPanelId = (v: unknown): v is PanelId => PANELS.some((p) => p.id === v);
export const panelInfo = (id: PanelId) => PANELS.find((p) => p.id === id)!;

// «Esta escena» y «Rodaje» van en columna a la derecha en pantallas anchas
// y como hoja inferior en las demás; «Tu historia» e «Ideas», a la izquierda.
export const isSidePanel = (id: PanelId | null) => id === "notas" || id === "radiografia";

// ------------------------------------------------------------ tipo de línea

// El menú de tipo de línea: primero lo de todos los días, luego «Más».
export const LINE_MENU: readonly { title: string | null; types: readonly BlockType[] }[] = [
  { title: null, types: ["sceneHeading", "action", "character", "dialogue", "parenthetical"] },
  { title: "Más", types: ["transition", "shot", "note"] },
];

export type KeyHint = { key: "Enter" | "Tab" | "⇧Tab"; to: BlockType; label: string; change: boolean };

// Qué hace cada tecla en la línea actual, en palabras: «Enter → Lo que se ve».
// `change`: la tecla cambia ESTA línea (Tab, o Enter en una línea vacía), no
// crea otra debajo.
export function lineKeyHints(type: BlockType, empty: boolean): KeyHint[] {
  const emptyEnter = empty ? EMPTY_ENTER[type] : undefined;
  // Un «Lugar y hora» vacío no cambia con Enter: se queda y se escribe debajo.
  const enterTo = emptyEnter && type !== "sceneHeading" ? emptyEnter : ENTER_NEXT[type];
  const out: KeyHint[] = [
    { key: "Enter", to: enterTo, label: BLOCK_LABELS[enterTo], change: Boolean(emptyEnter && type !== "sceneHeading") },
    { key: "Tab", to: TAB_NEXT[type], label: BLOCK_LABELS[TAB_NEXT[type]], change: true },
  ];
  return out;
}

export function shiftTabHint(type: BlockType): KeyHint {
  return { key: "⇧Tab", to: SHIFT_TAB_NEXT[type], label: BLOCK_LABELS[SHIFT_TAB_NEXT[type]], change: true };
}

// «Enter → Lo que se ve · Tab → Quién habla» (para lectores de pantalla y
// para el título de la pista).
export function lineKeyHintText(type: BlockType, empty: boolean): string {
  return lineKeyHints(type, empty)
    .map((h) => `${h.key} → ${h.label}`)
    .join(" · ");
}

// Botones de la barra encima del teclado del móvil (no hay Tab).
export const KEYBAR: readonly { type: BlockType; label: string }[] = [
  { type: "sceneHeading", label: "Lugar" },
  { type: "action", label: "Lo que se ve" },
  { type: "character", label: "Quién habla" },
  { type: "parenthetical", label: "(Cómo)" },
];

// Qué hace un botón de la barra del móvil sobre la línea actual. La barra
// sirve para «lo que viene ahora»: en una línea vacía le cambia el tipo; en
// una con texto abre debajo una línea nueva de ese tipo (así tocar «Quién
// habla» al acabar una frase nunca convierte la frase en un nombre). Para
// cambiar el tipo de una línea ya escrita está el menú de tipo de línea.
export function keybarAction(text: string, current: BlockType | null, target: BlockType): "set" | "insert" | "none" {
  if (!current) return "none";
  if (!text.trim()) return current === target ? "none" : "set";
  return "insert";
}

// ------------------------------------------------------------ ir a una escena

// Dónde dejar la ventana para que el encabezado quede arriba, justo debajo de
// la cabecera y la barra fijas (y no pegado al borde de abajo).
export function sceneScrollTop({ elementTop, scrollY, chromeBottom, gap = 24 }: { elementTop: number; scrollY: number; chromeBottom: number; gap?: number }): number {
  return Math.max(0, Math.round(elementTop + scrollY - chromeBottom - gap));
}

// ------------------------------------------------------------ teclado del móvil

// Cuánto tapa el teclado por abajo (con visualViewport, que sí lo descuenta).
export function keyboardInset(innerHeight: number, vv: { height: number; offsetTop: number } | null): number {
  if (!vv) return 0;
  const inset = innerHeight - vv.height - vv.offsetTop;
  return inset > 40 ? Math.round(inset) : 0; // menos de 40 px es la barra del navegador, no el teclado
}

// ------------------------------------------------------------ guardado

export type SaveState = "saved" | "dirty" | "saving" | "error";
export type Connection = "connecting" | "online" | "offline";
export type SaveTone = "ok" | "busy" | "warn" | "error";

export function saveIndicator(save: SaveState, connection: Connection, error?: string | null): { label: string; short: string; tone: SaveTone } {
  if (connection === "offline") return { label: "Sin conexión: lo que escribas se guarda al volver", short: "Sin conexión", tone: "warn" };
  if (save === "error") return { label: error ?? "Error al guardar. Se reintentará solo.", short: "Error al guardar", tone: "error" };
  if (save === "saving") return { label: "Guardando…", short: "Guardando…", tone: "busy" };
  if (save === "dirty") return { label: "Hay cambios sin guardar (se guardan solos en un momento)", short: "Sin guardar", tone: "busy" };
  return { label: "Todo lo escrito está guardado: se guarda solo mientras escribes.", short: "Guardado", tone: "ok" };
}

// ------------------------------------------------------------ exportar

export type ExportItem = { id: "pdf-a4" | "pdf-letter" | "fountain"; label: string; detail: string; href: string; mode: "tab" | "download" };

// El PDF se abre en otra pestaña (para verlo); el Fountain se descarga en la
// misma, sin dejar una pestaña en blanco abierta.
export function exportItems(screenplayId: string, printedPages: number): ExportItem[] {
  const pages = printedPages ? `${printedPages} ${printedPages === 1 ? "pág." : "págs."} + portada` : "solo la portada";
  return [
    { id: "pdf-a4", label: "PDF para imprimir o enviar", detail: `Tamaño A4 · ${pages}`, href: `/api/pdf/guion/${screenplayId}?size=A4`, mode: "tab" },
    { id: "pdf-letter", label: "PDF tamaño EE. UU.", detail: "Letter, el que piden en EE. UU.", href: `/api/pdf/guion/${screenplayId}?size=LETTER`, mode: "tab" },
    { id: "fountain", label: "Archivo .fountain", detail: "Texto para otras apps de guion", href: `/api/guiones/${screenplayId}/fountain`, mode: "download" },
  ];
}

// ------------------------------------------------------------ textos

export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

// Punto naranja junto a «Escena N de M»: dice qué es, con texto.
export function doubtsLabel(n: number): string {
  return n === 1 ? "1 escena con dudas" : `${n} escenas con dudas`;
}

// «≈ 8 s en pantalla» en vez de «1/8 pág.» (un octavo de página ≈ 7,5 s).
export function screenTime(eighths: number): string {
  const s = Math.max(1, Math.round((eighths / 8) * 60));
  return s < 60 ? `≈ ${s} s` : `≈ ${Math.round(s / 60)} min`;
}
