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
  setActBreaks,
  setPageBreaks,
} from "@/lib/screenplay/editor-extensions";
import { characterNames, scenesFromBlocks, type Reference, type Review } from "@/lib/screenplay/story";
import { storyMaps } from "@/lib/screenplay/story-doc";
import { useYMap } from "@/lib/screenplay/use-ymap";
import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { newSceneId } from "@/lib/screenplay/blocks";
import { suggestReferencesAction } from "@/lib/actions/screenplay-ai";
import { syncScreenplayToProject } from "@/lib/actions/screenplays";
import {
  STEPS,
  WorkspaceProvider,
  isStep,
  pushSuggestions,
  type RailTab,
  type Step,
  type Workspace,
} from "@/components/screenplay/workspace";
import { ScenePanel } from "@/components/screenplay/ScenePanel";
import { IdeaStep } from "@/components/screenplay/IdeaStep";
import { StoryRail } from "@/components/screenplay/StoryRail";
import { OpeningsPanel, StartHelp } from "@/components/screenplay/StartHelp";
import { CharacterDrawer } from "@/components/screenplay/CharacterDrawer";
import { AssistantDrawer } from "@/components/screenplay/AssistantDrawer";
import { SettingsDialog, type SettingsProps } from "@/components/screenplay/SettingsDialog";
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
  title: string;
  subtitle: string; // "Cortometraje · Marta Vidal"
  initialStep: string | null;
  settings: SettingsProps;
  linkedProject: { id: string; name: string } | null;
};

type SaveState = "saved" | "dirty" | "saving" | "error";
type Peer = { clientId: number; name: string; color: string; userId: string };

const SAVE_DEBOUNCE_MS = 1200;
const SAVE_MAX_WAIT_MS = 6000;

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

function docBlocks(doc: import("@tiptap/pm/model").Node | null): ScreenplayBlock[] {
  const out: ScreenplayBlock[] = [];
  doc?.forEach((node) => {
    if (!isBlockType(node.type.name)) return;
    const sid = node.type.name === "sceneHeading" ? (node.attrs.sid as string | null) : null;
    out.push(sid ? { type: node.type.name, text: node.textContent, id: sid } : { type: node.type.name, text: node.textContent });
  });
  return out;
}

