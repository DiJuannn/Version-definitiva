"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
import Document from "@tiptap/extension-document";
import Text from "@tiptap/extension-text";
import { Placeholder } from "@tiptap/extensions";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCaret from "@tiptap/extension-collaboration-caret";
import * as Y from "yjs";
import { createClient } from "@/lib/supabase/client";
import { cleanHexColor, cleanName, hexColorFor } from "@/components/canvas/presence";
import { saveScreenplayUpdate } from "@/lib/actions/screenplays";
import {
  BLOCK_LABELS,
  BLOCK_SHORTCUTS,
  BLOCK_TYPES,
  ENTER_NEXT,
  TAB_NEXT,
  isBlockType,
  type BlockType,
  type ScreenplayBlock,
} from "@/lib/screenplay/blocks";
import { layoutScreenplay, pageStarts } from "@/lib/screenplay/layout";
import {
  PLACEHOLDERS,
  ScreenplayBehaviour,
  ensureSceneIdsTr,
  screenplayNodes,
  setPageBreaks,
} from "@/lib/screenplay/editor-extensions";
import { characterNames, scenesFromBlocks, type Reference } from "@/lib/screenplay/story";
import { storyMaps } from "@/lib/screenplay/story-doc";
import { useYMap } from "@/lib/screenplay/use-ymap";
import { VIEWS, WorkspaceProvider, type View, type Workspace } from "@/components/screenplay/workspace";
import { ContextPanel } from "@/components/screenplay/ContextPanel";
import { BoardView } from "@/components/screenplay/BoardView";
import { TimeView } from "@/components/screenplay/TimeView";
import { CharactersView } from "@/components/screenplay/CharactersView";
import { ReferencesView } from "@/components/screenplay/ReferencesView";
import { StoryView } from "@/components/screenplay/StoryView";
import {
  REMOTE_ORIGIN,
  SupabaseYjsProvider,
  base64ToBytes,
  bytesToBase64,
  type ConnectionStatus,
} from "@/lib/screenplay/realtime-provider";

type Props = {
  screenplayId: string;
  initialState: string;
  userId: string;
  userName: string;
  // Cabecera (título, ajustes, exportar) — la pinta la página, el editor la
  // coloca junto al estado de guardado y las personas conectadas.
  header: React.ReactNode;
};

type SaveState = "saved" | "dirty" | "saving" | "error";
type Peer = { clientId: number; name: string; color: string; userId: string };

const SAVE_DEBOUNCE_MS = 1200;
const SAVE_MAX_WAIT_MS = 6000;

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function docBlocks(doc: import("@tiptap/pm/model").Node): ScreenplayBlock[] {
  const out: ScreenplayBlock[] = [];
  doc.forEach((node) => {
    if (!isBlockType(node.type.name)) return;
    const sid = node.type.name === "sceneHeading" ? (node.attrs.sid as string | null) : null;
    out.push(sid ? { type: node.type.name, text: node.textContent, id: sid } : { type: node.type.name, text: node.textContent });
  });
  return out;
}

