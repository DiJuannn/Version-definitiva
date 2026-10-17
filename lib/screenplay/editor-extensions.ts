// Esquema y comportamiento del editor de guion (TipTap / ProseMirror).
//
// Cada línea del guion es un bloque con tipo (lugar y hora, lo que se ve,
// quién habla…). Enter y Tab cambian de tipo como en Final Draft; el texto se
// guarda tal cual se escribe salvo el «Lugar y hora» y los cambios de escena,
// que se pasan a mayúsculas al salir de la línea (el resto de mayúsculas son
// solo de estilo: al exportar se pasan a mayúsculas de verdad).
//
// Toda la lógica son comandos de ProseMirror sobre el estado (sin DOM), para
// poder probarla sin navegador; la extensión de TipTap solo los conecta.
// Cada tecla es UNA sola transacción: encadenar varias con Yjs y los widgets
// de decoración dejaba posiciones viejas («CORTE A:» + Enter fallaba).

import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/core";
import type { Node as PMNode, Schema } from "@tiptap/pm/model";
import { Fragment } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState, type Transaction } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { Mapping } from "@tiptap/pm/transform";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import {
  BLOCK_LABELS,
  BLOCK_TYPES,
  EMPTY_ENTER,
  ENTER_NEXT,
  SCENE_PREFIX,
  SCENE_PREFIXES,
  SHIFT_TAB_NEXT,
  TAB_NEXT,
  TIME_OF_DAY,
  TRANSITIONS,
  blockShortcutKeys,
  characterLooksLikeSentence,
  characterName,
  headingLooksLikeSentence,
  isBlockType,
  looksLikeTransition,
  newSceneId,
  parseSceneHeading,
  type BlockType,
  type ScreenplayBlock,
} from "@/lib/screenplay/blocks";
import { parsePastedText } from "@/lib/screenplay/fountain";

type Dispatch = ((tr: Transaction) => void) | undefined;
type Command = (state: EditorState, dispatch?: Dispatch, view?: EditorView) => boolean;

export const PLACEHOLDERS: Record<BlockType, string> = {
  sceneHeading: "INT. LUGAR - DÍA",
  action: "Lo que se ve y se oye, en presente…",
  character: "NOMBRE DE QUIEN HABLA",
  parenthetical: "(cómo lo dice)",
  dialogue: "Lo que dice…",
  transition: "CORTE A:",
  shot: "PLANO DETALLE - …",
  note: "Nota para ti — no se imprime",
};

export const HEADING_HINT = "¿Dónde y cuándo? INT. COCINA - NOCHE";

// Texto de ayuda de una línea vacía. En «Lo que dice», con el nombre de
// quien habla: «Lo que dice LUCÍA…».
export function placeholderFor({ node, pos, editor }: { node: PMNode; pos: number; editor: Editor }): string {
  const type = node.type.name;
  if (!isBlockType(type)) return "";
  if (type === "dialogue") {
    const $pos = editor.state.doc.resolve(pos);
    for (let i = $pos.index(0) - 1; i >= 0 && i >= $pos.index(0) - 4; i--) {
      const prev = editor.state.doc.child(i);
      if (prev.type.name === "parenthetical") continue;
      if (prev.type.name === "character" && characterName(prev.textContent)) return `Lo que dice ${characterName(prev.textContent)}…`;
      break;
    }
  }
  return PLACEHOLDERS[type];
}

export const screenplayNodes = BLOCK_TYPES.map((name) =>
  Node.create({
    name,
    group: "block",
    content: "text*",
    marks: "",
    defining: true,
    parseHTML() {
      // Lo que no venga de este editor (un <p> cualquiera) es «Lo que se ve»,
      // nunca un encabezado (que es el primer tipo del grupo).
      if (name === "action") return [{ tag: `p[data-sp="${name}"]` }, { tag: "p", priority: 10 }];
      return [{ tag: `p[data-sp="${name}"]` }];
    },
    renderHTML({ HTMLAttributes }) {
      return ["p", mergeAttributes(HTMLAttributes, { "data-sp": name, class: `sp-block sp-${name}` }), 0];
    },
    // El encabezado lleva el id de su escena (ver lib/screenplay/story.ts).
    addAttributes() {
      if (name !== "sceneHeading") return {};
      return {
        sid: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute("data-sid"),
          renderHTML: (attrs: { sid?: string | null }) => (attrs.sid ? { "data-sid": attrs.sid } : {}),
        },
      };
    },
  }),
);

// Pone id a los encabezados que no lo tienen (nuevos) y lo cambia en los
// duplicados (partir un encabezado copia sus atributos). Solo con cambios
// propios: los de otra persona ya traen el id que puso su editor.
export function ensureSceneIdsTr(state: EditorState) {
  const seen = new Set<string>();
  let tr: Transaction | null = null;
  state.doc.forEach((node, offset) => {
    if (node.type.name !== "sceneHeading") return;
    const sid = node.attrs.sid as string | null;
    if (sid && !seen.has(sid)) {
      seen.add(sid);
      return;
    }
    const id = newSceneId();
    seen.add(id);
    tr = (tr ?? state.tr).setNodeAttribute(offset, "sid", id);
  });
  return tr as Transaction | null;
}

// ¿Borra algo esta transacción? (al desplazar decoraciones, las que caen en
// un trozo borrado desaparecen: entonces hay que rehacerlas).
function deletesContent(tr: Transaction): boolean {
  return tr.steps.some((step) => {
    let deleted = false;
    step.getMap().forEach((from, to) => {
      if (to > from) deleted = true;
    });
    return deleted;
  });
}

// Desplaza un conjunto de decoraciones; si alguna se ha perdido por el camino
// (se ha reemplazado su trozo, p. ej. al cargar el documento de Yjs), null.
function mapKeeping(set: DecorationSet, tr: Transaction, count: number): DecorationSet | null {
  const mapped = set.map(tr.mapping, tr.doc);
  if (deletesContent(tr) && mapped.find().length !== count) return null;
  return mapped;
}

const isRemote = (tr: Transaction) => Boolean(tr.getMeta(ySyncPluginKey)?.isChangeOrigin);
const hasText = (node: PMNode) => /\S/.test(node.textContent);

// ---------------------------------------------------------------- índice de escenas

// Qué bloques abren escena y con qué número. Es la misma regla que
// sceneNumbering() (blocks.ts) para el PDF y la tira, pero sobre el documento
// del editor y recalculada solo cuando cambia el documento. `sig` resume la
// estructura: si no cambia, las decoraciones se desplazan en vez de rehacerse.
export type SceneIndexEntry = { index: number; offset: number; sid: string | null; number: number | null; text: string };
export type SceneIndex = { headings: SceneIndexEntry[]; sig: string };

