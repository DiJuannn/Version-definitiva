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

// Botón «Nueva tarea» con su diálogo, para ponerlo en las acciones de la
// cabecera de la página (una sola acción principal arriba a la derecha).
export async function NewTaskButton({
  organizationId,
  projectId,
}: {
  organizationId: string;
  projectId?: string;
}) {
  const projects = projectId
    ? []
    : await prisma.project.findMany({ where: { organizationId }, orderBy: { name: "asc" }, select: { id: true, name: true } });
  return (
    <CreateDialog
      label="Nueva tarea"
      title="Nueva tarea"
      description="Aparecerá en esta lista y en el Inicio. Los detalles (responsable, notas) se añaden después en su ficha."
    >
      <NewTaskForm projectId={projectId} projects={projects} />
    </CreateDialog>
  );
}

// «hoy», «mañana», «en 3 días», «hace 2 días»: lo que se entiende sin contar.
function relative(date: Date, startOfToday: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diff = Math.round((d.getTime() - startOfToday.getTime()) / DAY);
  if (diff === 0) return "hoy";
  if (diff === 1) return "mañana";
  if (diff === -1) return "ayer";
  if (diff < 0) return `hace ${-diff} días`;
  return `en ${diff} días`;
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
}

// Prioridad: barra a la izquierda de la fila y etiqueta. Solo urgente y alta
// llevan color (son las que cambian el orden del día); media y baja, texto.
const PRIORITY_STYLE: Record<TaskPriority, { bar: string; text: string }> = {
  URGENT: { bar: "bg-danger", text: "text-danger" },
  HIGH: { bar: "bg-warn", text: "text-warn" },
  MEDIUM: { bar: "", text: "text-muted" },
  LOW: { bar: "", text: "text-muted/70" },
};