export default function ScreenplayEditor({ screenplayId, initialState, userId, userName, header }: Props) {
  // Documento y conexión en directo, una vez por guion abierto (este
  // componente solo se pinta en el navegador: ver ScreenplayEditorLoader).
  const [{ ydoc, provider }] = useState(() => {
    const doc = new Y.Doc();
    if (initialState) Y.applyUpdate(doc, base64ToBytes(initialState), "db");
    return { ydoc: doc, provider: new SupabaseYjsProvider(createClient(), doc, `guion:${screenplayId}`) };
  });
  useEffect(() => {
    provider.connect();
    return () => provider.disconnect();
  }, [provider]);

  const myColor = useMemo(() => hexColorFor(userId), [userId]);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      Document,
      Text,
      ...screenplayNodes,
      ScreenplayBehaviour,
      Placeholder.configure({
        placeholder: ({ node }) => (isBlockType(node.type.name) ? PLACEHOLDERS[node.type.name] : ""),
      }),
      Collaboration.configure({ document: ydoc }),
      CollaborationCaret.configure({ provider, user: { name: userName, color: myColor, userId } }),
    ],
    editorProps: {
      attributes: {
        class: "sp-doc",
        spellcheck: "true",
        lang: "es",
        "aria-label": "Guion",
      },
    },
  });

  // ------------------------------------------------------------ guardado

  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [saveError, setSaveError] = useState<string | null>(null);
  const serverVector = useRef<Uint8Array>(Y.encodeStateVector(ydoc));
  const saving = useRef(false);
  const again = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const firstDirtyAt = useRef<number | null>(null);
  const saveRef = useRef<() => Promise<boolean>>(async () => false);

  const save = useCallback(async (): Promise<boolean> => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    if (saving.current) {
      again.current = true;
      return false;
    }
    const update = Y.encodeStateAsUpdate(ydoc, serverVector.current);
    // Un update vacío de Yjs ocupa 2 bytes: nada que guardar.
    if (update.byteLength <= 2) {
      setSaveState("saved");
      firstDirtyAt.current = null;
      return true;
    }
    saving.current = true;
    setSaveState("saving");
    try {
      const res = await saveScreenplayUpdate(screenplayId, bytesToBase64(update));
      if (!res.ok) {
        setSaveError(res.error);
        setSaveState("error");
        return false;
      }
      serverVector.current = base64ToBytes(res.stateVector);
      setSaveError(null);
      firstDirtyAt.current = null;
      setSaveState("saved");
      return true;
    } catch {
      setSaveError("Sin conexión con el servidor. Se reintentará solo.");
      setSaveState("error");
      return false;
    } finally {
      saving.current = false;
      if (again.current) {
        again.current = false;
        void saveRef.current();
      }
    }
  }, [screenplayId, ydoc]);
  useEffect(() => {
    saveRef.current = save;
  }, [save]);

  useEffect(() => {
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === "db") return;
      // Los cambios de otra persona los guarda su navegador; aun así se
      // guardan también desde aquí con el siguiente cambio propio (no pasa
      // nada por guardarlos dos veces: la fusión de Yjs es idempotente).
      if (origin === REMOTE_ORIGIN) return;
      setSaveState((s) => (s === "saving" ? s : "dirty"));
      const now = Date.now();
      firstDirtyAt.current ??= now;
      if (timer.current) clearTimeout(timer.current);
      const waited = now - firstDirtyAt.current;
      timer.current = setTimeout(() => void save(), waited > SAVE_MAX_WAIT_MS ? 0 : SAVE_DEBOUNCE_MS);
    };
    ydoc.on("update", onUpdate);
    return () => ydoc.off("update", onUpdate);
  }, [save, ydoc]);

  // Reintento si falló, y guardado al salir de la pestaña.
  useEffect(() => {
    if (saveState !== "error") return;
    const t = setTimeout(() => void save(), 5000);
    return () => clearTimeout(t);
  }, [save, saveState]);

  useEffect(() => {
    const onHide = () => {
      if (document.visibilityState === "hidden") void save();
    };
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      if (saveState === "saved") return;
      void save();
      e.preventDefault();
    };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, [save, saveState]);

  // Exportar siempre lo último: se guarda antes de abrir el PDF/Fountain.
  useEffect(() => {
    const onExport = async (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      const w = window.open("about:blank", "_blank");
      await save();
      if (w) w.location.href = href;
      else window.location.href = href;
    };
    window.addEventListener("screenplay:export", onExport);
    return () => window.removeEventListener("screenplay:export", onExport);
  }, [save]);

  // ------------------------------------------------------------ conexión y personas

  const [connection, setConnection] = useState<ConnectionStatus>(provider.status);
  useEffect(() => provider.onStatus(setConnection), [provider]);

  const [peers, setPeers] = useState<Peer[]>([]);
  useEffect(() => {
    const read = () => {
      const list: Peer[] = [];
      provider.awareness.getStates().forEach((state, clientId) => {
        if (clientId === ydoc.clientID) return;
        const u = state.user as { name?: unknown; color?: unknown; userId?: unknown } | undefined;
        if (!u) return;
        list.push({ clientId, name: cleanName(u.name), color: cleanHexColor(u.color), userId: String(u.userId ?? clientId) });
      });
      setPeers([...new Map(list.map((p) => [p.userId, p])).values()]);
    };
    read();
    provider.awareness.on("change", read);
    return () => provider.awareness.off("change", read);
  }, [provider, ydoc]);

  // ------------------------------------------------------------ bloque actual, escenas y páginas

  const current = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { type: null as BlockType | null, sid: null as string | null };
      const { $from } = e.state.selection;
      const name = $from.depth >= 1 ? $from.node(1).type.name : $from.parent.type.name;
      // Escena actual: el último encabezado antes del cursor.
      let sid: string | null = null;
      const top = $from.index(0);
      for (let i = top; i >= 0; i--) {
        const n = e.state.doc.child(i);
        if (n.type.name === "sceneHeading" && n.textContent.trim()) {
          sid = (n.attrs.sid as string | null) ?? null;
          break;
        }
      }
      return { type: isBlockType(name) ? name : null, sid };
    },
  }) ?? { type: null, sid: null };

  const [blocks, setBlocks] = useState<ScreenplayBlock[]>([]);
  const [pageCount, setPageCount] = useState(0);
  useEffect(() => {
    if (!editor) return;
    // Guiones creados antes de que las escenas tuvieran id.
    const fix = ensureSceneIdsTr(editor.state);
    if (fix) editor.view.dispatch(fix.setMeta("addToHistory", false));

    let t: ReturnType<typeof setTimeout> | null = null;
    const recompute = () => {
      const list = docBlocks(editor.state.doc);
      setBlocks(list);
      const pages = layoutScreenplay(list);
      setPageBreaks(editor, pageStarts(pages));
      setPageCount(list.some((b) => b.type !== "note" && b.text.trim()) ? pages.length : 0);
    };
    const onUpdate = () => {
      if (t) clearTimeout(t);
      t = setTimeout(recompute, 350);
    };
    recompute();
    editor.on("update", onUpdate);
    return () => {
      if (t) clearTimeout(t);
      editor.off("update", onUpdate);
    };
  }, [editor]);

  const scenes = useMemo(() => scenesFromBlocks(blocks), [blocks]);
  const characters = useMemo(() => characterNames(blocks), [blocks]);
  const maps = useMemo(() => storyMaps(ydoc), [ydoc]);
  const refs = useYMap<Reference>(maps.refs);
  const sceneRefs = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of Object.values(refs)) if (r.anchor.type === "scene") m.set(r.anchor.sid, (m.get(r.anchor.sid) ?? 0) + 1);
    return m;
  }, [refs]);

  const [view, setViewState] = useState<View>("page");
  const setView = useCallback((v: View) => {
    setViewState(v);
    window.scrollTo({ top: 0 });
  }, []);

  const scenePos = useCallback(
    (sid: string): number | null => {
      if (!editor) return null;
      let pos: number | null = null;
      editor.state.doc.forEach((n, offset) => {
        if (pos === null && n.type.name === "sceneHeading" && n.attrs.sid === sid) pos = offset;
      });
      return pos;
    },
    [editor],
  );

  const goToScene = useCallback(
    (sid: string) => {
      if (!editor) return;
      // La página tiene que estar visible para poder enfocarla y desplazarse.
      requestAnimationFrame(() => {
        const pos = scenePos(sid);
        if (pos === null) return;
        editor.chain().focus().setTextSelection(pos + 1).run();
        const dom = editor.view.nodeDOM(pos);
        if (dom instanceof HTMLElement) dom.scrollIntoView({ block: "center", behavior: "smooth" });
      });
    },
    [editor, scenePos],
  );

  // Mueve la escena entera (del encabezado a la siguiente) delante de la
  // escena que ahora ocupa `toIndex`; más allá del final, al final del guion.
  const moveScene = useCallback(
    (sid: string, toIndex: number) => {
      if (!editor) return;
      const { doc } = editor.state;
      const ranges: { sid: string; from: number; to: number }[] = [];
      doc.forEach((n, offset) => {
        if (n.type.name === "sceneHeading" && n.attrs.sid) {
          if (ranges.length) ranges[ranges.length - 1].to = offset;
          ranges.push({ sid: n.attrs.sid as string, from: offset, to: doc.content.size });
        }
      });
      const from = ranges.findIndex((r) => r.sid === sid);
      if (from === -1) return;
      const target = toIndex >= ranges.length ? doc.content.size : ranges[Math.max(0, toIndex)].from;
      const { from: a, to: b } = ranges[from];
      if (target >= a && target <= b) return; // ya está ahí
      const slice = doc.slice(a, b);
      const tr = editor.state.tr.delete(a, b);
      tr.insert(tr.mapping.map(target), slice.content);
      editor.view.dispatch(tr);
    },
    [editor],
  );

  // La IA lee lo guardado: antes de llamarla se guarda lo pendiente.
  const flushSave = useCallback(async () => {
    for (let i = 0; i < 6; i++) {
      if (await saveRef.current()) return true;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }, []);

  const workspace: Workspace = {
    screenplayId,
    ydoc,
    maps,
    editor,
    blocks,
    scenes,
    characters,
    currentSid: current.sid,
    userName,
    goToScene,
    moveScene,
    flushSave,
    setView,
  };

  const setType = useCallback(
    (type: BlockType) => {
      editor?.chain().focus().setNode(type).run();
    },
    [editor],
  );

  const mod = isMac() ? "⌘" : "Ctrl";
  const status =
    connection === "offline"
      ? { label: "Sin conexión — se guardará al volver", tone: "text-warn" }
      : saveState === "error"
        ? { label: saveError ?? "Error al guardar", tone: "text-danger" }
        : saveState === "saving"
          ? { label: "Guardando…", tone: "text-muted" }
          : saveState === "dirty"
            ? { label: "Cambios sin guardar", tone: "text-muted" }
            : { label: "Guardado", tone: "text-success" };

  return (
    <WorkspaceProvider value={workspace}>
      <div className="sp-root">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">{header}</div>
          <div className="flex items-center gap-4 font-mono text-[11px]">
            <ul className="flex -space-x-2" aria-label="Escribiendo ahora">
              <li
                title={`${userName} (tú)`}
                className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg text-[11px] font-bold text-bg"
                style={{ background: myColor }}
              >
                {userName.slice(0, 1).toUpperCase()}
              </li>
              {peers.map((p) => (
                <li
                  key={p.clientId}
                  title={p.name}
                  className="flex h-7 w-7 items-center justify-center rounded-full border-2 border-bg text-[11px] font-bold text-bg"
                  style={{ background: p.color }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </li>
              ))}
            </ul>
            <span className={`flex items-center gap-1.5 ${status.tone}`} role="status" aria-live="polite">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {status.label}
            </span>
          </div>
        </div>

        <nav aria-label="Vistas del guion" className="mt-8 flex gap-6 overflow-x-auto border-b border-line">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setView(v.id)}
              aria-current={view === v.id ? "page" : undefined}
              className={`relative shrink-0 pb-3 font-mono text-[11px] tracking-[0.2em] uppercase transition-colors ${
                view === v.id ? "text-fg" : "text-muted hover:text-fg"
              }`}
            >
              {v.label}
              {v.id === "references" && Object.keys(refs).length > 0 && (
                <span className="ml-1.5 text-accent">{Object.keys(refs).length}</span>
              )}
              {view === v.id && <span className="absolute inset-x-0 -bottom-px h-0.5 bg-accent" />}
            </button>
          ))}
        </nav>

        <div className="mt-8">
          {view === "board" && <BoardView />}
          {view === "time" && <TimeView />}
          {view === "characters" && <CharactersView />}
          {view === "references" && <ReferencesView />}
          {view === "story" && <StoryView />}

          {/* La página nunca se desmonta: el editor y su conexión siguen vivos
              en las otras vistas (el corcho mueve escenas a través de él). */}
          <div className={view === "page" ? "grid gap-8 xl:grid-cols-[200px_minmax(0,1fr)_280px]" : "hidden"}>
            <aside className="order-2 xl:order-1">
              <div className="xl:sticky xl:top-28">
                <p className="font-mono text-[10px] tracking-[0.2em] text-muted uppercase">Escenas</p>
                {scenes.length === 0 ? (
                  <p className="mt-3 font-sans text-xs text-muted">Escribe un encabezado (INT. / EXT.) para empezar la primera escena.</p>
                ) : (
                  <ol className="mt-3 max-h-[70vh] space-y-px overflow-y-auto pr-1">
                    {scenes.map((s) => (
                      <li key={s.sid}>
                        <button
                          type="button"
                          onClick={() => goToScene(s.sid)}
                          aria-current={s.sid === current.sid}
                          className={`flex w-full gap-2 border-l-2 px-2 py-1.5 text-left font-mono text-[11px] transition-colors hover:text-fg ${
                            s.sid === current.sid ? "border-accent text-fg" : "border-transparent text-muted"
                          }`}
                        >
                          <span className="w-5 shrink-0 text-right text-accent">{s.number}</span>
                          <span className="line-clamp-2 flex-1">{s.heading}</span>
                          {sceneRefs.get(s.sid) ? (
                            <span title={`${sceneRefs.get(s.sid)} referencias`} className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </aside>

            <div className="order-1 min-w-0 xl:order-2">
              <div className="z-10 mb-4 flex flex-wrap items-center gap-3 border-b border-line bg-bg/90 py-2 backdrop-blur-md lg:sticky lg:top-24">
                <label className="sr-only" htmlFor="sp-block-type">
                  Tipo de línea
                </label>
                <select
                  id="sp-block-type"
                  value={current.type ?? ""}
                  onChange={(e) => isBlockType(e.target.value) && setType(e.target.value)}
                  className="bg-bg py-1 font-mono text-xs text-fg outline-none"
                >
                  {!current.type && <option value="">—</option>}
                  {BLOCK_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {BLOCK_LABELS[t]} · {mod}+{BLOCK_SHORTCUTS[t]}
                    </option>
                  ))}
                </select>
                {current.type && (
                  <span className="font-mono text-[11px] text-muted">
                    <kbd className="sp-kbd">Tab</kbd> {BLOCK_LABELS[TAB_NEXT[current.type]]}
                    <span className="mx-2 text-line">|</span>
                    <kbd className="sp-kbd">Enter</kbd> {BLOCK_LABELS[ENTER_NEXT[current.type]]}
                  </span>
                )}
                <span className="ml-auto font-mono text-[11px] text-muted">
                  <span className="text-fg">{pageCount}</span> {pageCount === 1 ? "página" : "páginas"} · ≈{pageCount} min
                </span>
              </div>

              <div className="sp-desk">
                <div className="sp-paper">
                  <EditorContent editor={editor} />
                </div>
              </div>
            </div>

            <aside className="order-3">
              <div className="xl:sticky xl:top-28">
                <ContextPanel />
              </div>
            </aside>
          </div>
        </div>
      </div>
    </WorkspaceProvider>
  );
}
