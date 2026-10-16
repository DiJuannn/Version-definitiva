"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/core";
import type { Node as PMNode } from "@tiptap/pm/model";
import { Plugin, PluginKey, TextSelection, type EditorState } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import { BLOCK_LABELS, characterName, isBlockType, type BlockType } from "@/lib/screenplay/blocks";
import { findMatches, nearestMatch, planRename, type FindLine, type FindMatch, type FindOptions } from "@/lib/screenplay-find";
import { useWorkspace } from "@/components/screenplay/workspace";
import { editorDom } from "@/components/screenplay/help-layout";

// Buscar y reemplazar dentro del guion (Ctrl/⌘+F, Ctrl/⌘+H) y renombrar un
// personaje en todo el guion. Las coincidencias se marcan en la página; todo
// se deshace de una vez con Ctrl/⌘+Z.

export const FIND_EVENT = "sp:find";
export type FindRequest = { mode: "find" | "replace" | "rename"; name?: string };
// Para abrirlo desde fuera (atajos, ficha de un personaje…).
export const openFind = (detail: FindRequest) => window.dispatchEvent(new CustomEvent<FindRequest>(FIND_EVENT, { detail }));

type FindState = { opts: FindOptions | null; index: number; matches: { from: number; to: number }[]; set: DecorationSet };
const findKey = new PluginKey<FindState>("sp-find");

function docLines(doc: PMNode): { lines: FindLine[]; offsets: number[] } {
  const lines: FindLine[] = [];
  const offsets: number[] = [];
  doc.forEach((n, offset) => {
    if (!isBlockType(n.type.name)) return;
    lines.push({ type: n.type.name, text: n.textContent });
    offsets.push(offset + 1);
  });
  return { lines, offsets };
}

function compute(doc: PMNode, opts: FindOptions | null, index: number): FindState {
  if (!opts?.query) return { opts, index: 0, matches: [], set: DecorationSet.empty };
  const { lines, offsets } = docLines(doc);
  const matches = findMatches(lines, opts).map((m: FindMatch) => ({ from: offsets[m.line] + m.from, to: offsets[m.line] + m.to }));
  const i = matches.length ? Math.min(Math.max(0, index), matches.length - 1) : 0;
  const decos = matches.map((m, k) =>
    Decoration.inline(m.from, m.to, {
      class: k === i ? "sp-find-hit sp-find-current" : "sp-find-hit",
      style: k === i ? "background:rgba(90,70,168,.32);border-radius:2px;box-shadow:0 0 0 1px rgba(90,70,168,.55)" : "background:rgba(255,196,0,.38);border-radius:2px",
    }),
  );
  return { opts, index: i, matches, set: DecorationSet.create(doc, decos) };
}

const findPlugin = () =>
  new Plugin<FindState>({
    key: findKey,
    state: {
      init: () => ({ opts: null, index: 0, matches: [], set: DecorationSet.empty }),
      apply(tr, prev) {
        const meta = tr.getMeta(findKey) as Partial<Pick<FindState, "opts" | "index">> | undefined;
        if (meta) return compute(tr.doc, meta.opts !== undefined ? meta.opts : prev.opts, meta.index ?? prev.index);
        if (tr.docChanged) return compute(tr.doc, prev.opts, prev.index);
        return prev;
      },
    },
    props: { decorations: (state) => findKey.getState(state)?.set ?? DecorationSet.empty },
  });

const getFind = (state: EditorState) => findKey.getState(state) ?? null;

// Filtros «Buscar en»: los tipos de línea con su nombre llano.
const SCOPES: { id: string; label: string; types: BlockType[] | null }[] = [
  { id: "all", label: "Todo el guion", types: null },
  { id: "dialogue", label: BLOCK_LABELS.dialogue, types: ["dialogue", "parenthetical"] },
  { id: "action", label: BLOCK_LABELS.action, types: ["action"] },
  { id: "sceneHeading", label: BLOCK_LABELS.sceneHeading, types: ["sceneHeading"] },
  { id: "character", label: BLOCK_LABELS.character, types: ["character"] },
];

function useEditorTick(editor: Editor | null) {
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!editor) return;
    const on = () => setTick((t) => t + 1);
    editor.on("transaction", on);
    return () => {
      editor.off("transaction", on);
    };
  }, [editor]);
}

