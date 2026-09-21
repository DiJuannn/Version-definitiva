"use client";

import { createContext, useContext } from "react";
import Link from "next/link";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { useMap } from "@/components/project-map/mapContext";
import { MAP_COLORS, MAP_ENTITY_LABELS, NOTE_COLORS, type MapItem } from "@/lib/project-map-types";

// Elementos de la pizarra: nota, texto, imagen, forma, sección y cosas del proyecto (escenas,
// tareas…). Todos (menos la sección, que es un fondo) llevan puntos de unión para las flechas.
export type ItemNode = Node<{ item: MapItem }, "item">;

type ItemContext = {
  update: (id: string, patch: Partial<MapItem>) => void;
  remove: (id: string) => void;
  // Vista pública: sin edición, sin puntos de unión, sin botones.
  readOnly: boolean;
};

const ItemCtx = createContext<ItemContext | null>(null);
export const ItemProvider = ItemCtx.Provider;

function useItems(): ItemContext {
  const ctx = useContext(ItemCtx);
  if (!ctx) throw new Error("ItemProvider ausente");
  return ctx;
}

const FIELD = "nodrag nowheel w-full bg-transparent outline-none placeholder:opacity-50 focus:bg-white/5";
const LABEL = "font-mono text-[9px] tracking-widest uppercase";

// Cuatro puntos de unión (arriba, derecha, abajo, izquierda). Se ven al pasar el
// ratón o al seleccionar la tarjeta; arrastrar desde uno crea una flecha.
export function Handles({ selected }: { selected: boolean }) {
  const cls = `h-2.5! w-2.5! border-accent! bg-bg! transition-opacity ${
    selected ? "opacity-100" : "opacity-0 group-hover:opacity-100"
  }`;
  return (
    <>
      <Handle id="t" type="source" position={Position.Top} className={cls} />
      <Handle id="r" type="source" position={Position.Right} className={cls} />
      <Handle id="b" type="source" position={Position.Bottom} className={cls} />
      <Handle id="l" type="source" position={Position.Left} className={cls} />
    </>
  );
}

function Frame({
  id,
  selected,
  minW = 60,
  minH = 40,
  handles = true,
  className = "",
  style,
  children,
}: {
  id: string;
  selected: boolean;
  minW?: number;
  minH?: number;
  handles?: boolean;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  const { remove, readOnly } = useItems();
  return (
    <div className="group relative h-full w-full">
      {!readOnly && (
        <NodeResizer
          minWidth={minW}
          minHeight={minH}
          isVisible={selected}
          lineClassName="border-accent!"
          handleClassName="h-2.5! w-2.5! rounded-none! border-accent! bg-bg!"
        />
      )}
      {handles && !readOnly && <Handles selected={selected} />}
      {!readOnly && (
        <button
          type="button"
          onClick={() => remove(id)}
          aria-label="Quitar elemento"
          className="nodrag absolute top-1 right-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-danger group-hover:flex focus-visible:flex"
        >
          ×
        </button>
      )}
      <div className={`h-full w-full overflow-hidden ${className}`} style={style}>
        {children}
      </div>
    </div>
  );
}

function Note({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update, readOnly } = useItems();
  return (
    <Frame id={id} selected={selected} minW={100} minH={70} className="shadow-lg" style={{ background: item.color ?? NOTE_COLORS[0], color: "#1a1a1a" }}>
      <div className="flex h-full flex-col p-3">
        <textarea
          value={item.text ?? ""}
          readOnly={readOnly}
          onChange={(e) => update(id, { text: e.target.value })}
          placeholder={readOnly ? "" : "Escribe una nota…"}
          maxLength={2000}
          aria-label="Texto de la nota"
          className={`${FIELD} min-h-0 flex-1 resize-none font-sans text-sm leading-snug`}
        />
        {selected && !readOnly && (
          <div className="nodrag mt-2 flex gap-1.5" role="group" aria-label="Color de la nota">
            {NOTE_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={item.color === c}
                onClick={() => update(id, { color: c })}
                className={`h-4 w-4 rounded-full border ${item.color === c ? "border-black" : "border-black/20"}`}
                style={{ background: c }}
              />
            ))}
          </div>
        )}
      </div>
    </Frame>
  );
}

const TEXT_SIZE: Record<NonNullable<MapItem["size"]>, string> = {
  s: "text-sm",
  m: "text-2xl font-bold",
  l: "text-5xl font-black",
};

function TextBlock({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update, readOnly } = useItems();
  return (
    <Frame id={id} selected={selected} minW={80} minH={30}>
      <textarea
        value={item.text ?? ""}
        readOnly={readOnly}
        onChange={(e) => update(id, { text: e.target.value })}
        placeholder={readOnly ? "" : "Texto"}
        maxLength={1000}
        aria-label="Texto"
        className={`${FIELD} h-full resize-none px-1 font-display leading-tight ${TEXT_SIZE[item.size ?? "m"]}`}
        style={{ color: item.color ?? MAP_COLORS[6] }}
      />
    </Frame>
  );
}

