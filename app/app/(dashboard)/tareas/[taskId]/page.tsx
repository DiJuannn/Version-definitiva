import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { addTaskComment, deleteTask, updateTask, updateTaskStatus } from "@/lib/actions/tasks";
import { DeleteButton } from "@/components/DeleteButton";
import { TaskPriority, TaskStatus } from "@/lib/generated/prisma";
import { BackLink } from "@/components/BackLink";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

const STATUS_LABELS: Record<TaskStatus, string> = {
  PENDING: "Pendiente",
  IN_PROGRESS: "En progreso",
  DONE: "Completada",
};

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ taskId: string }>;
}) {
  const { taskId } = await params;

  const profile = await getCurrentProfile();
  if (!profile) return null;

  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: profile.organizationId },
    include: {
      project: true,
      shootingDay: true,
      comments: { orderBy: { createdAt: "asc" } },
    },
  });
  if (!task) notFound();

  const backHref = task.projectId ? `/app/${task.projectId}/tareas` : "/app/tareas";
  const updateAction = updateTask.bind(null, taskId);
  const statusAction = updateTaskStatus.bind(null, taskId);
  const commentAction = addTaskComment.bind(null, taskId);

  return (
    <div>
      <BackLink href={backHref}>← Tareas</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">{task.title}</h1>
      {(task.project || task.shootingDay) && (
        <p className="mt-1 font-mono text-xs text-muted">
          {task.project?.name}
          {task.shootingDay
            ? ` · Día ${task.shootingDay.date.toLocaleDateString("es-ES")}`
            : ""}
        </p>
      )}

      <form action={statusAction} className="mt-6 flex flex-wrap items-center gap-2">
        {Object.values(TaskStatus).map((value) => (
          <button
            key={value}
            type="submit"
            name="status"
            value={value}
            className={`rounded-full border px-4 py-1.5 font-mono text-xs tracking-widest uppercase transition-colors ${
              task.status === value
                ? "border-accent bg-accent text-bg"
                : "border-line text-muted hover:border-accent hover:text-accent"
            }`}
          >
            {STATUS_LABELS[value]}
          </button>
        ))}
      </form>

      <form
        action={updateAction}
        className="mt-8 grid gap-4 border border-line p-5 sm:grid-cols-2"
      >
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Título
          </span>
          <input
            name="title"
            defaultValue={task.title}
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Descripción
          </span>
          <textarea
            name="description"
            defaultValue={task.description ?? ""}
            rows={3}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Responsable
          </span>
          <input
            name="assignedTo"
            defaultValue={task.assignedTo ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Fecha límite
          </span>
          <input
            type="date"
            name="dueDate"
            defaultValue={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Prioridad
          </span>
          <select
            name="priority"
            defaultValue={task.priority}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            {Object.values(TaskPriority).map((value) => (
              <option key={value} value={value} className="bg-bg">
                {PRIORITY_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Categoría
          </span>
          <input
            name="category"
            defaultValue={task.category ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <div>
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Guardar
          </button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Comentarios
        </h2>
        {task.comments.length > 0 && (
          <div className="mt-3 space-y-3">
            {task.comments.map((comment) => (
              <div key={comment.id} className="border-l-2 border-line pl-3">
                <p className="font-mono text-sm">{comment.body}</p>
                <p className="mt-0.5 font-mono text-[10px] text-muted">
                  {comment.createdAt.toLocaleString("es-ES")}
                </p>
              </div>
            ))}
          </div>
        )}
        <form action={commentAction} className="mt-4 flex gap-2">
          <input
            name="body"
            placeholder="Añadir comentario"
            required
            className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-fg px-4 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Enviar
          </button>
        </form>
      </section>

      <form action={deleteTask.bind(null, taskId)} className="mt-8">
        <DeleteButton
          confirmMessage="¿Eliminar esta tarea? No se puede deshacer."
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          Eliminar tarea
        </DeleteButton>
      </form>
    </div>
  );
}
