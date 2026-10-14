// Paso entre el estado Yjs del guion (lo que editan varias personas a la vez)
// y la lista plana de bloques { type, text } que usan el PDF, Fountain y las
// estadísticas. El editor (TipTap + Collaboration) guarda el documento en el
// fragmento "default": un Y.XmlElement por bloque, con su texto dentro.

import * as Y from "yjs";
import { isBlockType, newSceneId, type ScreenplayBlock } from "@/lib/screenplay/blocks";

export const FRAGMENT = "default";

export function blocksFromYDoc(doc: Y.Doc): ScreenplayBlock[] {
  const blocks: ScreenplayBlock[] = [];
  for (const node of doc.getXmlFragment(FRAGMENT).toArray()) {
    if (!(node instanceof Y.XmlElement) || !isBlockType(node.nodeName)) continue;
    const text = node
      .toArray()
      .map((child) => (child instanceof Y.XmlText ? child.toString().replace(/<[^>]*>/g, "") : ""))
      .join("");
    const id = node.nodeName === "sceneHeading" ? node.getAttribute("sid") : undefined;
    blocks.push(id ? { type: node.nodeName, text, id } : { type: node.nodeName, text });
  }
  return blocks;
}

// Rellena un documento vacío con bloques (crear guion, importar Fountain).
export function fillYDoc(doc: Y.Doc, blocks: ScreenplayBlock[]) {
  const fragment = doc.getXmlFragment(FRAGMENT);
  const list = blocks.length ? blocks : [{ type: "sceneHeading" as const, text: "" }];
  doc.transact(() => {
    fragment.insert(
      fragment.length,
      list.map((b) => {
        const el = new Y.XmlElement(b.type);
        if (b.type === "sceneHeading") el.setAttribute("sid", b.id ?? newSceneId());
        const text = new Y.XmlText();
        if (b.text) text.insert(0, b.text);
        el.insert(0, [text]);
        return el;
      }),
    );
  });
}

export function ydocFromBlocks(blocks: ScreenplayBlock[]): Uint8Array {
  const doc = new Y.Doc();
  fillYDoc(doc, blocks);
  return Y.encodeStateAsUpdate(doc);
}

export const toBase64 = (bytes: Uint8Array) => Buffer.from(bytes).toString("base64");
export const fromBase64 = (s: string) => new Uint8Array(Buffer.from(s, "base64"));
