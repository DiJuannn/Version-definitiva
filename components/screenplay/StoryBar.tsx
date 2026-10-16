"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import Link from "next/link";
import { SceneProgress } from "@/components/SceneProgress";
import type { ScreenplayProduction } from "@/lib/actions/screenplay-production";
import { formatEighths, type SceneInfo } from "@/lib/screenplay/story";
import {
  ACT_PLAIN,
  KEY_MOMENTS,
  MOMENTS,
  assignRows,
  layoutBlocks,
  momentBehind,
  pageAt,
  plural,
  sceneUnits,
  screenTime,
  stripColorOf,
  type BlockBox,
  type MomentId,
  type PlacedMoment,
} from "@/lib/screenplay/moments";
import { publishScreenplayFormat, useStoryModel, type StoryModel } from "@/components/screenplay/story-model";
import { MomentCard } from "@/components/screenplay/MomentCard";
import { NOTICE_EVENT, moveSceneTo, showStoryNotice, undoAction, type StoryNotice } from "@/components/screenplay/scene-moves";

// «Tu historia»: una barra clara acoplada abajo del editor, como la barra de
// tiempo de un reproductor. Dice dónde estás de la película y qué momentos de
// la historia tienes ya. Cada momento se abre y explica qué es, con una
// pregunta para escribirlo y botones para marcarlo. La vista «Rodaje» enseña
// lo de producción (interior/exterior, día/noche y lo preparado).
//
// Sustituye a la tira oscura de encima del folio (StoryStrip).

type View = "historia" | "rodaje";
type Prefs = { view: View; collapsed: boolean };
const PREFS_KEY = "sp-storybar";

function readPrefs(): Prefs {
  try {
    const raw = JSON.parse(localStorage.getItem(PREFS_KEY) ?? "{}") as Partial<Prefs>;
    return { view: raw.view === "rodaje" ? "rodaje" : "historia", collapsed: raw.collapsed === true };
  } catch {
    return { view: "historia", collapsed: false };
  }
}

function useMedia(query: string): boolean {
  const [on, setOn] = useState(() => typeof window !== "undefined" && window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const fn = () => setOn(mq.matches);
    fn();
    mq.addEventListener("change", fn);
    return () => mq.removeEventListener("change", fn);
  }, [query]);
  return on;
}

// Ancho en píxeles de un elemento (se mide en vivo): las etiquetas y los
// bloques se colocan en píxeles, no en porcentajes, para que no se pisen.
function useWidth<T extends HTMLElement>(): [(el: T | null) => void, number, T | null] {
  const [el, setEl] = useState<T | null>(null);
  const [w, setW] = useState(0);
  useLayoutEffect(() => {
    if (!el) return;
    // El observador avisa nada más empezar a mirar, y luego en cada cambio.
    const ro = new ResizeObserver(() => setW(el.clientWidth));
    ro.observe(el);
    return () => ro.disconnect();
  }, [el]);
  return [setEl, w, el];
}

// Ancho del texto de una etiqueta, medido con la fuente de la página (sin
// tocar el DOM): sirve para repartir las etiquetas en filas sin que se pisen.
let measureCtx: CanvasRenderingContext2D | null = null;
function textWidth(text: string, weight: number, size: number): number {
  if (typeof document === "undefined") return text.length * size * 0.55;
  measureCtx ??= document.createElement("canvas").getContext("2d");
  if (!measureCtx) return text.length * size * 0.55;
  const family = getComputedStyle(document.body).fontFamily || "sans-serif";
  measureCtx.font = `${weight} ${size}px ${family}`;
  return measureCtx.measureText(text).width;
}

