// Crear en la página las escenas del esqueleto: un encabezado vacío (con su
// id) y una línea de «lo que se ve», también vacía, por tarjeta. Así no se
// escribe nada por quien escribe, y una escena vacía no sale en el PDF ni
// pasa a producción hasta que tenga lugar y hora (ver los tests).
//
// No se usa `addScene` del espacio de trabajo: ese sustituye el guion entero
// si no tiene texto, y unas escenas del esqueleto aún vacías también son
// «sin texto» (se borrarían al añadir una tarjeta nueva).

import type { Editor } from "@tiptap/core";
import { newSceneId } from "@/lib/screenplay/blocks";

export type NewScene = { key: string; beforeSid: string | null };

// Ids de las escenas que hay ahora mismo en la página, en orden (también las vacías).
export function liveSceneSids(editor: Editor): string[] {
  const out: string[] = [];
  editor.state.doc.forEach((n) => {
    if (n.type.name === "sceneHeading" && typeof n.attrs.sid === "string" && n.attrs.sid) out.push(n.attrs.sid);
  });
  return out;
}

// Inserta todas las escenas en un solo paso (un solo «deshacer»). Devuelve el
// sid de cada una por su clave.
export function insertSkeletonScenes(editor: Editor, items: NewScene[], keepSids: ReadonlySet<string>): Map<string, string> {
  const made = new Map<string, string>();
  if (!items.length) return made;
  const { schema, doc } = editor.state;
  // Un guion recién creado (sin texto ni escenas del esqueleto) se sustituye entero.
  let hasText = false;
  let hasKept = false;
  doc.forEach((n) => {
    if (n.textContent.trim()) hasText = true;
    if (n.type.name === "sceneHeading" && keepSids.has(n.attrs.sid as string)) hasKept = true;
  });
  const pristine = !hasText && !hasKept;

  const sceneNodes = (key: string) => {
    const sid = newSceneId();
    made.set(key, sid);
    return [schema.nodes.sceneHeading.create({ sid }), schema.nodes.action.create()];
  };

  const tr = editor.state.tr;
  if (pristine) {
    tr.replaceWith(0, doc.content.size, items.flatMap((it) => sceneNodes(it.key)));
  } else {
    // Delante de su escena siguiente (o al final). Se inserta de atrás hacia
    // delante agrupando por destino, para que las posiciones no se muevan.
    const positions = new Map<string, number>();
    doc.forEach((n, offset) => {
      if (n.type.name === "sceneHeading" && n.attrs.sid) positions.set(n.attrs.sid as string, offset);
    });
    const groups = new Map<number, NewScene[]>();
    for (const it of items) {
      const at = it.beforeSid && positions.has(it.beforeSid) ? positions.get(it.beforeSid)! : doc.content.size;
      groups.set(at, [...(groups.get(at) ?? []), it]);
    }
    for (const at of [...groups.keys()].sort((a, b) => b - a)) {
      tr.insert(at, groups.get(at)!.flatMap((it) => sceneNodes(it.key)));
    }
  }
  editor.view.dispatch(tr);
  return made;
}