function buildSceneIndex(doc: PMNode): SceneIndex {
  const headings: SceneIndexEntry[] = [];
  let n = 0;
  let pending: SceneIndexEntry | null = null;
  doc.forEach((node, offset, index) => {
    if (node.type.name === "sceneHeading") {
      const text = node.textContent;
      const entry: SceneIndexEntry = { index, offset, sid: (node.attrs.sid as string | null) ?? null, number: null, text };
      headings.push(entry);
      pending = null;
      if (/\S/.test(text)) entry.number = ++n;
      else pending = entry;
    } else if (pending && hasText(node)) {
      pending.number = ++n;
      pending = null;
    }
  });
  const sig = headings.map((h) => `${h.index}:${h.number ?? "-"}:${h.sid ?? ""}`).join(",");
  return { headings, sig };
}

export const sceneIndexKey = new PluginKey<SceneIndex>("sp-scene-index");

export function sceneIndex(state: EditorState): SceneIndex {
  return sceneIndexKey.getState(state) ?? buildSceneIndex(state.doc);
}

// ---------------------------------------------------------------- sugerencias

// Autocompletado de nombres de personaje, lugares, momento del día y
// cambios de escena con lo que ya existe en el guion. Se ve como texto
// fantasma («ANA|BEL Tab ⇥») y, si hay varias opciones, como un desplegable.
// Tab y → aceptan; Enter no (para poder escribir ANA aunque exista ANABEL),
// salvo en listas cerradas (DÍA/NOCHE, transiciones) o si se ha elegido con
// las flechas; Esc la descarta hasta el siguiente carácter.
export type SuggestionKind = "character" | "prefix" | "place" | "time" | "transition";

export type SuggestionState = {
  kind: SuggestionKind;
  from: number; // inicio del trozo que se sustituye
  pos: number; // cursor (final de la línea)
  typed: string; // lo escrito en ese trozo
  items: string[]; // hasta 5, la mejor primero: texto con el que se sustituye [from, pos)
  index: number; // la elegida
  closed: boolean; // lista cerrada: Enter también acepta
  navigated: boolean; // se ha elegido con las flechas: Enter también acepta
  dismissed: boolean; // Esc: no se enseña hasta el siguiente carácter
};

export const MAX_SUGGESTIONS = 5;
export const suggestionKey = new PluginKey<SuggestionState | null>("sp-suggestion");

// Lo que cada bloque aporta al índice de sugerencias, recordado por nodo:
// los nodos de ProseMirror son inmutables y los que no cambian se comparten
// entre versiones del documento, así que cada tecla solo analiza su línea.
type NodeFacts = { character?: string; heading?: string; prefix?: string; place?: string; mentions?: string[] };
const factsMemo = new WeakMap<PMNode, NodeFacts>();

// Palabras en mayúsculas de la acción que no son nombres.
const NOT_NAMES = new Set(["INT", "EXT", "CORTE", "FUNDIDO", "FIN", "OK", "TV", "DVD", "CD", "V.O", "O.S", "CONT", "MÁS", "SMS", "WC", "DNI", "ADN", "EEUU", "UE"]);

function factsOf(node: PMNode): NodeFacts {
  const hit = factsMemo.get(node);
  if (hit) return hit;
  const facts: NodeFacts = {};
  const text = node.textContent;
  const type = node.type.name;
  if (type === "character") {
    const name = characterName(text);
    if (name) facts.character = name;
  } else if (type === "sceneHeading") {
    const upper = text.trim().toUpperCase();
    if (upper) {
      facts.heading = upper;
      const { prefix, place } = parseSceneHeading(upper);
      if (prefix && place) {
        facts.prefix = prefix;
        facts.place = place;
      }
    }
  } else if (type === "action" && /\p{Lu}{2}/u.test(text)) {
    // «AUREL (23) entra…»: personajes que aún no hablan, en mayúsculas la
    // primera vez que salen (la convención de la acción).
    const found = text.match(/(?<![\p{L}.])\p{Lu}[\p{Lu}'’-]+(?: \p{Lu}[\p{Lu}'’-]+){0,2}(?![\p{L}.])/gu) ?? [];
    const names = found.filter((w) => w.length >= 2 && !NOT_NAMES.has(w));
    if (names.length) facts.mentions = [...new Set(names)];
  }
  factsMemo.set(node, facts);
  return facts;
}

type SuggestIndex = {
  characters: Map<string, number>; // hablan: peso 2 por línea
  headings: Map<string, number>;
  places: Map<string, Map<string, number>>; // lugar → prefijo → veces
};
const indexMemo = new WeakMap<PMNode, SuggestIndex>();

function suggestIndex(doc: PMNode): SuggestIndex {
  const hit = indexMemo.get(doc);
  if (hit) return hit;
  const characters = new Map<string, number>();
  const headings = new Map<string, number>();
  const places = new Map<string, Map<string, number>>();
  const add = (m: Map<string, number>, k: string, w: number) => m.set(k, (m.get(k) ?? 0) + w);
  doc.forEach((node) => {
    const f = factsOf(node);
    if (f.character) add(characters, f.character, 2);
    if (f.mentions) for (const m of f.mentions) add(characters, m, 1);
    if (f.heading) add(headings, f.heading, 1);
    if (f.place && f.prefix) {
      if (!places.has(f.place)) places.set(f.place, new Map());
      add(places.get(f.place)!, f.prefix, 1);
    }
  });
  const index = { characters, headings, places };
  indexMemo.set(doc, index);
  return index;
}

function ranked(typed: string, options: Iterable<[string, number]>, exclude?: string): string[] {
  const upper = typed.toUpperCase();
  const out: [string, number][] = [];
  for (const [opt, weight] of options) {
    if (opt.length <= upper.length || !opt.startsWith(upper) || opt === exclude) continue;
    out.push([opt, weight]);
  }
  // Más usadas primero; a igualdad, la más completa.
  out.sort((a, b) => b[1] - a[1] || b[0].length - a[0].length || a[0].localeCompare(b[0], "es"));
  return out.slice(0, MAX_SUGGESTIONS).map(([o]) => o);
}

