import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/lib/actions/tasks";
import {
  addChecklistTemplateItem,
  applyChecklistTemplate,
  createChecklistTemplate,
  deleteChecklistTemplate,
} from "@/lib/actions/checklist-templates";
import { DeleteButton } from "@/components/DeleteButton";
import { EmptyState } from "@/components/EmptyState";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { TaskCheck } from "@/components/TaskCheck";
import { TaskPriority } from "@/lib/generated/prisma";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const FIELD =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

// Lista de tareas compartida por /app/tareas (toda la organización) y
// /app/[id]/tareas (un proyecto): mismos controles, distinto alcance.
export async function TasksView({
  organizationId,
  projectId,
  showCompleted,
  completedHref,
}: {
  organizationId: string;
  projectId?: string;
  showCompleted: boolean;
  // Enlace que alterna "ver completadas".
  completedHref: string;
}) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [tasks, projects, templates] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId,
        ...(projectId ? { projectId } : {}),
        ...(showCompleted ? {} : { status: { not: "DONE" } }),
      },
      orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
      include: { project: { select: { name: true } } },
    }),
    projectId
      ? Promise.resolve([])
      : prisma.project.findMany({ where: { organizationId }, orderBy: { name: "asc" } }),
    projectId
      ? Promise.resolve([])
      : prisma.checklistTemplate.findMany({
          where: { organizationId },
          orderBy: { createdAt: "desc" },
          include: { items: { orderBy: { order: "asc" } } },
        }),
  ]);

  return (
    <div>
      <form
        action={createTask}
        className="mt-6 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-5"
      >
        {projectId && <input type="hidden" name="projectId" value={projectId} />}
        <FormField label="Nueva tarea" className="sm:col-span-2">
          <input name="title" required placeholder="Qué hay que hacer" className={FIELD} />
        </FormField>
        {!projectId && (
          <FormField label="Proyecto">
            <select name="projectId" defaultValue="" className={FIELD}>
              <option value="" className="bg-bg">
                Sin proyecto
              </option>
              {projects.map((project) => (
                <option key={project.id} value={project.id} className="bg-bg">
                  {project.name}
                </option>
              ))}
            </select>
          </FormField>
        )}
        <FormField label="Prioridad">
          <select name="priority" defaultValue="MEDIUM" className={FIELD}>
            {Object.values(TaskPriority).map((value) => (
              <option key={value} value={value} className="bg-bg">
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Fecha límite">
          <input type="date" name="dueDate" className={FIELD} />
        </FormField>
        <div className="sm:col-span-2 lg:col-span-5">
          <SubmitButton pendingLabel="Creando…" savedLabel="✓ Creada" className="btn btn-secondary">
            Crear tarea
          </SubmitButton>
        </div>
      </form>

      <div className="mt-8 flex items-center justify-between">
        <p className="font-mono text-[11px] tracking-widest text-muted uppercase">
          {showCompleted ? "Todas las tareas" : "Pendientes"} · {tasks.length}
        </p>
        <Link href={completedHref} className="link-action">
          {showCompleted ? "Ocultar completadas" : "Ver completadas"}
        </Link>
      </div>

      {tasks.length === 0 ? (
        <EmptyState
          title={showCompleted ? "Todavía no hay tareas" : "No hay tareas pendientes"}
          description="Crea una arriba con su prioridad y fecha límite. Aparecerá aquí y en el Inicio, y podrás marcarla como hecha con un toque."
        />
      ) : (
        <ul className="mt-2 border-t border-line">
          {tasks.map((task) => {
            const done = task.status === "DONE";
            const overdue = !done && task.dueDate !== null && task.dueDate < startOfToday;
            return (
              <li key={task.id} className="flex items-center gap-3 border-b border-line py-3">
                <TaskCheck taskId={task.id} done={done} title={task.title} />
                <Link
                  href={`/app/tareas/${task.id}`}
                  className="group flex min-w-0 flex-1 items-center justify-between gap-4"
                >
                  <span className="min-w-0">
                    <span
                      className={`block truncate font-mono text-sm transition-colors group-hover:text-accent ${
                        done ? "text-muted line-through" : ""
                      }`}
                    >
                      {task.title}
                    </span>
                    {!projectId && task.project && (
                      <span className="block truncate font-mono text-[11px] text-muted">
                        {task.project.name}
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-3 font-mono text-xs text-muted">
                    {(task.priority === "URGENT" || task.priority === "HIGH") && !done && (
                      <span className={task.priority === "URGENT" ? "text-danger" : "text-warn"}>
                        {PRIORITY_LABELS[task.priority]}
                      </span>
                    )}
                    {task.dueDate && (
                      <span className={overdue ? "text-danger" : ""}>
                        {overdue ? "Vencida · " : ""}
                        {task.dueDate.toLocaleDateString("es-ES", { day: "2-digit", month: "short" })}
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}

      {!projectId && (
        <section className="mt-14">
          <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
            Plantillas de checklist
          </h2>
          <p className="mt-2 max-w-xl font-sans text-sm text-muted">
            Listas de tareas que se repiten en cada proyecto (por ejemplo, «Antes del rodaje»).
            Aplícalas a un proyecto y se crean todas las tareas de golpe.
          </p>

          <form action={createChecklistTemplate} className="mt-4 flex max-w-md items-end gap-2">
            <FormField label="Nueva plantilla" className="w-full">
              <input name="name" required placeholder="Nombre de la plantilla" className={FIELD} />
            </FormField>
            <SubmitButton
              pendingLabel="Creando…"
              savedLabel="✓ Creada"
              className="btn btn-secondary shrink-0"
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
                      <p className="font-display text-sm font-bold">{template.name}</p>
                      <form action={deleteChecklistTemplate.bind(null, template.id)}>
                        <DeleteButton>Eliminar plantilla</DeleteButton>
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
                      <label className="sr-only" htmlFor={`item-${template.id}`}>
                        Añadir elemento a {template.name}
                      </label>
                      <input
                        id={`item-${template.id}`}
                        name="label"
                        placeholder="Añadir elemento"
                        required
                        className="w-full border border-line bg-transparent px-2 py-1.5 text-xs outline-none transition-colors focus:border-accent"
                      />
                      <SubmitButton pendingLabel="…" className="btn btn-outline btn-sm shrink-0">
                        +
                      </SubmitButton>
                    </form>

                    {template.items.length > 0 && projects.length > 0 && (
                      <form
                        action={applyChecklistTemplate}
                        className="mt-3 flex flex-wrap items-center gap-2"
                      >
                        <input type="hidden" name="templateId" value={template.id} />
                        <label className="sr-only" htmlFor={`apply-${template.id}`}>
                          Proyecto al que aplicar {template.name}
                        </label>
                        <select
                          id={`apply-${template.id}`}
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
                          className="btn btn-secondary btn-sm"
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
      )}
    </div>
  );
}
