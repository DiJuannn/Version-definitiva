// Esquema y comportamiento del editor de guion (TipTap / ProseMirror).
//
// Cada línea del guion es un bloque con tipo (encabezado, acción, personaje…).
// Enter y Tab cambian de tipo como en Final Draft; el texto se guarda tal cual
// se escribe y las mayúsculas de encabezados y personajes son solo de estilo
// (al exportar se pasan a mayúsculas de verdad).

import { Extension, Node, mergeAttributes, type Editor } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { ySyncPluginKey } from "@tiptap/y-tiptap";
import {
  BLOCK_LABELS,
  BLOCK_SHORTCUTS,
  BLOCK_TYPES,
  EMPTY_ENTER,
  ENTER_NEXT,
  SCENE_PREFIX,
  SCENE_PREFIXES,
  SHIFT_TAB_NEXT,
  TAB_NEXT,
  TIME_OF_DAY,
  TRANSITION_PATTERN,
  TRANSITIONS,
  characterName,
  isBlockType,
  newSceneId,
  type BlockType,
} from "@/lib/screenplay/blocks";

export const PLACEHOLDERS: Record<BlockType, string> = {
  sceneHeading: "INT. LUGAR - DÍA",
  action: "Lo que vemos y oímos…",
  character: "PERSONAJE",
  parenthetical: "(en voz baja)",
  dialogue: "Lo que dice…",
  transition: "CORTE A:",
  shot: "PLANO DETALLE",
  note: "Nota privada — no se imprime",
};

