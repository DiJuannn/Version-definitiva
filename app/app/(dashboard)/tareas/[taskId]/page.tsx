import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { addTaskComment, deleteTask, updateTask, updateTaskStatus } from "@/lib/actions/tasks";
import { DeleteButton } from "@/components/DeleteButton";
import { TaskPriority, TaskStatus } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";

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

  const LABEL = "font-mono text-[10px] tracking-[0.18em] text-muted uppercase";
  const meta = [
    task.project?.name ?? "Sin proyecto",
    task.shootingDay
      ? `Día de rodaje ${task.shootingDay.date.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`
      : null,
    `Creada el ${task.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`,
  ].filter(Boolean);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdue = task.status !== "DONE" && task.dueDate !== null && task.dueDate < startOfToday;

  return (
    <div className="pb-16">
      <PageHeader
        backHref={backHref}
        backLabel="← Tareas"
        eyebrow="Tarea"
        title={task.title}
        description={meta.join(" · ")}
      />

      {overdue && task.dueDate && (
        <p className="mt-6 border-l-2 border-danger pl-3 font-sans text-sm text-danger">
          Venció el {task.dueDate.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}. Cambia la fecha
          límite o márcala como completada.
        </p>
      )}

      {/* Estado: control segmentado, un toque para cambiarlo. */}
      <form action={statusAction} className="mt-8 flex flex-wrap items-center gap-4">
        <span className={LABEL}>Estado</span>
        <div role="group" aria-label="Estado de la tarea" className="inline-flex rounded-full bg-fg/[0.06] p-1">
          {Object.values(TaskStatus).map((value) => {
            const active = task.status === value;
            return (
              <button
                key={value}
                type="submit"
                name="status"
                value={value}
                aria-pressed={active}
                className={`rounded-full px-4 py-1.5 font-mono text-[11px] tracking-widest uppercase transition-colors ${
                  active
                    ? value === "DONE"
                      ? "bg-success text-bg"
                      : "bg-bg-raised text-fg shadow-sm"
                    : "text-muted hover:text-fg"
                }`}
              >
                {STATUS_LABELS[value]}
              </button>
            );
          })}
        </div>
      </form>

      <form
        action={updateAction}
        className="mt-10 grid gap-x-16 gap-y-8 border-t border-line pt-8 lg:grid-cols-[minmax(0,1fr)_300px]"
      >
        <div className="space-y-6">
          <label className="block">
            <span className={LABEL}>Título</span>
            <input name="title" defaultValue={task.title} required className="field-line font-sans text-lg" />
          </label>
          <label className="block">
            <span className={LABEL}>Descripción</span>
            <textarea
              name="description"
              defaultValue={task.description ?? ""}
              rows={5}
              placeholder="Detalles, enlaces, a quién hay que llamar…"
              className="field mt-2 w-full leading-relaxed"
            />
          </label>
        </div>

        <div className="space-y-5 lg:border-l lg:border-line lg:pl-8">
          <label className="block">
            <span className={LABEL}>Responsable</span>
            <input name="assignedTo" defaultValue={task.assignedTo ?? ""} placeholder="Nadie todavía" className="field-line" />
          </label>
          <label className="block">
            <span className={LABEL}>Fecha límite</span>
            <input
              type="date"
              name="dueDate"
              defaultValue={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
              className="field-line"
            />
          </label>
          <label className="block">
            <span className={LABEL}>Prioridad</span>
            <select name="priority" defaultValue={task.priority} className="field-line">
              {Object.values(TaskPriority).map((value) => (
                <option key={value} value={value}>
                  {PRIORITY_LABELS[value]}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className={LABEL}>Categoría</span>
            <input name="category" defaultValue={task.category ?? ""} placeholder="Producción, arte…" className="field-line" />
          </label>
        </div>

        <div className="lg:col-span-2">
          <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-primary">
            Guardar cambios
          </SubmitButton>
        </div>
      </form>

      <section aria-labelledby="comentarios" className="mt-16 max-w-3xl">
        <h2 id="comentarios" className="flex items-baseline gap-3 border-b border-line pb-3 font-display text-xl font-black tracking-tight uppercase">
          Comentarios
          <span className="font-mono text-[11px] font-normal tracking-widest text-muted">{task.comments.length}</span>
        </h2>
        {task.comments.length > 0 ? (
          <ol className="divide-y divide-line">
            {task.comments.map((comment) => (
              <li key={comment.id} className="py-4">
                <p className={LABEL}>
                  {comment.createdAt.toLocaleString("es-ES", {
                    day: "numeric",
                    month: "short",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
                <p className="mt-1 font-sans text-[15px] leading-relaxed whitespace-pre-line">{comment.body}</p>
              </li>
            ))}
          </ol>
        ) : (
          <p className="py-4 font-sans text-sm text-muted">Aún no hay comentarios. Úsalos para dejar avances o dudas.</p>
        )}
        <form action={commentAction} className="flex items-end gap-4 border-t border-line pt-4">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Comentario nuevo</span>
            <input name="body" placeholder="Escribe un comentario…" required className="field-line" />
          </label>
          <SubmitButton pendingLabel="Enviando…" savedLabel="✓ Enviado" className="btn btn-secondary btn-sm shrink-0">
            Comentar
          </SubmitButton>
        </form>
      </section>

      <form action={deleteTask.bind(null, taskId)} className="mt-16 border-t border-line pt-4">
        <DeleteButton confirmMessage="¿Eliminar esta tarea? No se puede deshacer." className="link-action">
          Eliminar tarea
        </DeleteButton>
      </form>
    </div>
  );
}
