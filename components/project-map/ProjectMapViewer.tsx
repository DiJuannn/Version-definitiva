"use client";

import "@xyflow/react/dist/style.css";

import { useMemo } from "react";
import { Background, Controls, MiniMap, ReactFlow, ReactFlowProvider } from "@xyflow/react";
import { buildFromLayout, toRfEdge, type AnyNode } from "@/components/project-map/board-utils";
import { ItemNodeView, ItemProvider } from "@/components/project-map/itemNodes";
import { MapProvider } from "@/components/project-map/mapContext";
import { ToolNodeView } from "@/components/project-map/toolNode";
import type { MapEntities, MapLayout, MapToolCard } from "@/lib/project-map-types";

const nodeTypes = { tool: ToolNodeView, item: ItemNodeView };
const noop = () => undefined;

// Vista pública de solo lectura de una pizarra (enlace compartido): se puede mover y ampliar
// el lienzo, pero nada se edita, ni hay enlaces a la app.
function Viewer({ tools, entities, layout }: { tools: MapToolCard[]; entities: MapEntities; layout: MapLayout }) {
  const nodes = useMemo(() => buildFromLayout(layout).nodes, [layout]);
  const edges = useMemo(() => {
    const ids = new Set(nodes.map((n) => n.id));
    return layout.edges.filter((e) => ids.has(e.source) && ids.has(e.target)).map((e) => toRfEdge(e, false));
  }, [layout, nodes]);
  const toolsByKey = useMemo(() => Object.fromEntries(tools.map((t) => [t.key, t])), [tools]);

  const mapCtx = useMemo(
    () => ({ projectId: "", tools: toolsByKey, entities, hide: noop, completeTask: noop, changeStatus: noop, busy: false, readOnly: true }),
    [toolsByKey, entities],
  );
  const itemCtx = useMemo(() => ({ update: noop, remove: noop, readOnly: true }), []);

  return (
    <MapProvider value={mapCtx}>
      <ItemProvider value={itemCtx}>
        <div className="h-[calc(100dvh-9rem)] min-h-[420px] border border-line">
          <ReactFlow<AnyNode>
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            colorMode="dark"
            minZoom={0.1}
            maxZoom={2}
            fitView
            fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
            nodesDraggable={false}
            nodesConnectable={false}
            elementsSelectable={false}
            zoomOnDoubleClick={false}
            proOptions={{ hideAttribution: false }}
          >
            <Background gap={24} size={1} />
            <Controls showInteractive={false} />
            <MiniMap pannable zoomable className="hidden! sm:block!" maskColor="rgba(0,0,0,0.6)" />
          </ReactFlow>
        </div>
      </ItemProvider>
    </MapProvider>
  );
}

export default function ProjectMapViewer(props: { tools: MapToolCard[]; entities: MapEntities; layout: MapLayout }) {
  return (
    <ReactFlowProvider>
      <Viewer {...props} />
    </ReactFlowProvider>
  );
}
