import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createTask } from "@/lib/actions/tasks";
import {
  addChecklistTemplateItem,
  applyChecklistTemplate,
  createChecklistTemplate,
  deleteChecklistTemplate,
} from "@/lib/actions/checklist-templates";
import { DeleteButton } from "@/components/DeleteButton";
import { TaskPriority } from "@/lib/generated/prisma";
import { BackLink } from "@/components/BackLink";
import { SubmitButton } from "@/components/SubmitButton";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export default async function TareasPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const organizationId = profile.organizationId;

  const [tasks, projects, templates] = await Promise.all([
    prisma.task.findMany({
      where: { organizationId, status: { not: "DONE" } },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      include: { project: { select: { name: true } } },
    }),
    prisma.project.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    prisma.checklistTemplate.findMany({
      where: { organizationId },
      orderBy: { createdAt: "desc" },
      include: { items: { orderBy: { order: "asc" } } },
    }),
  ]);

  return (
    <div>
      <BackLink href="/app">← Taller</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">Tareas</h1>

      <form
        action={createTask}
        className="mt-8 grid gap-2 border border-line p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        <input
          name="title"
          placeholder="Título"
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent sm:col-span-2"
        />
        <select
          name="projectId"
          defaultValue=""
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        >
          <option value="" className="bg-bg">
            Sin proyecto
          </option>
          {projects.map((project) => (
            <option key={project.id} value={project.id} className="bg-bg">
              {project.name}
            </option>
          ))}
        </select>
        <select
          name="priority"
          defaultValue="MEDIUM"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        >
          {Object.values(TaskPriority).map((value) => (
            <option key={value} value={value} className="bg-bg">
              {PRIORITY_LABELS[value]}
            </option>
          ))}
        </select>
        <input
          type="date"
          name="dueDate"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <div className="sm:col-span-2 lg:col-span-5">
          <SubmitButton
            pendingLabel="Creando…"
            savedLabel="✓ Creada"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Crear tarea
          </SubmitButton>
        </div>
      </form>

      {tasks.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          No hay tareas pendientes.
        </p>
      ) : (
        <div className="mt-10 border-t border-line">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/app/tareas/${task.id}`}
              className="group flex items-center justify-between gap-4 border-b border-line py-3 transition-colors hover:border-accent"
            >
              <div>
                <span className="font-mono text-sm transition-colors group-hover:text-accent">
                  ☐ {task.title}
                </span>
                {task.project && (
                  <span className="ml-2 font-mono text-xs text-muted">
                    {task.project.name}
                  </span>
                )}
              </div>
              <span className="font-mono text-xs text-muted">
                {PRIORITY_LABELS[task.priority]}
                {task.dueDate ? ` · ${task.dueDate.toLocaleDateString("es-ES")}` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}

      <section className="mt-14">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Plantillas de checklist
        </h2>

        <form action={createChecklistTemplate} className="mt-4 flex max-w-sm gap-2">
          <input
            name="name"
            placeholder="Nombre de la plantilla"
            required
            className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <SubmitButton
            pendingLabel="Creando…"
            savedLabel="✓ Creada"
            className="shrink-0 rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Crear
          </SubmitButton>
        </form>

        {templates.length > 0 && (
          <div className="mt-6 space-y-6">
            {templates.map((template) => {
              const addItemAction = addChecklistTemplateItem.bind(null, template.id);
              return (
                <div key={template.id} className="border border-line p-4">
                  <div className="flex items-center justify-between">
                    <p className="font-display text-sm font-bold uppercase">
                      {template.name}
                    </p>
                    <form action={deleteChecklistTemplate.bind(null, template.id)}>
                      <DeleteButton
                        confirmMessage="¿Eliminar esta plantilla de checklist?"
                        className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                      >
                        Eliminar plantilla
                      </DeleteButton>
                    </form>
                  </div>

                  {template.items.length > 0 && (
                    <ul className="mt-3 space-y-1">
                      {template.items.map((item) => (
                        <li key={item.id} className="font-mono text-xs text-muted">
                          ☐ {item.label}
                        </li>
                      ))}
                    </ul>
                  )}

                  <form action={addItemAction} className="mt-3 flex gap-2">
                    <input
                      name="label"
                      placeholder="Añadir item"
                      required
                      className="w-full border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                    />
                    <SubmitButton
                      pendingLabel="…"
                      className="shrink-0 rounded-full border border-line px-3 py-1.5 font-mono text-[11px] tracking-widest uppercase hover:border-accent hover:text-accent"
                    >
                      +
                    </SubmitButton>
                  </form>

                  {template.items.length > 0 && projects.length > 0 && (
                    <form
                      action={applyChecklistTemplate}
                      className="mt-3 flex flex-wrap items-center gap-2"
                    >
                      <input type="hidden" name="templateId" value={template.id} />
                      <select
                        name="projectId"
                        required
                        className="border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                      >
                        {projects.map((project) => (
                          <option key={project.id} value={project.id} className="bg-bg">
                            {project.name}
                          </option>
                        ))}
                      </select>
                      <SubmitButton
                        pendingLabel="Aplicando…"
                        savedLabel="✓ Aplicado"
                        className="rounded-full bg-fg px-4 py-1.5 font-mono text-[11px] tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
                      >
                        Aplicar a proyecto
                      </SubmitButton>
                    </form>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
