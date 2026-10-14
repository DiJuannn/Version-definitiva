import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/lib/actions/tasks";
import {
  addChecklistTemplateItem,
  applyChecklistTemplate,
  createChecklistTemplate,
  deleteChecklistTemplate,
} from "@/lib/actions/checklist-templates";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { DeleteButton } from "@/components/DeleteButton";
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

const DAY = 24 * 60 * 60 * 1000;

function shortDate(date: Date) {
  return date.toLocaleDateString("es-ES", { day: "numeric", month: "short" }).replace(".", "");
}

// Formulario de alta. En el diálogo va en una columna; en línea (cuando aún
// no hay ninguna tarea) se abre a lo ancho.
function NewTaskForm({
  projectId,
  projects,
  inline,
}: {
  projectId?: string;
  projects: { id: string; name: string }[];
  inline?: boolean;
}) {
  return (
    <form
      action={createTask}
      className={inline ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]" : "grid gap-4"}
    >
      {projectId && <input type="hidden" name="projectId" value={projectId} />}
      <FormField label="Qué hay que hacer" className={inline ? "sm:col-span-2 lg:col-span-1" : undefined}>
        <input name="title" required placeholder="Ej.: confirmar el permiso de la localización" className="field w-full" />
      </FormField>
      {!projectId && (
        <FormField label="Proyecto">
          <select name="projectId" defaultValue="" className="field w-full">
            <option value="">Sin proyecto</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </select>
        </FormField>
      )}
      <div className={inline ? "contents" : "grid grid-cols-2 gap-4"}>
        <FormField label="Prioridad">
          <select name="priority" defaultValue="MEDIUM" className="field w-full">
            {Object.values(TaskPriority).map((value) => (
              <option key={value} value={value}>
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Fecha límite">
          <input type="date" name="dueDate" className="field w-full" />
        </FormField>
      </div>
      <div className={`flex items-center gap-4 ${inline ? "sm:col-span-2 lg:col-span-4" : "mt-1"}`}>
        <SubmitButton pendingLabel="Creando…" savedLabel="✓ Creada" className="btn btn-primary">
          Crear tarea
        </SubmitButton>
        <DialogCancel />
      </div>
    </form>
  );
}

// Lista de tareas compartida por /app/tareas (toda la organización) y
// /app/[id]/tareas (un proyecto): mismos controles, distinto alcance. Las
// tareas se agrupan por cuándo hay que hacerlas, que es lo primero que se
// busca al abrir la lista.
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
  const inAWeek = new Date(startOfToday.getTime() + 7 * DAY);

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

  type Row = (typeof tasks)[number];
  const open = tasks.filter((t) => t.status !== "DONE");
  type Group = { id: string; title: string; tone?: "danger"; rows: Row[] };
  const groups: Group[] = ([
    {
      id: "vencidas",
      title: "Vencidas",
      tone: "danger" as const,
      rows: open.filter((t) => t.dueDate && t.dueDate < startOfToday),
    },
    {
      id: "semana",
      title: "Esta semana",
      rows: open.filter((t) => t.dueDate && t.dueDate >= startOfToday && t.dueDate < inAWeek),
    },
    { id: "despues", title: "Más adelante", rows: open.filter((t) => t.dueDate && t.dueDate >= inAWeek) },
    { id: "sin-fecha", title: "Sin fecha", rows: open.filter((t) => !t.dueDate) },
    { id: "hechas", title: "Completadas", rows: tasks.filter((t) => t.status === "DONE") },
  ] satisfies Group[]).filter((g) => g.rows.length > 0);

  const overdue = groups.find((g) => g.id === "vencidas")?.rows.length ?? 0;
  const urgent = open.filter((t) => t.priority === "URGENT").length;

  return (
    <div>
      {/* Resumen y acciones, en una línea. */}
      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-4 border-b border-line pb-4">
        <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-sm text-muted">
          <span>
            <span className="font-display text-2xl font-black text-fg tabular-nums">{open.length}</span>{" "}
            {open.length === 1 ? "pendiente" : "pendientes"}
          </span>
          {overdue > 0 && (
            <span>
              <span className="font-display text-2xl font-black text-danger tabular-nums">{overdue}</span>{" "}
              {overdue === 1 ? "vencida" : "vencidas"}
            </span>
          )}
          {urgent > 0 && (
            <span>
              <span className="font-display text-2xl font-black text-fg tabular-nums">{urgent}</span>{" "}
              {urgent === 1 ? "urgente" : "urgentes"}
            </span>
          )}
        </p>
        <div className="flex items-center gap-4">
          <Link href={completedHref} className="link-action">
            {showCompleted ? "Ocultar completadas" : "Ver completadas"}
          </Link>
          {tasks.length > 0 && (
            <CreateDialog
              label="Nueva tarea"
              title="Nueva tarea"
              description="Aparecerá en esta lista y en el Inicio. Los detalles (responsable, notas) se añaden después en su ficha."
            >
              <NewTaskForm projectId={projectId} projects={projects} />
            </CreateDialog>
          )}
        </div>
      </div>

      {tasks.length === 0 ? (
        <section aria-labelledby="primera-tarea" className="py-10">
          <h2 id="primera-tarea" className="font-display text-xl font-bold">
            {showCompleted ? "Todavía no hay tareas" : "No hay nada pendiente"}
          </h2>
          <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
            Apunta aquí lo que hay que hacer, con su prioridad y fecha límite. Saldrá también en el Inicio,
            y se marca como hecha con un toque en su círculo.
          </p>
          <div className="mt-8 max-w-5xl">
            <NewTaskForm projectId={projectId} projects={projects} inline />
          </div>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`grupo-${group.id}`} className="mt-8">
            <h2
              id={`grupo-${group.id}`}
              className={`eyebrow flex items-center gap-2 ${group.tone === "danger" ? "!text-danger" : ""}`}
            >
              {group.title}
              <span className="tabular-nums opacity-70">{group.rows.length}</span>
            </h2>
            <ul className="mt-2 divide-y divide-line border-y border-line">
              {[...group.rows]
                .sort((a, b) => (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity))
                .map((task) => {
                  const done = task.status === "DONE";
                  const late = !done && task.dueDate !== null && task.dueDate < startOfToday;
                  const meta = [
                    !projectId ? (task.project?.name ?? "Sin proyecto") : null,
                    task.assignedTo,
                    task.category,
                  ].filter(Boolean);
                  return (
                    <li key={task.id} className="flex items-center gap-4 py-3.5">
                      <TaskCheck taskId={task.id} done={done} title={task.title} />
                      <Link
                        href={`/app/tareas/${task.id}`}
                        className="group flex min-w-0 flex-1 items-center justify-between gap-4"
                      >
                        <span className="min-w-0">
                          <span
                            className={`block truncate font-sans text-[15px] transition-colors group-hover:text-accent ${
                              done ? "text-muted line-through" : ""
                            }`}
                          >
                            {task.title}
                          </span>
                          {(meta.length > 0 || task.status === "IN_PROGRESS") && (
                            <span className="mt-0.5 block truncate font-sans text-[13px] text-muted">
                              {task.status === "IN_PROGRESS" && <span className="text-accent">En marcha · </span>}
                              {meta.join(" · ")}
                            </span>
                          )}
                        </span>
                        <span className="flex shrink-0 items-center gap-4 font-mono text-[11px] tracking-wide text-muted uppercase">
                          {(task.priority === "URGENT" || task.priority === "HIGH") && !done && (
                            <span
                              className={`flex items-center gap-1.5 ${
                                task.priority === "URGENT" ? "text-danger" : "text-warn"
                              }`}
                            >
                              <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                              <span className="sr-only sm:not-sr-only">{PRIORITY_LABELS[task.priority]}</span>
                            </span>
                          )}
                          {task.dueDate && (
                            <span className={`w-14 text-right tabular-nums ${late ? "text-danger" : ""}`}>
                              {shortDate(task.dueDate)}
                            </span>
                          )}
                          <span aria-hidden className="hidden font-sans text-base text-muted transition-colors group-hover:text-accent sm:inline">
                            →
                          </span>
                        </span>
                      </Link>
                    </li>
                  );
                })}
            </ul>
          </section>
        ))
      )}

      {!projectId && (
        <section aria-labelledby="plantillas" className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
            <div>
              <h2 id="plantillas" className="font-display text-2xl font-black tracking-tight uppercase">
                Plantillas de checklist
              </h2>
              <p className="mt-1 max-w-xl font-sans text-sm leading-relaxed text-muted">
                Listas que se repiten en cada proyecto, como «Antes del rodaje». Al aplicarla a un proyecto se
                crean todas sus tareas de golpe.
              </p>
            </div>
          </div>

          <ul className={`divide-y divide-line ${templates.length > 0 ? "border-b border-line" : ""}`}>
            {templates.map((template) => (
              <li key={template.id}>
                <details className="group">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 py-4">
                    <span className="flex min-w-0 items-baseline gap-3">
                      <span className="truncate font-sans text-[17px] font-medium transition-colors group-hover:text-accent">
                        {template.name}
                      </span>
                      <span className="shrink-0 font-sans text-[13px] text-muted">
                        {template.items.length} {template.items.length === 1 ? "tarea" : "tareas"}
                      </span>
                    </span>
                    <span
                      aria-hidden
                      className="font-sans text-xl leading-none text-muted transition-transform group-open:rotate-90 group-hover:text-accent"
                    >
                      ›
                    </span>
                  </summary>

                  <div className="grid gap-x-12 gap-y-6 pb-8 lg:grid-cols-[minmax(0,1fr)_320px]">
                    <div>
                      {template.items.length > 0 ? (
                        <ol className="space-y-2">
                          {template.items.map((item, i) => (
                            <li key={item.id} className="flex gap-3 font-sans text-[15px]">
                              <span className="w-5 shrink-0 text-right font-mono text-[11px] leading-6 text-muted tabular-nums">
                                {i + 1}
                              </span>
                              {item.label}
                            </li>
                          ))}
                        </ol>
                      ) : (
                        <p className="font-sans text-sm text-muted">Todavía vacía: añade su primera tarea.</p>
                      )}
                      <form
                        action={addChecklistTemplateItem.bind(null, template.id)}
                        className="mt-3 flex items-end gap-3 pl-8"
                      >
                        <label className="min-w-0 flex-1">
                          <span className="sr-only">Añadir tarea a {template.name}</span>
                          <input name="label" placeholder="Añadir una tarea a la plantilla" required className="field-line" />
                        </label>
                        <SubmitButton pendingLabel="…" savedLabel="✓" className="link-action text-fg">
                          Añadir
                        </SubmitButton>
                      </form>
                    </div>

                    <div className="space-y-6 lg:border-l lg:border-line lg:pl-8">
                      {template.items.length > 0 && projects.length > 0 && (
                        <form action={applyChecklistTemplate} className="space-y-3">
                          <input type="hidden" name="templateId" value={template.id} />
                          <FormField label="Crear estas tareas en">
                            <select name="projectId" required className="field w-full">
                              {projects.map((project) => (
                                <option key={project.id} value={project.id}>
                                  {project.name}
                                </option>
                              ))}
                            </select>
                          </FormField>
                          <SubmitButton pendingLabel="Aplicando…" savedLabel="✓ Tareas creadas" className="btn btn-secondary btn-sm">
                            Aplicar al proyecto
                          </SubmitButton>
                        </form>
                      )}
                      <form action={deleteChecklistTemplate.bind(null, template.id)}>
                        <DeleteButton className="link-action">Eliminar plantilla</DeleteButton>
                      </form>
                    </div>
                  </div>
                </details>
              </li>
            ))}
          </ul>

          <form
            action={createChecklistTemplate}
            className="flex max-w-lg items-end gap-3 py-5"
          >
            <label className="min-w-0 flex-1">
              <span className="sr-only">Nombre de la plantilla nueva</span>
              <input name="name" required placeholder="+ Nueva plantilla (p. ej. «Entrega a festivales»)" className="field-line" />
            </label>
            <SubmitButton pendingLabel="Creando…" savedLabel="✓ Creada" className="link-action text-fg">
              Crear
            </SubmitButton>
          </form>
        </section>
      )}
    </div>
  );
}
