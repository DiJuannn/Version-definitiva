"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { searchProject } from "@/lib/actions/search";
import { openScenePeek } from "@/components/ScenePeek";
import { getPaletteContext, type PaletteContext } from "@/lib/actions/palette";
import { FESTIVALS } from "@/lib/festivals";
import { HIT_GROUP_LABELS, hitPath, type SearchHit } from "@/lib/search-hits";
import { matchTools, wordsMatch } from "@/lib/tool-search";
import { TOOL_GROUPS } from "@/lib/tool-groups";

// `peek`: una escena se abre en su ficha rápida, sin salir de donde estás.
type Row = { key: string; group: string; title: string; subtitle?: string | null; href: string; peek?: string };

const fmtDay = (iso: string) =>
  new Date(iso).toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "short", timeZone: "Europe/Madrid" });

// «Lo que toca»: acciones según cómo va el proyecto (la próxima jornada, la
// primera escena sin desglosar o sin planos) y las de siempre.
function paletteActions(base: string, ctx: PaletteContext | null): Row[] {
  const rows: Row[] = [];
  const day = ctx?.nextDay;
  if (day) {
    rows.push({
      key: "a-day",
      group: "Lo que toca",
      title: `Orden de rodaje del día ${day.index}`,
      subtitle: fmtDay(day.date),
      href: `${base}/plan-de-rodaje?dia=${day.id}`,
    });
    rows.push({
      key: "a-sheet",
      group: "Lo que toca",
      title: day.hasSheet ? `Hoja de llamada del día ${day.index}` : `Preparar la hoja de llamada del día ${day.index}`,
      subtitle: day.hasSheet ? "Revisarla o compartirla" : "Todavía no está hecha",
      href: `${base}/call-sheets/${day.id}`,
    });
  }
  const unbroken = ctx?.scenes.find((sc) => !sc.broken);
  if (unbroken)
    rows.push({ key: "a-desg", group: "Lo que toca", title: `Desglosar la escena ${unbroken.number}`, subtitle: unbroken.slug, href: `${base}/desglose?escena=${unbroken.id}` });
  const unplanned = ctx?.scenes.find((sc) => !sc.planned);
  if (unplanned)
    rows.push({ key: "a-plan", group: "Lo que toca", title: `Planificar la escena ${unplanned.number}`, subtitle: unplanned.slug, href: `${base}/shot-list?escena=${unplanned.id}` });
  rows.push(
    { key: "a-tec", group: "Acciones", title: "Imprimir el guion técnico", subtitle: "Planos, encuadre, audio y duración", href: `${base}/shot-list?vista=tecnico` },
    { key: "a-cons", group: "Acciones", title: "Ver lo que hay que conseguir", subtitle: "Todo lo desglosado, por categorías", href: `${base}/desglose?vista=lista` },
    { key: "a-live", group: "Acciones", title: "Día de rodaje en directo", subtitle: "Plan frente al reloj, tomas y qué se cae del día", href: `${base}/plan-de-rodaje/directo` },
    { key: "a-claq", group: "Acciones", title: "Abrir la claqueta", subtitle: "Para apuntar tomas en el rodaje", href: `${base}/claqueta` },
    { key: "a-task", group: "Acciones", title: "Ver las tareas del proyecto", subtitle: "Lo pendiente, por fecha", href: `${base}/tareas` },
  );
  return rows;
}

