"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import { CreateProjectForm } from "@/components/CreateProjectForm";
import { Modal } from "@/components/Modal";
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
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
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

      <Modal
        open={pickerTool !== null}
        onClose={() => setPickerTool(null)}
        title={projects.length === 0 ? "Crea tu primer proyecto" : "Elige un proyecto"}
        description={pickerTool ? `Para abrir ${pickerTool.label}.` : undefined}
      >
        {pickerTool && projects.length === 0 && (
          <div className="mt-4">
            <CreateProjectForm
              action={createProjectAndOpenTool.bind(null, pickerTool.href)}
              formClassName="flex flex-col gap-3"
              inputClassName="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none focus:border-accent"
              buttonClassName="btn btn-secondary"
              autoFocus
            />
          </div>
        )}
        {pickerTool && projects.length > 0 && (
          <div className="mt-4 max-h-72 divide-y divide-line overflow-y-auto border-t border-line">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => router.push(`/app/${project.id}/${pickerTool.href}`)}
                className="block min-h-11 w-full py-3 text-left font-mono text-sm transition-colors hover:text-accent"
              >
                {project.name}
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setPickerTool(null)}
          className="link-action mt-4"
        >
          Cancelar
        </button>
      </Modal>
    </>
  );
}