export default function ScreenplayEditor({
  screenplayId,
  initialState,
  userId,
  userName,
  title,
  subtitle,
  initialStep,
  settings,
  linkedProject,
}: Props) {
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
      for (let i = $from.index(0); i >= 0; i--) {
        const n = e.state.doc.child(i);
        // También las escenas aún sin encabezado (las de una idea suelta).
        if (n.type.name === "sceneHeading" && (n.textContent.trim() || n.attrs.sid)) {
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

  const scenes = useMemo(() => scenesFromBlocks(blocks, "A4", { untitled: true }), [blocks]);
  const isEmpty = editor !== null && !blocks.some((b) => b.text.trim());
  const characters = useMemo(() => characterNames(blocks), [blocks]);
  const maps = useMemo(() => storyMaps(ydoc), [ydoc]);
  const refs = useYMap<Reference>(maps.refs);
  const ai = useYMap<unknown>(maps.ai);
  const pendingCount = Array.isArray(ai.suggestions) ? ai.suggestions.length : 0;
  const doubtScenes = useMemo(() => {
    const items = (ai.review as Review | undefined)?.items ?? [];
    return new Set(items.map((d) => d.sid).filter(Boolean));
  }, [ai.review]);
  const sceneRefs = useMemo(() => {
    const m = new Map<string, number>();
    for (const r of Object.values(refs)) if (r.anchor.type === "scene") m.set(r.anchor.sid, (m.get(r.anchor.sid) ?? 0) + 1);
    return m;
  }, [refs]);

  // Las rayas de los actos en la página.
  const acts = useYMap<string>(maps.acts);
  const structureMap = useYMap<unknown>(maps.structure);
  useEffect(() => {
    if (!editor) return;
    const labels: Record<string, string> = { ...acts };
    const first = scenes[0]?.sid;
    const three = structureMap.template !== "five" && structureMap.template !== "free";
    if (first && !labels[first] && Object.keys(acts).length && three) labels[first] = "Acto I";
    setActBreaks(editor, labels);
  }, [acts, editor, scenes, structureMap.template]);

  // ------------------------------------------------------------ pasos

  const [step, setStepState] = useState<Step>(isStep(initialStep) ? initialStep : "guion");

  // Columna de la historia junto a la página (Estructura / Ideas sueltas).
  // Abierta por defecto; se recuerda si se cierra.
  const [railOpen, setRailOpenState] = useState(true);
  const [railTab, setRailTab] = useState<RailTab>("estructura");
  useEffect(() => {
    try {
      // En pantallas estrechas el panel tapa la página: empieza cerrado.
      const narrow = window.innerWidth < 1280;
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if ((narrow || localStorage.getItem("sp-rail") === "0") && initialStep !== "escaleta") setRailOpenState(false);
    } catch {}
  }, [initialStep]);
  const setRailOpen = useCallback((open: boolean) => {
    setRailOpenState(open);
    try {
      localStorage.setItem("sp-rail", open ? "1" : "0");
    } catch {}
  }, []);
  const openRail = useCallback(
    (tab: RailTab) => {
      setRailTab(tab);
      setRailOpen(true);
    },
    [setRailOpen],
  );
  const [openingsOpen, setOpeningsOpen] = useState(false);
  const openOpenings = useCallback(() => setOpeningsOpen(true), []);
  const setStep = useCallback((s: Step) => {
    setStepState(s);
    const url = new URL(window.location.href);
    url.searchParams.set("paso", s);
    window.history.replaceState(null, "", url);
    window.scrollTo({ top: 0 });
  }, []);

  const [characterOpen, setCharacterOpen] = useState<string | null>(null);
  const [assistantOpen, setAssistantOpen] = useState(false);
  // Modo foco: la página sola. La lista de escenas se abre como menú y las
  // notas de la escena como columna, solo cuando se piden (y se recuerda).
  const [scenesOpen, setScenesOpen] = useState(false);
  const [notesOpen, setNotesOpenState] = useState(false);
  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setNotesOpenState(localStorage.getItem("sp-notes-open") === "1");
    } catch {}
  }, []);
  const setNotesOpen = useCallback((open: boolean) => {
    setNotesOpenState(open);
    try {
      localStorage.setItem("sp-notes-open", open ? "1" : "0");
    } catch {}
  }, []);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const openCharacter = useCallback((name: string) => {
    setAssistantOpen(false);
    setCharacterOpen(name);
  }, []);
  const openAssistant = useCallback(() => {
    setCharacterOpen(null);
    setAssistantOpen(true);
  }, []);

  // ------------------------------------------------------------ mover y añadir escenas

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
      // Espera a que la página esté visible para poder enfocarla y desplazarse.
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

  // Escena nueva: encabezado, la idea de la que sale (como nota) y una acción
  // vacía, delante de `beforeSid` (o al final del guion). Devuelve su sid.
  const addScene = useCallback(
    (heading: string, synopsis: string, beforeSid: string | null, note?: string): string | null => {
      if (!editor) return null;
      const { schema, doc } = editor.state;
      const sid = newSceneId();
      const before = beforeSid ? scenePos(beforeSid) : null;
      const target = before ?? doc.content.size;
      const text = heading.trim().toUpperCase();
      const nodes = [
        schema.nodes.sceneHeading.create({ sid }, text ? schema.text(text) : null),
        ...(note?.trim() ? [schema.nodes.note.create(null, schema.text(note.trim()))] : []),
        schema.nodes.action.create(),
      ];
      // Si el guion está vacío (recién creado), se sustituye entero.
      const empty = !docBlocks(doc).some((b) => b.text.trim());
      const tr = empty ? editor.state.tr.replaceWith(0, doc.content.size, nodes) : editor.state.tr.insert(target, nodes);
      editor.view.dispatch(tr);
      if (synopsis) maps.scenes.set(sid, { synopsis });
      return sid;
    },
    [editor, maps, scenePos],
  );

  // Una nota al final de la escena en la que está el cursor.
  const insertNote = useCallback(
    (text: string): boolean => {
      if (!editor || !current.sid || !text.trim()) return false;
      const start = scenePos(current.sid);
      if (start === null) return false;
      const { doc, schema } = editor.state;
      let end = doc.content.size;
      let seen = false;
      doc.forEach((n, offset) => {
        if (offset <= start) return;
        if (!seen && n.type.name === "sceneHeading") {
          end = offset;
          seen = true;
        }
      });
      editor.view.dispatch(editor.state.tr.insert(end, schema.nodes.note.create(null, schema.text(text.trim()))));
      return true;
    },
    [current.sid, editor, scenePos],
  );

  // La IA lee lo guardado: antes de llamarla se guarda lo pendiente.
  const flushSave = useCallback(async () => {
    for (let i = 0; i < 6; i++) {
      if (await saveRef.current()) return true;
      await new Promise((r) => setTimeout(r, 400));
    }
    return false;
  }, []);

  // ------------------------------------------------------------ referencias solas al terminar una escena

  const [autoRefs, setAutoRefsState] = useState<boolean>(() => {
    try {
      return window.localStorage.getItem("sp-auto-refs") === "1";
    } catch {
      return false;
    }
  });
  const setAutoRefs = useCallback((on: boolean) => {
    setAutoRefsState(on);
    try {
      window.localStorage.setItem("sp-auto-refs", on ? "1" : "0");
    } catch {
      // sin almacenamiento local: vale para esta sesión
    }
  }, []);
  const [autoBusy, setAutoBusy] = useState<string | null>(null);
  const currentSidRef = useRef<string | null>(null);
  const editedScenes = useRef(new Set<string>());

  // Qué escenas toca esta persona (solo sus propios cambios).
  useEffect(() => {
    const onUpdate = (_u: Uint8Array, origin: unknown) => {
      if (origin === REMOTE_ORIGIN || origin === "db") return;
      if (currentSidRef.current) editedScenes.current.add(currentSidRef.current);
    };
    ydoc.on("update", onUpdate);
    return () => ydoc.off("update", onUpdate);
  }, [ydoc]);

  useEffect(() => {
    const prev = currentSidRef.current;
    currentSidRef.current = current.sid;
    if (!autoRefs || !prev || prev === current.sid || !editedScenes.current.has(prev)) return;
    editedScenes.current.delete(prev);
    const scene = scenesFromBlocks(docBlocks(editor?.state.doc ?? null), "A4", { untitled: true }).find((s) => s.sid === prev);
    if (!scene) return;
    const words = blocks
      .slice(scene.start, scene.end)
      .reduce((n, b) => n + (b.text.trim() ? b.text.trim().split(/\s+/).length : 0), 0);
    // Una vez por escena, salvo que haya crecido bastante desde la última.
    const last = Number(maps.ai.get(`auto:${prev}`) ?? 0);
    if (words < 40 || words < last + 60) return;
    maps.ai.set(`auto:${prev}`, words);
    setAutoBusy(prev);
    void (async () => {
      await flushSave();
      const res = await suggestReferencesAction(screenplayId, { type: "scene", sid: prev }).catch(() => null);
      if (res?.ok) pushSuggestions(maps, res.suggestions);
      setAutoBusy(null);
    })();
  }, [autoRefs, blocks, current.sid, editor, flushSave, maps, screenplayId]);

  // ------------------------------------------------------------ al día con Taller

  const [syncNote, setSyncNote] = useState<string | null>(null);
  useEffect(() => {
    if (!linkedProject) return;
    let t: ReturnType<typeof setTimeout> | null = null;
    const onChange = (_e: unknown, tr: Y.Transaction) => {
      if (!tr.local) return; // cada persona sincroniza lo suyo
      if (t) clearTimeout(t);
      t = setTimeout(async () => {
        await flushSave();
        const res = await syncScreenplayToProject(screenplayId).catch(() => null);
        setSyncNote(res && res.ok && res.warning ? res.warning : null);
      }, 5000);
    };
    maps.characters.observeDeep(onChange);
    maps.refs.observeDeep(onChange);
    return () => {
      if (t) clearTimeout(t);
      maps.characters.unobserveDeep(onChange);
      maps.refs.unobserveDeep(onChange);
    };
  }, [flushSave, linkedProject, maps, screenplayId]);

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
    linkedProject,
    goToScene,
    moveScene,
    addScene,
    insertNote,
    pageCount,
    openRail,
    openOpenings,
    flushSave,
    setStep,
    openCharacter,
    openAssistant,
    autoRefs,
    setAutoRefs,
    autoBusy,
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
      ? { label: "Sin conexión", tone: "text-warn" }
      : saveState === "error"
        ? { label: saveError ?? "Error al guardar", tone: "text-danger" }
        : saveState === "saving"
          ? { label: "Guardando…", tone: "text-muted" }
          : saveState === "dirty"
            ? { label: "Sin guardar", tone: "text-muted" }
            : { label: "Guardado", tone: "text-muted" };
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const exportTo = (href: string) => window.dispatchEvent(new CustomEvent("screenplay:export", { detail: href }));

  return (
    <WorkspaceProvider value={workspace}>
      <header className="sp-chrome sticky top-0 z-30 border-b border-[var(--line)]">
        <div className="flex h-16 items-center gap-2 px-3 sm:gap-4 sm:px-4 lg:px-7">
          <Link href="/app/guiones" className="flex shrink-0 items-center gap-2.5 text-muted hover:text-fg" title="Volver a Guiones">
            <AjoloteLogo className="h-5 w-auto text-fg" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase">
              ←<span className="hidden sm:inline"> Guiones</span>
            </span>
          </Link>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            title="Ajustes del guion"
            className="hidden min-w-0 truncate text-[17px] font-black tracking-tight hover:text-[var(--accent)] md:block"
          >
            {title}
          </button>

          <nav aria-label="Pasos del guion" className="mx-auto flex items-center gap-1">
            {STEPS.map((s, i) => (
              <span key={s.id} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden className="hidden h-px w-6 bg-[var(--line)] sm:block" />}
                <button
                  type="button"
                  onClick={() => setStep(s.id)}
                  aria-current={step === s.id ? "step" : undefined}
                  aria-label={s.label}
                  className={`sp-step ${i < stepIndex ? "sp-step-done" : ""}`}
                >
                  <span className="sp-step-num">{i + 1}</span>
                  <span className={step === s.id ? "" : "hidden sm:inline"}>{s.label}</span>
                </button>
              </span>
            ))}
          </nav>

          <div className="flex shrink-0 items-center gap-2 text-[13px] sm:gap-3">
            <ul className="hidden -space-x-1.5 sm:flex" aria-label="Escribiendo ahora">
              <li
                title={`${userName} (tú)`}
                className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#0a0a0a] text-[11px] font-bold text-[#111]"
                style={{ background: myColor }}
              >
                {userName.slice(0, 1).toUpperCase()}
              </li>
              {peers.map((p) => (
                <li
                  key={p.clientId}
                  title={p.name}
                  className="grid h-7 w-7 place-items-center rounded-full border-2 border-[#0a0a0a] text-[11px] font-bold text-[#111]"
                  style={{ background: p.color }}
                >
                  {p.name.slice(0, 1).toUpperCase()}
                </li>
              ))}
            </ul>
            <span className={`hidden items-center gap-1.5 lg:flex ${status.tone}`} role="status" aria-live="polite">
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
              {status.label}
            </span>
            <details className="relative">
              <summary className="sp-btn cursor-pointer list-none" aria-label="Exportar">
                <span aria-hidden className="sm:hidden">⤓</span>
                <span className="hidden sm:inline">Exportar</span>
              </summary>
              <div className="absolute right-0 z-40 mt-1 w-44 overflow-hidden rounded-lg border border-[var(--line)] bg-[#131313] py-1 shadow-lg">
                {(
                  [
                    ["PDF (A4)", `/api/pdf/guion/${screenplayId}?size=A4`],
                    ["PDF (Carta)", `/api/pdf/guion/${screenplayId}?size=LETTER`],
                    ["Fountain", `/api/guiones/${screenplayId}/fountain`],
                  ] as const
                ).map(([label, href]) => (
                  <button
                    key={href}
                    type="button"
                    onClick={(e) => {
                      (e.currentTarget.closest("details") as HTMLDetailsElement).open = false;
                      exportTo(href);
                    }}
                    className="block w-full px-3.5 py-2 text-left hover:bg-white/5"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </details>
            <button type="button" onClick={() => (assistantOpen ? setAssistantOpen(false) : openAssistant())} className="sp-ai-btn">
              <span className="hidden sm:inline">Asistente IA</span>
              <span className="sm:hidden">IA</span>
              {pendingCount > 0 && <span className="rounded-full bg-[var(--ai)] px-1.5 text-[11px] text-white">{pendingCount}</span>}
            </button>
          </div>
        </div>
        {syncNote && <p className="border-t border-[var(--line)] px-7 py-1.5 text-[12.5px] text-[var(--ai)]">{syncNote}</p>}
      </header>

      {step === "idea" && (
        <div key="idea" className="sp-enter">
          <IdeaStep title={title} subtitle={subtitle} />
        </div>
      )}

      {/* El guion nunca se desmonta: el editor y su conexión siguen vivos en
          la Idea (desde allí también se crean escenas). */}
      <div
        className={
          step === "guion"
            ? `sp-enter grid gap-6 px-4 pb-24 lg:px-7 ${
                railOpen && notesOpen
                  ? "xl:grid-cols-[300px_minmax(0,1fr)_320px]"
                  : railOpen
                    ? "xl:grid-cols-[300px_minmax(0,1fr)]"
                    : notesOpen
                      ? "xl:grid-cols-[minmax(0,1fr)_320px]"
                      : ""
              }`
            : "hidden"
        }
      >
        {railOpen && (
          <button type="button" aria-label="Cerrar el panel" onClick={() => setRailOpenState(false)} className="fixed inset-x-0 top-16 bottom-0 z-30 bg-black/30 xl:hidden" />
        )}
        {railOpen && (
          <aside
            aria-label="La historia"
            className="fixed top-16 bottom-0 left-0 z-40 w-[min(320px,88vw)] bg-[#f5f5f3] shadow-[20px_0_40px_-20px_rgba(0,0,0,0.3)] xl:sticky xl:z-10 xl:h-[calc(100vh-4rem)] xl:w-auto xl:shadow-none"
          >
            <div className="h-full border-r border-[var(--line)] xl:-ml-7 xl:pl-3">
              <StoryRail tab={railTab} onTab={setRailTab} onClose={() => setRailOpen(false)} />
            </div>
          </aside>
        )}
        <div className="min-w-0">
          <div className="sticky top-16 z-20 flex flex-wrap items-center gap-3 border-b border-[var(--line)] bg-[#f5f5f3]/95 py-2 backdrop-blur">
            {!railOpen && (
              <button
                type="button"
                onClick={() => setRailOpen(true)}
                className="rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-[13px] hover:border-[var(--accent)]"
              >
                Estructura e ideas
              </button>
            )}
            {/* Escenas: un menú, no una columna fija. */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setScenesOpen((v) => !v)}
                aria-expanded={scenesOpen}
                className="flex items-center gap-2 rounded-md border border-[var(--line)] bg-white px-2.5 py-1 text-[13px] hover:border-[var(--accent)]"
              >
                {scenes.length === 0 ? (
                  "Sin escenas"
                ) : (
                  <>
                    <span className="font-semibold">
                      Escena {scenes.find((s) => s.sid === current.sid)?.number ?? "—"}
                    </span>
                    <span className="text-muted">de {scenes.length}</span>
                    {doubtScenes.size > 0 && (
                      <span title={`${doubtScenes.size} escenas con dudas`} className="h-1.5 w-1.5 rounded-full bg-[var(--ai)]" />
                    )}
                  </>
                )}
                <span aria-hidden className="text-[10px] text-muted">▾</span>
              </button>
              {scenesOpen && (
                <div className="absolute left-0 z-40 mt-1.5 w-[22rem] max-w-[calc(100vw-2rem)] rounded-xl bg-white p-1.5 shadow-[0_0_0_1px_var(--line),0_18px_40px_-16px_rgba(0,0,0,0.35)]">
                  {scenes.length === 0 ? (
                    <p className="p-3 text-[13px] leading-relaxed text-muted">
                      Escribe «int.» o «ext.» al principio de una línea para empezar una escena.
                    </p>
                  ) : (
                    <ol className="max-h-[60vh] overflow-y-auto">
                      {scenes.map((s) => (
                        <li key={s.sid}>
                          <button
                            type="button"
                            onClick={() => {
                              goToScene(s.sid);
                              setScenesOpen(false);
                            }}
                            aria-current={s.sid === current.sid}
                            className={`flex w-full gap-2 rounded-lg px-2.5 py-1.5 text-left text-[12.5px] leading-snug transition-colors ${
                              s.sid === current.sid ? "bg-[var(--accent)]/10 text-fg" : "text-muted hover:bg-black/[0.04] hover:text-fg"
                            }`}
                          >
                            <span className="w-5 shrink-0 text-right font-[family-name:var(--font-courier)] font-bold text-[var(--accent)]">{s.number}</span>
                            <span className="line-clamp-2 flex-1 font-[family-name:var(--font-courier)]">{s.heading || "Sin encabezado"}</span>
                            {doubtScenes.has(s.sid) && (
                              <span title="Tiene dudas de la revisión" className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--ai)]" />
                            )}
                            {sceneRefs.get(s.sid) ? (
                              <span title={`${sceneRefs.get(s.sid)} referencias`} className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[var(--accent)]" />
                            ) : null}
                          </button>
                        </li>
                      ))}
                    </ol>
                  )}
                </div>
              )}
            </div>
            <label className="sr-only" htmlFor="sp-block-type">
              Tipo de línea
            </label>
            <select
              id="sp-block-type"
              value={current.type ?? ""}
              onChange={(e) => isBlockType(e.target.value) && setType(e.target.value)}
              className="rounded-md border border-[var(--line)] bg-white px-2 py-1 text-[13px] outline-none"
            >
              {!current.type && <option value="">—</option>}
              {BLOCK_TYPES.map((t) => (
                <option key={t} value={t}>
                  {BLOCK_LABELS[t]} · {mod}+{BLOCK_SHORTCUTS[t]}
                </option>
              ))}
            </select>
            {current.type && (
              <span className="hidden text-[12.5px] text-muted md:inline">
                <kbd className="sp-kbd">Tab</kbd> {BLOCK_LABELS[TAB_NEXT[current.type]]}
                <span className="mx-2 text-[var(--line)]">|</span>
                <kbd className="sp-kbd">Enter</kbd> {BLOCK_LABELS[ENTER_NEXT[current.type]]}
              </span>
            )}
            <span className="ml-auto text-[12.5px] text-muted">
              <span className="font-semibold text-fg">{pageCount}</span> {pageCount === 1 ? "página" : "páginas"} · ≈{pageCount} min
            </span>
            <button
              type="button"
              onClick={() => setNotesOpen(!notesOpen)}
              aria-pressed={notesOpen}
              className={`rounded-md border px-2.5 py-1 text-[13px] transition-colors ${
                notesOpen ? "border-[var(--accent)] bg-[var(--accent)]/10 text-fg" : "border-[var(--line)] bg-white text-muted hover:text-fg"
              }`}
            >
              Notas de escena
            </button>
          </div>
          <div className="sp-desk" onMouseDown={() => scenesOpen && setScenesOpen(false)}>
            <div className={`sp-paper ${isEmpty ? "sp-paper-empty" : ""}`}>
              <EditorContent editor={editor} />
              {isEmpty && <StartHelp onWrite={() => editor?.chain().focus("start").run()} />}
            </div>
          </div>
        </div>

        {notesOpen && (
          <aside className="pt-6">
            <div className="xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
              <ScenePanel />
            </div>
          </aside>
        )}
      </div>

      {openingsOpen && <OpeningsPanel onClose={() => setOpeningsOpen(false)} />}
      {characterOpen && <CharacterDrawer name={characterOpen} onClose={() => setCharacterOpen(null)} />}
      {assistantOpen && <AssistantDrawer onClose={() => setAssistantOpen(false)} />}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} />
    </WorkspaceProvider>
  );
}
