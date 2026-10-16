"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import { isBlockType, type BlockType } from "@/lib/screenplay/blocks";
import { useWorkspace } from "@/components/screenplay/workspace";
import { useLineGuidePref } from "@/components/screenplay/help-prefs";
import { MARGIN_CARD_MIN, editorDom, usePaperSpace } from "@/components/screenplay/help-layout";
import { lineGuideText, lineGuideVisible } from "@/components/screenplay/line-guide-text";

// «Guía de la línea»: al margen derecho del papel, a la altura de la línea
// donde escribes, qué es esa línea (en llano, con el nombre técnico pequeño),
// qué se pone en ella y qué hacen Enter y Tab. Sale sola mientras el guion
// tiene menos de 3 escenas; se apaga con «No volver a mostrar» o en Ajustes.
// Si no cabe al margen (móvil, panel abierto), es una línea fina bajo la
// barra (LineGuideBar).

export type CurrentLine = { type: BlockType | null; empty: boolean; from: number; focused: boolean };

// La línea del cursor y si el guion tiene el foco. Se actualiza con cada
// cambio del editor; el foco se suelta con un respiro para que un clic en la
// guía no la haga desaparecer antes de llegar.
export function useCurrentLine(editor: Editor | null): CurrentLine {
  const [line, setLine] = useState<CurrentLine>({ type: null, empty: true, from: 0, focused: false });
  useEffect(() => {
    if (!editor) return;
    let blurTimer: ReturnType<typeof setTimeout> | null = null;
    const read = (focused?: boolean) => {
      const { $from, from } = editor.state.selection;
      const node = $from.depth >= 1 ? $from.node(1) : $from.parent;
      const name = node.type.name;
      const next: CurrentLine = {
        type: isBlockType(name) ? name : null,
        empty: node.textContent.length === 0,
        from,
        focused: focused ?? editor.isFocused,
      };
      setLine((prev) =>
        prev.type === next.type && prev.empty === next.empty && prev.from === next.from && prev.focused === next.focused ? prev : next,
      );
    };
    const onTr = () => read();
    const onFocus = () => {
      if (blurTimer) clearTimeout(blurTimer);
      read(true);
    };
    const onBlur = () => {
      if (blurTimer) clearTimeout(blurTimer);
      blurTimer = setTimeout(() => read(false), 220);
    };
    read();
    editor.on("transaction", onTr);
    editor.on("focus", onFocus);
    editor.on("blur", onBlur);
    return () => {
      if (blurTimer) clearTimeout(blurTimer);
      editor.off("transaction", onTr);
      editor.off("focus", onFocus);
      editor.off("blur", onBlur);
    };
  }, [editor]);
  return line;
}

function useGuideState() {
  const { editor, scenes } = useWorkspace();
  const [pref, setPref] = useLineGuidePref();
  const line = useCurrentLine(editor);
  const on = lineGuideVisible(pref, scenes.length) && line.type !== null;
  return { editor, line, on, off: () => setPref("off") };
}

function Keys({ keys }: { keys: { key: string; text: string }[] }) {
  return (
    <ul className="mt-2 space-y-1">
      {keys.map((k) => (
        <li key={k.key} className="flex items-baseline gap-1.5">
          <kbd className="sp-kbd shrink-0">{k.key}</kbd>
          <span>{k.text}</span>
        </li>
      ))}
    </ul>
  );
}