function ImageItemView({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update, readOnly } = useItems();
  return (
    <Frame id={id} selected={selected} minW={80} minH={70} className="border border-line bg-bg-raised">
      <div className="flex h-full flex-col">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={item.url}
          alt={item.caption ?? "Imagen de la pizarra"}
          loading="lazy"
          decoding="async"
          draggable={false}
          className="min-h-0 w-full flex-1 object-cover"
        />
        {(!readOnly || item.caption) && (
          <input
            value={item.caption ?? ""}
            readOnly={readOnly}
            onChange={(e) => update(id, { caption: e.target.value })}
            placeholder={readOnly ? "" : "Pie de foto"}
            maxLength={200}
            aria-label="Pie de foto"
            className={`${FIELD} shrink-0 px-2 py-1.5 font-sans text-xs text-fg`}
          />
        )}
      </div>
    </Frame>
  );
}

const SHAPE_RADIUS = { rect: "0", round: "16px", ellipse: "50%" } as const;

function ShapeItemView({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update, readOnly } = useItems();
  const color = item.color ?? MAP_COLORS[0];
  return (
    <Frame
      id={id}
      selected={selected}
      minW={60}
      minH={40}
      style={{ background: `${color}33`, border: `2px solid ${color}`, borderRadius: SHAPE_RADIUS[item.shape ?? "rect"] }}
    >
      <div className="flex h-full items-center justify-center px-3">
        <input
          value={item.text ?? ""}
          readOnly={readOnly}
          onChange={(e) => update(id, { text: e.target.value })}
          placeholder={readOnly ? "" : "Etiqueta"}
          maxLength={300}
          aria-label="Etiqueta de la forma"
          className={`${FIELD} text-center font-sans text-sm text-fg`}
        />
      </div>
    </Frame>
  );
}

function SectionItemView({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update, readOnly } = useItems();
  const color = item.color ?? MAP_COLORS[5];
  return (
    <Frame id={id} selected={selected} minW={160} minH={100} handles={false} style={{ background: `${color}14`, border: `2px dashed ${color}88` }}>
      <input
        value={item.title ?? ""}
        readOnly={readOnly}
        onChange={(e) => update(id, { title: e.target.value })}
        placeholder={readOnly ? "" : "Título de la sección"}
        maxLength={120}
        aria-label="Título de la sección"
        className={`${FIELD} px-3 py-2 font-mono text-xs tracking-widest uppercase`}
        style={{ color }}
      />
    </Frame>
  );
}

// Una cosa del proyecto (escena, personaje, plano, tarea…): se muestra en vivo con los datos reales.
function EntityCard({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { entities, projectId, completeTask, busy, readOnly } = useMap();
  const kind = item.kind ?? "scene";
  const list = entities[kind] ?? [];
  const label = (item.label ?? "").toLowerCase();
  const e = list.find((x) => x.id === item.refId) ?? (label ? list.find((x) => x.title.toLowerCase() === label) : undefined);
  const heading = MAP_ENTITY_LABELS[kind].one;

  return (
    <Frame id={id} selected={selected} minW={160} minH={80} className="border border-accent/50 bg-bg-raised">
      <div className="flex h-full flex-col gap-1 p-3">
        <p className={`${LABEL} text-accent`}>{heading} · del proyecto</p>
        {e ? (
          <>
            <div className="flex items-start gap-2">
              {kind === "task" && (
                <button
                  type="button"
                  disabled={busy || readOnly || e.done}
                  onClick={() => completeTask(e.id)}
                  aria-label={e.done ? `«${e.title}» está hecha` : `Completar «${e.title}»`}
                  className={`nodrag mt-1 flex h-4 w-4 shrink-0 items-center justify-center border text-[10px] leading-none ${
                    e.done ? "border-success/60 bg-success/15 text-success" : "border-muted/60 hover:border-accent"
                  }`}
                >
                  {e.done ? "✓" : ""}
                </button>
              )}
              <p className={`font-display text-base leading-tight font-bold ${e.done ? "text-muted line-through" : ""}`}>{e.title}</p>
            </div>
            {e.sub && <p className="font-mono text-[11px] text-muted">{e.sub}</p>}
            {e.body && <p className="line-clamp-4 min-h-0 flex-1 overflow-hidden font-sans text-xs leading-snug text-muted">{e.body}</p>}
            {e.tag && <p className={`${LABEL} text-muted`}>{e.tag}</p>}
            {!readOnly && (
              <Link href={`/app/${projectId}/${e.slug}`} className={`nodrag ${LABEL} mt-auto self-start text-accent hover:underline`}>
                Abrir →
              </Link>
            )}
          </>
        ) : (
          <p className="font-sans text-xs text-muted">«{item.label ?? "?"}» ya no existe en el proyecto.{readOnly ? "" : " Puedes quitar la tarjeta."}</p>
        )}
      </div>
    </Frame>
  );
}

export function ItemNodeView({ id, data, selected }: NodeProps<ItemNode>) {
  const item = data.item;
  if (item.type === "note") return <Note id={id} item={item} selected={selected} />;
  if (item.type === "text") return <TextBlock id={id} item={item} selected={selected} />;
  if (item.type === "image") return <ImageItemView id={id} item={item} selected={selected} />;
  if (item.type === "shape") return <ShapeItemView id={id} item={item} selected={selected} />;
  if (item.type === "entity") return <EntityCard id={id} item={item} selected={selected} />;
  return <SectionItemView id={id} item={item} selected={selected} />;
}
