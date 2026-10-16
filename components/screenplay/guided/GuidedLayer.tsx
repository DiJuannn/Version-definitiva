"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useYMap } from "@/lib/screenplay/use-ymap";
import type { SceneMeta } from "@/lib/screenplay/story";
import { targetPages } from "@/lib/screenplay/moments";
import { useWorkspace } from "@/components/screenplay/workspace";
import { useGuidedData, useGuidedMode } from "@/components/screenplay/guided/use-guided";
import { sceneGuidesKey, sceneGuidesPlugin, setSceneGuides, type SceneGuide } from "@/components/screenplay/guided/scene-guides";
import {
  MILESTONE_TEXT,
  ROUTES,
  cardView,
  draftProgress,
  missingForDraft,
  reachedMilestones,
  sceneRanges,
  type DraftItem,
  type Milestone,
} from "@/components/screenplay/guided/guided";

// Lo que el camino guiado añade a la página del guion (bajo la cabecera,
// lejos de «Tu historia», que va abajo):
// - la barra «Tu borrador»: qué escenas están vacías, esbozadas o escritas y
//   qué falta para tener un borrador, con los hitos;
// - la cabecera de cada escena del esqueleto (pregunta guía y nota);
// - y, para todo el mundo, «Donde lo dejaste» al volver.
export function GuidedLayer({ format }: { format: string }) {
  const { maps, screenplayId, blocks, setStep } = useWorkspace();
  const mode = useGuidedMode(maps, screenplayId);
  const { start, skeleton } = useGuidedData(maps);

  // Un guion guiado que aún no ha empezado se abre en las preguntas (si se
  // entra sin pedir un paso, p. ej. desde la lista de guiones).
  const checked = useRef(false);
  useEffect(() => {
    if (checked.current || !blocks.length) return;
    checked.current = true;
    const asked = new URL(window.location.href).searchParams.has("paso");
    if (mode.on && !asked && !start.done && !skeleton && !blocks.some((b) => b.text.trim())) setStep("empezar");
  }, [blocks, mode.on, setStep, skeleton, start.done]);

  return (
    <>
      {mode.on && <DraftBar format={format} onHide={() => mode.set(false)} />}
      {mode.on && <SceneGuides />}
      <ResumeNote />
    </>
  );
}

// ------------------------------------------------------------------ cabeceras de escena

function SceneGuides() {
  const { editor, maps, blocks } = useWorkspace();
  const { start, skeleton } = useGuidedData(maps);
  const meta = useYMap<SceneMeta>(maps.scenes);

  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    editor.registerPlugin(sceneGuidesPlugin());
    return () => {
      if (!editor.isDestroyed) editor.unregisterPlugin(sceneGuidesKey);
    };
  }, [editor]);

  const guides = useMemo(() => {
    const map = new Map<string, SceneGuide>();
    if (!skeleton) return map;
    const ranges = new Map(sceneRanges(blocks).map((r) => [r.sid, r]));
    const progress = draftProgress(blocks, skeleton, null, { name: start.name });
    const linked = skeleton.cards.filter((c) => c.sid && ranges.has(c.sid));
    linked.forEach((c, i) => {
      const v = cardView(skeleton, c, start.name);
      const state = progress.items.find((x) => x.sid === c.sid)?.state ?? "empty";
      map.set(c.sid!, {
        eyebrow: `Paso ${i + 1} de ${linked.length} · ${v.plain}${v.technical ? ` (${v.technical})` : ""}`,
        question: v.question,
        note: (meta[c.sid!]?.synopsis ?? c.line ?? "").trim(),
        done: state === "written",
        empty: !ranges.get(c.sid!)?.heading,
      });
    });
    return map;
  }, [blocks, meta, skeleton, start.name]);

  // Solo se repinta si cambia lo que se enseña.
  const sig = useMemo(() => JSON.stringify([...guides.entries()]), [guides]);
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    setSceneGuides(editor, guides);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- `sig` resume `guides`
  }, [editor, sig]);
  return null;
}

// ------------------------------------------------------------------ «Tu borrador»

const seenKey = (id: string) => `sp-hitos:${id}`;

function readSeen(id: string): Set<Milestone> | null {
  try {
    const v = window.localStorage.getItem(seenKey(id));
    return v === null ? null : new Set(JSON.parse(v) as Milestone[]);
  } catch {
    return new Set();
  }
}