export const screenplayNodes = BLOCK_TYPES.map((name) =>
  Node.create({
    name,
    group: "block",
    content: "text*",
    marks: "",
    defining: true,
    parseHTML() {
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
  let tr: ReturnType<EditorState["tr"]["setNodeAttribute"]> | null = null;
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
  return tr as EditorState["tr"] | null;
}

// ---------------------------------------------------------------- sugerencias

// Texto fantasma (gris) que completa nombres de personaje, encabezados y
// transiciones con lo que ya existe en el guion. Tab, Enter o → lo aceptan.
type Suggestion = { suffix: string; pos: number } | null;
export const suggestionKey = new PluginKey<Suggestion>("sp-suggestion");

function collect(state: EditorState, type: BlockType, skipPos: number): Map<string, number> {
  const counts = new Map<string, number>();
  state.doc.forEach((node, offset) => {
    if (node.type.name !== type || offset === skipPos) return;
    const value = type === "character" ? characterName(node.textContent) : node.textContent.trim().toUpperCase();
    if (value) counts.set(value, (counts.get(value) ?? 0) + 1);
  });
  return counts;
}

function bestMatch(typed: string, options: Iterable<string>, counts?: Map<string, number>): string | null {
  const upper = typed.toUpperCase();
  let best: string | null = null;
  for (const opt of options) {
    if (opt.length <= upper.length || !opt.startsWith(upper)) continue;
    if (!best || (counts?.get(opt) ?? 0) > (counts?.get(best) ?? 0)) best = opt;
  }
  return best ? best.slice(upper.length) : null;
}

function computeSuggestion(state: EditorState): Suggestion {
  const { selection } = state;
  if (!selection.empty) return null;
  const { $from } = selection;
  const node = $from.parent;
  const type = node.type.name;
  const text = node.textContent;
  if ($from.parentOffset !== text.length || !text.trim()) return null;
  const blockPos = $from.before();

  let suffix: string | null = null;
  if (type === "character") {
    const counts = collect(state, "character", blockPos);
    suffix = bestMatch(text, counts.keys(), counts);
  } else if (type === "sceneHeading") {
    const upper = text.toUpperCase();
    if (!SCENE_PREFIX.test(`${upper} `) || !/\s/.test(upper)) {
      suffix = bestMatch(text, SCENE_PREFIXES.map((p) => `${p} `));
    }
    if (!suffix) {
      const dash = upper.lastIndexOf("- ");
      if (dash !== -1 && dash >= upper.length - 12) {
        const partial = upper.slice(dash + 2);
        suffix = partial ? bestMatch(partial, TIME_OF_DAY) : null;
      }
    }
    if (!suffix) {
      // Encabezados ya usados (la misma localización vuelve muchas veces).
      const counts = collect(state, "sceneHeading", blockPos);
      suffix = bestMatch(text, counts.keys(), counts);
    }
  } else if (type === "transition") {
    suffix = bestMatch(text, TRANSITIONS);
  }
  return suffix ? { suffix, pos: $from.pos } : null;
}

function acceptSuggestion(editor: Editor): boolean {
  const s = suggestionKey.getState(editor.state);
  if (!s) return false;
  editor.commands.insertContentAt(s.pos, s.suffix);
  return true;
}

// -------------------------------------------------------------- saltos de página

// Las marcas de página (como en el PDF) las calcula el editor a partir de la
// maquetación real y las pasa aquí: bloque en el que empieza cada página.
export const pageBreaksKey = new PluginKey<DecorationSet>("sp-pages");

export function setPageBreaks(editor: Editor, starts: { block: number; page: number }[]) {
  editor.view.dispatch(editor.state.tr.setMeta(pageBreaksKey, starts).setMeta("addToHistory", false));
}

// ---------------------------------------------------------------- extensión

function setType(editor: Editor, type: BlockType): boolean {
  const { $from } = editor.state.selection;
  const node = $from.parent;
  if (type === "parenthetical" && !node.textContent) {
    // Acotación nueva: con sus paréntesis y el cursor dentro.
    const start = $from.start();
    return editor
      .chain()
      .setNode("parenthetical")
      .insertContentAt(start, "()")
      .setTextSelection(start + 1)
      .run();
  }
  if (node.type.name === "parenthetical" && type !== "parenthetical" && /^\(\)$/.test(node.textContent)) {
    const start = $from.start();
    return editor.chain().deleteRange({ from: start, to: start + 2 }).setNode(type).run();
  }
  return editor.chain().setNode(type).run();
}

function currentType(editor: Editor): BlockType | null {
  const name = editor.state.selection.$from.parent.type.name;
  return isBlockType(name) ? name : null;
}

function handleEnter(editor: Editor): boolean {
  const type = currentType(editor);
  if (!type) return false;
  const { $from, empty } = editor.state.selection;
  const text = $from.parent.textContent;

  // Si hay sugerencia, se acepta y sigue como un Enter normal.
  if (empty && $from.parentOffset === text.length) acceptSuggestion(editor);

  const node = editor.state.selection.$from.parent;
  const fullText = node.textContent;

  // Enter en un bloque vacío: cambia su tipo en vez de crear otro.
  const emptyNext = EMPTY_ENTER[type];
  if (fullText === "" && emptyNext) return setType(editor, emptyNext);
  if (type === "parenthetical" && fullText === "()") return setType(editor, "dialogue");

  // Enter al principio de un bloque con texto: hueco del mismo tipo encima.
  if (editor.state.selection.$from.parentOffset === 0 && fullText) {
    return editor.chain().splitBlock().run();
  }

  // Una acción escrita como "CORTE A:" es una transición.
  let next = ENTER_NEXT[type];
  if (type === "action" && TRANSITION_PATTERN.test(fullText.trim())) {
    editor.commands.setNode("transition");
    next = ENTER_NEXT.transition;
  }

  // Si la acotación está entre paréntesis y el cursor justo antes del ")",
  // Enter salta fuera del paréntesis.
  if (type === "parenthetical" && fullText.endsWith(")")) {
    const { $from: f } = editor.state.selection;
    if (f.parentOffset === fullText.length - 1) editor.commands.setTextSelection(f.pos + 1);
  }

  return editor.chain().splitBlock().setNode(next).run();
}

export const ScreenplayBehaviour = Extension.create({
  name: "screenplayBehaviour",
  priority: 1000,

  addKeyboardShortcuts() {
    const shortcuts: Record<string, (props: { editor: Editor }) => boolean> = {
      Enter: ({ editor }) => handleEnter(editor),
      Tab: ({ editor }) => {
        if (acceptSuggestion(editor)) return true;
        const type = currentType(editor);
        if (type) setType(editor, TAB_NEXT[type]);
        return true;
      },
      "Shift-Tab": ({ editor }) => {
        const type = currentType(editor);
        if (type) setType(editor, SHIFT_TAB_NEXT[type]);
        return true;
      },
      ArrowRight: ({ editor }) => {
        const { $from, empty } = editor.state.selection;
        if (!empty || $from.parentOffset !== $from.parent.textContent.length) return false;
        return acceptSuggestion(editor);
      },
    };
    for (const type of BLOCK_TYPES) {
      shortcuts[`Mod-${BLOCK_SHORTCUTS[type]}`] = ({ editor }) => setType(editor, type);
    }
    return shortcuts;
  },

  addProseMirrorPlugins() {
    return [
      new Plugin<Suggestion>({
        key: suggestionKey,
        state: {
          init: (_, state) => computeSuggestion(state),
          apply: (tr, prev, _old, state) => (tr.docChanged || tr.selectionSet ? computeSuggestion(state) : prev),
        },
        props: {
          decorations(state) {
            const s = suggestionKey.getState(state);
            if (!s) return null;
            return DecorationSet.create(state.doc, [
              Decoration.widget(
                s.pos,
                () => {
                  const span = document.createElement("span");
                  span.className = "sp-ghost";
                  span.textContent = s.suffix;
                  return span;
                },
                { side: 1, key: `ghost-${s.suffix}` },
              ),
            ]);
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
            let i = 0;
            tr.doc.forEach((_node, offset) => {
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
              i += 1;
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
          if (transactions.some((t) => t.getMeta(ySyncPluginKey)?.isChangeOrigin)) return null;
          const tr = ensureSceneIdsTr(state);
          return tr ? tr.setMeta("addToHistory", false) : null;
        },
      }),

      // Número de escena a ambos lados del encabezado, como en el PDF.
      new Plugin({
        key: new PluginKey("sp-scene-numbers"),
        props: {
          decorations(state) {
            const decos: Decoration[] = [];
            let n = 0;
            state.doc.forEach((node, offset) => {
              if (node.type.name !== "sceneHeading" || !node.textContent.trim()) return;
              n += 1;
              const num = String(n);
              for (const side of ["left", "right"] as const) {
                decos.push(
                  Decoration.widget(
                    offset + 1,
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
            });
            return DecorationSet.create(state.doc, decos);
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

            // "int. " o "ext. " al empezar una acción → encabezado.
            if (text === " " && type === "action" && from === to) {
              const before = node.textContent.slice(0, $from.parentOffset);
              if (/^(INT\.?\/EXT|EXT\.?\/INT|I\/E|INT|EXT)\.?$/i.test(before) && $from.parentOffset === node.textContent.length) {
                view.dispatch(state.tr.insertText(" ", from, to).setNodeMarkup(pos, state.schema.nodes.sceneHeading));
                return true;
              }
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
        },
      }),
    ];
  },
});

export { BLOCK_LABELS };