export function computeSuggestion(state: EditorState): SuggestionState | null {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  const node = $from.parent;
  const type = node.type.name;
  if (type !== "character" && type !== "sceneHeading" && type !== "transition") return null;
  const text = node.textContent;
  if ($from.parentOffset !== text.length || !text.trim()) return null;
  const start = $from.start();
  const pos = $from.pos;
  const make = (kind: SuggestionKind, from: number, items: string[], closed = false): SuggestionState | null =>
    items.length ? { kind, from, pos, typed: state.doc.textBetween(from, pos), items, index: 0, closed, navigated: false, dismissed: false } : null;

  if (type === "character") {
    const own = characterName(text);
    if (/\(|\)/.test(text)) return null; // ya lleva extensión: (V.O.), (CONT.)…
    return make("character", start + (text.length - text.trimStart().length), ranked(text.trim(), suggestIndex(state.doc).characters, own));
  }

  if (type === "transition") {
    return make("transition", start, ranked(text, TRANSITIONS.map((t) => [t, 1] as [string, number])), true);
  }

  // Lugar y hora.
  const upper = text.toUpperCase();
  const hasPrefix = SCENE_PREFIX.test(`${upper} `) && /\s/.test(upper);
  if (!hasPrefix && !/\s/.test(upper)) {
    const items = ranked(text, SCENE_PREFIXES.map((p, i) => [`${p} `, SCENE_PREFIXES.length - i] as [string, number]));
    if (items.length) return make("prefix", start, items);
  }
  // Momento del día: tras « - ».
  const dash = upper.lastIndexOf(" -");
  if (hasPrefix && dash !== -1 && dash >= upper.length - 16) {
    const after = upper.slice(dash + 2);
    const partial = after.trimStart();
    if (!/\s-/.test(after)) {
      const from = start + dash + 2 + (after.length - partial.length);
      const lead = after.length ? "" : " ";
      const items = ranked(partial, TIME_OF_DAY.map((t, i) => [t, TIME_OF_DAY.length - i] as [string, number])).map((t) => lead + t);
      if (!partial) {
        const all = TIME_OF_DAY.slice(0, MAX_SUGGESTIONS).map((t) => lead + t);
        return make("time", from, all, true);
      }
      return make("time", from, items, true);
    }
  }
  if (!hasPrefix) return null;
  // Lugares ya usados (con el prefijo que se ha escrito) y encabezados enteros.
  const { prefix } = parseSceneHeading(upper);
  const idx = suggestIndex(state.doc);
  const options = new Map<string, number>();
  // Pesos: el encabezado entero ya usado, luego el lugar con el mismo
  // prefijo (INT./EXT.) y por último el lugar usado con el otro.
  for (const [place, byPrefix] of idx.places) {
    let n = 0;
    for (const [p, count] of byPrefix) n += p === prefix ? count * 2 : count;
    options.set(`${prefix} ${place}`, n);
  }
  for (const [heading, n] of idx.headings) options.set(heading, Math.max(options.get(heading) ?? 0, n * 2 + 1));
  return make("place", start, ranked(text, options, upper.trim()));
}

// Lo que necesita una UI de fuera (desplegable propio, barra móvil…).
export type PublicSuggestion = Pick<SuggestionState, "kind" | "items" | "index" | "typed" | "closed">;

export function getSuggestions(state: EditorState): PublicSuggestion | null {
  const s = suggestionKey.getState(state);
  if (!s || s.dismissed) return null;
  return { kind: s.kind, items: s.items, index: s.index, typed: s.typed, closed: s.closed };
}

// Completa la línea con la sugerencia (la elegida o la que se diga).
function acceptTr(state: EditorState, index?: number): Transaction | null {
  const s = suggestionKey.getState(state);
  if (!s || s.dismissed) return null;
  const value = s.items[index ?? s.index];
  if (!value) return null;
  const tr = state.tr.insertText(value, s.from, s.pos);
  return tr.setSelection(TextSelection.create(tr.doc, s.from + value.length)).scrollIntoView();
}

export const acceptSuggestionCommand =
  (index?: number): Command =>
  (state, dispatch) => {
    const tr = acceptTr(state, index);
    if (!tr) return false;
    dispatch?.(tr);
    return true;
  };

export const moveSuggestionCommand =
  (delta: number): Command =>
  (state, dispatch) => {
    const s = suggestionKey.getState(state);
    if (!s || s.dismissed || s.items.length < 2) return false;
    const index = (s.index + delta + s.items.length) % s.items.length;
    dispatch?.(state.tr.setMeta(suggestionKey, { select: index }));
    return true;
  };

export const dismissSuggestionCommand: Command = (state, dispatch) => {
  const s = suggestionKey.getState(state);
  if (!s || s.dismissed) return false;
  dispatch?.(state.tr.setMeta(suggestionKey, { dismiss: true }));
  return true;
};

// Atajos para quien pinte su propia UI.
export const acceptSuggestion = (view: EditorView, index?: number) => acceptSuggestionCommand(index)(view.state, view.dispatch);
export const moveSuggestion = (view: EditorView, delta: number) => moveSuggestionCommand(delta)(view.state, view.dispatch);
export const dismissSuggestion = (view: EditorView) => dismissSuggestionCommand(view.state, view.dispatch);

function suggestionWidget(s: SuggestionState) {
  return (view: EditorView) => {
    const wrap = document.createElement("span");
    wrap.className = "sp-sugg";
    wrap.contentEditable = "false";
    const ghost = document.createElement("span");
    ghost.className = "sp-ghost";
    ghost.setAttribute("aria-hidden", "true");
    const value = s.items[s.index];
    ghost.textContent = value.toUpperCase().startsWith(s.typed.toUpperCase()) ? value.slice(s.typed.length) : "";
    const key = document.createElement("kbd");
    key.className = "sp-ghost-key";
    key.textContent = "Tab ⇥";
    ghost.appendChild(key);
    wrap.appendChild(ghost);

    const live = document.createElement("span");
    live.className = "sr-only";
    live.setAttribute("role", "status");
    live.textContent = `Sugerencia: ${value.trim()}. Tab para aceptar, Esc para descartar.`;
    wrap.appendChild(live);

    if (s.items.length > 1) {
      const list = document.createElement("span");
      list.className = "sp-sugg-list";
      list.setAttribute("role", "listbox");
      list.setAttribute("aria-label", "Sugerencias");
      s.items.forEach((item, i) => {
        const opt = document.createElement("span");
        opt.className = "sp-sugg-item";
        opt.setAttribute("role", "option");
        opt.setAttribute("aria-selected", String(i === s.index));
        const shown = item.trim();
        const typedLen = Math.max(0, s.typed.trim().length);
        const strong = document.createElement("b");
        strong.textContent = shown.slice(0, typedLen);
        opt.append(strong, shown.slice(typedLen));
        opt.addEventListener("mousedown", (e) => {
          e.preventDefault();
          acceptSuggestion(view, i);
          view.focus();
        });
        list.appendChild(opt);
      });
      const foot = document.createElement("span");
      foot.className = "sp-sugg-foot";
      foot.textContent = "↑↓ elegir · Tab aceptar · Esc cerrar";
      list.appendChild(foot);
      wrap.appendChild(list);
    }
    return wrap;
  };
}

