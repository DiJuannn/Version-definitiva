"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { NodeResizer, type Node, type NodeProps } from "@xyflow/react";
import { MAP_PHASES, MAP_TOOL_PHASE, type MapToolCard, type MapToolKey } from "@/lib/project-map-types";
import { Handles } from "@/components/project-map/itemNodes";

export type ToolNode = Node<{ key: MapToolKey }, "tool">;

type MapContext = {
  projectId: string;
  tools: Record<string, MapToolCard>;
  hide: (key: MapToolKey) => void;
  completeTask: (taskId: string) => void;
  changeStatus: (status: string) => void;
  busy: boolean;
};

const MapCtx = createContext<MapContext | null>(null);
export const MapProvider = MapCtx.Provider;

function useMap(): MapContext {
  const ctx = useContext(MapCtx);
  if (!ctx) throw new Error("MapProvider ausente");
  return ctx;
}

const LABEL = "font-mono text-[9px] tracking-widest uppercase";

function StatusMark({ status }: { status: MapToolCard["status"] }) {
  if (status === "ok") return <span className="font-mono text-xs text-success" title="Completo">✓</span>;
  if (status === "warn") return <span className="h-2 w-2 rounded-full bg-warn" title="Falta algo" />;
  return null;
}

export function ToolNodeView({ data, selected }: NodeProps<ToolNode>) {
  const { tools, projectId, hide, completeTask, changeStatus, busy } = useMap();
  const card = tools[data.key];
  if (!card) return null;

  const phase = MAP_PHASES.find((p) => p.id === MAP_TOOL_PHASE[card.key])?.label ?? "";
  const href = `/app/${projectId}${card.slug ? `/${card.slug}` : ""}`;
  const pct = card.progress && card.progress.total > 0 ? Math.round((card.progress.done / card.progress.total) * 100) : null;

  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        minWidth={200}
        minHeight={110}
        isVisible={selected}
        lineClassName="border-accent!"
        handleClassName="h-2.5! w-2.5! rounded-none! border-accent! bg-bg!"
      />
      <Handles selected={selected} />
      <button
        type="button"
        onClick={() => hide(card.key)}
        aria-label={`Ocultar «${card.title}»`}
        title="Ocultar esta tarjeta"
        className="nodrag absolute top-1 right-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-danger group-hover:flex focus-visible:flex"
      >
        ×
      </button>
      <div
        className={`flex h-full w-full flex-col gap-1 overflow-hidden border bg-bg-raised p-3 ${
          card.key === "proyecto" ? "border-accent/60" : "border-line"
        }`}
      >
        <div className="flex items-center justify-between gap-2">
          <span className={`${LABEL} text-accent`}>{phase}</span>
          <StatusMark status={card.status} />
        </div>
        <p className="truncate font-display text-xs font-bold tracking-wide uppercase">{card.title}</p>
        <p className="font-display text-2xl leading-none font-black">{card.headline}</p>

        {card.lines.map((line, i) => (
          <p key={i} className="font-mono text-[11px] leading-snug text-muted">
            {line}
          </p>
        ))}

        {pct !== null && (
          <div className="mt-1" aria-label={`${pct}% completado`}>
            <div className="h-1 w-full bg-line">
              <div className={`h-1 ${pct === 100 ? "bg-success" : "bg-accent"}`} style={{ width: `${pct}%` }} />
            </div>
            <p className={`${LABEL} mt-1 text-muted`}>
              {card.progress!.done}/{card.progress!.total}
            </p>
          </div>
        )}

        {card.project && (
          <label className="nodrag mt-1 block">
            <span className={`${LABEL} text-muted`}>Estado</span>
            <select
              value={card.project.status}
              disabled={busy}
              onChange={(e) => changeStatus(e.target.value)}
              aria-label="Estado del proyecto"
              className="mt-1 w-full border border-line bg-bg px-2 py-1.5 font-mono text-xs"
            >
              {card.project.options.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        )}

        {card.tasks && (
          <ul className="nowheel mt-1 min-h-0 flex-1 space-y-1 overflow-y-auto">
            {card.tasks.length === 0 ? (
              <li className="font-sans text-xs text-muted">Todo al día.</li>
            ) : (
              card.tasks.map((t) => (
                <li key={t.id} className="flex items-start gap-2">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => completeTask(t.id)}
                    aria-label={`Completar «${t.title}»`}
                    className="nodrag mt-0.5 h-4 w-4 shrink-0 border border-muted/60 hover:border-accent"
                  />
                  <span className="min-w-0 font-sans text-xs leading-snug">
                    {t.title}
                    {t.due && <span className="ml-1 font-mono text-[10px] text-muted">· {t.due}</span>}
                  </span>
                </li>
              ))
            )}
          </ul>
        )}

        {card.key !== "proyecto" && (
          <Link href={href} className={`nodrag ${LABEL} mt-auto self-start pt-1 text-accent hover:underline`}>
            Abrir →
          </Link>
        )}
      </div>
    </div>
  );
}
