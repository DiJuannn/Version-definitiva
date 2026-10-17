"use client";

// Mover y duplicar escenas sin arrastrar (menú ⋯ del panel «Tu historia» y
// Alt+↑/↓ en el guion). Trabaja sobre el documento del editor: una escena va
// de su encabezado al siguiente. El cursor se queda donde estaba, dentro de la
// escena movida, y el cambio entra en el Deshacer normal del editor.

import type { Editor } from "@tiptap/core";
import { TextSelection } from "@tiptap/pm/state";
import { newSceneId } from "@/lib/screenplay/blocks";

type Range = { sid: string; from: number; to: number };

function sceneRanges(editor: Editor): Range[] {
  const { doc } = editor.state;
  const ranges: Range[] = [];
  doc.forEach((n, offset) => {
    if (n.type.name === "sceneHeading" && n.attrs.sid) {
      if (ranges.length) ranges[ranges.length - 1].to = offset;
      ranges.push({ sid: n.attrs.sid as string, from: offset, to: doc.content.size });
    }
  });
  return ranges;
}

// Pone la escena `sid` delante de `beforeSid` (o al final si es null).
export function moveSceneBefore(editor: Editor, sid: string, beforeSid: string | null): boolean {
  if (sid === beforeSid) return false;
  const ranges = sceneRanges(editor);
  const r = ranges.find((x) => x.sid === sid);
  if (!r) return false;
  const before = beforeSid ? ranges.find((x) => x.sid === beforeSid) : null;
  if (beforeSid && !before) return false;
  const target = before ? before.from : editor.state.doc.content.size;
  if (target >= r.from && target <= r.to) return false; // ya está ahí
  const { selection, doc } = editor.state;
  const inside = selection.from >= r.from && selection.from < r.to ? selection.from - r.from : null;
  const slice = doc.slice(r.from, r.to);
  const tr = editor.state.tr.delete(r.from, r.to);
  const at = tr.mapping.map(target);
  tr.insert(at, slice.content);
  if (inside !== null) {
    const pos = Math.min(at + inside, tr.doc.content.size - 1);
    tr.setSelection(TextSelection.near(tr.doc.resolve(pos)));
    tr.scrollIntoView();
  }
  editor.view.dispatch(tr);
  return true;
}

// Mueve la escena a la posición `toIndex` (0..n-1) entre las escenas `order`.
export function moveSceneTo(editor: Editor, order: string[], sid: string, toIndex: number): boolean {
  const from = order.indexOf(sid);
  if (from === -1) return false;
  const to = Math.max(0, Math.min(order.length - 1, toIndex));
  if (to === from) return false;
  const rest = order.filter((x) => x !== sid);
  return moveSceneBefore(editor, sid, rest[to] ?? null);
}

// Copia la escena entera justo después de ella, con un id nuevo. Devuelve el
// sid de la copia.
export function duplicateScene(editor: Editor, sid: string): string | null {
  const r = sceneRanges(editor).find((x) => x.sid === sid);
  if (!r) return null;
  const copy = newSceneId();
  const slice = editor.state.doc.slice(r.from, r.to);
  const tr = editor.state.tr.insert(r.to, slice.content);
  const heading = tr.doc.nodeAt(r.to);
  if (heading?.type.name === "sceneHeading") tr.setNodeMarkup(r.to, undefined, { ...heading.attrs, sid: copy });
  editor.view.dispatch(tr);
  return copy;
}

// ------------------------------------------------------------------ avisos

// Un aviso breve encima de la barra «Tu historia» («Escena 3 movida a la
// posición 1 · Deshacer»). Se lanza desde cualquier sitio del editor.
export type StoryNotice = { text: string; action?: { label: string; run: () => void } };

export const NOTICE_EVENT = "sp:story-notice";

export function showStoryNotice(n: StoryNotice) {
  window.dispatchEvent(new CustomEvent<StoryNotice>(NOTICE_EVENT, { detail: n }));
}

export function undoAction(editor: Editor | null): StoryNotice["action"] {
  return editor ? { label: "Deshacer", run: () => editor.commands.undo() } : undefined;
}