// ---------------------------------------------------------------- avisos

// Cuando el editor cambia algo por su cuenta (pegar como guion, una frase
// escrita como «Lugar y hora»…), lo dice junto a la línea con un botón para
// deshacerlo. También se puede escuchar con la opción `onNotice` para
// enseñarlo en otro sitio (un toast).
export type NoticeKind = "paste" | "heading-to-action" | "character-to-action";

export type Notice = {
  id: number;
  kind: NoticeKind;
  message: string;
  action: string; // texto del botón
  from: number; // trozo del documento al que se refiere
  to: number;
  raw?: string; // lo pegado, tal cual
  text?: string; // el texto de la línea convertida
  sid?: string | null;
};

export const noticeKey = new PluginKey<Notice | null>("sp-notice");
export const NOTICE_MS = 9000;
let noticeSeq = 0;

function withNotice(tr: Transaction, n: Omit<Notice, "id">): Transaction {
  return tr.setMeta(noticeKey, { set: { ...n, id: ++noticeSeq } });
}

export function getNotice(state: EditorState): Notice | null {
  return noticeKey.getState(state) ?? null;
}

export const dismissNoticeCommand: Command = (state, dispatch) => {
  if (!noticeKey.getState(state)) return false;
  dispatch?.(state.tr.setMeta(noticeKey, { clear: true }).setMeta("addToHistory", false));
  return true;
};

// El botón del aviso: vuelve a como estaba lo que el editor cambió.
export const runNoticeActionCommand: Command = (state, dispatch) => {
  const n = noticeKey.getState(state);
  if (!n) return false;
  const { schema } = state;
  const tr = state.tr;
  if (n.kind === "paste") {
    const lines = (n.raw ?? "").replace(/\r\n?/g, "\n").split("\n").map((l) => l.trim()).filter(Boolean);
    const nodes = lines.map((l) => schema.nodes.action.create(null, schema.text(l)));
    if (!nodes.length) return false;
    tr.replaceWith(n.from, n.to, nodes);
    tr.setSelection(TextSelection.near(tr.doc.resolve(n.from + Fragment.from(nodes).size - 1), -1));
  } else if (n.kind === "heading-to-action") {
    const text = (n.text ?? "").toUpperCase();
    tr.replaceWith(n.from, n.to, schema.nodes.sceneHeading.create({ sid: n.sid ?? null }, text ? schema.text(text) : null));
  } else {
    const node = state.doc.nodeAt(n.from);
    if (!node || node.type.name !== "action") return false;
    tr.setNodeMarkup(n.from, schema.nodes.character);
  }
  dispatch?.(tr.setMeta(noticeKey, { clear: true }).scrollIntoView());
  return true;
};

export const runNoticeAction = (view: EditorView) => runNoticeActionCommand(view.state, view.dispatch);
export const dismissNotice = (view: EditorView) => dismissNoticeCommand(view.state, view.dispatch);

function noticeWidget(n: Notice) {
  return (view: EditorView) => {
    const box = document.createElement("div");
    box.className = "sp-notice";
    box.contentEditable = "false";
    box.setAttribute("role", "status");
    const msg = document.createElement("span");
    msg.className = "sp-notice-text";
    msg.textContent = n.message;
    const act = document.createElement("button");
    act.type = "button";
    act.className = "sp-notice-action";
    act.textContent = n.action;
    act.addEventListener("mousedown", (e) => e.preventDefault());
    act.addEventListener("click", () => {
      runNoticeAction(view);
      view.focus();
    });
    const close = document.createElement("button");
    close.type = "button";
    close.className = "sp-notice-close";
    close.setAttribute("aria-label", "Cerrar aviso");
    close.textContent = "×";
    close.addEventListener("mousedown", (e) => e.preventDefault());
    close.addEventListener("click", () => {
      dismissNotice(view);
      view.focus();
    });
    box.append(msg, act, close);
    return box;
  };
}

// -------------------------------------------------------------- saltos de página

// Las marcas de página (como en el PDF) las calcula el editor a partir de la
// maquetación real y las pasa aquí: bloque en el que empieza cada página.
export const pageBreaksKey = new PluginKey<DecorationSet>("sp-pages");

export function setPageBreaks(editor: Editor, starts: { block: number; page: number }[]) {
  editor.view.dispatch(editor.state.tr.setMeta(pageBreaksKey, starts).setMeta("addToHistory", false));
}

// -------------------------------------------------------------- actos

// Dónde empieza cada acto (sid del encabezado → nombre): una raya con el
// nombre del acto encima de esa escena. Solo en pantalla, no en el PDF.
type ActBreaks = { acts: Record<string, string>; sig: string; count: number; set: DecorationSet };
export const actBreaksKey = new PluginKey<ActBreaks>("sp-acts");

export function setActBreaks(editor: Editor, acts: Record<string, string>) {
  editor.view.dispatch(editor.state.tr.setMeta(actBreaksKey, acts).setMeta("addToHistory", false));
}

// ---------------------------------------------------------------- comandos

function currentType(state: EditorState): BlockType | null {
  const name = state.selection.$from.parent.type.name;
  return isBlockType(name) ? name : null;
}

// Cambia el tipo de la línea del cursor (o de todas las de la selección).
// Una «Cómo lo dice» nueva nace con sus paréntesis y el cursor dentro.
function setLineTypeTr(tr: Transaction, type: BlockType): Transaction {
  const schema = tr.doc.type.schema;
  const target = schema.nodes[type];
  const { $from, $to } = tr.selection;
  if ($from.parent !== $to.parent) {
    tr.doc.nodesBetween($from.pos, $to.pos, (node, pos) => {
      if (node.isTextblock && node.type !== target) tr.setNodeMarkup(pos, target, type === "sceneHeading" ? { sid: null } : null);
      return false;
    });
    return tr;
  }
  const node = $from.parent;
  const pos = $from.before();
  if (node.type === target) return tr;
  if (type === "parenthetical" && !node.textContent) {
    tr.setNodeMarkup(pos, target).insertText("()", pos + 1);
    return tr.setSelection(TextSelection.create(tr.doc, pos + 2));
  }
  if (node.type.name === "parenthetical" && /^\(\)$/.test(node.textContent)) tr.delete(pos + 1, pos + 3);
  return tr.setNodeMarkup(pos, target, type === "sceneHeading" ? { sid: null } : null);
}

