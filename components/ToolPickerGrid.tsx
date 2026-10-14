"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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
      {/* Atajos: losas compactas (icono, nombre y una línea), agrupadas por fase. */}
      {groups.map((group) => (
        <div key={group.label} className="mt-10 first:mt-0">
          <p className="eyebrow text-accent">{group.label}</p>
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {group.tools.map((tool) => (
              <button
                key={tool.label}
                type="button"
                onClick={() => handleToolClick(tool)}
                className="tile group flex items-start gap-3.5 p-4 text-left transition duration-300 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--accent)] focus-visible:shadow-[0_0_0_2px_var(--accent)] focus-visible:outline-none active:scale-[0.99]"
              >
                <span className="mt-0.5 h-6 w-6 shrink-0 text-muted transition-colors group-hover:text-accent">{tool.icon}</span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span className="font-display text-[15px] font-bold transition-colors group-hover:text-accent">
                      {tool.label}
                    </span>
                    {tool.pro && (
                      <span className="rounded-full bg-accent/15 px-1.5 py-px font-mono text-[9px] tracking-widest text-accent uppercase">
                        PRO
                      </span>
                    )}
                  </span>
                  <span className="mt-1 line-clamp-2 block font-sans text-[13px] leading-snug text-muted">
                    {tool.description}
                  </span>
                </span>
              </button>
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
              inputClassName="field w-full px-3 py-2 text-sm"
              buttonClassName="btn btn-primary self-start"
              autoFocus
            />
          </div>
        )}
        {pickerTool && projects.length > 0 && (
          <div className="mt-5 max-h-72 divide-y divide-line overflow-y-auto border-y border-line">
            {projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => router.push(`/app/${project.id}/${pickerTool.href}`)}
                className="flex min-h-11 w-full items-center justify-between gap-3 py-3 text-left font-sans text-[15px] transition-colors hover:text-accent"
              >
                {project.name}
                <span aria-hidden className="text-muted">→</span>
              </button>
            ))}
          </div>
        )}
        <button
          type="button"
          onClick={() => setPickerTool(null)}
          className="link-action mt-3 !px-0"
        >
          Cancelar
        </button>
      </Modal>
    </>
  );
}
