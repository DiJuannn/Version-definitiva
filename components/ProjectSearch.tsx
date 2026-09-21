"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchProject } from "@/lib/actions/search";
import { FESTIVALS } from "@/lib/festivals";
import { HIT_GROUP_LABELS, hitPath, type SearchHit } from "@/lib/search-hits";
import { matchTools, wordsMatch } from "@/lib/tool-search";
import { TOOL_GROUPS } from "@/lib/tool-groups";

type Row = { key: string; group: string; title: string; subtitle?: string | null; href: string };

const CHIP =
  "flex min-h-9 items-center gap-1.5 rounded-full border px-3.5 py-1.5 font-mono text-[11px] tracking-widest uppercase transition active:scale-[0.97] border-line text-muted hover:border-accent/60 hover:text-fg";

// Buscador del proyecto: encuentra herramientas (también por su nombre «del oficio»: «call sheet»),
// escenas, personajes, sitios, tareas, desglose, partidas y festivales. Se abre con el botón «Buscar»,
// con «/» o con Ctrl/⌘+K.
export function ProjectSearch({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  // Los resultados guardan la búsqueda a la que responden: los de la letra anterior no se enseñan (ni se abren con Enter).
  const [found, setFound] = useState<{ q: string; hits: SearchHit[] }>({ q: "", hits: [] });
  const [searching, setSearching] = useState(false);
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const base = `/app/${projectId}`;

  // Atajos de teclado (no se disparan mientras se escribe en otro campo).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      const typing = target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "k" && (e.ctrlKey || e.metaKey)) || (e.key === "/" && !typing && !e.ctrlKey && !e.metaKey)) {
        e.preventDefault();
        setOpen(true);
      } else if (e.key === "Escape") {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  // Contenido del proyecto: tras una pausa al teclear, y descartando respuestas viejas.
  useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const result = await searchProject(projectId, q);
        if (!cancelled) setFound({ q, hits: result });
      } catch {
        if (!cancelled) setFound({ q, hits: [] });
      } finally {
        if (!cancelled) setSearching(false);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, open, projectId]);

  const q = query.trim();
  const rows = useMemo<Row[]>(() => {
    if (q.length < 2) return [];
    const tools = matchTools(
      TOOL_GROUPS.flatMap((g) => g.tools),
      q,
    ).map((t) => ({
      key: `tool-${t.href}`,
      group: "Herramientas",
      title: t.label,
      subtitle: t.description,
      href: t.absolute ? t.href : `${base}/${t.href}`,
    }));
    const festivals = FESTIVALS.filter((f) => wordsMatch(`${f.name} ${f.city} ${f.zone}`, q))
      .slice(0, 4)
      .map((f) => ({
        key: `fest-${f.name}`,
        group: "Festivales",
        title: f.name,
        subtitle: f.city,
        href: `${base}/festivales`,
      }));
    const content = (found.q === q ? found.hits : []).map((h) => ({
      key: `${h.kind}-${h.id}`,
      group: HIT_GROUP_LABELS[h.kind],
      title: h.title,
      subtitle: h.subtitle,
      href: `${base}/${hitPath(h)}`,
    }));
    return [...tools, ...content, ...festivals];
  }, [q, found, base]);
  const waiting = q.length >= 2 && found.q !== q;

  function go(row: Row) {
    setOpen(false);
    router.push(row.href);
  }

  function onInputKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((i) => Math.min(rows.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((i) => Math.max(0, i - 1));
    } else if (e.key === "Enter" && rows[active]) {
      e.preventDefault();
      go(rows[active]);
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
        aria-keyshortcuts="/ Control+K"
        className={CHIP}
      >
        <svg viewBox="0 0 24 24" aria-hidden className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        Buscar
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/70 p-4 pt-[12vh] print:hidden"
          onMouseDown={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div role="dialog" aria-modal="true" aria-label="Buscar en el proyecto" className="w-full max-w-xl border border-accent/50 bg-bg shadow-2xl shadow-black/70">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Busca una herramienta, una escena, un personaje…"
                aria-label="Buscar"
                className="min-w-0 flex-1 bg-transparent py-4 font-sans text-base outline-none placeholder:text-muted"
              />
              <button type="button" onClick={() => setOpen(false)} className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-fg">
                Esc
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto" role="listbox" aria-label="Resultados">
              {q.length < 2 ? (
                <p className="px-4 py-6 font-sans text-sm text-muted">
                  Escribe al menos dos letras. Prueba con «presupuesto», «call sheet», el nombre de un personaje o de un
                  sitio.
                </p>
              ) : rows.length === 0 ? (
                <p className="px-4 py-6 font-sans text-sm text-muted">
                  {searching || waiting ? "Buscando…" : `No encuentro nada para «${q}».`}
                </p>
              ) : (
                rows.map((row, i) => (
                  <div key={row.key}>
                    {(i === 0 || rows[i - 1].group !== row.group) && (
                      <p className="px-4 pt-3 pb-1 font-mono text-[10px] tracking-widest text-accent uppercase">{row.group}</p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(row)}
                      className={`block w-full border-l-2 px-4 py-2.5 text-left transition-colors ${
                        i === active ? "border-accent bg-accent/10" : "border-transparent"
                      }`}
                    >
                      <span className="block font-display text-sm font-bold">{row.title}</span>
                      {row.subtitle && <span className="block truncate font-mono text-xs text-muted">{row.subtitle}</span>}
                    </button>
                  </div>
                ))
              )}
              {waiting && rows.length > 0 && <p className="px-4 py-2 font-mono text-[10px] text-muted">Buscando más…</p>}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