export const setLineTypeCommand =
  (type: BlockType): Command =>
  (state, dispatch) => {
    if (!currentType(state)) return false;
    dispatch?.(setLineTypeTr(state.tr, type).scrollIntoView());
    return true;
  };

// Para la barra de herramientas o la barra del móvil.
export const setLineType = (view: EditorView, type: BlockType) => setLineTypeCommand(type)(view.state, view.dispatch);

// ¿La escena que abre este encabezado (vacío) ya tiene algo escrito?
function sceneHasBody(doc: PMNode, index: number): boolean {
  for (let i = index + 1; i < doc.childCount; i++) {
    const n = doc.child(i);
    if (n.type.name === "sceneHeading") return false;
    if (hasText(n)) return true;
  }
  return false;
}

export const enterCommand: Command = (state, dispatch) => {
  const type = currentType(state);
  if (!type) return false;
  const { schema } = state;
  const tr = state.tr;
  if (!tr.selection.empty) tr.deleteSelection();

  // La sugerencia solo se acepta con Enter en listas cerradas (DÍA/NOCHE,
  // transiciones) o si se ha elegido con las flechas.
  const s = suggestionKey.getState(state);
  if (state.selection.empty && s && !s.dismissed && (s.closed || s.navigated)) {
    const value = s.items[s.index];
    tr.insertText(value, s.from, s.pos);
    tr.setSelection(TextSelection.create(tr.doc, s.from + value.length));
  }

  const $f = tr.selection.$from;
  const node = $f.parent;
  const text = node.textContent;
  const pos = $f.before();
  const index = $f.index(0);
  const atEnd = $f.parentOffset === text.length;

  // Línea vacía: cambia de tipo en vez de crear otra.
  if (text === "") {
    // Un «Lugar y hora» vacío al principio del guion, o el de una escena que
    // ya tiene algo escrito, se queda (se puede rellenar luego): la línea
    // nueva va debajo.
    if (type === "sceneHeading" && (index === 0 || sceneHasBody(tr.doc, index))) {
      tr.insert(pos + node.nodeSize, schema.nodes.action.create());
      tr.setSelection(TextSelection.create(tr.doc, pos + node.nodeSize + 1));
      dispatch?.(tr.scrollIntoView());
      return true;
    }
    const emptyNext = EMPTY_ENTER[type];
    if (emptyNext) {
      dispatch?.(setLineTypeTr(tr, emptyNext).scrollIntoView());
      return true;
    }
  }
  if (type === "parenthetical" && text === "()") {
    dispatch?.(setLineTypeTr(tr, "dialogue").scrollIntoView());
    return true;
  }

  // Enter al principio de una línea con texto: hueco del mismo tipo encima
  // (sin copiar el id de escena: la escena sigue con su texto).
  if ($f.parentOffset === 0 && text) {
    tr.insert(pos, node.type.create(type === "sceneHeading" ? { sid: null } : null));
    dispatch?.(tr.scrollIntoView());
    return true;
  }

  let next: BlockType = ENTER_NEXT[type];

  if (atEnd) {
    // Una frase escrita como «Lugar y hora»: se queda como «Lo que se ve» y
    // arriba un «Lugar y hora» vacío (la escena conserva su id).
    if (type === "sceneHeading" && headingLooksLikeSentence(text)) {
      const sid = (node.attrs.sid as string | null) ?? null;
      tr.setNodeMarkup(pos, schema.nodes.action);
      const heading = schema.nodes.sceneHeading.create({ sid });
      tr.insert(pos, heading);
      const actionEnd = pos + heading.nodeSize + node.nodeSize;
      tr.insert(actionEnd, schema.nodes.action.create());
      tr.setSelection(TextSelection.create(tr.doc, actionEnd + 1));
      withNotice(tr, {
        kind: "heading-to-action",
        message: "Lo he dejado como «Lo que se ve». Arriba va «Lugar y hora»: dónde y cuándo (INT. COCINA - NOCHE). Puedes rellenarlo luego.",
        action: "Deshacer",
        from: pos,
        to: actionEnd,
        text,
        sid,
      });
      dispatch?.(tr.scrollIntoView());
      return true;
    }
    // Una descripción escrita en la línea de «Quién habla».
    if (type === "character" && characterLooksLikeSentence(text)) {
      tr.setNodeMarkup(pos, schema.nodes.action);
      tr.insert(pos + node.nodeSize, schema.nodes.action.create());
      tr.setSelection(TextSelection.create(tr.doc, pos + node.nodeSize + 1));
      withNotice(tr, {
        kind: "character-to-action",
        message: "Parecía una descripción: la he pasado a «Lo que se ve».",
        action: "Era un nombre",
        from: pos,
        to: pos + node.nodeSize,
        text,
      });
      dispatch?.(tr.scrollIntoView());
      return true;
    }
    // «CORTE A:» escrito como «Lo que se ve» es un cambio de escena.
    if (type === "action" && looksLikeTransition(text)) {
      tr.setNodeMarkup(pos, schema.nodes.transition);
      next = ENTER_NEXT.transition;
    }
  }

  // En una acotación con el cursor justo antes del «)», Enter salta fuera.
  let at = tr.selection.from;
  if (type === "parenthetical" && text.endsWith(")") && $f.parentOffset === text.length - 1) at += 1;

  // Al final: la línea siguiente es del tipo que toca. En medio: se parte
  // la línea y las dos mitades conservan su tipo.
  const atEndNow = at === pos + node.nodeSize - 1;
  if (atEndNow) {
    const fresh = schema.nodes[next].create();
    tr.insert(pos + node.nodeSize, fresh);
    tr.setSelection(TextSelection.create(tr.doc, pos + node.nodeSize + 1));
  } else {
    tr.split(at, 1, [{ type: node.type, attrs: type === "sceneHeading" ? { sid: null } : undefined }]);
  }
  dispatch?.(tr.scrollIntoView());
  return true;
};

