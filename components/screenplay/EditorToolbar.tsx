"use client";

import { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import type { Editor } from "@tiptap/react";
import { BLOCK_EXAMPLES, BLOCK_HINTS, BLOCK_LABELS, BLOCK_TECH, shortcutLabel, type BlockType } from "@/lib/screenplay/blocks";
import { setLineType, tabCommand } from "@/lib/screenplay/editor-extensions";
import { TextSelection } from "@tiptap/pm/state";
import type { SceneInfo } from "@/lib/screenplay/story";
import { PopoverPanel, usePopover } from "@/components/ui/Popover";
import {
  KEYBAR,
  LINE_MENU,
  PANELS,
  doubtsLabel,
  keybarAction,
  keyboardInset,
  lineKeyHints,
  shiftTabHint,
  type ExportItem,
  type PanelId,
  type SaveTone,
} from "@/components/screenplay/editor-chrome";

// Piezas de la barra del guion: paneles, escenas, tipo de línea, pistas de
// teclado, exportar, estado de guardado y la barra encima del teclado del
// móvil. ScreenplayEditor las coloca; aquí solo se pintan.

// ------------------------------------------------------------ paneles

export function PanelTabs({ panel, onToggle, mod }: { panel: PanelId | null; onToggle: (id: PanelId) => void; mod: string }) {
  const base = useId();
  return (
    <div role="group" aria-label="Paneles junto a la página" className="inline-flex rounded-md border border-[var(--line)] bg-white text-[13px]">
      {PANELS.map((p, i) => (
        <span key={p.id} className="group relative">
          <button
            type="button"
            aria-pressed={panel === p.id}
            aria-describedby={`${base}-${p.id}`}
            onClick={() => onToggle(p.id)}
            className={`block px-2.5 py-1 whitespace-nowrap transition-colors ${i ? "border-l border-[var(--line)]" : "rounded-l-md"} ${
              i === PANELS.length - 1 ? "rounded-r-md" : ""
            } ${panel === p.id ? "bg-[#1c1b19] text-white" : "text-muted hover:text-fg"}`}
          >
            {p.label}
          </button>
          {/* Descripción de una línea: al pasar el ratón o con el foco del teclado. */}
          <span
            role="tooltip"
            id={`${base}-${p.id}`}
            className="sp-tip pointer-events-none absolute top-full left-0 z-50 mt-2 w-64 rounded-md bg-[#1c1b19] px-3 py-2 text-[12px] leading-snug text-white opacity-0 shadow-lg group-hover:opacity-100 group-has-[:focus-visible]:opacity-100"
          >
            {p.description}
            <span className="mt-1 block text-[11px] text-white/60">{panel === p.id ? `Pulsa otra vez para cerrarlo · ${mod} + .` : `Mostrar u ocultar el panel: ${mod} + .`}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

// En el móvil los cuatro paneles van en un menú «···» con su explicación a la
// vista (en táctil no hay ratón para los tooltips).
export function PanelsMenu({ panel, onToggle, onSettings }: { panel: PanelId | null; onToggle: (id: PanelId) => void; onSettings: () => void }) {
  const pop = usePopover();
  return (
    <div className="relative">
      <button
        type="button"
        {...pop.triggerProps}
        aria-haspopup="menu"
        aria-label="Paneles y ajustes"
        className={`grid h-8 w-9 place-items-center rounded-md border text-[15px] leading-none ${
          panel ? "border-[#1c1b19] bg-[#1c1b19] text-white" : "border-[var(--line)] bg-white text-fg"
        }`}
      >
        ···
      </button>
      <PopoverPanel open={pop.open} panelRef={pop.panelRef} id={pop.id} label="Paneles" align="right" className="w-[min(20rem,calc(100vw-2rem))]">
        {PANELS.map((p) => (
          <button
            key={p.id}
            type="button"
            role="menuitemcheckbox"
            aria-checked={panel === p.id}
            onClick={() => {
              pop.close();
              onToggle(p.id);
            }}
            className="sp-pop-item flex w-full items-start gap-2.5 text-left"
          >
            <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${panel === p.id ? "bg-[var(--accent)]" : "bg-[#d9d8d3]"}`} />
            <span>
              <span className="block text-[14px] font-semibold">{p.label}</span>
              <span className="block text-[12.5px] leading-snug text-muted">{p.description}</span>
            </span>
          </button>
        ))}
        <div className="my-1 border-t border-[var(--line)]" />
        <button
          type="button"
          role="menuitem"
          onClick={() => {
            pop.close();
            onSettings();
          }}
          className="sp-pop-item block w-full text-left text-[13.5px]"
        >
          Ajustes del guion <span className="text-muted">· título, formato, proyecto</span>
        </button>
      </PopoverPanel>
    </div>
  );
}

// ------------------------------------------------------------ escenas

export function SceneMenu({
  scenes,
  currentSid,
  doubtScenes,
  sceneRefs,
  onGo,
  compact,
}: {
  scenes: SceneInfo[];
  currentSid: string | null;
  doubtScenes: Set<string | null>;
  sceneRefs: Map<string, number>;
  onGo: (sid: string) => void;
  compact: boolean;
}) {
  const pop = usePopover();
  const current = scenes.find((s) => s.sid === currentSid);
  const doubts = doubtScenes.size;
  const label = scenes.length === 0 ? "Sin escenas" : `Escena ${current?.number ?? "—"} de ${scenes.length}`;
  return (
    <div className="relative">
      <button
        type="button"
        {...pop.triggerProps}
        aria-haspopup="menu"
        aria-label={doubts ? `${label} · ${doubtsLabel(doubts)}` : label}
        className="flex h-8 items-center gap-2 rounded-md border border-[var(--line)] bg-white px-2.5 text-[13px] whitespace-nowrap hover:border-[var(--accent)]"
      >
        {scenes.length === 0 ? (
          "Sin escenas"
        ) : compact ? (
          <span className="font-semibold">
            Esc. {current?.number ?? "—"}
            <span className="font-normal text-muted">/{scenes.length}</span>
          </span>
        ) : (
          <>
            <span className="font-semibold">Escena {current?.number ?? "—"}</span>
            <span className="text-muted">de {scenes.length}</span>
          </>
        )}
        {doubts > 0 && (
          <span className="flex items-center gap-1 text-[12px] text-[var(--ai)]">
            <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-[var(--ai)]" />
            {!compact && <span>{doubts} con dudas</span>}
          </span>
        )}
        <span aria-hidden className="text-[10px] text-muted">
          ▾
        </span>
      </button>
      <PopoverPanel open={pop.open} panelRef={pop.panelRef} id={pop.id} label="Escenas" className="w-[22rem] max-w-[calc(100vw-2rem)]">
        {scenes.length === 0 ? (
          <p className="p-3 text-[13px] leading-relaxed text-muted">
            Aún no hay escenas. Cada escena empieza con <b className="text-fg">Lugar y hora</b>: escribe «int.» (dentro) o «ext.» (fuera) al principio de una línea.
          </p>
        ) : (
          <>
            <ol className="max-h-[60vh] overflow-y-auto">
              {scenes.map((s) => (
                <li key={s.sid}>
                  <button
                    type="button"
                    role="menuitemradio"
                    aria-checked={s.sid === currentSid}
                    onClick={() => {
                      pop.close();
                      onGo(s.sid);
                    }}
                    className={`sp-pop-item flex w-full gap-2 text-left text-[12.5px] leading-snug ${s.sid === currentSid ? "bg-[var(--accent)]/10 text-fg" : "text-muted"}`}
                  >
                    <span className="w-5 shrink-0 text-right font-[family-name:var(--font-courier)] font-bold text-[var(--accent)]">{s.number}</span>
                    <span className="line-clamp-2 flex-1 font-[family-name:var(--font-courier)]">{s.heading || "Sin lugar ni hora"}</span>
                    {doubtScenes.has(s.sid) && (
                      <span className="mt-px shrink-0 rounded-full bg-[var(--ai)]/10 px-1.5 text-[11px] text-[var(--ai)]">dudas</span>
                    )}
                    {sceneRefs.get(s.sid) ? (
                      <span className="mt-px shrink-0 rounded-full bg-[var(--accent)]/10 px-1.5 text-[11px] text-[var(--accent)]">
                        {sceneRefs.get(s.sid)} ref.
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ol>
            {(doubts > 0 || sceneRefs.size > 0) && (
              <p className="mt-1 border-t border-[var(--line)] px-2.5 pt-2 pb-1 text-[11.5px] leading-snug text-muted">
                {doubts > 0 && <>«dudas»: lo que señaló el Asistente al revisar (lo ves en Esta escena). </>}
                {sceneRefs.size > 0 && <>«ref.»: referencias guardadas.</>}
              </p>
            )}
          </>
        )}
      </PopoverPanel>
    </div>
  );
}

// ------------------------------------------------------------ tipo de línea

export function LineTypeMenu({ editor, type, mac, compact }: { editor: Editor | null; type: BlockType | null; mac: boolean; compact: boolean }) {
  const pop = usePopover();
  const choose = (t: BlockType) => {
    pop.close();
    if (!editor) return;
    editor.view.focus();
    setLineType(editor.view, t);
  };
  return (
    <div className="relative">
      <button
        type="button"
        {...pop.triggerProps}
        aria-haspopup="menu"
        aria-label={`Tipo de línea: ${type ? BLOCK_LABELS[type] : "ninguno"}. Cambiar`}
        disabled={!editor}
        className="flex h-8 max-w-[44vw] items-center gap-1.5 rounded-md border border-[var(--line)] bg-white px-2.5 text-[13px] whitespace-nowrap hover:border-[var(--accent)]"
      >
        <span className="truncate font-semibold">{type ? BLOCK_LABELS[type] : "Tipo de línea"}</span>
        {type && !compact && BLOCK_TECH[type] !== BLOCK_LABELS[type] && <span className="text-[11px] text-muted">{BLOCK_TECH[type]}</span>}
        <span aria-hidden className="text-[10px] text-muted">
          ▾
        </span>
      </button>
      <PopoverPanel open={pop.open} panelRef={pop.panelRef} id={pop.id} label="Tipo de línea" className="w-[27rem] max-w-[calc(100vw-1.5rem)]">
        {LINE_MENU.map((g) => (
          <div key={g.title ?? "main"}>
            {g.title && <p className="sp-label mt-1 border-t border-[var(--line)] px-2.5 pt-2.5 pb-1">{g.title}</p>}
            {g.types.map((t) => (
              <button
                key={t}
                type="button"
                role="menuitemradio"
                aria-checked={t === type}
                onClick={() => choose(t)}
                title={BLOCK_HINTS[t]}
                className={`sp-pop-item grid w-full grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-left ${t === type ? "bg-[var(--accent)]/10" : ""}`}
              >
                <span className="min-w-0">
                  <span className="text-[13.5px] font-semibold">{BLOCK_LABELS[t]}</span>
                  {BLOCK_TECH[t] !== BLOCK_LABELS[t] && <span className="ml-1.5 text-[11px] text-muted">{BLOCK_TECH[t]}</span>}
                  <span className="mt-0.5 block truncate font-[family-name:var(--font-courier)] text-[12.5px] text-muted">{BLOCK_EXAMPLES[t]}</span>
                </span>
                <kbd className="sp-kbd hidden self-center sm:inline">{shortcutLabel(t, mac)}</kbd>
              </button>
            ))}
          </div>
        ))}
        {type && <p className="border-t border-[var(--line)] px-2.5 pt-2 pb-1 text-[12px] leading-snug text-muted">{BLOCK_HINTS[type]}.</p>}
      </PopoverPanel>
    </div>
  );
}

// «Enter → Lo que se ve · Tab → Quién habla»
export function KeyHints({ type, empty }: { type: BlockType; empty: boolean }) {
  const hints = lineKeyHints(type, empty);
  const back = shiftTabHint(type);
  const title = [
    ...hints.map((h) =>
      h.key === "Enter"
        ? h.change
          ? `Enter: esta línea vacía pasa a «${h.label}»`
          : `Enter: línea nueva de «${h.label}»`
        : `Tab: esta línea pasa a «${h.label}»`,
    ),
    `Mayús+Tab: vuelve a «${back.label}»`,
  ].join(". ");
  return (
    <span className="flex items-center gap-2 text-[12.5px] whitespace-nowrap text-muted" title={title}>
      {hints.map((h, i) => (
        <span key={h.key} className="flex items-center gap-1">
          {i > 0 && (
            <span aria-hidden className="mr-1 text-[#c9c8c3]">
              ·
            </span>
          )}
          <kbd className="sp-kbd">{h.key}</kbd>
          <span aria-hidden>→</span>
          <span className="text-fg">{h.label}</span>
        </span>
      ))}
    </span>
  );
}

// ------------------------------------------------------------ exportar

export function ExportMenu({ items, onExport }: { items: ExportItem[]; onExport: (item: ExportItem) => void }) {
  const pop = usePopover();
  return (
    <div className="relative">
      <button type="button" {...pop.triggerProps} aria-haspopup="menu" aria-label="Descargar el guion" className="sp-btn h-8 !py-0">
        <span aria-hidden className="sm:hidden">
          ⤓
        </span>
        <span className="hidden sm:inline">Descargar</span>
      </button>
      <PopoverPanel open={pop.open} panelRef={pop.panelRef} id={pop.id} label="Descargar el guion" align="right" className="sp-light w-72 text-fg">
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            onClick={() => {
              pop.close(true);
              onExport(it);
            }}
            className="sp-pop-item block w-full text-left"
          >
            <span className="block text-[13.5px] font-semibold">{it.label}</span>
            <span className="block text-[12px] text-muted">{it.detail}</span>
          </button>
        ))}
      </PopoverPanel>
    </div>
  );
}

// ------------------------------------------------------------ guardado

const TONE_DOT: Record<SaveTone, string> = {
  ok: "bg-[var(--success)]",
  busy: "bg-[var(--muted)] animate-pulse",
  warn: "bg-[var(--warn)]",
  error: "bg-[var(--danger)]",
};

// En pantallas estrechas: un punto de color (verde guardado, gris guardando,
// ámbar sin conexión, rojo error) que al tocarlo dice qué pasa.
export function SaveDot({ label, short, tone, extra }: { label: string; short: string; tone: SaveTone; extra?: string | null }) {
  const pop = usePopover({ focusOnOpen: false });
  return (
    <div className="relative">
      <button type="button" {...pop.triggerProps} aria-haspopup="dialog" aria-label={`Estado: ${short}`} className="flex h-8 items-center gap-1.5 px-1 text-[12.5px] text-muted">
        <span aria-hidden className={`h-2 w-2 rounded-full ${TONE_DOT[tone]}`} />
        <span className="hidden sm:inline">{short}</span>
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {short}
      </span>
      <PopoverPanel open={pop.open} panelRef={pop.panelRef} id={pop.id} role="dialog" label="Estado del guardado" align="right" className="sp-light w-64 p-3 text-[13px] leading-snug text-fg">
        <p className="font-semibold">{short}</p>
        <p className="mt-0.5 text-muted">{label}</p>
        {extra && <p className="mt-1.5 text-muted">{extra}</p>}
      </PopoverPanel>
    </div>
  );
}

// ------------------------------------------------------------ barra del teclado (móvil)

// Encima del teclado del móvil, donde no hay Tab: Lugar · Lo que se ve ·
// Quién habla · (Cómo) · ⇥. No roba el foco al guion (así el teclado no se
// cierra) y marca el tipo de la línea actual.
export function KeyboardBar({ editor, type }: { editor: Editor | null; type: BlockType | null }) {
  const [focused, setFocused] = useState(false);
  const [inset, setInset] = useState(0);

  useEffect(() => {
    if (!editor) return;
    const on = () => setFocused(true);
    const off = () => setFocused(false);
    // eslint-disable-next-line react-hooks/set-state-in-effect -- estado inicial del foco
    setFocused(editor.isFocused);
    editor.on("focus", on);
    editor.on("blur", off);
    return () => {
      editor.off("focus", on);
      editor.off("blur", off);
    };
  }, [editor]);

  useEffect(() => {
    if (!focused) return;
    const vv = window.visualViewport;
    const update = () => setInset(keyboardInset(window.innerHeight, vv ? { height: vv.height, offsetTop: vv.offsetTop } : null));
    update();
    vv?.addEventListener("resize", update);
    vv?.addEventListener("scroll", update);
    return () => {
      vv?.removeEventListener("resize", update);
      vv?.removeEventListener("scroll", update);
    };
  }, [focused]);

  if (!editor || !focused || typeof document === "undefined") return null;

  const apply = (target: BlockType) => {
    const { state } = editor.view;
    const { $from } = state.selection;
    const node = $from.parent;
    const action = keybarAction(node.textContent, type, target);
    if (action === "set") setLineType(editor.view, target);
    else if (action === "insert") {
      // Una línea nueva de ese tipo debajo, en una sola transacción.
      const { schema } = state;
      const after = $from.after();
      const paren = target === "parenthetical";
      const created = schema.nodes[target].create(target === "sceneHeading" ? { sid: null } : null, paren ? schema.text("()") : null);
      const tr = state.tr.insert(after, created);
      tr.setSelection(TextSelection.create(tr.doc, after + (paren ? 2 : 1))).scrollIntoView();
      editor.view.dispatch(tr);
    }
  };

  return createPortal(
    <div className="sp-light">
      <div
        role="toolbar"
        aria-label="Tipo de línea"
        style={{ bottom: inset }}
        className="sp-keybar fixed inset-x-0 z-[45] flex items-stretch gap-1 overflow-x-auto border-t border-[var(--line)] bg-[#f5f5f3]/95 px-1.5 py-1.5 backdrop-blur"
      >
        {KEYBAR.map((k) => (
          <button
            key={k.type}
            type="button"
            aria-pressed={type === k.type}
            onPointerDown={(e) => e.preventDefault()}
            onClick={() => apply(k.type)}
            className={`min-h-10 flex-1 basis-auto rounded-md px-2 text-[13px] font-semibold whitespace-nowrap ${
              type === k.type ? "bg-[#1c1b19] text-white" : "bg-white text-fg shadow-[0_0_0_1px_var(--line)]"
            }`}
          >
            {k.label}
          </button>
        ))}
        <button
          type="button"
          aria-label="Tab: cambiar al siguiente tipo de línea o aceptar la sugerencia"
          onPointerDown={(e) => e.preventDefault()}
          onClick={() => tabCommand(editor.view.state, editor.view.dispatch)}
          className="min-h-10 w-11 shrink-0 rounded-md bg-white text-[16px] text-fg shadow-[0_0_0_1px_var(--line)]"
        >
          ⇥
        </button>
      </div>
    </div>,
    document.body,
  );
}
