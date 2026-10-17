"use client";

import { useEffect, useState } from "react";
import { BLOCK_EXAMPLES, BLOCK_LABELS, BLOCK_TECH, BLOCK_TYPES, shortcutLabel } from "@/lib/screenplay/blocks";
import { Modal } from "@/components/Modal";
import { Sheet } from "@/components/ui/Sheet";
import { useMediaQuery } from "@/components/ui/use-media-query";
import { openFind } from "@/components/screenplay/FindReplace";
import { setFocusMode } from "@/components/screenplay/FocusMode";

// La hoja de atajos: el botón «?» de la cabecera y Ctrl/⌘ + /. Son los
// atajos reales del editor (lib/screenplay/editor-extensions.ts y la barra).

export const SHORTCUTS_EVENT = "sp:shortcuts";
export const openShortcuts = () => window.dispatchEvent(new Event(SHORTCUTS_EVENT));

const isMac = () => typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);

export type ShortcutRow = { keys: string[]; what: string; example?: string };
export type ShortcutGroup = { title: string; rows: ShortcutRow[] };

// En Mac: ⌘ ⌥ ⇧; en el resto: Ctrl, Alt, Mayús.
export function shortcutGroups(mac: boolean): ShortcutGroup[] {
  const mod = mac ? "⌘" : "Ctrl";
  const shift = mac ? "⇧" : "Mayús";
  const alt = mac ? "⌥" : "Alt";
  const plus = (...k: string[]) => (mac ? k.join("") : k.join("+"));
  return [
    {
      title: "Al escribir",
      rows: [
        { keys: ["Enter"], what: "Línea siguiente, del tipo que suele venir (tras «Quién habla», «Lo que dice»). En una línea vacía, le cambia el tipo." },
        { keys: ["Tab"], what: "Cambia el tipo de la línea: en «Lo que se ve» vacía, pasa a «Quién habla» (para que hable alguien)." },
        { keys: [plus(shift, "Tab")], what: "El camino de vuelta de Tab." },
        { keys: ["Tab", "→"], what: "Acepta la sugerencia (un nombre o un lugar que ya existe)." },
        { keys: ["↑", "↓"], what: "Elige otra sugerencia de la lista." },
        { keys: ["Esc"], what: "Descarta la sugerencia o el aviso. Esc y luego Tab sale del guion con el teclado." },
        { keys: ["("], what: "Al empezar «Lo que dice», abre «Cómo lo dice»." },
      ],
    },
    {
      title: "Tipo de línea",
      rows: BLOCK_TYPES.map((t) => ({ keys: [shortcutLabel(t, mac)], what: BLOCK_TECH[t] === BLOCK_LABELS[t] ? BLOCK_LABELS[t] : `${BLOCK_LABELS[t]} · ${BLOCK_TECH[t].toLowerCase()}`, example: BLOCK_EXAMPLES[t] })),
    },
    {
      title: "Escenas y paneles",
      rows: [
        { keys: [plus(alt, "↑"), plus(alt, "↓")], what: "Sube o baja la escena donde está el cursor." },
        { keys: [plus(mod, ".")], what: "Muestra u oculta el panel junto a la página." },
        { keys: [plus(mod, "Z")], what: "Deshacer." },
        { keys: [plus(mod, shift, "Z")], what: "Rehacer." },
      ],
    },
    {
      title: "Ayudas",
      rows: [
        { keys: [plus(mod, "F")], what: "Buscar en el guion." },
        { keys: [plus(mod, "H")], what: "Buscar y reemplazar (y renombrar un personaje en todo el guion)." },
        { keys: [plus(mod, shift, "F")], what: "Modo foco: solo el papel. Esc para salir." },
        { keys: [plus(mod, "/")], what: "Esta hoja de atajos." },
      ],
    },
  ];
}

// El botón «?» de la cabecera.
export function ShortcutsButton() {
  return (
    <button
      type="button"
      onClick={openShortcuts}
      aria-label="Atajos de teclado y ayudas"
      title={`Atajos de teclado (${isMac() ? "⌘" : "Ctrl"} + /)`}
      className="hidden h-8 w-8 shrink-0 place-items-center rounded-md border border-[var(--line)] text-[14px] sm:grid font-semibold text-muted transition-colors hover:border-[#4a4752] hover:text-fg"
    >
      ?
    </button>
  );
}

function Groups({ mac, onAction }: { mac: boolean; onAction: (a: "find" | "rename" | "focus") => void }) {
  const groups = shortcutGroups(mac);
  return (
    <div className="space-y-6 text-[13.5px]">
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={() => onAction("focus")} className="sp-btn">
          Entrar en modo foco
        </button>
        <button type="button" onClick={() => onAction("find")} className="sp-btn">
          Buscar y reemplazar
        </button>
        <button type="button" onClick={() => onAction("rename")} className="sp-btn">
          Renombrar un personaje
        </button>
      </div>
      {groups.map((g) => (
        <section key={g.title}>
          <h3 className="sp-label">{g.title}</h3>
          <dl className="mt-2 divide-y divide-[var(--line)]">
            {g.rows.map((r) => (
              <div key={r.keys.join() + r.what} className="grid grid-cols-[8.5rem_1fr] gap-3 py-1.5">
                <dt className="flex flex-wrap items-start gap-1">
                  {r.keys.map((k, i) => (
                    <span key={k} className="flex items-center gap-1">
                      {i > 0 && <span className="text-[11px] text-muted">o</span>}
                      <kbd className="sp-kbd !text-[11.5px] !leading-5">{k}</kbd>
                    </span>
                  ))}
                </dt>
                <dd className="leading-snug">
                  {r.what}
                  {r.example && <span className="mt-0.5 block font-[family-name:var(--font-courier)] text-[12px] text-muted">{r.example}</span>}
                </dd>
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function ShortcutsSheet() {
  const [open, setOpen] = useState(false);
  const narrow = useMediaQuery("(max-width: 767px)");
  const [mac, setMac] = useState(false);
  useEffect(() => {
    setMac(isMac()); // eslint-disable-line react-hooks/set-state-in-effect -- solo se sabe en el navegador
    const onOpen = () => setOpen(true);
    const onKey = (e: KeyboardEvent) => {
      // «/» en teclados ingleses; en el español es Mayús+7 (e.key sigue siendo «/»).
      if ((e.ctrlKey || e.metaKey) && !e.altKey && (e.key === "/" || e.code === "Slash")) {
        e.preventDefault();
        setOpen((v) => !v);
      }
    };
    window.addEventListener(SHORTCUTS_EVENT, onOpen);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener(SHORTCUTS_EVENT, onOpen);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  const onAction = (a: "find" | "rename" | "focus") => {
    setOpen(false);
    if (a === "focus") requestAnimationFrame(() => setFocusMode(true));
    else requestAnimationFrame(() => openFind({ mode: a === "find" ? "replace" : "rename" }));
  };

  if (!open) return null;
  const subtitle = "Lo que hace cada tecla en el guion. En el móvil, la barra de encima del teclado hace lo de Tab.";
  if (narrow) {
    return (
      <Sheet title="Atajos y ayudas" subtitle={subtitle} onClose={() => setOpen(false)} height="86vh">
        <Groups mac={mac} onAction={onAction} />
      </Sheet>
    );
  }
  return (
    <Modal open onClose={() => setOpen(false)} title="Atajos y ayudas" description={subtitle} size="lg">
      <div className="mt-4 max-h-[70vh] overflow-y-auto pr-1">
        <Groups mac={mac} onAction={onAction} />
      </div>
    </Modal>
  );
}
