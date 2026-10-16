// Encima de cada escena del esqueleto, en la página, una cabecera que no se
// escribe ni se imprime: qué paso de la historia es, la pregunta que dice qué
// tiene que pasar y la línea que se apuntó en la tarjeta. Es una decoración
// de ProseMirror (no está en el documento: ni en el PDF, ni en Fountain, ni
// para el resto del equipo si tiene la guía apagada).

import type { Editor } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { Node as PMNode } from "@tiptap/pm/model";

export type SceneGuide = { eyebrow: string; question: string; note: string; done: boolean; empty: boolean };

type GuideState = { guides: Map<string, SceneGuide>; set: DecorationSet };

export const sceneGuidesKey = new PluginKey<GuideState>("spGuidedScenes");

function widget(g: SceneGuide, view: EditorView, getPos: () => number | undefined): HTMLElement {
  const box = document.createElement("div");
  box.contentEditable = "false";
  box.setAttribute("data-sp-guide", "");
  box.setAttribute("aria-label", `${g.eyebrow}. ${g.question}`);
  box.style.cssText = [
    "margin: calc(var(--u) / 3) 0 calc(var(--u) / -6)",
    "padding: 8px 12px",
    "border-radius: 8px",
    `border: 1px solid ${g.done ? "#ece9e1" : "#e4dcf7"}`,
    `background: ${g.done ? "transparent" : "#f8f6fe"}`,
    "font-family: var(--font-archivo), system-ui, sans-serif",
    "font-size: 13px",
    "line-height: 1.45",
    "color: #4b4757",
    "user-select: none",
    "cursor: text",
  ].join(";");
  // Al pulsar la cabecera, el cursor va a la línea de lugar y hora de su escena.
  box.addEventListener("mousedown", (e) => {
    e.preventDefault();
    const pos = getPos();
    if (pos === undefined) return;
    const heading = view.state.doc.nodeAt(pos);
    const at = Math.min(pos + 1 + (heading?.content.size ?? 0), view.state.doc.content.size);
    view.dispatch(view.state.tr.setSelection(TextSelection.create(view.state.doc, at)));
    view.focus();
  });
  const eyebrow = document.createElement("p");
  eyebrow.textContent = g.eyebrow;
  eyebrow.style.cssText =
    "margin:0;font-family:var(--font-jetbrains-mono),monospace;font-size:10.5px;letter-spacing:.14em;text-transform:uppercase;color:#5a46a8";
  box.append(eyebrow);
  if (!g.done) {
    const q = document.createElement("p");
    q.style.cssText = "margin:3px 0 0";
    const b = document.createElement("b");
    b.textContent = "Pregunta guía: ";
    b.style.fontWeight = "600";
    q.append(b, g.question);
    box.append(q);
  }
  if (g.empty) {
    const h = document.createElement("p");
    h.style.cssText = "margin:4px 0 0;color:#5a46a8";
    h.textContent = "→ Debajo, dónde y cuándo pasa: INT. o EXT., el lugar y DÍA o NOCHE.";
    box.append(h);
  }
  if (g.note) {
    const n = document.createElement("p");
    n.style.cssText = "margin:2px 0 0;color:#6d695f";
    const b = document.createElement("b");
    b.textContent = "Tu nota: ";
    b.style.fontWeight = "600";
    n.append(b, `«${g.note}»`);
    box.append(n);
  }
  return box;
}

function build(doc: PMNode, guides: Map<string, SceneGuide>): DecorationSet {
  if (!guides.size) return DecorationSet.empty;
  const decos: Decoration[] = [];
  doc.forEach((node, offset) => {
    if (node.type.name !== "sceneHeading") return;
    const g = guides.get(node.attrs.sid as string);
    if (!g) return;
    decos.push(
      Decoration.widget(offset, (view, getPos) => widget(g, view, getPos), {
        side: -1,
        ignoreSelection: true,
        stopEvent: () => true,
        key: `g:${node.attrs.sid}:${g.done ? 1 : 0}:${g.empty ? 1 : 0}:${g.eyebrow}:${g.question}:${g.note}`,
      }),
    );
  });
  return DecorationSet.create(doc, decos);
}

export function sceneGuidesPlugin(): Plugin<GuideState> {
  return new Plugin<GuideState>({
    key: sceneGuidesKey,
    state: {
      init: () => ({ guides: new Map(), set: DecorationSet.empty }),
      apply(tr, prev, _old, state: EditorState) {
        const next = tr.getMeta(sceneGuidesKey) as Map<string, SceneGuide> | undefined;
        if (next) return { guides: next, set: build(state.doc, next) };
        if (tr.docChanged) return { guides: prev.guides, set: build(state.doc, prev.guides) };
        return prev;
      },
    },
    props: {
      decorations: (state) => sceneGuidesKey.getState(state)?.set ?? null,
    },
  });
}

export function setSceneGuides(editor: Editor, guides: Map<string, SceneGuide>) {
  if (editor.isDestroyed) return;
  editor.view.dispatch(editor.state.tr.setMeta(sceneGuidesKey, guides).setMeta("addToHistory", false));
}