// Esc y luego Tab sale del guion (Tab se usa para cambiar de tipo de línea:
// sin esto sería una trampa de teclado).
export const tabEscapeKey = new PluginKey<boolean>("sp-tab-escape");

export const tabCommand: Command = (state, dispatch) => {
  if (tabEscapeKey.getState(state)) return false; // que el navegador mueva el foco
  if (acceptSuggestionCommand()(state, dispatch)) return true;
  const type = currentType(state);
  if (type) setLineTypeCommand(TAB_NEXT[type])(state, dispatch);
  return true;
};

export const shiftTabCommand: Command = (state, dispatch) => {
  if (tabEscapeKey.getState(state)) return false;
  const type = currentType(state);
  if (type) setLineTypeCommand(SHIFT_TAB_NEXT[type])(state, dispatch);
  return true;
};

export const escapeCommand: Command = (state, dispatch) => {
  if (dismissSuggestionCommand(state, dispatch)) return true;
  if (dismissNoticeCommand(state, dispatch)) return true;
  dispatch?.(state.tr.setMeta(tabEscapeKey, true).setMeta("addToHistory", false));
  return true;
};

export const arrowRightCommand: Command = (state, dispatch) => {
  const { $from, empty } = state.selection;
  if (!empty || $from.parentOffset !== $from.parent.textContent.length) return false;
  return acceptSuggestionCommand()(state, dispatch);
};

// ---------------------------------------------------------------- pegar

// Pega texto de fuera reconociéndolo como guion (encabezados, personajes,
// diálogos, acotaciones, transiciones). Una sola línea va a la línea actual
// sin cambiarle el tipo. Lo copiado del propio editor no pasa por aquí.
export function pasteTextTr(state: EditorState, raw: string): Transaction | null {
  const text = raw.replace(/\r\n?/g, "\n");
  const trimmed = text.replace(/^\s*\n|\n\s*$/g, "");
  if (!trimmed) return null;
  const { schema } = state;
  const tr = state.tr;
  if (!/\n/.test(trimmed)) {
    tr.insertText(trimmed.trim() === trimmed ? trimmed : trimmed.replace(/^\s+|\s+$/g, ""));
    return tr.scrollIntoView();
  }
  const blocks = parsePastedText(trimmed);
  if (!blocks.length) return null;
  const nodes = blocks.map((b) => blockNode(schema, b));

  if (!tr.selection.empty) tr.deleteSelection();
  const $f = tr.selection.$from;
  const parent = $f.parent;
  const before = $f.before();
  let from: number;
  if (!parent.textContent) {
    // Línea vacía: lo pegado la sustituye.
    tr.replaceWith(before, before + parent.nodeSize, nodes);
    from = before;
  } else if ($f.parentOffset === parent.content.size) {
    from = before + parent.nodeSize;
    tr.insert(from, nodes);
  } else if ($f.parentOffset === 0) {
    from = before;
    tr.insert(from, nodes);
  } else {
    tr.split($f.pos, 1, [{ type: parent.type, attrs: parent.type.name === "sceneHeading" ? { sid: null } : undefined }]);
    from = $f.pos + 1;
    tr.insert(from, nodes);
  }
  const size = Fragment.from(nodes).size;
  tr.setSelection(TextSelection.create(tr.doc, from + size - 1));

  const scenes = blocks.filter((b) => b.type === "sceneHeading").length;
  const characters = new Set(blocks.filter((b) => b.type === "character").map((b) => characterName(b.text))).size;
  const special = blocks.some((b) => b.type !== "action");
  if (special) {
    const parts = [
      scenes ? `${scenes} ${scenes === 1 ? "escena" : "escenas"}` : "",
      characters ? `${characters} ${characters === 1 ? "personaje" : "personajes"}` : "",
    ].filter(Boolean);
    withNotice(tr, {
      kind: "paste",
      message: `Pegado como guion${parts.length ? `: ${parts.join(", ")}` : ""}. ¿No era eso?`,
      action: "Pegar como texto normal",
      from,
      to: from + size,
      raw: trimmed,
    });
  }
  return tr.scrollIntoView();
}

function blockNode(schema: Schema, b: ScreenplayBlock): PMNode {
  const type = schema.nodes[b.type] ?? schema.nodes.action;
  const content = b.text ? schema.text(b.text) : null;
  return type.create(b.type === "sceneHeading" ? { sid: null } : null, content);
}

// ---------------------------------------------------------------- plugins

export type ScreenplayBehaviourOptions = {
  // Avisos (pegar como guion, frase pasada a «Lo que se ve»…) para enseñarlos
  // fuera del papel, por ejemplo en un toast. Se llaman también si los avisos
  // se pintan en línea.
  onNotice?: (notice: Notice | null) => void;
  // Pintar los avisos junto a la línea (por defecto, sí).
  inlineNotices?: boolean;
  // Pintar el desplegable de sugerencias (si se pinta fuera, false; el texto
  // fantasma se pinta siempre).
  inlineSuggestions?: boolean;
};