// Al margen del papel. Se monta dentro de `.sp-paper` (que es `relative`).
export function LineGuide() {
  const { editor, line, on, off } = useGuideState();
  const space = usePaperSpace(editor);
  const ref = useRef<HTMLDivElement>(null);
  const [top, setTop] = useState<number | null>(null);
  const fits = space.ready && space.right >= MARGIN_CARD_MIN;
  const show = on && fits && line.focused;

  // La altura de la línea: se mide tras pintar (el texto de arriba puede
  // haber crecido).
  useLayoutEffect(() => {
    if (!show || !editor) return;
    const dom = editorDom(editor);
    const paper = ref.current?.offsetParent as HTMLElement | null;
    if (!dom || !paper) return;
    try {
      const c = editor.view.coordsAtPos(Math.min(line.from, editor.state.doc.content.size));
      const t = Math.round(c.top - paper.getBoundingClientRect().top);
      setTop((prev) => (prev === t ? prev : t));
    } catch {
      // posición fuera del documento durante un cambio remoto: se ignora
    }
  }, [editor, line.from, line.type, line.empty, show]);

  if (!line.type || !on || !fits) return null;
  const g = lineGuideText(line.type, line.empty);
  const width = Math.min(260, space.right - 28);
  return (
    <div
      ref={ref}
      aria-live="polite"
      aria-label={`Guía de la línea: ${g.name}`}
      onMouseDown={(e) => e.preventDefault()} // que el guion no pierda el foco
      style={{ top: top ?? 0, left: "calc(100% + 18px)", width }}
      className={`absolute z-10 font-sans text-[12.5px] leading-snug text-muted transition-[top,opacity] duration-150 ease-out motion-reduce:transition-none ${
        show && top !== null ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <span aria-hidden className="absolute top-[9px] -left-[18px] h-px w-3 bg-[var(--accent)]/50" />
      <div className="rounded-lg border-l-2 border-[var(--accent)] bg-white/70 py-1.5 pr-2 pl-3">
        <p className="flex flex-wrap items-baseline gap-x-1.5">
          <span className="text-[13px] font-semibold text-fg">{g.name}</span>
          {g.technical !== g.name.toLowerCase() && <span className="text-[11px] text-[#9b9aa0]">· {g.technical}</span>}
        </p>
        <p className="mt-0.5 text-fg/80">{g.hint}</p>
        {g.tip && <p className="mt-1 text-[12px]">{g.tip}</p>}
        <Keys keys={g.keys} />
        <button
          type="button"
          onClick={off}
          title="Puedes volver a encenderla en Ajustes del guion (⚙)"
          className="mt-2 text-[11.5px] text-[#9b9aa0] underline-offset-2 hover:text-fg hover:underline"
        >
          No volver a mostrar
        </button>
      </div>
    </div>
  );
}

// ¿Se ve la línea fina? (para dejarle sitio debajo de la barra).
export function useLineGuideBarVisible(): boolean {
  const { editor, line, on } = useGuideState();
  const space = usePaperSpace(editor);
  const fits = space.ready && space.right >= MARGIN_CARD_MIN;
  return Boolean(line.type && on && !fits && line.focused);
}

// En pantallas estrechas: una línea fina bajo la barra de herramientas.
export function LineGuideBar({ top }: { top: number }) {
  const { line, off } = useGuideState();
  const visible = useLineGuideBarVisible();
  if (!visible || !line.type) return null;
  const g = lineGuideText(line.type, line.empty);
  const keys = g.keys.map((k) => `${k.key}: ${k.text}`).join(" · ");
  return (
    <div
      style={{ top }}
      onMouseDown={(e) => e.preventDefault()}
      aria-live="polite"
      className="absolute inset-x-0 z-10 -mx-4 flex h-7 items-center gap-2 border-b border-[var(--line)] bg-[#fbfaf6]/95 px-4 text-[12px] text-muted backdrop-blur lg:mx-0 lg:px-2"
    >
      <span className="shrink-0 font-semibold text-fg">{g.name}</span>
      <span className="min-w-0 flex-1 truncate">
        {g.hint}
        <span className="hidden sm:inline"> · {keys}</span>
      </span>
      <button type="button" onClick={off} aria-label="No volver a mostrar la guía de la línea" title="No volver a mostrar" className="shrink-0 px-1 text-[15px] leading-none hover:text-fg">
        ×
      </button>
    </div>
  );
}
