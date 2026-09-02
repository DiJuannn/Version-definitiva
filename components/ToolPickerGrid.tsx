"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { createProjectAndOpenTool } from "@/lib/actions/projects";
import type { ToolDefinition } from "@/lib/tool-groups";

type ProjectOption = { id: string; name: string };

// Mismo patrón que el selector de herramientas de la app móvil
// (proyecto.tsx + ProjectPickerModal): eliges primero la herramienta, y
// solo si hace falta se pregunta el proyecto — con 1 solo proyecto entra
// directo, con varios se elige, y sin ninguno se crea ahí mismo.
export function ToolPickerGrid({
  groups,
  projects,
}: {
  groups: { label: string; tools: ToolDefinition[] }[];
  projects: ProjectOption[];
}) {
  const router = useRouter();
  const [pickerTool, setPickerTool] = useState<ToolDefinition | null>(null);

  function handleToolClick(tool: ToolDefinition) {
    if (tool.absolute) {
      router.push(tool.href);
      return;
    }
    if (projects.length === 1) {
      router.push(`/app/${projects[0].id}/${tool.href}`);
      return;
    }
    setPickerTool(tool);
  }

  return (
    <>
      {groups.map((group) => (
        <div key={group.label} className="mt-8 first:mt-0">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            {group.label}
          </p>
          <div className="mt-3 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
            {group.tools.map((tool) => (
              <ToolCard
                key={tool.label}
                icon={tool.icon}
                label={tool.label}
                description={tool.description}
                badge={tool.pro ? "PRO" : undefined}
                onClick={() => handleToolClick(tool)}
              />
            ))}
          </div>
        </div>
      ))}

      {pickerTool && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-bg/90 p-4"
          onClick={() => setPickerTool(null)}
        >
          <div
            className="w-full max-w-sm border border-line bg-bg p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
              {pickerTool.label}
            </p>

            {projects.length === 0 ? (
              <>
                <h2 className="mt-2 font-display text-lg font-bold uppercase">
                  Crea tu primer proyecto
                </h2>
                <div className="mt-4">
                  <CreateProjectForm
                    action={createProjectAndOpenTool.bind(null, pickerTool.href)}
                    formClassName="flex flex-col gap-3"
                    inputClassName="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
                    buttonClassName="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                    autoFocus
                  />
                </div>
              </>
            ) : (
              <>
                <h2 className="mt-2 font-display text-lg font-bold uppercase">
                  Elige un proyecto
                </h2>
                <div className="mt-4 max-h-72 divide-y divide-line overflow-y-auto border-t border-line">
                  {projects.map((project) => (
                    <button
                      key={project.id}
                      type="button"
                      onClick={() => router.push(`/app/${project.id}/${pickerTool.href}`)}
                      className="block w-full py-3 text-left font-mono text-sm transition-colors hover:text-accent"
                    >
                      {project.name}
                    </button>
                  ))}
                </div>
              </>
            )}

            <button
              type="button"
              onClick={() => setPickerTool(null)}
              className="mt-4 font-mono text-[10px] tracking-widest text-muted uppercase transition-colors hover:text-accent"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}
    </>
  );
}