export function screenplayPlugins(options: ScreenplayBehaviourOptions = {}): Plugin[] {
  const inlineNotices = options.inlineNotices ?? true;
  const inlineSuggestions = options.inlineSuggestions ?? true;

  return [
    // Primero el índice: los demás lo leen en su apply.
    new Plugin<SceneIndex>({
      key: sceneIndexKey,
      state: {
        init: (_, state) => buildSceneIndex(state.doc),
        apply: (tr, prev) => (tr.docChanged ? buildSceneIndex(tr.doc) : prev),
      },
    }),

    new Plugin<SuggestionState | null>({
      key: suggestionKey,
      state: {
        init: (_, state) => computeSuggestion(state),
        apply(tr, prev, _old, state) {
          const meta = tr.getMeta(suggestionKey) as { dismiss?: boolean; select?: number } | undefined;
          if (meta?.dismiss && prev) return { ...prev, dismissed: true };
          if (meta?.select !== undefined && prev) return { ...prev, index: meta.select, navigated: true };
          if (!tr.docChanged && !tr.selectionSet) return prev;
          const next = computeSuggestion(state);
          // Los cambios de otra persona no reabren lo que se ha cerrado con Esc.
          if (next && prev?.dismissed && isRemote(tr)) return { ...next, dismissed: true };
          return next;
        },
      },
      props: {
        decorations(state) {
          const s = suggestionKey.getState(state);
          if (!s || s.dismissed) return null;
          const widget = inlineSuggestions || s.items.length < 2 ? s : { ...s, items: [s.items[s.index]], index: 0 };
          return DecorationSet.create(state.doc, [
            Decoration.widget(s.pos, suggestionWidget(widget), {
              side: 1,
              key: `sugg-${widget.index}-${widget.items.join("|")}-${s.typed}`,
              ignoreSelection: true,
              stopEvent: () => true,
            }),
          ]);
        },
      },
    }),

    new Plugin<Notice | null>({
      key: noticeKey,
      state: {
        init: () => null,
        apply(tr, prev) {
          const meta = tr.getMeta(noticeKey) as { set?: Notice; clear?: boolean } | undefined;
          if (meta?.set) return meta.set;
          if (meta?.clear) return null;
          if (!prev || !tr.docChanged) return prev;
          const from = tr.mapping.mapResult(prev.from, 1);
          const to = tr.mapping.mapResult(prev.to, -1);
          if (from.deleted && to.deleted) return null;
          if (to.pos <= from.pos) return null;
          return { ...prev, from: from.pos, to: to.pos };
        },
      },
      props: {
        decorations(state) {
          const n = noticeKey.getState(state);
          if (!n || !inlineNotices || n.to > state.doc.content.size) return null;
          return DecorationSet.create(state.doc, [
            Decoration.widget(n.to, noticeWidget(n), { side: -1, key: `notice-${n.id}`, ignoreSelection: true, stopEvent: () => true }),
          ]);
        },
      },
      view() {
        let timer: ReturnType<typeof setTimeout> | null = null;
        let shown: number | null = null;
        return {
          update(view) {
            const n = noticeKey.getState(view.state) ?? null;
            if ((n?.id ?? null) === shown) return;
            shown = n?.id ?? null;
            if (timer) clearTimeout(timer);
            timer = null;
            options.onNotice?.(n);
            if (n) timer = setTimeout(() => dismissNotice(view), NOTICE_MS);
          },
          destroy() {
            if (timer) clearTimeout(timer);
          },
        };
      },
    }),

    new Plugin<boolean>({
      key: tabEscapeKey,
      state: {
        init: () => false,
        apply: (tr, prev) => (tr.getMeta(tabEscapeKey) ? true : tr.docChanged || tr.selectionSet ? false : prev),
      },
      props: {
        // Tras Esc, cualquier tecla que no sea Tab vuelve a lo normal.
        handleKeyDown(view, event) {
          if (tabEscapeKey.getState(view.state) && event.key !== "Tab" && event.key !== "Shift" && event.key !== "Escape") {
            view.dispatch(view.state.tr.setMeta(tabEscapeKey, false).setMeta("addToHistory", false));
          }
          return false;
        },
      },
    }),

    new Plugin<ActBreaks>({
      key: actBreaksKey,
      state: {
        init: () => ({ acts: {}, sig: "", count: 0, set: DecorationSet.empty }),
        apply(tr, prev, _old, state) {
          const next = tr.getMeta(actBreaksKey) as Record<string, string> | undefined;
          if (!next && !tr.docChanged) return prev;
          const acts = next ?? prev.acts;
          const { headings, sig } = sceneIndex(state);
          if (!next && sig === prev.sig) {
            const set = mapKeeping(prev.set, tr, prev.count);
            if (set) return { ...prev, set };
          }
          const decos: Decoration[] = [];
          for (const h of headings) {
            const label = h.sid ? acts[h.sid] : undefined;
            if (!label) continue;
            decos.push(
              Decoration.widget(
                h.offset,
                () => {
                  const el = document.createElement("div");
                  el.className = "sp-actbreak";
                  el.contentEditable = "false";
                  el.setAttribute("aria-hidden", "true");
                  el.dataset.label = label;
                  return el;
                },
                { side: -1, key: `act-${label}-${h.sid}`, ignoreSelection: true },
              ),
            );
          }
          return { acts, sig, count: decos.length, set: DecorationSet.create(tr.doc, decos) };
        },
      },
      props: {
        decorations(state) {
          return actBreaksKey.getState(state)?.set;
        },
      },
    }),

    new Plugin<DecorationSet>({
      key: pageBreaksKey,
      state: {
        init: () => DecorationSet.empty,
        apply(tr, set) {
          const starts = tr.getMeta(pageBreaksKey) as { block: number; page: number }[] | undefined;
          if (!starts) return set.map(tr.mapping, tr.doc);
          const byIndex = new Map(starts.map((s) => [s.block, s.page]));
          const decos: Decoration[] = [];
          tr.doc.forEach((_node, offset, i) => {
            const page = byIndex.get(i);
            if (page && page > 1) {
              decos.push(
                Decoration.widget(
                  offset,
                  () => {
                    const el = document.createElement("div");
                    el.className = "sp-pagebreak";
                    el.contentEditable = "false";
                    el.setAttribute("aria-hidden", "true");
                    el.dataset.page = `${page}.`;
                    return el;
                  },
                  { side: -1, key: `page-${page}-${i}`, ignoreSelection: true },
                ),
              );
            }
          });
          return DecorationSet.create(tr.doc, decos);
        },
      },
      props: {
        decorations(state) {
          return pageBreaksKey.getState(state);
        },
      },
    }),

    new Plugin({
      key: new PluginKey("sp-scene-ids"),
      appendTransaction(transactions, _old, state) {
        if (!transactions.some((t) => t.docChanged)) return null;
        if (transactions.some(isRemote)) return null;
        const tr = ensureSceneIdsTr(state);
        return tr ? tr.setMeta("addToHistory", false) : null;
      },
    }),

    // «Lugar y hora» y «Cambio de escena» en mayúsculas de verdad al salir de
    // la línea (mientras se escribe se dejan como están: el estilo ya las
    // enseña en mayúsculas y así no se pelea con el corrector ni el IME).
    new Plugin({
      key: new PluginKey("sp-uppercase"),
      appendTransaction(transactions, old, state) {
        if (!transactions.some((t) => t.selectionSet) || transactions.some(isRemote)) return null;
        const $old = old.selection.$from;
        if ($old.depth < 1) return null;
        const oldNode = $old.node(1);
        if (oldNode.type.name !== "sceneHeading" && oldNode.type.name !== "transition") return null;
        const mapping = new Mapping();
        transactions.forEach((t) => mapping.appendMapping(t.mapping));
        const result = mapping.mapResult($old.before(1), 1);
        if (result.deleted) return null;
        const pos = result.pos;
        const node = state.doc.nodeAt(pos);
        if (!node || (node.type.name !== "sceneHeading" && node.type.name !== "transition")) return null;
        const { from, to } = state.selection;
        if (from >= pos && to <= pos + node.nodeSize) return null; // sigue en la línea
        const text = node.textContent;
        const upper = text.toUpperCase();
        if (upper === text) return null;
        return state.tr.insertText(upper, pos + 1, pos + 1 + node.content.size);
      },
    }),

    // Un «Lugar y hora» vacío que ya abre escena (o el primero del guion) no
    // se queda en blanco: dice qué va ahí, aunque el cursor esté en otra línea
    // (el placeholder normal solo sale en la línea del cursor).
    new Plugin({
      key: new PluginKey("sp-heading-hint"),
      props: {
        decorations(state) {
          const { $from } = state.selection;
          const here = $from.depth >= 1 ? $from.before(1) : -1;
          const decos: Decoration[] = [];
          for (const h of sceneIndex(state).headings) {
            if (h.text || h.offset === here || (h.number === null && h.index !== 0)) continue;
            decos.push(Decoration.node(h.offset, h.offset + 2, { class: "sp-heading-hint", "data-hint": HEADING_HINT }));
          }
          return decos.length ? DecorationSet.create(state.doc, decos) : null;
        },
      },
    }),

    // Número de escena a ambos lados del encabezado, como en el PDF. Solo se
    // rehacen cuando cambia la estructura de escenas; al escribir dentro de
    // una escena se desplazan (con 110 páginas, rehacerlos en cada tecla era
    // lo que más pesaba).
    new Plugin<SceneNumbers>({
      key: sceneNumbersKey,
      state: {
        init: (_, state) => sceneNumberDecos(state.doc, sceneIndex(state)),
        apply(tr, prev, _old, state) {
          if (!tr.docChanged) return prev;
          const index = sceneIndex(state);
          if (index.sig === prev.sig) {
            const set = mapKeeping(prev.set, tr, prev.count);
            if (set) return { ...prev, set };
          }
          return sceneNumberDecos(tr.doc, index);
        },
      },
      props: {
        decorations(state) {
          return sceneNumbersKey.getState(state)?.set;
        },
      },
    }),

    // Conversiones automáticas mientras se escribe (en la propia tecla,
    // como una sola transacción: así viaja a las demás personas tal cual).
    new Plugin({
      key: new PluginKey("sp-autoformat"),
      props: {
        handleTextInput(view, from, to, text) {
          const { state } = view;
          const $from = state.doc.resolve(from);
          const node = $from.parent;
          const type = node.type.name;
          const pos = $from.before();
          const atEnd = from === to && $from.parentOffset === node.textContent.length;

          // "int. " o "ext. " al empezar una acción → encabezado.
          if (text === " " && type === "action" && atEnd) {
            const before = node.textContent.slice(0, $from.parentOffset);
            if (/^(INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT)\.?$/i.test(before)) {
              view.dispatch(state.tr.insertText(" ", from, to).setNodeMarkup(pos, state.schema.nodes.sceneHeading, { sid: null }));
              return true;
            }
          }
          // «CORTE A:» al teclear los dos puntos → cambio de escena.
          if (text === ":" && type === "action" && atEnd && looksLikeTransition(`${node.textContent}:`)) {
            view.dispatch(state.tr.insertText(":", from, to).setNodeMarkup(pos, state.schema.nodes.transition));
            return true;
          }
          // "(" en un diálogo vacío → acotación, con su ")" y el cursor dentro.
          if (text === "(" && type === "dialogue" && !node.textContent) {
            const tr = state.tr.setNodeMarkup(pos, state.schema.nodes.parenthetical).insertText("()", from, to);
            tr.setSelection(TextSelection.create(tr.doc, from + 1));
            view.dispatch(tr);
            return true;
          }
          // En una acotación, ")" justo delante de ")" solo avanza el cursor.
          if (text === ")" && type === "parenthetical" && from === to && node.textContent[$from.parentOffset] === ")") {
            view.dispatch(state.tr.setSelection(TextSelection.create(state.doc, from + 1)));
            return true;
          }
          return false;
        },

        handlePaste(view, event) {
          const data = event.clipboardData;
          if (!data) return false;
          // Copiado del propio editor: ya trae los tipos de línea.
          if (/data-sp=/.test(data.getData("text/html"))) return false;
          const text = data.getData("text/plain");
          if (!text) return false;
          const tr = pasteTextTr(view.state, text);
          if (!tr) return false;
          view.dispatch(tr);
          return true;
        },
      },
    }),
  ];
}

