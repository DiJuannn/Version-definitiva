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
import { isBlockType, type BlockType, type ScreenplayBlock } from "@/lib/screenplay/blocks";
import { layoutScreenplay, pageStarts, scriptLength } from "@/lib/screenplay/layout";
import {
  ScreenplayBehaviour,
  placeholderFor,
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
import { autoSyncScreenplayScenes, syncScreenplayToProject } from "@/lib/actions/screenplays";
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
import { StoryBar } from "@/components/screenplay/StoryBar"; // gv2:tira
import { Radiography } from "@/components/screenplay/Radiography";
import { getScreenplayProduction, type ScreenplayProduction } from "@/lib/actions/screenplay-production";
import { OpeningsPanel, StartHelp } from "@/components/screenplay/StartHelp";
import { CharacterDrawer } from "@/components/screenplay/CharacterDrawer";
import { AssistantDrawer } from "@/components/screenplay/AssistantDrawer";
import { SettingsDialog, type SettingsProps } from "@/components/screenplay/SettingsDialog";
import { Sheet } from "@/components/ui/Sheet";
import { useMediaQuery } from "@/components/ui/use-media-query";
import {
  ExportMenu,
  KeyHints,
  KeyboardBar,
  LineTypeMenu,
  PanelTabs,
  PanelsMenu,
  SaveDot,
  SceneMenu,
} from "@/components/screenplay/EditorToolbar";
import {
  exportItems,
  isPanelId,
  isSidePanel,
  panelInfo,
  saveIndicator,
  sceneScrollTop,
  type ExportItem,
  type PanelId,
  type SaveState,
} from "@/components/screenplay/editor-chrome";
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
        placeholder: placeholderFor, // gv2:motor — «Lo que dice LUCÍA…»
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
        "aria-multiline": "true",
        // M11: Tab cambia el tipo de línea; así se sabe cómo salir.
        "aria-describedby": "sp-editor-help",
      },
    },
    // gv2:motor — con dependencias, TipTap no vuelve a aplicar las opciones
    // (y a repintar todo el documento) en cada render del componente.
  }, [ydoc, provider]);

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

  // Exportar siempre lo último: se guarda antes. El PDF se abre en otra
  // pestaña (se abre ya, en el clic, para que el navegador no la bloquee); el
  // Fountain se descarga aquí mismo, sin dejar una pestaña en blanco (M5).
  const exportScript = useCallback(
    async (item: ExportItem) => {
      if (item.mode === "download") {
        await save();
        // La respuesta es «attachment»: se descarga con su nombre y la página
        // no se mueve.
        const a = document.createElement("a");
        a.href = item.href;
        document.body.appendChild(a);
        a.click();
        a.remove();
        return;
      }
      const w = window.open("about:blank", "_blank");
      await save();
      if (w) w.location.href = item.href;
      else window.location.href = item.href;
    },
    [save],
  );
  useEffect(() => {
    // Otras piezas (el Asistente, la Idea…) pueden pedir exportar con el evento.
    const onExport = (e: Event) => {
      const href = (e as CustomEvent<string>).detail;
      void exportScript({ id: "pdf-a4", label: "", detail: "", href, mode: href.includes("/fountain") ? "download" : "tab" });
    };
    window.addEventListener("screenplay:export", onExport);
    return () => window.removeEventListener("screenplay:export", onExport);
  }, [exportScript]);

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
      // gv2:motor — awareness avisa en cada movimiento del cursor: solo se
      // actualiza si cambia quién está (si no, todo el editor se repintaba
      // en cada tecla).
      const next = [...new Map(list.map((p) => [p.userId, p])).values()];
      const sig = (ps: Peer[]) => ps.map((p) => `${p.clientId}:${p.userId}:${p.name}:${p.color}`).join("|");
      setPeers((prev) => (sig(prev) === sig(next) ? prev : next));
    };
    read();
    provider.awareness.on("change", read);
    return () => provider.awareness.off("change", read);
  }, [provider, ydoc]);


  // ------------------------------------------------------------ bloque actual, escenas y páginas

  const current = useEditorState({
    editor,
    selector: ({ editor: e }) => {
      if (!e) return { type: null as BlockType | null, sid: null as string | null, empty: true };
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
      return { type: isBlockType(name) ? name : null, sid, empty: $from.parent.textContent.length === 0 };
    },
  }) ?? { type: null, sid: null, empty: true };

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
  // M6: la misma medida que el PDF y que «Rodaje».
  const length = useMemo(() => scriptLength(blocks), [blocks]);
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

  // Junto a la página, un solo panel a la vez (o ninguno): Tu historia, Ideas
  // sueltas, Esta escena o Rodaje. Por defecto, solo la página. Se recuerda
  // cómo se dejó, y Ctrl/⌘ + «.» lo muestra u oculta.
  type Panel = PanelId;
  const [panel, setPanelState] = useState<Panel | null>(initialStep === "escaleta" ? "estructura" : null);
  const lastPanel = useRef<Panel>("estructura");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("sp-panel");
      const valid = isPanelId(saved);
      if (valid) lastPanel.current = saved;
      // En pantallas estrechas el panel tapa la página: no se reabre solo.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (valid && window.innerWidth >= 1280 && initialStep !== "escaleta") setPanelState(saved);
    } catch {}
  }, [initialStep]);
  const setPanel = useCallback((next: Panel | null) => {
    setPanelState(next);
    if (next) lastPanel.current = next;
    try {
      localStorage.setItem("sp-panel", next ?? "");
    } catch {}
  }, []);
  const togglePanel = useCallback((which: Panel) => setPanelState((cur) => {
    const next = cur === which ? null : which;
    if (next) lastPanel.current = next;
    try {
      localStorage.setItem("sp-panel", next ?? "");
    } catch {}
    return next;
  }), []);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "." && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        setPanelState((cur) => {
          const next = cur ? null : lastPanel.current;
          try {
            localStorage.setItem("sp-panel", next ?? "");
          } catch {}
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
  const railOpen = panel === "estructura" || panel === "ideas";
  const railTab: RailTab = panel === "ideas" ? "ideas" : "estructura";
  const notesOpen = panel === "notas";
  // B6: «Esta escena» y «Rodaje» van en columna solo en pantallas anchas; en
  // las demás, como hoja inferior (antes quedaban al final del guion).
  const wide = useMediaQuery("(min-width: 1280px)");
  const sideOpen = isSidePanel(panel) && wide;
  const sheetPanel = isSidePanel(panel) && !wide ? panel : null;
  const openRail = useCallback((tab: RailTab) => setPanel(tab), [setPanel]);
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
  // Modo foco: la página sola. La lista de escenas se abre como menú y los
  // paneles junto a la página, solo cuando se piden (y se recuerda).
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

  const headerRef = useRef<HTMLElement>(null);
  const toolbarRef = useRef<HTMLDivElement>(null);
  const goToScene = useCallback(
    (sid: string) => {
      if (!editor) return;
      // Espera a que la página esté visible para poder enfocarla y desplazarse.
      requestAnimationFrame(() => {
        const pos = scenePos(sid);
        if (pos === null) return;
        editor.chain().focus(undefined, { scrollIntoView: false }).setTextSelection(pos + 1).run();
        const dom = editor.view.nodeDOM(pos);
        if (!(dom instanceof HTMLElement)) return;
        // M1: el encabezado arriba, justo debajo de la cabecera y la barra
        // fijas (no pegado al borde de abajo ni tapado por ellas).
        const chromeBottom = toolbarRef.current?.getBoundingClientRect().bottom ?? headerRef.current?.getBoundingClientRect().bottom ?? 0;
        const top = sceneScrollTop({ elementTop: dom.getBoundingClientRect().top, scrollY: window.scrollY, chromeBottom });
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        window.scrollTo({ top, behavior: reduce ? "auto" : "smooth" });
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

  // Las escenas pasan solas al proyecto vinculado: cuando cambia algo que le
  // importa a producción (encabezado, orden, quién sale, de qué va), tras una
  // pausa al escribir. Al abrir no se sincroniza: solo los cambios de aquí.
  const [prodSync, setProdSync] = useState<"idle" | "syncing" | "ok" | "error">("idle");
  const sceneSig = useMemo(
    () =>
      scenes
        .filter((sc) => sc.heading)
        .map((sc) => `${sc.sid}|${sc.heading}|${sc.present.join(",")}|${sc.firstAction.slice(0, 280)}`)
        .join("\n"),
    [scenes],
  );
  const syncedSig = useRef<string | null>(null);
  useEffect(() => {
    if (!linkedProject || !editor) return;
    if (syncedSig.current === null) {
      syncedSig.current = sceneSig;
      return;
    }
    if (sceneSig === syncedSig.current) return;
    const t = setTimeout(async () => {
      setProdSync("syncing");
      await flushSave();
      const res = await autoSyncScreenplayScenes(screenplayId).catch(() => null);
      if (res?.ok) {
        syncedSig.current = sceneSig;
        setProdSync("ok");
        setSyncNote(
          res.gone
            ? `${res.gone === 1 ? "La escena" : "Las escenas"} ${res.goneNumbers?.join(", ")} de producción ya no ${res.gone === 1 ? "está" : "están"} en el guion. No se borra${res.gone === 1 ? "" : "n"} sola${res.gone === 1 ? "" : "s"} (puede${res.gone === 1 ? "" : "n"} tener planos o días): revísala${res.gone === 1 ? "" : "s"} en el proyecto.`
            : null,
        );
      } else {
        setProdSync("error");
        setSyncNote(res && !res.ok ? `No se han podido pasar las escenas al proyecto: ${res.error}` : "No se han podido pasar las escenas al proyecto. Se reintentará con el próximo cambio.");
      }
    }, 6000);
    return () => clearTimeout(t);
  }, [editor, flushSave, linkedProject, sceneSig, screenplayId]);

  // Lo que el proyecto vinculado sabe de cada escena (tira viva y
  // radiografía): al abrir y después de cada paso al proyecto.
  const [production, setProduction] = useState<ScreenplayProduction | null>(null);
  useEffect(() => {
    if (!linkedProject || prodSync === "syncing") return;
    let alive = true;
    getScreenplayProduction(screenplayId)
      .then((p) => alive && setProduction(p))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [linkedProject, prodSync, screenplayId]);

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

  const mac = isMac();
  const mod = mac ? "⌘" : "Ctrl";
  const status = saveIndicator(saveState, connection, saveError);
  const prodNote =
    linkedProject && prodSync !== "idle"
      ? prodSync === "syncing"
        ? "pasando al proyecto…"
        : prodSync === "ok"
          ? "proyecto al día"
          : "proyecto sin actualizar"
      : null;
  const stepIndex = STEPS.findIndex((s) => s.id === step);
  const exports = useMemo(() => exportItems(screenplayId, length.printedPages), [length.printedPages, screenplayId]);
  // P8: en el móvil, la barra cabe en una fila (escena · tipo de línea · ···).
  const narrow = useMediaQuery("(max-width: 767px)");
  // B7: encima del teclado del móvil (sin Tab), una barra con los tipos.
  const touchKeyboard = useMediaQuery("(max-width: 767px), (pointer: coarse) and (max-width: 1279px)");
  const openSettings = useCallback(() => setSettingsOpen(true), []);
  const sidePanel = notesOpen ? <ScenePanel /> : <Radiography production={production} onOpenSettings={openSettings} />;

  return (
    <WorkspaceProvider value={workspace}>
      <header ref={headerRef} className="sp-chrome sticky top-0 z-30 border-b border-[var(--line)]">
        <div className="flex h-14 items-center gap-2 px-3 sm:h-16 sm:gap-4 sm:px-4 lg:px-7">
          <Link href="/app/guiones" className="flex shrink-0 items-center gap-2.5 text-muted hover:text-fg" title="Volver a Guiones">
            <AjoloteLogo className="h-5 w-auto text-fg" />
            <span className="font-mono text-[11px] tracking-[0.2em] uppercase">
              ←<span className="hidden sm:inline"> Guiones</span>
            </span>
          </Link>
          <div className="hidden min-w-0 items-center gap-1.5 md:flex">
            <button
              type="button"
              onClick={openSettings}
              className="min-w-0 truncate text-[17px] font-black tracking-tight hover:text-[var(--accent)]"
            >
              {title}
            </button>
            <button
              type="button"
              onClick={openSettings}
              aria-label="Ajustes del guion"
              title="Ajustes del guion: título, formato, autoría y proyecto vinculado"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-md text-[15px] text-muted hover:bg-white/5 hover:text-fg"
            >
              ⚙
            </button>
          </div>

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

          <div className="flex shrink-0 items-center gap-1.5 text-[13px] sm:gap-3">
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
            <span
              className={`hidden items-center gap-1.5 lg:flex ${status.tone === "error" ? "text-danger" : status.tone === "warn" ? "text-warn" : "text-muted"}`}
              role="status"
              aria-live="polite"
              title={status.label}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${status.tone === "ok" ? "bg-[var(--success)]" : "bg-current"}`} />
              {status.tone === "error" ? status.label : status.short}
              {prodNote && (
                <span className={prodSync === "error" ? "text-warn" : "text-muted"} title={`Proyecto vinculado: ${linkedProject?.name}`}>
                  · {prodNote}
                </span>
              )}
            </span>
            {/* M12: en móvil y tableta, el punto de guardado (al tocarlo dice qué pasa). */}
            <div className="lg:hidden">
              <SaveDot label={status.label} short={status.short} tone={status.tone} extra={prodNote && linkedProject ? `${linkedProject.name}: ${prodNote}` : null} />
            </div>
            <ExportMenu items={exports} onExport={(it) => void exportScript(it)} />
            {/* gv2:ayudas — botón «?» de atajos (ShortcutsSheet, Ctrl+/): va aquí, antes del Asistente. */}
            {/* /gv2:ayudas */}
            <button type="button" onClick={() => (assistantOpen ? setAssistantOpen(false) : openAssistant())} className="sp-ai-btn h-8 !py-0">
              <span className="hidden sm:inline">Asistente IA</span>
              <span className="sm:hidden">IA</span>
              {pendingCount > 0 && <span className="rounded-full bg-[var(--ai)] px-1.5 text-[11px] text-white">{pendingCount}</span>}
            </button>
          </div>
        </div>
        {syncNote && <p className="border-t border-[var(--line)] px-4 py-1.5 text-[12.5px] text-[var(--ai)] lg:px-7">{syncNote}</p>}
        {status.tone === "error" && <p className="border-t border-[var(--line)] px-4 py-1.5 text-[12.5px] text-danger lg:hidden">{status.label}</p>}
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
                railOpen ? "xl:grid-cols-[300px_minmax(0,1fr)]" : sideOpen ? "xl:grid-cols-[minmax(0,1fr)_340px]" : ""
              }`
            : "hidden"
        }
      >
        {railOpen && (
          <button type="button" aria-label="Cerrar el panel" onClick={() => setPanel(null)} className="fixed inset-x-0 top-14 bottom-0 z-30 bg-black/30 sm:top-16 xl:hidden" />
        )}
        {railOpen && (
          <aside
            aria-label={panelInfo(railTab).label}
            className="fixed top-14 bottom-0 left-0 z-40 w-[min(320px,88vw)] bg-[#f5f5f3] shadow-[20px_0_40px_-20px_rgba(0,0,0,0.3)] sm:top-16 xl:sticky xl:z-10 xl:h-[calc(100vh-4rem)] xl:w-auto xl:shadow-none"
          >
            <div className="h-full border-r border-[var(--line)] xl:-ml-7 xl:pl-3">
              <StoryRail tab={railTab} onClose={() => setPanel(null)} />
            </div>
          </aside>
        )}
        <div className="min-w-0">
          <div
            ref={toolbarRef}
            className="@container sticky top-14 z-20 -mx-4 flex items-center gap-2 border-b border-[var(--line)] bg-[#f5f5f3]/95 px-4 py-2 backdrop-blur sm:top-16 sm:gap-3 lg:mx-0 lg:px-0"
          >
            {/* Qué se ve junto a la página: uno a la vez, o solo la página. */}
            {narrow ? null : <PanelTabs panel={panel} onToggle={togglePanel} mod={mod} />}
            {/* Escenas: un menú, no una columna fija. */}
            <SceneMenu scenes={scenes} currentSid={current.sid} doubtScenes={doubtScenes} sceneRefs={sceneRefs} onGo={goToScene} compact={narrow} />
            <LineTypeMenu editor={editor} type={current.type} mac={mac} compact={narrow} />
            {current.type && (
              <span className="hidden @min-[1040px]:inline">
                <KeyHints type={current.type} empty={current.empty} />
              </span>
            )}
            <span className="ml-auto hidden text-[12.5px] whitespace-nowrap text-muted @min-[620px]:inline" title="Medido como el PDF: 1 página ≈ 1 minuto en pantalla">
              {length.label}
            </span>
            {narrow && (
              <span className="ml-auto">
                <PanelsMenu panel={panel} onToggle={togglePanel} onSettings={openSettings} />
              </span>
            )}
          </div>
          {/* gv2:ayudas — NextStep («¿Y ahora qué?»): tarjeta junto al papel. Su montaje va aquí. */}
          {/* /gv2:ayudas */}
          <div className="sp-desk">
            <div className={`sp-paper relative ${isEmpty ? "sp-paper-empty" : ""}`}>
              <EditorContent editor={editor} />
              {/* gv2:ayudas — LineGuide (guía de la línea, al margen del papel, con coordsAtPos): va aquí. */}
              {/* /gv2:ayudas */}
              {isEmpty && <StartHelp onWrite={() => editor?.chain().focus("start").run()} />}
            </div>
          </div>
          <p id="sp-editor-help" className="sr-only">
            Guion. Enter crea la línea siguiente; Tab cambia el tipo de la línea actual. Para salir del guion con el teclado, pulsa Esc y luego Tab.
          </p>
          {/* gv2:tira — «Tu historia», acoplada abajo de la columna del guion */}
          <StoryBar production={production} format={settings.format} />
          {/* /gv2:tira */}
        </div>

        {sideOpen && (
          <aside aria-label={panelInfo(notesOpen ? "notas" : "radiografia").label} className="pt-6">
            <div className="xl:sticky xl:top-24 xl:max-h-[calc(100vh-7rem)] xl:overflow-y-auto xl:pr-1">
              <div className="mb-5 flex items-start gap-3">
                <div className="min-w-0 flex-1">
                  <h2 className="text-[15px] leading-tight font-bold">{panelInfo(notesOpen ? "notas" : "radiografia").label}</h2>
                  <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{panelInfo(notesOpen ? "notas" : "radiografia").description}</p>
                </div>
                <button type="button" onClick={() => setPanel(null)} aria-label="Cerrar el panel" title="Cerrar el panel" className="-mt-0.5 text-[17px] leading-none text-muted hover:text-fg">
                  ×
                </button>
              </div>
              {sidePanel}
            </div>
          </aside>
        )}
      </div>

      {/* B6: en pantallas estrechas, «Esta escena» y «Rodaje» como hoja inferior. */}
      {sheetPanel && step === "guion" && (
        <Sheet title={panelInfo(sheetPanel).label} subtitle={panelInfo(sheetPanel).description} onClose={() => setPanel(null)}>
          {sidePanel}
        </Sheet>
      )}
      {touchKeyboard && step === "guion" && !sheetPanel && <KeyboardBar editor={editor} type={current.type} />}

      {openingsOpen && <OpeningsPanel onClose={() => setOpeningsOpen(false)} />}
      {characterOpen && <CharacterDrawer name={characterOpen} onClose={() => setCharacterOpen(null)} />}
      {assistantOpen && <AssistantDrawer onClose={() => setAssistantOpen(false)} />}
      {/* gv2:ayudas — ShortcutsSheet y demás hojas de ayuda: se montan aquí. */}
      {/* /gv2:ayudas */}
      <SettingsDialog open={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} />
    </WorkspaceProvider>
  );
}
