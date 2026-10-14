import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createTask } from "@/lib/actions/tasks";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { TaskCheck } from "@/components/TaskCheck";
import { TaskPriority } from "@/lib/generated/prisma";
import { StatusLine } from "@/components/gestion/ToolStatus";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};
const PRIORITY_RANK: Record<TaskPriority, number> = { URGENT: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
// Raya de prioridad a la izquierda de cada tarea: rojo urgente, ámbar alta,
// morado tenue media, casi nada baja.
const PRIORITY_BAR: Record<TaskPriority, string> = {
  URGENT: "bg-danger",
  HIGH: "bg-warn",
  MEDIUM: "bg-accent/45",
  LOW: "bg-line",
};
const PRIORITY_TEXT: Record<TaskPriority, string> = {
  URGENT: "text-danger",
  HIGH: "text-warn",
  MEDIUM: "text-muted",
  LOW: "text-muted",
};

const DAY = 24 * 60 * 60 * 1000;

// «Venció hace 2 días», «vence hoy», «mañana», «jue 15 oct»…
function whenLabel(due: Date, today: Date) {
  const days = Math.round((due.getTime() - today.getTime()) / DAY);
  if (days < -1) return `Venció hace ${-days} días`;
  if (days === -1) return "Venció ayer";
  if (days === 0) return "Vence hoy";
  if (days === 1) return "Mañana";
  if (days < 7) return due.toLocaleDateString("es-ES", { weekday: "long" }).replace(/^./, (c) => c.toUpperCase());
  return due.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
}

function NewTaskForm({ projectId, inline }: { projectId: string; inline?: boolean }) {
  return (
    <form
      action={createTask}
      className={inline ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(2,minmax(0,1fr))]" : "grid gap-4"}
    >
      <input type="hidden" name="projectId" value={projectId} />
      <FormField label="Qué hay que hacer" className={inline ? "sm:col-span-2 lg:col-span-1" : undefined}>
        <input name="title" required placeholder="Ej.: confirmar el permiso de la localización" className="field w-full" />
      </FormField>
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
      <div className={`flex items-center gap-4 ${inline ? "sm:col-span-2 lg:col-span-3" : "mt-1"}`}>
        <SubmitButton pendingLabel="Creando…" savedLabel="✓ Creada" className="btn btn-primary">
          Crear tarea
        </SubmitButton>
        <DialogCancel />
      </div>
    </form>
  );
}

export function NewProjectTaskButton({ projectId }: { projectId: string }) {
  return (
    <CreateDialog
      label="Nueva tarea"
      title="Nueva tarea"
      description="Aparecerá en esta lista y en el Inicio. Los detalles (responsable, notas) se añaden después en su ficha."
    >
      <NewTaskForm projectId={projectId} />
    </CreateDialog>
  );
}

// Tareas de un proyecto como un tablero por cuándo: vencidas, esta semana,
// más adelante y sin fecha, una columna cada una (apiladas en el móvil), con
// la prioridad como una raya de color y su nombre en cada tarea.
export async function ProjectTasksBoard({
  organizationId,
  projectId,
  showCompleted,
  completedHref,
}: {
  organizationId: string;
  projectId: string;
  showCompleted: boolean;
  completedHref: string;
}) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const inAWeek = new Date(today.getTime() + 7 * DAY);

  const tasks = await prisma.task.findMany({
    where: { organizationId, projectId, ...(showCompleted ? {} : { status: { not: "DONE" } }) },
    orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
  });

  type Row = (typeof tasks)[number];
  const open = tasks.filter((t) => t.status !== "DONE");
  const done = tasks.filter((t) => t.status === "DONE");
  const byPriorityThenDate = (a: Row, b: Row) =>
    PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority] ||
    (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity);
  const byDate = (a: Row, b: Row) =>
    (a.dueDate?.getTime() ?? Infinity) - (b.dueDate?.getTime() ?? Infinity) || PRIORITY_RANK[a.priority] - PRIORITY_RANK[b.priority];

  const columns = [
    {
      id: "vencidas",
      title: "Vencidas",
      empty: "Nada vencido.",
      tone: "danger" as const,
      rows: open.filter((t) => t.dueDate && t.dueDate < today).sort(byDate),
    },
    {
      id: "semana",
      title: "Esta semana",
      empty: "Nada para estos 7 días.",
      rows: open.filter((t) => t.dueDate && t.dueDate >= today && t.dueDate < inAWeek).sort(byDate),
    },
    {
      id: "despues",
      title: "Más adelante",
      empty: "Nada más adelante.",
      rows: open.filter((t) => t.dueDate && t.dueDate >= inAWeek).sort(byDate),
    },
    {
      id: "sin-fecha",
      title: "Sin fecha",
      empty: "Todo tiene fecha.",
      rows: open.filter((t) => !t.dueDate).sort(byPriorityThenDate),
    },
  ];

  const overdue = columns[0].rows;
  const week = columns[1].rows;
  const urgent = open.filter((t) => t.priority === "URGENT");

  const taskRow = (task: Row) => {
    const isDone = task.status === "DONE";
    const late = !isDone && task.dueDate !== null && task.dueDate < today;
    const meta = [task.assignedTo, task.category].filter(Boolean);
    return (
      <li key={task.id} className="relative flex items-start gap-3 py-3.5 pl-3.5">
        <span aria-hidden className={`absolute top-3.5 bottom-3.5 left-0 w-[3px] rounded-full ${isDone ? "bg-line" : PRIORITY_BAR[task.priority]}`} />
        <span className="pt-px">
          <TaskCheck taskId={task.id} done={isDone} title={task.title} />
        </span>
        <Link href={`/app/tareas/${task.id}`} className="group min-w-0 flex-1">
          <span
            className={`block font-sans text-[15px] leading-snug transition-colors group-hover:text-accent ${
              isDone ? "text-muted line-through" : ""
            }`}
          >
            {task.title}
          </span>
          <span className="mt-1 flex flex-wrap items-center gap-x-2.5 gap-y-0.5 font-sans text-[12px]">
            {!isDone && (
              <span className={`font-medium ${PRIORITY_TEXT[task.priority]}`}>{PRIORITY_LABELS[task.priority]}</span>
            )}
            {task.dueDate && (
              <span className={late ? "text-danger" : "text-muted"}>{whenLabel(task.dueDate, today)}</span>
            )}
            {task.status === "IN_PROGRESS" && <span className="text-accent">En marcha</span>}
            {meta.length > 0 && <span className="truncate text-muted">{meta.join(" · ")}</span>}
          </span>
        </Link>
      </li>
    );
  };

  if (tasks.length === 0) {
    return (
      <section aria-labelledby="primera-tarea" className="mt-12">
        <h2 id="primera-tarea" className="font-display text-xl font-bold">
          {showCompleted ? "Todavía no hay tareas" : "No hay nada pendiente"}
        </h2>
        <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
          Apunta aquí lo que hay que hacer, con su prioridad y fecha límite. Saldrá también en el Inicio, y se marca como
          hecha con un toque en su círculo.
        </p>
        <div className="mt-8 max-w-4xl">
          <NewTaskForm projectId={projectId} inline />
        </div>
        {!showCompleted && (
          <Link href={completedHref} className="link-action mt-6 inline-flex">
            Ver completadas
          </Link>
        )}
      </section>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-x-8 gap-y-2">
        <StatusLine tone={overdue.length > 0 ? "danger" : urgent.length > 0 ? "warn" : "ok"}>
          {open.length} {open.length === 1 ? "pendiente" : "pendientes"}
          {overdue.length > 0 && (
            <>
              {" · "}
              <span className="text-danger">
                {overdue.length === 1 ? (
                  <>
                    vencida «{overdue[0].title}»
                  </>
                ) : (
                  `${overdue.length} vencidas`
                )}
              </span>
            </>
          )}
          {week.length > 0 && <> · {week.length} para esta semana</>}
          {urgent.length > 0 && (
            <>
              {" · "}
              {urgent.length} urgente{urgent.length === 1 ? "" : "s"}
            </>
          )}
          .
        </StatusLine>
        <Link href={completedHref} className="link-action mt-8">
          {showCompleted ? "Ocultar completadas" : "Ver completadas"}
        </Link>
      </div>

      <div className="mt-8 grid gap-6 md:grid-cols-2 xl:grid-cols-4 xl:gap-4">
        {columns.map((col) => (
          <section key={col.id} aria-labelledby={`col-${col.id}`} className="min-w-0">
            <h2
              id={`col-${col.id}`}
              className={`flex items-baseline justify-between gap-3 border-b-2 pb-2 ${
                col.tone === "danger" && col.rows.length > 0 ? "border-danger" : "border-line"
              }`}
            >
              <span
                className={`font-display text-base font-black tracking-tight ${
                  col.tone === "danger" && col.rows.length > 0 ? "text-danger" : ""
                }`}
              >
                {col.title}
              </span>
              <span className="font-mono text-[11px] text-muted tabular-nums">{col.rows.length}</span>
            </h2>
            {col.rows.length === 0 ? (
              <p className="py-4 font-sans text-sm text-muted/80">{col.empty}</p>
            ) : (
              <ul className="divide-y divide-line">{col.rows.map(taskRow)}</ul>
            )}
          </section>
        ))}
      </div>

      {showCompleted && done.length > 0 && (
        <section aria-labelledby="col-hechas" className="mt-12">
          <h2 id="col-hechas" className="flex items-baseline gap-3 border-b-2 border-line pb-2">
            <span className="font-display text-base font-black tracking-tight">Completadas</span>
            <span className="font-mono text-[11px] text-muted tabular-nums">{done.length}</span>
          </h2>
          <ul className="grid divide-y divide-line md:grid-cols-2 md:gap-x-8 md:divide-y-0">{done.map(taskRow)}</ul>
        </section>
      )}
    </div>
  );
}
