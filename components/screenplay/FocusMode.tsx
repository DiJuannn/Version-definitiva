"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { getNotice, getSuggestions } from "@/lib/screenplay/editor-extensions";
import { useWorkspace } from "@/components/screenplay/workspace";
import { editorDom } from "@/components/screenplay/help-layout";

// Modo foco (Ctrl/⌘ + Mayús + F): solo el papel. Se esconden la cabecera, la
// barra, «Tu historia» y las ayudas; la línea donde escribes queda a media
// pantalla (como en una máquina de escribir) y el resto del texto, atenuado.
// Esc sale (si no hay una sugerencia o un aviso que cerrar antes).

let on = false;
const listeners = new Set<() => void>();
export function setFocusMode(v: boolean) {
  if (on === v) return;
  on = v;
  listeners.forEach((l) => l());
}
export const toggleFocusMode = () => setFocusMode(!on);
export function useFocusMode(): boolean {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => on,
    () => false,
  );
}

const focusKey = new PluginKey<DecorationSet>("sp-focus-line");

// Marca la línea del cursor (las demás se atenúan con CSS).
const focusPlugin = () =>
  new Plugin({
    key: focusKey,
    props: {
      decorations(state) {
        const { $from } = state.selection;
        if ($from.depth < 1) return DecorationSet.empty;
        const start = $from.before(1);
        return DecorationSet.create(state.doc, [Decoration.node(start, start + $from.node(1).nodeSize, { class: "sp-focus-line" })]);
      },
    },
  });

// Lo que se esconde y se atenúa. Va aquí (y no en globals.css) porque solo
// existe mientras el modo foco está encendido.
const FOCUS_CSS = `
.sp-chrome,
[data-gv2-help-anchor],
div:has(+ [data-gv2-help-anchor]),
section[aria-label="Tu historia"],
section[aria-label="¿Y ahora qué?"] { display: none !important; }
.sp-doc > .sp-block { opacity: .38; transition: opacity 180ms ease; }
.sp-doc > .sp-block.sp-focus-line { opacity: 1; }
.sp-desk { padding-top: 32vh; padding-bottom: 50vh; }
@media (prefers-reduced-motion: reduce) { .sp-doc > .sp-block { transition: none; } }
`;

export function FocusMode() {
  const { editor } = useWorkspace();
  const focus = useFocusMode();

  const visible = useCallback(() => {
    const dom = editorDom(editor);
    return Boolean(dom && dom.offsetParent !== null);
  }, [editor]);

  // Atajo y salida con Esc (en captura: antes que el guion, para saber si
  // había una sugerencia o un aviso abiertos; si los hay, Esc es para ellos).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && !e.altKey && (e.code === "KeyF" || e.key.toLowerCase() === "f")) {
        if (!visible()) return;
        e.preventDefault();
        toggleFocusMode();
        return;
      }
      if (e.key === "Escape" && on) {
        if (editor && (getSuggestions(editor.state) || getNotice(editor.state))) return;
        if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
        setFocusMode(false);
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [editor, visible]);

  // La línea marcada y la máquina de escribir.
  useEffect(() => {
    if (!editor || !focus) return;
    editor.registerPlugin(focusPlugin());
    let raf = 0;
    const center = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        try {
          const c = editor.view.coordsAtPos(editor.state.selection.from);
          const target = window.innerHeight * 0.42;
          const delta = c.top - target;
          if (Math.abs(delta) > 24) {
            const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            window.scrollBy({ top: delta, behavior: reduce ? "auto" : "smooth" });
          }
        } catch {}
      });
    };
    center();
    editor.commands.focus(undefined, { scrollIntoView: false });
    editor.on("selectionUpdate", center);
    return () => {
      cancelAnimationFrame(raf);
      editor.off("selectionUpdate", center);
      if (!editor.isDestroyed) editor.unregisterPlugin(focusKey);
    };
  }, [editor, focus]);

  // Al salir del paso Guion (Idea), fuera también el modo foco.
  useEffect(() => {
    if (!focus) return;
    const t = setInterval(() => !visible() && setFocusMode(false), 1000);
    return () => clearInterval(t);
  }, [focus, visible]);

  if (!focus) return null;
  return (
    <>
      <style>{FOCUS_CSS}</style>
      <div className="pointer-events-none fixed inset-x-0 top-3 z-40 flex justify-center">
        <button
          type="button"
          onClick={() => setFocusMode(false)}
          className="pointer-events-auto rounded-full bg-[#1c1b19]/85 px-3.5 py-1.5 text-[12px] text-white/90 opacity-40 shadow-lg backdrop-blur transition-opacity hover:opacity-100 focus-visible:opacity-100"
        >
          Modo foco · <kbd className="font-sans">Esc</kbd> para salir
        </button>
      </div>
    </>
  );
}