export function FindReplace() {
  const { editor, characters, maps, scenes } = useWorkspace();
  const [open, setOpen] = useState<FindRequest["mode"] | null>(null);
  const [query, setQuery] = useState("");
  const [replace, setReplace] = useState("");
  const [scope, setScope] = useState("all");
  const [caseSensitive, setCase] = useState(false);
  const [wholeWord, setWhole] = useState(false);
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEditorTick(open ? editor : null);

  // El plugin de marcas vive solo mientras el buscador está abierto.
  useEffect(() => {
    if (!editor || !open) return;
    const plugin = findPlugin();
    editor.registerPlugin(plugin);
    return () => {
      if (!editor.isDestroyed) editor.unregisterPlugin(findKey);
    };
  }, [editor, open]);

  const opts = useMemo<FindOptions | null>(
    () => (open && open !== "rename" && query ? { query, caseSensitive, wholeWord, types: SCOPES.find((s) => s.id === scope)?.types ?? null } : null),
    [caseSensitive, open, query, scope, wholeWord],
  );

  // Cada cambio de búsqueda: marcas nuevas, desde la coincidencia más cercana al cursor.
  useEffect(() => {
    if (!editor || !open || !getFind(editor.state)) return;
    const { $from } = editor.state.selection;
    const { lines, offsets } = docLines(editor.state.doc);
    const line = Math.max(0, offsets.filter((o) => o <= $from.pos).length - 1);
    const near = opts ? nearestMatch(findMatches(lines, opts), line, $from.parentOffset) : 0;
    editor.view.dispatch(editor.state.tr.setMeta(findKey, { opts, index: near }).setMeta("addToHistory", false));
  }, [editor, open, opts]);

  const state = editor && open ? getFind(editor.state) : null;
  const total = state?.matches.length ?? 0;
  const index = state?.index ?? 0;

  const go = useCallback(
    (delta: number) => {
      if (!editor) return;
      const s = getFind(editor.state);
      if (!s?.matches.length) return;
      const i = (s.index + delta + s.matches.length) % s.matches.length;
      const m = s.matches[i];
      editor.view.dispatch(editor.state.tr.setMeta(findKey, { index: i }).setMeta("addToHistory", false));
      // Que se vea, sin quitarle el foco a la caja de búsqueda.
      try {
        const dom = editor.view.domAtPos(m.from).node;
        (dom instanceof HTMLElement ? dom : dom.parentElement)?.scrollIntoView({ block: "center", behavior: "smooth" });
      } catch {}
    },
    [editor],
  );

  const replaceOne = () => {
    if (!editor) return;
    const s = getFind(editor.state);
    const m = s?.matches[s.index];
    if (!m) return;
    const tr = editor.state.tr.insertText(replace, m.from, m.to);
    tr.setSelection(TextSelection.create(tr.doc, m.from + replace.length));
    editor.view.dispatch(tr);
    setDone(null);
  };

  const replaceAll = () => {
    if (!editor) return;
    const s = getFind(editor.state);
    if (!s?.matches.length) return;
    const tr = editor.state.tr;
    for (const m of [...s.matches].reverse()) tr.insertText(replace, m.from, m.to);
    editor.view.dispatch(tr);
    setDone(`${s.matches.length === 1 ? "1 cambio" : `${s.matches.length} cambios`}. Ctrl/⌘+Z lo deshace todo de una vez.`);
  };

  // ------------------------------------------------------------ renombrar
  const plan = useMemo(() => {
    if (!editor || open !== "rename" || !renameFrom || !renameTo.trim()) return null;
    return planRename(docLines(editor.state.doc).lines, renameFrom, renameTo);
    // El documento cambia con cada tecla: se recalcula al re-pintar (useEditorTick).
  }, [editor, open, renameFrom, renameTo, state, scenes]); // eslint-disable-line react-hooks/exhaustive-deps

  const rename = () => {
    if (!editor || !plan) return;
    const { offsets } = docLines(editor.state.doc);
    const tr = editor.state.tr;
    for (const e of [...plan.edits].reverse()) tr.insertText(e.text, offsets[e.line] + e.from, offsets[e.line] + e.to);
    editor.view.dispatch(tr);
    // La ficha del personaje pasa al nombre nuevo (si ya había una, se juntan).
    const prev = maps.characters.get(plan.from);
    if (prev) {
      const target = maps.characters.get(plan.to);
      const move = () => {
        maps.characters.set(plan.to, { ...prev, ...(target ?? {}) });
        maps.characters.delete(plan.from);
      };
      if (maps.characters.doc) maps.characters.doc.transact(move);
      else move();
    }
    setDone(`${plan.from} ahora es ${plan.to}: ${plan.speaking} ${plan.speaking === 1 ? "vez que habla" : "veces que habla"} y ${plan.mentions} ${plan.mentions === 1 ? "mención" : "menciones"}.`);
    setRenameFrom(plan.to);
    setRenameTo("");
  };

  // ------------------------------------------------------------ abrir y cerrar
  const close = useCallback(() => {
    setOpen(null);
    setDone(null);
    editor?.commands.focus(undefined, { scrollIntoView: false });
  }, [editor]);

  useEffect(() => {
    const visible = () => {
      const dom = editorDom(editor);
      return Boolean(dom && dom.offsetParent !== null);
    };
    const onKey = (e: KeyboardEvent) => {
      const mod = e.ctrlKey || e.metaKey;
      if (!mod || e.altKey || !visible()) return;
      const k = e.key.toLowerCase();
      if (k === "f" && !e.shiftKey) {
        e.preventDefault();
        const sel = editor?.state.selection;
        const picked = sel && !sel.empty ? editor!.state.doc.textBetween(sel.from, sel.to, " ").slice(0, 80) : "";
        if (picked && !picked.includes("\n")) setQuery(picked);
        setOpen((m) => (m === "replace" ? m : "find"));
        requestAnimationFrame(() => input.current?.select());
      } else if (k === "h" && !e.shiftKey) {
        e.preventDefault();
        setOpen("replace");
        requestAnimationFrame(() => input.current?.select());
      }
    };
    const onOpen = (e: Event) => {
      const d = (e as CustomEvent<FindRequest>).detail;
      setOpen(d.mode);
      setDone(null);
      if (d.mode === "rename" && d.name) setRenameFrom(characterName(d.name));
      requestAnimationFrame(() => input.current?.focus());
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener(FIND_EVENT, onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener(FIND_EVENT, onOpen);
    };
  }, [editor]);

  // Esc lo cierra también si el foco se ha quedado fuera (un botón que se
  // desactiva al usarlo deja el foco en la página).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape" || e.defaultPrevented) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest(".sp-doc")) return; // en el guion, Esc es para sus sugerencias
      close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close, open]);

  if (!open) return null;

  const field =
    "h-8 w-full rounded-md border border-[var(--line)] bg-white px-2.5 text-[13px] outline-none transition-colors focus:border-[var(--accent)]";
  const tab = (id: FindRequest["mode"], label: string) => (
    <button
      type="button"
      role="tab"
      aria-selected={open === id || (id === "find" && open === "replace")}
      onClick={() => {
        setOpen(id === "find" ? (open === "replace" ? "replace" : "find") : id);
        setDone(null);
      }}
      className={`rounded-md px-2 py-0.5 text-[12.5px] ${
        open === id || (id === "find" && open === "replace") ? "bg-[#1c1b19] text-white" : "text-muted hover:text-fg"
      }`}
    >
      {label}
    </button>
  );

  return (
    <div
      role="dialog"
      aria-label={open === "rename" ? "Renombrar personaje" : "Buscar en el guion"}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          close();
        }
      }}
      className="sp-light fixed top-[68px] right-3 left-3 z-40 rounded-xl bg-white p-3 text-fg shadow-[0_0_0_1px_var(--line),0_18px_40px_-16px_rgba(0,0,0,0.35)] sm:left-auto sm:w-[380px]"
    >
      <div className="mb-2 flex items-center gap-1" role="tablist">
        {tab("find", "Buscar y reemplazar")}
        {tab("rename", "Renombrar personaje")}
        <button type="button" onClick={close} aria-label="Cerrar (Esc)" title="Cerrar (Esc)" className="ml-auto px-1.5 text-[17px] leading-none text-muted hover:text-fg">
          ×
        </button>
      </div>

      {open !== "rename" ? (
        <>
          <div className="flex items-center gap-1.5">
            <label className="sr-only" htmlFor="sp-find-q">
              Buscar
            </label>
            <input
              id="sp-find-q"
              ref={input}
              value={query}
              autoFocus
              onChange={(e) => {
                setQuery(e.target.value);
                setDone(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  go(e.shiftKey ? -1 : 1);
                }
              }}
              placeholder="Buscar en el guion"
              className={field}
            />
            <span className="w-16 shrink-0 text-center text-[12px] text-muted tabular-nums" aria-live="polite">
              {query ? (total ? `${index + 1} de ${total}` : "Nada") : ""}
            </span>
            <button type="button" onClick={() => go(-1)} disabled={!total} aria-label="Anterior (Mayús+Enter)" className="grid h-8 w-7 place-items-center rounded-md text-muted hover:bg-black/[0.04] hover:text-fg disabled:opacity-40">
              ↑
            </button>
            <button type="button" onClick={() => go(1)} disabled={!total} aria-label="Siguiente (Enter)" className="grid h-8 w-7 place-items-center rounded-md text-muted hover:bg-black/[0.04] hover:text-fg disabled:opacity-40">
              ↓
            </button>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5 text-[12.5px] text-muted">
            <label className="flex items-center gap-1.5">
              Buscar en
              <select value={scope} onChange={(e) => setScope(e.target.value)} className="rounded-md border border-[var(--line)] bg-white px-1.5 py-0.5 text-[12.5px] text-fg outline-none">
                {SCOPES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={caseSensitive} onChange={(e) => setCase(e.target.checked)} className="accent-[var(--accent)]" />
              Mayúsculas exactas
            </label>
            <label className="flex items-center gap-1">
              <input type="checkbox" checked={wholeWord} onChange={(e) => setWhole(e.target.checked)} className="accent-[var(--accent)]" />
              Palabra entera
            </label>
          </div>
          {open === "replace" ? (
            <div className="mt-2.5 border-t border-[var(--line)] pt-2.5">
              <label className="sr-only" htmlFor="sp-find-r">
                Reemplazar por
              </label>
              <input
                id="sp-find-r"
                value={replace}
                onChange={(e) => setReplace(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    replaceOne();
                  }
                }}
                placeholder="Reemplazar por"
                className={field}
              />
              <div className="mt-2 flex gap-1.5">
                <button type="button" disabled={!total} onClick={replaceOne} className="sp-btn !px-2.5 !py-1 text-[12.5px] disabled:opacity-50">
                  Reemplazar
                </button>
                <button type="button" disabled={!total} onClick={replaceAll} className="sp-btn !px-2.5 !py-1 text-[12.5px] disabled:opacity-50">
                  Reemplazar {total > 1 ? `las ${total}` : "todo"}
                </button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setOpen("replace")} className="mt-2 text-[12.5px] text-[var(--accent)] hover:underline">
              Reemplazar…
            </button>
          )}
        </>
      ) : (
        <div className="space-y-2.5">
          <p className="text-[12.5px] leading-snug text-muted">
            Cambia el nombre donde habla, donde se le nombra en lo que se ve y lo que dicen, y en su ficha. Tus notas no se tocan.
          </p>
          <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-1.5">
            <label className="sr-only" htmlFor="sp-rename-from">
              Personaje
            </label>
            <select id="sp-rename-from" value={renameFrom} onChange={(e) => setRenameFrom(e.target.value)} className={field}>
              <option value="">Personaje…</option>
              {characters.map((c) => (
                <option key={c.name} value={c.name}>
                  {c.name}
                </option>
              ))}
            </select>
            <span aria-hidden className="text-muted">
              →
            </span>
            <label className="sr-only" htmlFor="sp-rename-to">
              Nombre nuevo
            </label>
            <input
              id="sp-rename-to"
              ref={input}
              value={renameTo}
              onChange={(e) => {
                setRenameTo(e.target.value);
                setDone(null);
              }}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  rename();
                }
              }}
              placeholder="Nombre nuevo"
              className={`${field} uppercase placeholder:normal-case`}
            />
          </div>
          {plan && (
            <p className="text-[12.5px] text-muted" aria-live="polite">
              Se cambiará en {plan.speaking} {plan.speaking === 1 ? "línea de «Quién habla»" : "líneas de «Quién habla»"} y {plan.mentions}{" "}
              {plan.mentions === 1 ? "mención" : "menciones"}.
            </p>
          )}
          <button type="button" disabled={!plan || !plan.edits.length} onClick={rename} className="sp-btn !px-2.5 !py-1 text-[12.5px] disabled:opacity-50">
            Renombrar en todo el guion
          </button>
        </div>
      )}
      {done && (
        <p className="mt-2.5 text-[12.5px] text-[var(--success)]" role="status">
          ✓ {done}
        </p>
      )}
    </div>
  );
}