// Lista de tareas compartida por /app/tareas (toda la organización) y
// /app/[id]/tareas (un proyecto): mismos controles, distinto alcance. Las
// tareas se agrupan por cuándo hay que hacerlas, que es lo primero que se
// busca al abrir la lista; dentro de cada grupo, la prioridad se ve en el
// borde de la fila.
export async function TasksView({
  organizationId,
  projectId,
  filterProjectId,
  showCompleted,
  completedHref,
  filter,
  hideCreate,
}: {
  organizationId: string;
  projectId?: string;
  // Vista de organización filtrada por un proyecto (sin cambiar de alcance).
  filterProjectId?: string;
  showCompleted: boolean;
  // Enlace que alterna "ver completadas".
  completedHref: string;
  // Control de filtro (segmentado) que pinta la página junto a la línea de estado.
  filter?: React.ReactNode;
  // La página ya pone «Nueva tarea» en su cabecera.
  hideCreate?: boolean;
}) {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const tomorrow = new Date(startOfToday.getTime() + DAY);
  const inAWeek = new Date(startOfToday.getTime() + 7 * DAY);
  const scopeProjectId = projectId ?? filterProjectId;

  const [tasks, projects, templates] = await Promise.all([
    prisma.task.findMany({
      where: {
        organizationId,
        ...(scopeProjectId ? { projectId: scopeProjectId } : {}),
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
  type Group = { id: string; title: string; hint?: string; dot: string; tone?: "danger"; rows: Row[] };
  const endOfWeek = new Date(inAWeek.getTime() - DAY);
  const groups: Group[] = ([
    {
      id: "vencidas",
      title: "Vencidas",
      hint: "ya ha pasado su fecha",
      dot: "bg-danger",
      tone: "danger" as const,
      rows: open.filter((t) => t.dueDate && t.dueDate < startOfToday),
    },
    {
      id: "hoy",
      title: "Hoy",
      dot: "bg-accent",
      rows: open.filter((t) => t.dueDate && t.dueDate >= startOfToday && t.dueDate < tomorrow),
    },
    {
      id: "semana",
      title: "Esta semana",
      hint: `hasta el ${endOfWeek.toLocaleDateString("es-ES", { weekday: "long", day: "numeric" })}`,
      dot: "bg-fg",
      rows: open.filter((t) => t.dueDate && t.dueDate >= tomorrow && t.dueDate < inAWeek),
    },
    { id: "despues", title: "Más adelante", dot: "bg-muted", rows: open.filter((t) => t.dueDate && t.dueDate >= inAWeek) },
    { id: "sin-fecha", title: "Sin fecha", hint: "ponles fecha para que no se olviden", dot: "bg-muted/50", rows: open.filter((t) => !t.dueDate) },
    { id: "hechas", title: "Completadas", dot: "bg-success", rows: tasks.filter((t) => t.status === "DONE") },
  ] satisfies Group[]).filter((g) => g.rows.length > 0);

  const overdueRows = groups.find((g) => g.id === "vencidas")?.rows ?? [];
  const soon = groups.filter((g) => g.id === "hoy" || g.id === "semana").reduce((n, g) => n + g.rows.length, 0);
  const undated = groups.find((g) => g.id === "sin-fecha")?.rows.length ?? 0;
  const urgent = open.filter((t) => t.priority === "URGENT").length;

  const summary = [
    soon > 0 ? `${soon} esta semana` : null,
    urgent > 0 ? `${urgent} ${urgent === 1 ? "urgente" : "urgentes"}` : null,
    undated > 0 ? `${undated} sin fecha` : null,
  ].filter(Boolean);

  return (
    <div>
      {/* Cómo voy: en frases, y lo vencido como aviso que se puede abrir. */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="font-sans text-[15px] leading-relaxed text-muted">
          {open.length === 0 ? (
            "Nada pendiente."
          ) : (
            <>
              <span className="font-display text-2xl font-black text-fg tabular-nums">{open.length}</span>{" "}
              {open.length === 1 ? "tarea pendiente" : "tareas pendientes"}
              {summary.length > 0 && <>: {summary.join(", ")}.</>}
            </>
          )}
        </p>
        <div className="flex flex-wrap items-center gap-4">
          <Link href={completedHref} className="link-action">
            {showCompleted ? "Ocultar completadas" : "Ver completadas"}
          </Link>
          {!hideCreate && tasks.length > 0 && (
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
      {overdueRows.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {overdueRows.slice(0, 3).map((task) => (
            <li key={task.id} className="border-l-2 border-danger pl-3 font-sans text-sm text-muted">
              <Link href={`/app/tareas/${task.id}`} className="text-fg hover:text-accent">
                {task.title}
              </Link>{" "}
              venció {relative(task.dueDate!, startOfToday)}: cámbiale la fecha o márcala como hecha.
            </li>
          ))}
        </ul>
      )}
      {filter && <div className="mt-6">{filter}</div>}

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
            <NewTaskForm projectId={scopeProjectId} projects={projects} inline />
          </div>
        </section>
      ) : (
        groups.map((group) => (
          <section key={group.id} aria-labelledby={`grupo-${group.id}`} className="mt-10">
            <h2 id={`grupo-${group.id}`} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="flex items-center gap-2.5">
                <span aria-hidden className={`h-2 w-2 translate-y-[-2px] rounded-full ${group.dot}`} />
                <span
                  className={`font-display text-lg font-black tracking-tight uppercase ${
                    group.tone === "danger" ? "text-danger" : ""
                  }`}
                >
                  {group.title}
                </span>
                <span className="font-mono text-[11px] text-muted tabular-nums">{group.rows.length}</span>
              </span>
              {group.hint && <span className="font-sans text-[13px] text-muted">{group.hint}</span>}
            </h2>
            <ul className="sheet mt-3 divide-y divide-line overflow-hidden">
              {[...group.rows]
                .sort(
                  (a, b) =>
                    (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) ||
                    Object.keys(PRIORITY_STYLE).indexOf(a.priority) - Object.keys(PRIORITY_STYLE).indexOf(b.priority),
                )
                .map((task) => {
                  const done = task.status === "DONE";
                  const late = !done && task.dueDate !== null && task.dueDate < startOfToday;
                  const style = PRIORITY_STYLE[task.priority];
                  return (
                    <li key={task.id} className="relative flex items-center gap-4 px-4 py-3.5 sm:px-5">
                      {!done && style.bar && <span aria-hidden className={`absolute inset-y-0 left-0 w-[3px] ${style.bar}`} />}
                      <TaskCheck taskId={task.id} done={done} title={task.title} />
                      <Link
                        href={`/app/tareas/${task.id}`}
                        className="group flex min-w-0 flex-1 items-center justify-between gap-4"
                      >
                        <span className="min-w-0 flex-1">
                          <span
                            className={`block font-sans text-[15px] leading-snug transition-colors group-hover:text-accent ${
                              done ? "text-muted line-through" : ""
                            }`}
                          >
                            {task.title}
                          </span>
                          <span className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1.5 font-sans text-[13px] text-muted">
                            {!done && (task.priority === "URGENT" || task.priority === "HIGH") && (
                              <span className={`font-mono text-[10px] tracking-widest uppercase ${style.text}`}>
                                {PRIORITY_LABELS[task.priority]}
                              </span>
                            )}
                            {task.status === "IN_PROGRESS" && (
                              <span className="inline-flex items-center gap-1.5 text-accent">
                                <span aria-hidden className="h-1.5 w-1.5 animate-pulse rounded-full bg-accent motion-reduce:animate-none" />
                                En marcha
                              </span>
                            )}
                            {!projectId && (
                              <span className="rounded-full bg-fg/[0.07] px-2 py-0.5 text-[12px] text-fg/80">
                                {task.project?.name ?? "Sin proyecto"}
                              </span>
                            )}
                            {task.category && <span>{task.category}</span>}
                            {task.assignedTo && (
                              <span className="inline-flex items-center gap-1.5 text-fg/85">
                                <span
                                  aria-hidden
                                  className="grid h-5 w-5 place-items-center rounded-full bg-accent/20 font-mono text-[9px] font-bold text-fg"
                                >
                                  {initials(task.assignedTo)}
                                </span>
                                {task.assignedTo}
                              </span>
                            )}
                          </span>
                        </span>
                        {task.dueDate && (
                          // La fecha como una hoja de calendario: mes arriba, día grande.
                          <span className="flex shrink-0 items-center gap-3">
                            {!done && (
                              <span className={`hidden text-right font-sans text-[12px] sm:block ${late ? "text-danger" : "text-muted"}`}>
                                {relative(task.dueDate, startOfToday)}
                              </span>
                            )}
                            <span
                              className={`grid w-11 overflow-hidden rounded-md text-center leading-none ${
                                late ? "bg-danger/15 text-danger" : "bg-fg/[0.06]"
                              }`}
                              aria-label={`${shortDate(task.dueDate)}${done ? "" : `, ${relative(task.dueDate, startOfToday)}`}`}
                            >
                              <span
                                className={`py-1 font-mono text-[9px] tracking-widest uppercase ${
                                  late ? "bg-danger/25" : "bg-fg/[0.07] text-muted"
                                }`}
                              >
                                {task.dueDate.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}
                              </span>
                              <span className="py-1.5 font-display text-lg font-black tabular-nums">{task.dueDate.getDate()}</span>
                            </span>
                          </span>
                        )}
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
          <div className="flex flex-wrap items-end justify-between gap-4">
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

          <ul className="sheet mt-4 divide-y divide-line">
            {templates.map((template) => (
              <li key={template.id} className="px-4 sm:px-5">
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
            <li className="px-4 sm:px-5">
              <form action={createChecklistTemplate} className="flex max-w-lg items-end gap-3 py-4">
                <label className="min-w-0 flex-1">
                  <span className="sr-only">Nombre de la plantilla nueva</span>
                  <input name="name" required placeholder="+ Nueva plantilla (p. ej. «Entrega a festivales»)" className="field-line" />
                </label>
                <SubmitButton pendingLabel="Creando…" savedLabel="✓ Creada" className="link-action text-fg">
                  Crear
                </SubmitButton>
              </form>
            </li>
          </ul>
        </section>
      )}
    </div>
  );
}