function DraftBar({ format, onHide }: { format: string; onHide: () => void }) {
  const { maps, blocks, currentSid, goToScene, pageCount, openAssistant, screenplayId } = useWorkspace();
  const { start, skeleton, structure } = useGuidedData(maps);
  const meta = useYMap<SceneMeta>(maps.scenes);
  const synopses = useMemo(() => Object.fromEntries(Object.entries(meta).map(([k, m]) => [k, m?.synopsis])), [meta]);
  const progress = useMemo(
    () => draftProgress(blocks, skeleton, currentSid, { name: start.name, synopses }),
    [blocks, currentSid, skeleton, start.name, synopses],
  );
  const short = format !== "FEATURE" && format !== "SERIES_EPISODE";
  const missing = missingForDraft(progress, { name: start.name, want: start.want, pages: pageCount, minPages: short ? 3 : 0 }).slice(0, 2);
  const target = skeleton && structure.targetPages === undefined ? ROUTES[skeleton.route].pages : targetPages(structure, format);

  // Hitos: cada uno se celebra una vez (los que ya estaban al abrir, no).
  const [milestone, setMilestone] = useState<Milestone | null>(null);
  const seen = useRef<Set<Milestone> | null>(null);
  const reached = reachedMilestones(progress).join(",");
  useEffect(() => {
    if (!blocks.length) return;
    const now = reached ? (reached.split(",") as Milestone[]) : [];
    const persist = (set: Set<Milestone>) => {
      try {
        window.localStorage.setItem(seenKey(screenplayId), JSON.stringify([...set]));
      } catch {
        // sin almacenamiento: se puede repetir algún aviso
      }
    };
    if (!seen.current) {
      const stored = readSeen(screenplayId);
      seen.current = stored ?? new Set(now);
      if (!stored) persist(seen.current);
      return;
    }
    const fresh = now.filter((m) => !seen.current!.has(m));
    if (!fresh.length) return;
    fresh.forEach((m) => seen.current!.add(m));
    persist(seen.current);
    setMilestone(fresh[fresh.length - 1]);
  }, [blocks.length, reached, screenplayId]);
  useEffect(() => {
    if (!milestone || milestone === "all") return;
    const t = setTimeout(() => setMilestone(null), 9000);
    return () => clearTimeout(t);
  }, [milestone]);

  if (!progress.total) return null;
  const dense = progress.items.length > 12;
  const exportPdf = () => window.dispatchEvent(new CustomEvent("screenplay:export", { detail: `/api/pdf/guion/${screenplayId}?size=A4` }));

  return (
    <section aria-label="Tu borrador" className="border-b border-[var(--line)] py-2.5 text-[12.5px]">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <span className="sp-label shrink-0 !text-[10px]">Tu borrador</span>
        <ol className="flex min-w-[160px] flex-1 gap-1" aria-label="Escenas del borrador">
          {progress.items.map((it) => (
            <li key={it.key} className="min-w-0 flex-1" style={{ maxWidth: dense ? 40 : 120 }}>
              <Segment item={it} dense={dense} onGo={() => it.sid && goToScene(it.sid)} />
            </li>
          ))}
        </ol>
        <span className="shrink-0 text-muted">
          <b className="font-semibold text-fg">
            {progress.written} de {progress.total}
          </b>{" "}
          {progress.total === 1 ? "escena escrita" : "escenas escritas"} · {pageCount} de ~{target} págs.
        </span>
        <span className="flex min-w-0 shrink-0 items-center gap-3 max-lg:basis-full">
          {missing.length ? (
            <span className="text-muted">
              Para un borrador te falta: <b className="font-semibold text-[var(--accent)]">{missing[0]}</b>
              {missing[1] && <> · {missing[1]}</>}
            </span>
          ) : (
            <span className="font-semibold text-success">Tienes un borrador completo.</span>
          )}
          <button type="button" onClick={onHide} title="Quitar la guía (solo para ti; se vuelve a poner desde la página en blanco o la Idea)" className="text-muted hover:text-fg">
            Ocultar
          </button>
        </span>
      </div>
      {milestone && (
        <div role="status" className="mt-2 flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--r-md)] bg-[#1c1b19] px-3.5 py-1.5 text-[13px] text-white">
          <span className={milestone === "all" ? "font-semibold" : ""}>{MILESTONE_TEXT[milestone]}</span>
          {milestone === "all" && (
            <>
              <span className="text-white/70">Ahora:</span>
              <button type="button" onClick={exportPdf} className="rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/20">
                Descargar el PDF
              </button>
              <button type="button" onClick={openAssistant} className="rounded-md bg-white/10 px-2.5 py-1 hover:bg-white/20">
                Pedir una revisión al compañero
              </button>
            </>
          )}
          <button type="button" onClick={() => setMilestone(null)} aria-label="Cerrar" className="ml-1 text-white/60 hover:text-white">
            ×
          </button>
        </div>
      )}
    </section>
  );
}

const SEGMENT = {
  written: "bg-[#1c1b19] text-white border-[#1c1b19]",
  sketched: "bg-[#efeaf9] text-[#5a46a8] border-[#e0d8f5]",
  empty: "bg-[#ebeae5] text-[#8a867c] border-[#ebeae5]",
} as const;

