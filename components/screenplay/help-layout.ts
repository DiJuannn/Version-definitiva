"use client";

import { useEffect, useState } from "react";
import type { Editor } from "@tiptap/core";

// Cuánto sitio libre queda a cada lado del papel (en px). Las ayudas van en
// esos márgenes cuando caben; si no (móvil, un panel abierto), se pliegan a
// una línea fina bajo la barra.

export type PaperSpace = { left: number; right: number; ready: boolean };

export const MARGIN_CARD_MIN = 236; // una tarjeta de 220 px y aire

export function editorDom(editor: Editor | null): HTMLElement | null {
  if (!editor || editor.isDestroyed) return null;
  try {
    return editor.view.dom as HTMLElement;
  } catch {
    return null; // la vista aún no está montada
  }
}

export function usePaperSpace(editor: Editor | null): PaperSpace {
  const [space, setSpace] = useState<PaperSpace>({ left: 0, right: 0, ready: false });
  useEffect(() => {
    const dom = editorDom(editor);
    const paper = dom?.closest<HTMLElement>(".sp-paper");
    const desk = paper?.closest<HTMLElement>(".sp-desk");
    if (!paper || !desk) return;
    const measure = () => {
      const d = desk.getBoundingClientRect();
      const p = paper.getBoundingClientRect();
      // El papel oculto (paso Idea) mide 0: no se cambia nada.
      if (!p.width) return;
      const next = { left: Math.max(0, Math.round(p.left - d.left)), right: Math.max(0, Math.round(d.right - p.right)), ready: true };
      setSpace((prev) => (prev.left === next.left && prev.right === next.right && prev.ready ? prev : next));
    };
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(desk);
    ro.observe(paper);
    window.addEventListener("resize", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [editor]);
  return space;
}

// Altura a la que acaba lo fijo de arriba (cabecera + barra de herramientas)
// para pegar debajo una línea fina. `anchor` es un elemento que va justo
// después de la barra.
export function stickyTopBelow(prev: Element | null): number {
  if (!(prev instanceof HTMLElement)) return 0;
  const top = parseFloat(getComputedStyle(prev).top);
  return (Number.isFinite(top) ? top : 0) + prev.offsetHeight;
}
