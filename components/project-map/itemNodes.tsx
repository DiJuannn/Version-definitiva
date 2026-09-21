"use client";

import { createContext, useContext } from "react";
import { Handle, NodeResizer, Position, type Node, type NodeProps } from "@xyflow/react";
import { MAP_COLORS, NOTE_COLORS, type MapItem } from "@/lib/project-map-types";

// Elementos propios de la pizarra: nota, texto, imagen, forma y sección. Todos
// (menos la sección, que es un fondo) llevan puntos de unión para las flechas.
export type ItemNode = Node<{ item: MapItem }, "item">;

type ItemContext = {
  update: (id: string, patch: Partial<MapItem>) => void;
  remove: (id: string) => void;
};

const ItemCtx = createContext<ItemContext | null>(null);
export const ItemProvider = ItemCtx.Provider;

function useItems(): ItemContext {
  const ctx = useContext(ItemCtx);
  if (!ctx) throw new Error("ItemProvider ausente");
  return ctx;
}

const FIELD = "nodrag nowheel w-full bg-transparent outline-none placeholder:opacity-50 focus:bg-white/5";

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
  const { remove } = useItems();
  return (
    <div className="group relative h-full w-full">
      <NodeResizer
        minWidth={minW}
        minHeight={minH}
        isVisible={selected}
        lineClassName="border-accent!"
        handleClassName="h-2.5! w-2.5! rounded-none! border-accent! bg-bg!"
      />
      {handles && <Handles selected={selected} />}
      <button
        type="button"
        onClick={() => remove(id)}
        aria-label="Quitar elemento"
        className="nodrag absolute top-1 right-1 z-10 hidden h-5 w-5 items-center justify-center rounded-full bg-black/60 text-xs leading-none text-white hover:bg-danger group-hover:flex focus-visible:flex"
      >
        ×
      </button>
      <div className={`h-full w-full overflow-hidden ${className}`} style={style}>
        {children}
      </div>
    </div>
  );
}

function Note({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update } = useItems();
  return (
    <Frame id={id} selected={selected} minW={100} minH={70} className="shadow-lg" style={{ background: item.color ?? NOTE_COLORS[0], color: "#1a1a1a" }}>
      <div className="flex h-full flex-col p-3">
        <textarea
          value={item.text ?? ""}
          onChange={(e) => update(id, { text: e.target.value })}
          placeholder="Escribe una nota…"
          maxLength={2000}
          aria-label="Texto de la nota"
          className={`${FIELD} min-h-0 flex-1 resize-none font-sans text-sm leading-snug`}
        />
        {selected && (
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
  const { update } = useItems();
  return (
    <Frame id={id} selected={selected} minW={80} minH={30}>
      <textarea
        value={item.text ?? ""}
        onChange={(e) => update(id, { text: e.target.value })}
        placeholder="Texto"
        maxLength={1000}
        aria-label="Texto"
        className={`${FIELD} h-full resize-none px-1 font-display leading-tight ${TEXT_SIZE[item.size ?? "m"]}`}
        style={{ color: item.color ?? MAP_COLORS[6] }}
      />
    </Frame>
  );
}

function ImageItemView({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update } = useItems();
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
        <input
          value={item.caption ?? ""}
          onChange={(e) => update(id, { caption: e.target.value })}
          placeholder="Pie de foto"
          maxLength={200}
          aria-label="Pie de foto"
          className={`${FIELD} shrink-0 px-2 py-1.5 font-sans text-xs text-fg`}
        />
      </div>
    </Frame>
  );
}

const SHAPE_RADIUS = { rect: "0", round: "16px", ellipse: "50%" } as const;

function ShapeItemView({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update } = useItems();
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
          onChange={(e) => update(id, { text: e.target.value })}
          placeholder="Etiqueta"
          maxLength={300}
          aria-label="Etiqueta de la forma"
          className={`${FIELD} text-center font-sans text-sm text-fg`}
        />
      </div>
    </Frame>
  );
}

function SectionItemView({ id, item, selected }: { id: string; item: MapItem; selected: boolean }) {
  const { update } = useItems();
  const color = item.color ?? MAP_COLORS[5];
  return (
    <Frame id={id} selected={selected} minW={160} minH={100} handles={false} style={{ background: `${color}14`, border: `2px dashed ${color}88` }}>
      <input
        value={item.title ?? ""}
        onChange={(e) => update(id, { title: e.target.value })}
        placeholder="Título de la sección"
        maxLength={120}
        aria-label="Título de la sección"
        className={`${FIELD} px-3 py-2 font-mono text-xs tracking-widest uppercase`}
        style={{ color }}
      />
    </Frame>
  );
}

export function ItemNodeView({ id, data, selected }: NodeProps<ItemNode>) {
  const item = data.item;
  if (item.type === "note") return <Note id={id} item={item} selected={selected} />;
  if (item.type === "text") return <TextBlock id={id} item={item} selected={selected} />;
  if (item.type === "image") return <ImageItemView id={id} item={item} selected={selected} />;
  if (item.type === "shape") return <ShapeItemView id={id} item={item} selected={selected} />;
  return <SectionItemView id={id} item={item} selected={selected} />;
}