const CHIP =
  "flex min-h-10 items-center gap-1.5 px-0.5 pb-2.5 pt-1 font-mono text-[11px] tracking-widest uppercase transition-colors text-muted hover:text-fg";

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

  // Al abrir: lo que toca y las escenas (para saltar a una por su número).
  const [ctx, setCtx] = useState<PaletteContext | null>(null);
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    getPaletteContext(projectId)
      .then((c) => !cancelled && setCtx(c))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [open, projectId]);

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
    const actions = paletteActions(base, ctx);
    if (!q) return actions;
    // Un número (o «esc 4») salta a esa escena.
    const num = /^(?:esc(?:ena)?\.?\s*)?(\d+[a-z]?)$/i.exec(q)?.[1]?.toLowerCase();
    const sceneRows: Row[] = num
      ? (ctx?.scenes ?? [])
          .filter((sc) => sc.number.toLowerCase().startsWith(num))
          .sort((a, b) => Number(b.number.toLowerCase() === num) - Number(a.number.toLowerCase() === num))
          .slice(0, 5)
          .map((sc) => ({ key: `n-${sc.id}`, group: "Escenas", title: `Escena ${sc.number}`, subtitle: sc.slug, href: `${base}/guion/${sc.id}`, peek: sc.id }))
      : [];
    if (q.length < 2) return sceneRows;
    const matchingActions = actions.filter((a) => wordsMatch(`${a.title} ${a.subtitle ?? ""}`, q)).map((a) => ({ ...a, group: "Acciones" }));
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
      peek: h.kind === "scene" ? h.id : undefined,
    }));
    return [...sceneRows, ...matchingActions, ...tools, ...content.filter((c) => !sceneRows.some((r) => r.peek === c.peek && c.peek)), ...festivals];
  }, [q, found, base, ctx]);
  const waiting = q.length >= 2 && found.q !== q && !/^(?:esc(?:ena)?\.?\s*)?\d+[a-z]?$/i.test(q);

  function go(row: Row) {
    setOpen(false);
    if (row.peek) openScenePeek(row.peek);
    else router.push(row.href);
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
          <div role="dialog" aria-modal="true" aria-label="Buscar en el proyecto" className="w-full max-w-xl overflow-hidden rounded-xl border border-line bg-bg shadow-2xl shadow-black/70">
            <div className="flex items-center gap-3 border-b border-line px-4">
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setActive(0);
                }}
                onKeyDown={onInputKey}
                placeholder="Qué quieres hacer: una herramienta, una escena (4), un personaje…"
                aria-label="Buscar"
                className="min-w-0 flex-1 bg-transparent py-4 font-sans text-base outline-none placeholder:text-muted focus-visible:outline-none"
              />
              <button type="button" onClick={() => setOpen(false)} className="font-mono text-[10px] tracking-widest text-muted uppercase hover:text-fg">
                Esc
              </button>
            </div>

            <div className="max-h-[55vh] overflow-y-auto pb-2" role="listbox" aria-label="Resultados">
              {rows.length === 0 ? (
                <p className="px-4 py-6 font-sans text-sm text-muted">
                  {searching || waiting ? "Buscando…" : `No encuentro nada para «${q}».`}
                </p>
              ) : (
                rows.map((row, i) => (
                  <div key={row.key}>
                    {(i === 0 || rows[i - 1].group !== row.group) && (
                      <p className="px-4 pt-3 pb-1 font-mono text-[10px] tracking-widest text-muted uppercase">{row.group}</p>
                    )}
                    <button
                      type="button"
                      role="option"
                      aria-selected={i === active}
                      onMouseEnter={() => setActive(i)}
                      onClick={() => go(row)}
                      className={`mx-2 flex w-[calc(100%-1rem)] items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                        i === active ? "bg-accent/12" : ""
                      }`}
                    >
                      <span className="min-w-0 flex-1">
                        <span className="block font-sans text-[14.5px] font-semibold">{row.title}</span>
                        {row.subtitle && <span className="block truncate font-sans text-[12.5px] text-muted">{row.subtitle}</span>}
                      </span>
                      {i === active && (
                        <span className="shrink-0 font-mono text-[10px] tracking-widest text-muted uppercase">{row.peek ? "↵ ficha" : "↵ abrir"}</span>
                      )}
                    </button>
                  </div>
                ))
              )}
              {waiting && rows.length > 0 && <p className="px-4 py-2 font-mono text-[10px] text-muted">Buscando más…</p>}
            </div>
            <p className="flex flex-wrap gap-x-4 border-t border-line px-4 py-2 font-mono text-[10px] tracking-widest text-muted uppercase">
              <span>↑↓ elegir</span>
              <span>↵ abrir</span>
              <span>4 → escena 4</span>
              <span className="ml-auto">Ctrl/⌘ K</span>
            </p>
          </div>
        </div>
      )}
    </>
  );
}
