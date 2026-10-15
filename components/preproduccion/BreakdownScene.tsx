"use client";

import { useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { markElementInScene, setElementInScene } from "@/lib/actions/breakdown";
import { BREAKDOWN_COLUMNS, CATEGORY_COLOR } from "@/components/preproduccion/palette";
import type { SceneText } from "@/lib/scene-text";

type Element = { id: string; name: string; category: string };

const CATEGORIES = BREAKDOWN_COLUMNS.filter((c) => c.key !== "CAST" && c.key !== "EXTRAS");
const LABEL = Object.fromEntries(BREAKDOWN_COLUMNS.map((c) => [c.key, c.label]));

// Minúsculas y sin tildes, letra a letra (mismo largo que el original), para
// encontrar «Cámara» escribiendo «camara» y poder volver a la posición real.
const foldChar = (c: string) => c.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().slice(0, 1) || c;
const fold = (s: string) => Array.from(s, foldChar).join("");
const isWord = (c: string | undefined) => Boolean(c && /[\p{L}\p{N}]/u.test(c));

type Hit = { start: number; end: number; kind: "linked" | "cast" | "suggest"; color: string; element?: Element; title: string };

function findHits(text: string, terms: { term: string; kind: Hit["kind"]; color: string; element?: Element; title: string }[]): Hit[] {
  const folded = fold(text);
  const hits: Hit[] = [];
  // Los nombres largos primero: «chaqueta vaquera» gana a «chaqueta».
  for (const t of [...terms].sort((a, b) => b.term.length - a.term.length)) {
    const needle = fold(t.term.trim());
    if (needle.length < 2) continue;
    let from = 0;
    while (true) {
      const at = folded.indexOf(needle, from);
      if (at === -1) break;
      const end = at + needle.length;
      from = end;
      if (isWord(folded[at - 1]) || isWord(folded[end])) continue;
      if (hits.some((h) => at < h.end && end > h.start)) continue;
      hits.push({ start: at, end, kind: t.kind, color: t.color, element: t.element, title: t.title });
    }
  }
  return hits.sort((a, b) => a.start - b.start);
}

export function BreakdownScene({
  projectId,
  sceneId,
  text,
  cast,
  linked,
  others,
}: {
  projectId: string;
  sceneId: string;
  text: SceneText;
  cast: string[];
  linked: Element[];
  // Elementos del proyecto que aún no están en esta escena.
  others: Element[];
}) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [picker, setPicker] = useState<{ text: string; x: number; y: number } | null>(null);
  const [manual, setManual] = useState({ name: "", category: "PROP" });
  const boxRef = useRef<HTMLDivElement>(null);

  const act = (fn: () => Promise<boolean>) =>
    start(async () => {
      await fn();
      setPicker(null);
      router.refresh();
    });
  const mark = (name: string, category: string) => act(() => markElementInScene(projectId, sceneId, { name, category }));
  const toggle = (el: Element, on: boolean) => act(() => setElementInScene(projectId, sceneId, el.id, on));

  const terms = useMemo(
    () => [
      ...linked.map((el) => ({ term: el.name, kind: "linked" as const, color: CATEGORY_COLOR[el.category as keyof typeof CATEGORY_COLOR], element: el, title: `${LABEL[el.category]} · ya en el desglose` })),
      ...cast.map((name) => ({ term: name, kind: "cast" as const, color: CATEGORY_COLOR.CAST, title: "Reparto" })),
      ...others.map((el) => ({ term: el.name, kind: "suggest" as const, color: CATEGORY_COLOR[el.category as keyof typeof CATEGORY_COLOR], element: el, title: `${LABEL[el.category]} · pulsa para añadirlo a esta escena` })),
    ],
    [linked, cast, others],
  );

  const found = new Map<string, Element>();
  const rendered = text.blocks.map((block, i) => {
    const hits = findHits(block.text, terms);
    const parts: ReactNode[] = [];
    let at = 0;
    for (const h of hits) {
      if (h.start > at) parts.push(block.text.slice(at, h.start));
      const word = block.text.slice(h.start, h.end);
      if (h.kind === "suggest" && h.element) {
        found.set(h.element.id, h.element);
        const el = h.element;
        parts.push(
          <button
            key={`${i}-${h.start}`}
            type="button"
            title={h.title}
            onClick={() => toggle(el, true)}
            className="cursor-pointer underline decoration-2 decoration-dotted underline-offset-4 hover:bg-black/5"
            style={{ textDecorationColor: h.color }}
          >
            {word}
          </button>,
        );
      } else {
        parts.push(
          <mark
            key={`${i}-${h.start}`}
            title={h.title}
            className={`rounded-sm px-0.5 text-inherit ${h.kind === "cast" ? "font-bold" : ""}`}
            style={{ background: `${h.color}55`, boxShadow: `inset 0 -2px 0 ${h.color}` }}
          >
            {word}
          </mark>,
        );
      }
      at = h.end;
    }
    if (at < block.text.length) parts.push(block.text.slice(at));
    const style =
      block.type === "character"
        ? "ml-[37%] uppercase"
        : block.type === "dialogue"
          ? "mx-[17%]"
          : block.type === "parenthetical"
            ? "ml-[28%] mr-[25%]"
            : block.type === "transition"
              ? "text-right uppercase"
              : "";
    return (
      <p key={i} className={`whitespace-pre-wrap ${style} ${block.type === "character" || block.type === "parenthetical" ? "" : "mb-3.5"}`}>
        {parts}
      </p>
    );
  });

  function onMouseUp() {
    const sel = window.getSelection();
    const value = sel?.toString().replace(/\s+/g, " ").trim() ?? "";
    if (!sel || !boxRef.current || value.length < 2 || value.length > 80 || !boxRef.current.contains(sel.anchorNode)) {
      setPicker(null);
      return;
    }
    const rect = sel.getRangeAt(0).getBoundingClientRect();
    const box = boxRef.current.getBoundingClientRect();
    setPicker({ text: value, x: rect.left - box.left + rect.width / 2, y: rect.bottom - box.top + 8 });
  }

  const byCategory = CATEGORIES.map((c) => ({ ...c, items: linked.filter((el) => el.category === c.key) })).filter((g) => g.items.length);
  const suggestions = [...found.values()];

  return (
    <div className={`grid grid-cols-[minmax(0,1fr)] gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] ${pending ? "opacity-70" : ""}`}>
      {/* La escena en papel, como el guion: se selecciona lo que hace falta. */}
      <div ref={boxRef} className="relative" onMouseUp={onMouseUp}>
        <div className="paper px-6 py-8 font-[family-name:var(--font-courier)] text-[15px] leading-[1.55] text-fg sm:px-12">
          {text.blocks.length === 0 ? (
            <p className="font-sans text-sm text-muted">
              Esta escena no tiene texto. Escríbela en el guion (o rellena su acción en la ficha) para desglosarla leyendo.
            </p>
          ) : (
            rendered
          )}
        </div>
        {picker && (
          <div
            role="dialog"
            aria-label={`Marcar «${picker.text}»`}
            className="menu-panel absolute z-30 w-72 -translate-x-1/2"
            style={{ left: picker.x, top: picker.y }}
            onMouseUp={(e) => e.stopPropagation()}
          >
            <p className="truncate px-3 pt-1.5 pb-2 font-sans text-[13px] text-muted">
              Marcar <span className="font-semibold text-fg">«{picker.text}»</span> como…
            </p>
            <div className="grid grid-cols-2 gap-1">
              {CATEGORIES.map((c) => (
                <button key={c.key} type="button" onClick={() => mark(picker.text, c.key)} className="menu-item py-1.5 text-left font-sans text-[13px]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: c.color }} />
                  {c.label}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="mt-3 font-sans text-[13px] text-muted">
          <b className="font-semibold text-fg">Selecciona una palabra</b> del texto para marcarla (atrezzo, vestuario, vehículo…).
          Lo subrayado con puntos ya existe en el proyecto: púlsalo para añadirlo a esta escena.
          {text.source === "ficha" && " Este texto sale del análisis del guion en PDF."}
        </p>
      </div>

      {/* Lo que pide la escena. */}
      <aside className="space-y-8 lg:sticky lg:top-28 lg:self-start">
        <section>
          <h3 className="eyebrow">En esta escena</h3>
          {cast.length > 0 && (
            <p className="mt-3 flex flex-wrap items-center gap-1.5 font-sans text-[13px]">
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLOR.CAST }} />
              <span className="text-muted">Reparto:</span> {cast.join(", ")}
            </p>
          )}
          {byCategory.length === 0 ? (
            <p className="mt-3 font-sans text-sm text-muted">Nada marcado todavía.</p>
          ) : (
            <ul className="mt-3 space-y-4">
              {byCategory.map((g) => (
                <li key={g.key}>
                  <p className="flex items-center gap-2 font-sans text-[13px] font-semibold">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: g.color }} />
                    {g.label}
                  </p>
                  <ul className="mt-1 divide-y divide-line">
                    {g.items.map((el) => (
                      <li key={el.id} className="group flex items-center justify-between gap-2 py-1.5 pl-[18px] font-sans text-sm">
                        {el.name}
                        <button
                          type="button"
                          onClick={() => toggle(el, false)}
                          aria-label={`Quitar ${el.name} de esta escena`}
                          className="text-muted opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100"
                        >
                          ×
                        </button>
                      </li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
          )}
        </section>

        {suggestions.length > 0 && (
          <section className="border-t border-line pt-6">
            <h3 className="eyebrow">Aparecen en el texto</h3>
            <ul className="mt-3 space-y-1.5">
              {suggestions.map((el) => (
                <li key={el.id}>
                  <button type="button" onClick={() => toggle(el, true)} className="flex w-full items-center gap-2 text-left font-sans text-sm hover:text-accent">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: CATEGORY_COLOR[el.category as keyof typeof CATEGORY_COLOR] }} />
                    <span className="flex-1">{el.name}</span>
                    <span className="font-mono text-[11px] text-accent">+ añadir</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="border-t border-line pt-6">
          <h3 className="eyebrow">Algo que no sale en el texto</h3>
          <form
            className="mt-3 space-y-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!manual.name.trim()) return;
              mark(manual.name, manual.category);
              setManual((m) => ({ ...m, name: "" }));
            }}
          >
            <input
              value={manual.name}
              onChange={(e) => setManual((m) => ({ ...m, name: e.target.value }))}
              placeholder="Grúa, lluvia artificial, perro…"
              aria-label="Nombre"
              className="field w-full"
            />
            <div className="flex gap-2">
              <select
                value={manual.category}
                onChange={(e) => setManual((m) => ({ ...m, category: e.target.value }))}
                aria-label="Categoría"
                className="field min-w-0 flex-1"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
              <button type="submit" className="btn btn-primary btn-sm shrink-0" disabled={pending}>
                Añadir
              </button>
            </div>
          </form>
        </section>
      </aside>
    </div>
  );
}