type SceneNumbers = { sig: string; count: number; set: DecorationSet };
const sceneNumbersKey = new PluginKey<SceneNumbers>("sp-scene-numbers");

function sceneNumberDecos(doc: PMNode, index: SceneIndex): SceneNumbers {
  const decos: Decoration[] = [];
  for (const h of index.headings) {
    if (h.number === null) continue;
    const num = String(h.number);
    for (const side of ["left", "right"] as const) {
      decos.push(
        Decoration.widget(
          h.offset + 1,
          () => {
            const el = document.createElement("span");
            el.className = `sp-scene-num sp-scene-num-${side}`;
            el.contentEditable = "false";
            el.textContent = num;
            return el;
          },
          { side: -1, key: `scene-${num}-${side}`, ignoreSelection: true },
        ),
      );
    }
  }
  return { sig: index.sig, count: decos.length, set: DecorationSet.create(doc, decos) };
}

// ---------------------------------------------------------------- extensión

const run = (cmd: Command) => ({ editor }: { editor: Editor }) => cmd(editor.state, editor.view.dispatch, editor.view);

export const ScreenplayBehaviour = Extension.create<ScreenplayBehaviourOptions>({
  name: "screenplayBehaviour",
  priority: 1000,

  addOptions() {
    return { onNotice: undefined, inlineNotices: true, inlineSuggestions: true };
  },

  addKeyboardShortcuts() {
    const shortcuts: Record<string, (props: { editor: Editor }) => boolean> = {
      Enter: run(enterCommand),
      Tab: run(tabCommand),
      "Shift-Tab": run(shiftTabCommand),
      Escape: run(escapeCommand),
      ArrowRight: run(arrowRightCommand),
      ArrowDown: run(moveSuggestionCommand(1)),
      ArrowUp: run(moveSuggestionCommand(-1)),
    };
    for (const type of BLOCK_TYPES) shortcuts[blockShortcutKeys(type)] = run(setLineTypeCommand(type));
    return shortcuts;
  },

  addProseMirrorPlugins() {
    return screenplayPlugins(this.options);
  },
});

export { BLOCK_LABELS };
