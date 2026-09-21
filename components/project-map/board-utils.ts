import { MarkerType, type Edge } from "@xyflow/react";
import type { ItemNode } from "@/components/project-map/itemNodes";
import type { ToolNode } from "@/components/project-map/toolNode";
import { MAP_TOOL_KEYS, defaultToolRect, type MapEdge, type MapItem, type MapLayout, type MapRect, type MapToolKey } from "@/lib/project-map-types";

// Piezas comunes del editor de la pizarra y de su vista pública de solo lectura.

export type AnyNode = ToolNode | ItemNode;

export const toolNode = (key: MapToolKey, r: MapRect): ToolNode => ({
  id: `tool-${key}`,
  type: "tool",
  position: { x: r.x, y: r.y },
  width: r.w,
  height: r.h,
  data: { key },
});

export const itemNode = (it: MapItem): ItemNode => ({
  id: it.id,
  type: "item",
  position: { x: it.x, y: it.y },
  width: it.w,
  height: it.h,
  // Las secciones van al fondo, detrás de lo que agrupan.
  zIndex: it.type === "section" ? -1 : undefined,
  data: { item: it },
});

export const sizeOf = (n: AnyNode) => ({
  w: Math.round(n.width ?? n.measured?.width ?? 240),
  h: Math.round(n.height ?? n.measured?.height ?? 140),
});

const EDGE_DEFAULT = "#8a8a84";

export function toRfEdge(e: MapEdge, selected: boolean): Edge {
  const color = e.color ?? EDGE_DEFAULT;
  return {
    id: e.id,
    source: e.source,
    target: e.target,
    sourceHandle: e.sh,
    targetHandle: e.th,
    label: e.label,
    selected,
    style: { stroke: color, strokeWidth: selected ? 3 : 2, strokeDasharray: e.dashed ? "7 5" : undefined },
    markerEnd: e.arrow === false ? undefined : { type: MarkerType.ArrowClosed, color },
    labelStyle: { fill: "#f2f0ea", fontSize: 12 },
    labelBgStyle: { fill: "#0a0a0a" },
    labelBgPadding: [6, 3],
    labelBgBorderRadius: 2,
  };
}

export function buildFromLayout(layout: MapLayout) {
  const nodes: AnyNode[] = [
    ...MAP_TOOL_KEYS.filter((k) => !layout.hidden.includes(k)).map((k) => toolNode(k, layout.tools[k] ?? defaultToolRect(k))),
    ...layout.items.map(itemNode),
  ];
  const hiddenRects: Partial<Record<MapToolKey, MapRect>> = Object.fromEntries(
    layout.hidden.map((k) => [k, layout.tools[k] ?? defaultToolRect(k)]),
  );
  return { nodes, hiddenRects };
}