export function StoryBar({ production, format }: { production: ScreenplayProduction | null; format: string | null }) {
  useEffect(() => publishScreenplayFormat(format), [format]);
  const model = useStoryModel();
  const mobile = useMedia("(max-width: 640px)");
  const [prefs, setPrefsState] = useState<Prefs>(readPrefs);
  const setPrefs = useCallback((patch: Partial<Prefs>) => {
    setPrefsState((p) => {
      const next = { ...p, ...patch };
      try {
        localStorage.setItem(PREFS_KEY, JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);

  // Avisos breves («Escena 3 movida…»), de aquí o del panel.
  const [notice, setNotice] = useState<StoryNotice | null>(null);
  useEffect(() => {
    let t: ReturnType<typeof setTimeout> | null = null;
    const on = (e: Event) => {
      setNotice((e as CustomEvent<StoryNotice>).detail);
      if (t) clearTimeout(t);
      t = setTimeout(() => setNotice(null), 7000);
    };
    window.addEventListener(NOTICE_EVENT, on);
    return () => {
      window.removeEventListener(NOTICE_EVENT, on);
      if (t) clearTimeout(t);
    };
  }, []);

  // Alt+↑ / Alt+↓ en el guion: sube o baja la escena del cursor.
  const { editor, scenes, currentSid } = model;
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!e.altKey || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
      if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
      if (!editor || !editor.view.hasFocus() || !currentSid) return;
      const order = scenes.map((s) => s.sid);
      const i = order.indexOf(currentSid);
      if (i === -1) return;
      e.preventDefault();
      const to = e.key === "ArrowUp" ? i - 1 : i + 1;
      if (to < 0 || to >= order.length) {
        showStoryNotice({ text: to < 0 ? "Ya es la primera escena." : "Ya es la última escena." });
        return;
      }
      if (moveSceneTo(editor, order, currentSid, to))
        showStoryNotice({ text: `Escena ${i + 1} movida a la posición ${to + 1}.`, action: undoAction(editor) });
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentSid, editor, scenes]);

  // gv2:tira — La barra va pegada abajo, encima del folio: al escribir al final
  // de la pantalla el cursor no debe quedar debajo. Se le dice al editor que
  // deje ese margen (y el de la cabecera y la barra de herramientas, arriba)
  // cuando se desplaza para seguir al cursor.
  useEffect(() => {
    const el = document.querySelector<HTMLElement>('section[aria-label="Tu historia"]');
    if (!editor || !el) return;
    const apply = () => {
      if (editor.isDestroyed) return;
      const bottom = Math.round(el.getBoundingClientRect().height) + 24;
      editor.view.setProps({
        scrollMargin: { top: 130, bottom, left: 5, right: 5 },
        scrollThreshold: { top: 130, bottom, left: 0, right: 0 },
      });
    };
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [editor, mobile]);

  const noticeEl = notice && (
    <div
      role="status"
      className="pointer-events-auto absolute right-4 bottom-full mb-2 flex max-w-[calc(100%-2rem)] items-center gap-3 rounded-lg bg-[#1c1b19] px-3.5 py-2 text-[12.5px] text-white shadow-lg"
    >
      <span>{notice.text}</span>
      {notice.action && (
        <button
          type="button"
          className="font-semibold text-[#cfc5ee] hover:underline"
          onClick={() => {
            notice.action?.run();
            setNotice(null);
          }}
        >
          {notice.action.label}
        </button>
      )}
      <button type="button" aria-label="Cerrar el aviso" className="text-white/60 hover:text-white" onClick={() => setNotice(null)}>
        ×
      </button>
    </div>
  );

  return mobile ? (
    <MobileBar model={model} production={production} view={prefs.view} setView={(view) => setPrefs({ view })} notice={noticeEl} />
  ) : (
    <DesktopBar model={model} production={production} prefs={prefs} setPrefs={setPrefs} notice={noticeEl} />
  );
}

// ------------------------------------------------------------------ piezas comunes

function ViewSwitch({ view, setView }: { view: View; setView: (v: View) => void }) {
  return (
    <div role="group" aria-label="Qué ver en la barra" className="inline-flex rounded-full border border-[var(--line)] p-0.5 text-[12px]">
      {(
        [
          ["historia", "Historia"],
          ["rodaje", "Rodaje"],
        ] as const
      ).map(([id, label]) => (
        <button
          key={id}
          type="button"
          aria-pressed={view === id}
          onClick={() => setView(id)}
          className={`rounded-full px-2.5 py-0.5 transition-colors ${view === id ? "bg-[var(--fg)] text-white" : "text-muted hover:text-fg"}`}
        >
          {label}
        </button>
      ))}
    </div>
  );
}

function summaryParts(model: StoryModel): string[] {
  const { scenes, pageCount, target, template, placed, current, currentSid } = model;
  const parts: string[] = [];
  const done = placed.filter((p) => !p.moment.auto && p.placed).length;
  if (template === "three" && pageCount < target) parts.push(`llevas ${pageCount} de ~${target} páginas`);
  else parts.push(`${plural(scenes.length, "escena", "escenas")} · ${plural(pageCount, "página", "páginas")}`);
  if (template === "three") parts.push(`${done} de ${KEY_MOMENTS.length} momentos`);
  if (current) {
    const behind = template === "three" ? momentBehind(placed, scenes, currentSid) : null;
    parts.push(`estás en la escena ${current.number}${behind ? `, «${behind.moment.plain}»` : ""}`);
  }
  return parts;
}

const romanOf = (label: string) => label.replace(/^Acto\s+/i, "");

// Tramos de acto sobre la línea: solo los marcados (en la página, «ACTO II»).
function actSegments(model: StoryModel, boxes: BlockBox[], width: number) {
  const { scenes, maps, template } = model;
  const acts = maps.acts.toJSON() as Record<string, string>;
  const starts = scenes.map((s, i) => ({ i, label: acts[s.sid] })).filter((x) => x.label);
  if (!starts.length) return [];
  if (starts[0].i !== 0 && template !== "free") starts.unshift({ i: 0, label: "Acto I" });
  const end = boxes.length ? boxes[boxes.length - 1].left + boxes[boxes.length - 1].width : width;
  return starts.map((s, k) => {
    const left = boxes[s.i]?.left ?? 0;
    const right = k + 1 < starts.length ? (boxes[starts[k + 1].i]?.left ?? end) - 2 : end;
    return { left, width: Math.max(0, right - left), roman: romanOf(s.label), plain: template === "three" ? ACT_PLAIN[s.label] : undefined };
  });
}

// ------------------------------------------------------------------ escritorio

function DesktopBar({
  model,
  production,
  prefs,
  setPrefs,
  notice,
}: {
  model: StoryModel;
  production: ScreenplayProduction | null;
  prefs: Prefs;
  setPrefs: (p: Partial<Prefs>) => void;
  notice: React.ReactNode;
}) {
  const { scenes, template, openRail, linkedProject } = model;
  const [open, setOpen] = useState<{ id: MomentId; x: number; writing?: boolean } | null>(null);
  const empty = scenes.length === 0;
  const view: View = prefs.view;
  const [sectionRef, secWidthPx, sectionEl] = useWidth<HTMLElement>();
  const popRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  const openMoment = useCallback((id: MomentId, anchor: HTMLElement, writing = false) => {
    const sec = sectionEl?.getBoundingClientRect();
    const r = anchor.getBoundingClientRect();
    returnTo.current = anchor;
    setOpen((cur) => (cur?.id === id && !writing ? null : { id, x: r.left + r.width / 2 - (sec?.left ?? 0), writing }));
  }, [sectionEl]);
  const close = useCallback((restore = true) => {
    setOpen(null);
    if (restore) returnTo.current?.focus();
  }, []);

  // Esc o un clic fuera cierran la tarjeta.
  useEffect(() => {
    if (!open) return;
    popRef.current?.focus();
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (popRef.current?.contains(t) || (t instanceof Element && t.closest("[data-moment]"))) return;
      close(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
    // Solo al abrir otra tarjeta, no en cada cambio de posición.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open?.id, close]);

  const parts = summaryParts(model);
  const placedOpen = open ? model.placed.find((p) => p.moment.id === open.id) : null;
  const secWidth = secWidthPx || 800;
  const popW = Math.min(400, secWidth - 16);
  const popLeft = open ? Math.max(8, Math.min(open.x - popW / 2, secWidth - popW - 8)) : 0;

  return (
    <section
      ref={sectionRef}
      aria-label="Tu historia"
      className="sticky bottom-0 z-20 mt-2 rounded-t-xl border border-b-0 border-[var(--line)] bg-white/[0.97] px-5 pt-2.5 pb-3 shadow-[0_-14px_30px_-26px_rgba(0,0,0,0.4)] backdrop-blur"
    >
      {notice}
      {placedOpen && (
        <div
          ref={popRef}
          role="dialog"
          aria-label={`${placedOpen.moment.plain} (${placedOpen.moment.technical})`}
          tabIndex={-1}
          className="absolute bottom-full z-30 mb-2.5 rounded-xl bg-white p-4 shadow-[0_0_0_1px_var(--line),0_18px_40px_-16px_rgba(0,0,0,0.35)] outline-none"
          style={{ left: popLeft, width: popW }}
        >
          <MomentCard key={placedOpen.moment.id + String(open?.writing)} item={placedOpen} model={model} onDone={() => close(false)} initialWriting={open?.writing} />
          <span
            aria-hidden
            className="absolute -bottom-[7px] h-3.5 w-3.5 rotate-45 bg-white shadow-[3px_3px_4px_-2px_rgba(0,0,0,0.12)]"
            style={{ left: Math.max(14, Math.min((open?.x ?? 0) - popLeft - 7, popW - 28)) }}
          />
        </div>
      )}

      {/* Cabecera: qué es y dónde estás; a la derecha, la vista y plegar. */}
      <div className="flex min-h-7 items-center gap-3 text-[12.5px]">
        <h2 className="shrink-0 font-semibold">{empty && template === "three" && view === "historia" ? "Así suele moverse una historia" : view === "rodaje" ? "Rodaje" : "Tu historia"}</h2>
        <p className="min-w-0 truncate text-muted">
          {view === "rodaje"
            ? `· color = interior/exterior · día/noche (como el plan de rodaje)${production ? " · círculo = desglose, planos, día asignado, rodada" : ""}`
            : empty
              ? template === "three"
                ? "· Aún no has escrito escenas. No hace falta ir en orden: toca un momento y apunta lo que ya sepas."
                : "· Aún no has escrito escenas."
              : `· ${parts.join(" · ")}`}
        </p>
        <div className="ml-auto flex shrink-0 items-center gap-3">
          {!empty && <ViewSwitch view={view} setView={(v) => (setPrefs({ view: v }), setOpen(null))} />}
          {view === "historia" && template === "three" && !empty && <TargetEditor model={model} />}
          {view === "rodaje" && linkedProject ? (
            <Link href={`/app/${linkedProject.id}`} className="text-[12.5px] text-[var(--accent)] hover:underline">
              Abrir el proyecto
            </Link>
          ) : (
            <button type="button" onClick={() => openRail("estructura")} className="text-[12.5px] text-[var(--accent)] hover:underline">
              Ver estructura
            </button>
          )}
          <button
            type="button"
            onClick={() => (setPrefs({ collapsed: !prefs.collapsed }), setOpen(null))}
            aria-expanded={!prefs.collapsed}
            aria-label={prefs.collapsed ? "Mostrar la barra" : "Ocultar la barra"}
            title={prefs.collapsed ? "Mostrar" : "Ocultar"}
            className="grid h-6 w-6 place-items-center rounded text-muted hover:bg-black/[0.04] hover:text-fg"
          >
            <span aria-hidden className={`inline-block text-[11px] transition-transform ${prefs.collapsed ? "rotate-180" : ""}`}>
              ⌄
            </span>
          </button>
        </div>
      </div>

      {!prefs.collapsed &&
        (view === "rodaje" ? (
          <RodajeTrack model={model} production={production} />
        ) : empty ? (
          template === "three" ? (
            <EmptyPath model={model} onOpen={openMoment} openId={open?.id ?? null} />
          ) : null
        ) : (
          <HistoryTrack model={model} onOpen={openMoment} openId={open?.id ?? null} />
        ))}
    </section>
  );
}

// «¿Cuánto durará? ~12 pág. ✎»: la duración prevista, editable.
function TargetEditor({ model }: { model: StoryModel }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  if (!editing)
    return (
      <button
        type="button"
        onClick={() => (setDraft(String(model.target)), setEditing(true))}
        title="La duración que esperas. La línea se mide con ella para que los momentos queden donde tocan."
        className="hidden text-[12.5px] text-[var(--accent)] hover:underline lg:inline"
      >
        ¿Cuánto durará? ~{model.target} pág. ✎
      </button>
    );
  const save = () => {
    const n = Number(draft);
    model.setTarget(Number.isFinite(n) && n >= 1 ? Math.min(240, n) : null);
    setEditing(false);
  };
  return (
    <form
      className="flex items-center gap-1.5 text-[12.5px]"
      onSubmit={(e) => {
        e.preventDefault();
        save();
      }}
    >
      <label htmlFor="sp-target" className="text-muted">
        Durará unas
      </label>
      <input
        id="sp-target"
        autoFocus
        type="number"
        min={1}
        max={240}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => e.key === "Escape" && setEditing(false)}
        className="w-14 rounded border border-[var(--line)] px-1.5 py-0.5 text-right outline-none focus:border-[var(--accent)]"
      />
      <span className="text-muted">páginas</span>
    </form>
  );
}

const ROW_H = 24;

function HistoryTrack({
  model,
  onOpen,
  openId,
}: {
  model: StoryModel;
  onOpen: (id: MomentId, anchor: HTMLElement) => void;
  openId: MomentId | null;
}) {
  const { scenes, timeline, placed, template, currentSid, goToScene, pageCount, target } = model;
  const [trackRef, width] = useWidth<HTMLDivElement>();
  const units = useMemo(() => [...scenes.map(sceneUnits), ...(timeline.todo > 0 ? [timeline.todo] : [])], [scenes, timeline.todo]);
  const { boxes, continuous } = useMemo(() => layoutBlocks(units, width, { gap: 2, min: 4 }), [units, width]);
  const sceneBoxes = boxes.slice(0, scenes.length);
  const todoBox = timeline.todo > 0 ? boxes[scenes.length] : null;
  const indexOf = useMemo(() => new Map(scenes.map((s, i) => [s.sid, i])), [scenes]);
  const showMoments = template === "three";
  const wide = width >= 900;

  // Dónde apunta cada momento: el centro de SU escena, o su sitio orientativo.
  const marks = useMemo(
    () =>
      placed.map((p) => {
        const i = p.sid ? indexOf.get(p.sid) : undefined;
        const box = i !== undefined ? sceneBoxes[i] : undefined;
        return { p, x: box ? box.left + box.width / 2 : p.at * width };
      }),
    [indexOf, placed, sceneBoxes, width],
  );

  // Las etiquetas se miden en píxeles y se reparten en filas sin pisarse.
  // Primero se estima el ancho con la fuente; en cuanto se pintan, se usa el
  // ancho real de cada etiqueta.
  const labelRefs = useRef(new Map<string, HTMLButtonElement>());
  const [measured, setMeasured] = useState<Record<string, number>>({});
  useLayoutEffect(() => {
    const read = () =>
      setMeasured((prev) => {
        const next: Record<string, number> = {};
        labelRefs.current.forEach((el, id) => (next[id] = el.offsetWidth));
        const same = Object.keys(next).length === Object.keys(prev).length && Object.entries(next).every(([k, v]) => prev[k] === v);
        return same ? prev : next;
      });
    const ro = new ResizeObserver(read);
    labelRefs.current.forEach((el) => ro.observe(el));
    return () => ro.disconnect();
  }, [placed, wide]);
  const rows = useMemo(() => {
    const boxes = marks.map(({ p }) => {
      const real = measured[p.moment.id];
      if (real) return real;
      const small = `${wide && !p.moment.auto ? `· ${p.moment.technical} ` : ""}${p.placed && p.scene ? `esc. ${p.scene.number}` : "sin marcar"}`;
      // texto + letra pequeña + relleno (12 px) + huecos (4 px) + borde
      return Math.ceil(textWidth(p.moment.plain, 600, 12) + textWidth(small, 400, 10.5) + 24);
    });
    return assignRows(
      marks.map((m, i) => ({ x: m.x, w: boxes[i] })),
      width,
      { gap: 8, maxRows: 3 },
    );
  }, [marks, measured, wide, width]);
  const rowCount = showMoments ? Math.max(1, ...rows.map((r) => r.row + 1)) : 0;

  // ←/→ pasan de un momento a otro.
  const onLabelKey = (e: ReactKeyboardEvent<HTMLButtonElement>, k: number) => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    e.preventDefault();
    const order = marks.map((m, i) => ({ i, x: m.x })).sort((a, b) => a.x - b.x);
    const pos = order.findIndex((o) => o.i === k);
    const next = order[pos + (e.key === "ArrowRight" ? 1 : -1)];
    if (next) labelRefs.current.get(marks[next.i].p.moment.id)?.focus();
  };

  // Números en los bloques solo si caben en casi todos (con 40 escenas, no:
  // salen al pasar el ratón).
  const numbers = scenes.length * 20 <= width;
  const curIndex = currentSid ? indexOf.get(currentSid) : undefined;
  const curBox = curIndex !== undefined ? sceneBoxes[curIndex] : undefined;
  const acts = actSegments(model, sceneBoxes, width);
  const todoPages = Math.max(1, target - pageCount);

  return (
    <div className="mt-1">
      {/* Momentos, encima de la línea */}
      {showMoments && (
        <div className="relative" style={{ height: rowCount * ROW_H + 8 }} aria-label="Momentos de la historia" role="group">
          {marks.map(({ p, x }, k) => {
            const r = rows[k] ?? { left: 0, row: 0 };
            const top = (rowCount - 1 - r.row) * ROW_H;
            const on = openId === p.moment.id;
            const scene = p.scene;
            return (
              <span key={p.moment.id}>
                {/* palito hasta la escena (o, sin marcar, que no llega a ninguna) */}
                <span
                  aria-hidden
                  className={`absolute w-px ${p.placed ? "bg-[var(--accent)]" : "bg-[repeating-linear-gradient(#bdbac8_0_2px,transparent_2px_4px)]"}`}
                  style={{ left: x, top: top + 20, height: r.row * ROW_H + (p.placed ? 8 : 4) }}
                />
                <button
                  ref={(el) => {
                    if (el) labelRefs.current.set(p.moment.id, el);
                    else labelRefs.current.delete(p.moment.id);
                  }}
                  type="button"
                  data-moment={p.moment.id}
                  aria-expanded={on}
                  aria-haspopup="dialog"
                  aria-label={`${p.moment.plain} (${p.moment.technical}): ${p.placed && scene ? `escena ${scene.number}` : "sin marcar"}. Abrir explicación`}
                  onClick={(e) => onOpen(p.moment.id, e.currentTarget)}
                  onKeyDown={(e) => onLabelKey(e, k)}
                  className={`absolute flex h-5 items-center gap-1 rounded-[5px] px-1.5 text-[12px] leading-none whitespace-nowrap transition-colors ${
                    on
                      ? "bg-[var(--accent)] font-semibold text-white"
                      : p.placed
                        ? "bg-[#efeaf9] font-semibold text-[#3d2f80] hover:bg-[#e4dcf6]"
                        : "border border-dashed border-[#c8c6d2] bg-white font-medium text-muted hover:border-[#9b96a8] hover:text-fg"
                  }`}
                  style={{ left: r.left, top, visibility: width ? "visible" : "hidden" }}
                >
                  {p.moment.plain}
                  {wide && !p.moment.auto && <small className={`text-[10.5px] font-normal ${on ? "text-white/75" : "text-muted"}`}>· {p.moment.technical}</small>}
                  <small className={`text-[10.5px] font-normal ${on ? "text-white/75" : p.placed ? "text-[#6a5fa0]" : "text-[#9a98a2]"}`}>
                    {p.placed && scene ? `esc. ${scene.number}` : "sin marcar"}
                  </small>
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* La línea: un bloque por escena, ancho = lo que dura. */}
      <div ref={trackRef} className="relative h-4" role="group" aria-label="Escenas">
        {curBox && (
          <span aria-hidden className="absolute -top-[9px] -translate-x-1/2 text-[9px] leading-none text-[var(--accent)]" style={{ left: curBox.left + curBox.width / 2 }}>
            ▼
          </span>
        )}
        {scenes.map((s, i) => {
          const box = sceneBoxes[i];
          if (!box) return null;
          const on = s.sid === currentSid;
          return (
            <button
              key={s.sid}
              type="button"
              tabIndex={on ? 0 : -1}
              onClick={() => goToScene(s.sid)}
              onKeyDown={(e) => {
                if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
                e.preventDefault();
                const next = scenes[i + (e.key === "ArrowRight" ? 1 : -1)];
                if (next) goToScene(next.sid);
              }}
              aria-current={on ? "true" : undefined}
              aria-label={`Escena ${s.number}: ${s.heading || "sin encabezado"}`}
              title={`${s.number}. ${s.heading || "Sin encabezado"} · ${screenTime(s.eighths)} (${formatEighths(s.eighths)} pág.)`}
              className={`absolute top-0 h-4 overflow-hidden text-left transition-colors ${continuous ? "" : "rounded-[3px]"} ${
                on ? "bg-[var(--accent)]" : "bg-[#e4e2dc] hover:bg-[#d6d3cb]"
              }`}
              style={{ left: box.left, width: Math.max(1, box.width) }}
            >
              {numbers && box.width >= 18 && (
                <span className={`absolute top-[2px] left-1 font-mono text-[10px] leading-none font-semibold ${on ? "text-white" : "text-[#6c6c72]"}`}>{s.number}</span>
              )}
            </button>
          );
        })}
        {todoBox && (
          <span
            className="absolute top-0 flex h-4 items-center overflow-hidden rounded-[3px] border-[1.5px] border-dashed border-[#cfcdc6] px-1.5 font-mono text-[10px] whitespace-nowrap text-[#9a98a2]"
            style={{ left: todoBox.left, width: todoBox.width }}
            title="Lo que falta hasta la duración prevista"
          >
            {todoBox.width >= 130 ? `por escribir · ~${todoPages} pág.` : todoBox.width >= 30 ? "…" : ""}
          </span>
        )}
      </div>

      {/* Actos, debajo (solo los marcados). */}
      {acts.length > 0 && (
        <div className="relative mt-1 h-4 text-[11px] text-muted">
          {acts.map((a, k) => (
            <span key={k} className="absolute top-0 truncate border-t-2 border-[#a08fd0] pt-0.5 whitespace-nowrap" style={{ left: a.left, width: a.width }}>
              <b className="font-semibold text-[#5a46a8]">{a.roman}</b>
              {a.plain && ` ${a.plain}`}
            </span>
          ))}
        </div>
      )}
      {template !== "three" && (
        <p className="mt-1.5 text-[11.5px] text-muted">
          {template === "five" ? "Estructura en 5 actos: " : "Estructura libre: "}
          los momentos («Algo cambia», «El gran final»…) son de la estructura en 3 actos y aquí no se marcan.
        </p>
      )}
    </div>
  );
}

function RodajeTrack({ model, production }: { model: StoryModel; production: ScreenplayProduction | null }) {
  const { scenes, currentSid, goToScene, linkedProject } = model;
  const [ref, width] = useWidth<HTMLDivElement>();
  const units = useMemo(() => scenes.map(sceneUnits), [scenes]);
  const { boxes, continuous } = useMemo(() => layoutBlocks(units, width, { gap: 2, min: 4 }), [units, width]);
  const cur = scenes.findIndex((s) => s.sid === currentSid);
  const curBox = cur >= 0 ? boxes[cur] : undefined;
  return (
    <div className="mt-3">
      <div ref={ref} className="relative h-4" role="group" aria-label="Escenas para el rodaje">
        {curBox && (
          <span aria-hidden className="absolute -top-[9px] -translate-x-1/2 text-[9px] leading-none text-[var(--accent)]" style={{ left: curBox.left + curBox.width / 2 }}>
            ▼
          </span>
        )}
        {scenes.map((s, i) => {
          const box = boxes[i];
          if (!box) return null;
          const on = s.sid === currentSid;
          const prod = production?.scenes[s.sid];
          return (
            <button
              key={s.sid}
              type="button"
              tabIndex={on ? 0 : -1}
              onClick={() => goToScene(s.sid)}
              aria-current={on ? "true" : undefined}
              aria-label={`Escena ${s.number}: ${s.heading || "sin encabezado"}`}
              title={`${s.number}. ${s.heading || "Sin encabezado"} · ${screenTime(s.eighths)}`}
              className={`absolute top-0 h-4 overflow-hidden ${continuous ? "" : "rounded-[3px]"} ${on ? "ring-2 ring-[var(--accent)] ring-offset-1" : ""}`}
              style={{ left: box.left, width: Math.max(1, box.width), background: stripColorOf(s) }}
            >
              {box.width >= 18 && <span className="absolute top-[2px] left-1 font-mono text-[10px] leading-none font-semibold text-[#3a3a40]">{s.number}</span>}
              {prod && box.width >= 32 && <SceneProgress status={prod.status} size={11} className="absolute top-[2.5px] right-1 text-[#3a3a40]" />}
            </button>
          );
        })}
      </div>
      {!linkedProject && <p className="mt-2 text-[11.5px] text-muted">Vincula un proyecto (en Ajustes del guion) para ver lo preparado para el rodaje.</p>}
    </div>
  );
}

// Guion vacío: el camino de los 6 momentos, cada uno con su pregunta.
function EmptyPath({
  model,
  onOpen,
  openId,
}: {
  model: StoryModel;
  onOpen: (id: MomentId, anchor: HTMLElement, writing?: boolean) => void;
  openId: MomentId | null;
}) {
  const { editor, ideasByMoment } = model;
  return (
    <ol className="mt-2 grid grid-cols-6 gap-2" aria-label="Los momentos de una historia">
      {MOMENTS.map((m, i) => {
        const ideas = ideasByMoment.get(m.id) ?? 0;
        return (
          <li
            key={m.id}
            className={`relative flex flex-col rounded-[10px] border border-dashed px-3 py-2.5 transition-colors ${
              openId === m.id ? "border-[var(--accent)] bg-[#f6f4fb]" : "border-[#cfcdc6] hover:border-[#9b96a8]"
            }`}
          >
            {i > 0 && (
              <span aria-hidden className="absolute top-1/2 -left-[7px] -translate-y-1/2 text-[11px] text-[#b9b6c6]">
                ›
              </span>
            )}
            <button
              type="button"
              data-moment={m.id}
              aria-haspopup="dialog"
              aria-expanded={openId === m.id}
              onClick={(e) => onOpen(m.id, e.currentTarget)}
              className="text-left"
            >
              <span className="block text-[13px] font-semibold">{m.plain}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-muted">{m.question}</span>
            </button>
            <span className="mt-auto flex items-center gap-2 pt-1.5 text-[12px]">
              {m.auto ? (
                <button type="button" onClick={() => editor?.chain().focus("start").run()} className="text-[var(--accent)] hover:underline">
                  Escribir esta escena →
                </button>
              ) : (
                <button
                  type="button"
                  data-moment={m.id}
                  onClick={(e) => onOpen(m.id, e.currentTarget.closest("li") ?? e.currentTarget, true)}
                  className="text-[var(--accent)] hover:underline"
                >
                  Apuntar idea
                </button>
              )}
              {ideas > 0 && <span className="text-muted">· {plural(ideas, "idea", "ideas")}</span>}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

// ------------------------------------------------------------------ móvil

function MobileBar({
  model,
  production,
  view,
  setView,
  notice,
}: {
  model: StoryModel;
  production: ScreenplayProduction | null;
  view: View;
  setView: (v: View) => void;
  notice: React.ReactNode;
}) {
  const { scenes, placed, current, currentSid, template } = model;
  const [sheet, setSheet] = useState(false);
  const [ref, width] = useWidth<HTMLDivElement>();
  const units = useMemo(() => scenes.map(sceneUnits), [scenes]);
  const { boxes } = useMemo(() => layoutBlocks(units, width, { gap: 2, min: 2 }), [units, width]);
  const indexOf = new Map(scenes.map((s, i) => [s.sid, i]));
  const done = placed.filter((p) => !p.moment.auto && p.placed).length;
  const behind = template === "three" ? momentBehind(placed, scenes, currentSid) : null;
  const line =
    scenes.length === 0
      ? template === "three"
        ? `${done} de ${KEY_MOMENTS.length} · Empieza aquí`
        : "Aún no hay escenas"
      : [current ? `esc. ${current.number}` : plural(scenes.length, "escena", "escenas"), behind?.moment.plain].filter(Boolean).join(" · ");

  return (
    <>
      <section aria-label="Tu historia" className="sticky bottom-0 z-20 -mx-4 border-t border-[var(--line)] bg-white px-3.5 pt-2 pb-[max(10px,env(safe-area-inset-bottom))]">
        {notice}
        <button type="button" onClick={() => setSheet(true)} aria-haspopup="dialog" aria-expanded={sheet} className="block w-full text-left">
          <span className="flex items-center gap-2 text-[12.5px]">
            <b className="font-semibold">Tu historia</b>
            <span className="min-w-0 flex-1 truncate text-muted">· {line}</span>
            <span aria-hidden className="text-[11px] text-muted">
              ⌃
            </span>
          </span>
          {scenes.length > 0 && (
            <span ref={ref} className="relative mt-1.5 block h-2.5">
              {scenes.map((s, i) => {
                const b = boxes[i];
                if (!b) return null;
                return (
                  <span
                    key={s.sid}
                    className={`absolute top-0 h-2.5 rounded-[2px] ${s.sid === currentSid ? "bg-[var(--accent)]" : "bg-[#e4e2dc]"}`}
                    style={{ left: b.left, width: Math.max(1, b.width) }}
                  />
                );
              })}
              {/* solo los momentos marcados, sobre su escena */}
              {template === "three" &&
                placed
                  .filter((p) => p.placed && !p.moment.auto && p.sid)
                  .map((p) => {
                    const b = boxes[indexOf.get(p.sid!) ?? -1];
                    return b ? (
                      <span key={p.moment.id} aria-hidden className="absolute -top-[4px] h-[18px] w-[2px] rounded-[1px] bg-[var(--accent)]" style={{ left: b.left + b.width / 2 - 1 }} />
                    ) : null;
                  })}
            </span>
          )}
        </button>
      </section>
      {sheet && <StorySheet model={model} production={production} view={view} setView={setView} onClose={() => setSheet(false)} />}
    </>
  );
}

function StorySheet({
  model,
  production,
  view,
  setView,
  onClose,
}: {
  model: StoryModel;
  production: ScreenplayProduction | null;
  view: View;
  setView: (v: View) => void;
  onClose: () => void;
}) {
  const { scenes, placed, pageCount, openRail, template, currentSid, current, goToScene, mark, totalPages, maps } = model;
  const [expanded, setExpanded] = useState<MomentId | null>(null);
  const [writeFor, setWriteFor] = useState<MomentId | null>(null);
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);
  const meta = maps.scenes.toJSON() as Record<string, { synopsis?: string }>;
  const sub = (p: PlacedMoment) =>
    p.placed && p.scene ? meta[p.scene.sid]?.synopsis || p.scene.firstAction || p.scene.heading || p.moment.what : p.moment.question;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Tu historia">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-[rgba(10,10,12,0.35)]" />
      <div
        ref={panel}
        tabIndex={-1}
        className="absolute inset-x-0 bottom-0 max-h-[86vh] overflow-y-auto rounded-t-[18px] bg-white px-4 pt-2.5 pb-[max(22px,env(safe-area-inset-bottom))] shadow-[0_-20px_50px_-10px_rgba(0,0,0,0.3)] outline-none"
      >
        <div aria-hidden className="mx-auto mb-3 h-1 w-10 rounded-full bg-[#d4d2cc]" />
        <div className="flex items-baseline gap-2">
          <h2 className="text-[17px] font-bold">{view === "rodaje" ? "Rodaje" : "Tu historia"}</h2>
          <span className="text-[12px] text-muted">
            {scenes.length ? `${plural(scenes.length, "escena", "escenas")} · ${pageCount} pág.` : "Así suele moverse una historia"}
          </span>
          <button
            type="button"
            onClick={() => {
              openRail("estructura");
              onClose();
            }}
            className="ml-auto text-[13px] text-[var(--accent)]"
          >
            Estructura →
          </button>
        </div>
        {scenes.length > 0 && (
          <div className="mt-2">
            <ViewSwitch view={view} setView={setView} />
          </div>
        )}

        {view === "rodaje" ? (
          <ol className="mt-3 space-y-1">
            {scenes.map((s) => (
              <SheetSceneRow key={s.sid} s={s} on={s.sid === currentSid} production={production} onGo={() => (goToScene(s.sid), onClose())} />
            ))}
            {!model.linkedProject && <li className="pt-2 text-[12px] text-muted">Vincula un proyecto (en Ajustes del guion) para ver lo preparado para el rodaje.</li>}
          </ol>
        ) : template !== "three" ? (
          <p className="mt-3 text-[13px] text-muted">
            {template === "five" ? "Estructura en 5 actos" : "Estructura libre"}: los momentos son de la estructura en 3 actos y aquí no se marcan. Puedes cambiarla en Estructura.
          </p>
        ) : (
          <ol className="relative mt-3 pl-[26px] before:absolute before:top-2 before:bottom-2 before:left-[9px] before:w-0.5 before:bg-[#e4e2dc]">
            {placed.map((p) => {
              const isHere = p.placed && p.sid === currentSid;
              const open = expanded === p.moment.id;
              return (
                <li key={p.moment.id} className="relative py-2">
                  <span
                    aria-hidden
                    className={`absolute top-[11px] -left-[23px] h-3.5 w-3.5 rounded-full ${
                      isHere
                        ? "border-[3px] border-white bg-white shadow-[0_0_0_2px_var(--accent)]"
                        : p.placed
                          ? "border-[3px] border-white bg-[var(--accent)] shadow-[0_0_0_1px_var(--accent)]"
                          : "border-[1.5px] border-dashed border-[#b9b6c6] bg-white"
                    }`}
                  />
                  <button type="button" onClick={() => (setWriteFor(null), setExpanded(open ? null : p.moment.id))} aria-expanded={open} className="block w-full text-left">
                    <span className="flex items-baseline gap-2">
                      <span className="text-[13.5px] font-semibold">{p.moment.plain}</span>
                      {!p.moment.auto && <small className="text-[11.5px] text-muted">{p.moment.technical}</small>}
                      <span className={`ml-auto shrink-0 font-[family-name:var(--font-courier)] text-[12px] ${p.placed ? "text-[var(--accent)]" : "text-muted"}`}>
                        {p.placed && p.scene ? `esc. ${p.scene.number}${isHere ? " · aquí" : ""}` : scenes.length ? `hacia pág. ${pageAt(p.moment.at, totalPages)}` : ""}
                      </span>
                    </span>
                    {!open && <span className="mt-0.5 line-clamp-2 text-[12px] leading-snug text-muted">{sub(p)}</span>}
                  </button>
                  {!open && !p.placed && (
                    <span className="mt-1 flex gap-3 text-[12.5px]">
                      {p.moment.auto ? (
                        <button
                          type="button"
                          onClick={() => {
                            model.editor?.chain().focus("start").run();
                            onClose();
                          }}
                          className="text-[var(--accent)]"
                        >
                          Escribir esta escena →
                        </button>
                      ) : (
                        current && (
                          <button type="button" onClick={() => mark(p.moment.id, current.sid)} className="text-[var(--accent)]">
                            Marcar esta escena ({current.number})
                          </button>
                        )
                      )}
                      {!p.moment.auto && (
                        <button type="button" onClick={() => (setWriteFor(p.moment.id), setExpanded(p.moment.id))} className="text-[var(--accent)]">
                          Apuntar idea
                        </button>
                      )}
                    </span>
                  )}
                  {open && (
                    <div className="mt-1">
                      <MomentCard item={p} model={model} onDone={onClose} hideTitle initialWriting={writeFor === p.moment.id} />
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}

function SheetSceneRow({ s, on, production, onGo }: { s: SceneInfo; on: boolean; production: ScreenplayProduction | null; onGo: () => void }) {
  const prod = production?.scenes[s.sid];
  return (
    <li>
      <button type="button" onClick={onGo} aria-current={on ? "true" : undefined} className={`flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left ${on ? "bg-[var(--accent)]/10" : ""}`}>
        <span aria-hidden className="h-4 w-1.5 shrink-0 rounded-sm" style={{ background: stripColorOf(s) }} />
        <span className="w-5 shrink-0 text-right font-[family-name:var(--font-courier)] text-[12px] font-bold text-[var(--accent)]">{s.number}</span>
        <span className="min-w-0 flex-1 truncate font-[family-name:var(--font-courier)] text-[12px]">{s.heading || "Sin encabezado"}</span>
        {prod && <SceneProgress status={prod.status} size={14} />}
      </button>
    </li>
  );
}