function Segment({ item, dense, onGo }: { item: DraftItem; dense: boolean; onGo: () => void }) {
  const status = item.state === "written" ? "escrita" : item.state === "sketched" ? "esbozada" : "vacía";
  const mark = item.state === "written" ? " ✓" : item.state === "sketched" ? " ✎" : "";
  return (
    <button
      type="button"
      onClick={onGo}
      title={`${item.index} · ${item.label} — ${status}${item.question ? `. ${item.question}` : ""}`}
      aria-label={`Escena ${item.index}, ${item.label}: ${status}${item.here ? " (estás aquí)" : ""}`}
      aria-current={item.here ? "location" : undefined}
      className={`block h-6 w-full truncate rounded-[5px] border px-1.5 text-left font-mono text-[10.5px] leading-[22px] transition-shadow ${SEGMENT[item.state]} ${
        item.here ? "shadow-[0_0_0_2px_#b9a6f0]" : "hover:shadow-[0_0_0_2px_var(--line)]"
      }`}
    >
      {!dense && (
        <>
          {item.index}
          <span className="max-sm:hidden">{item.here ? " · aquí" : mark}</span>
        </>
      )}
    </button>
  );
}

// ------------------------------------------------------------------ «Donde lo dejaste»

type Last = { sid: string; at: number };
const lastKey = (id: string) => `sp-last:${id}`;
// Si se vuelve antes de esto (una recarga), no se avisa.
const AWAY_MS = 5 * 60 * 1000;

function sceneAt(editor: NonNullable<ReturnType<typeof useWorkspace>["editor"]>): string | null {
  const { $from } = editor.state.selection;
  for (let i = $from.index(0); i >= 0; i--) {
    const n = editor.state.doc.child(i);
    if (n.type.name === "sceneHeading" && n.attrs.sid) return n.attrs.sid as string;
  }
  return null;
}

function ResumeNote() {
  const { editor, blocks, maps, currentSid, goToScene, screenplayId } = useWorkspace();
  const { start, skeleton } = useGuidedData(maps);
  const [last] = useState<Last | null>(() => {
    try {
      const v = JSON.parse(window.localStorage.getItem(lastKey(screenplayId)) ?? "null") as Last | null;
      return v && typeof v.sid === "string" && Date.now() - Number(v.at) > AWAY_MS ? v : null;
    } catch {
      return null;
    }
  });
  const [open, setOpen] = useState(true);

  // Se apunta la escena en la que se escribe (solo los cambios propios).
  useEffect(() => {
    if (!editor) return;
    const onUpdate = ({ transaction }: { transaction: import("@tiptap/pm/state").Transaction }) => {
      if (!transaction.docChanged || transaction.getMeta("y-sync$")?.isChangeOrigin) return;
      const sid = sceneAt(editor);
      if (!sid) return;
      try {
        window.localStorage.setItem(lastKey(screenplayId), JSON.stringify({ sid, at: Date.now() }));
      } catch {
        // sin almacenamiento: no se recuerda
      }
    };
    editor.on("update", onUpdate);
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor, screenplayId]);

  const ranges = useMemo(() => sceneRanges(blocks), [blocks]);
  const progress = useMemo(() => draftProgress(blocks, skeleton, null, { name: start.name }), [blocks, skeleton, start.name]);
  if (!open || !last || !blocks.length || currentSid === last.sid) return null;
  const i = ranges.findIndex((r) => r.sid === last.sid);
  if (i === -1 || (i === 0 && ranges.length === 1)) return null;
  const item = progress.items.find((x) => x.sid === last.sid);
  const heading = ranges[i].heading;
  const nextTodo = progress.items.find((x) => x.index > (item?.index ?? 0) && x.state !== "written");
  return (
    <div role="status" className="mt-2 flex w-fit max-w-full flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--r-md)] border border-[#e0d8f5] bg-[#f8f6fe] px-3.5 py-2 text-[13px] text-[#3a3550]">
      <span>
        <b className="font-semibold">Donde lo dejaste:</b> escena {item?.index ?? i + 1}
        {heading ? ` · ${heading.toUpperCase()}` : item?.label ? ` · ${item.label}` : ""}.
        {nextTodo && (
          <span className="text-[#6d6880]">
            {" "}
            Te queda: {nextTodo.index} · {nextTodo.label}.
          </span>
        )}
      </span>
      <button
        type="button"
        onClick={() => {
          setOpen(false);
          goToScene(last.sid);
        }}
        className="rounded-md bg-[#5a46a8] px-2.5 py-1 font-medium text-white hover:bg-[#4c3b92]"
      >
        Seguir aquí →
      </button>
      <button type="button" onClick={() => setOpen(false)} aria-label="Cerrar" className="ml-1 text-[#8a85a0] hover:text-fg">
        ×
      </button>
    </div>
  );
}
