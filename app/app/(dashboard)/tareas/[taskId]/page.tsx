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
    task.project ? null : "Sin proyecto",
    task.shootingDay
      ? `Día de rodaje ${task.shootingDay.date.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`
      : null,
    `Creada el ${task.createdAt.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}`,
  ].filter(Boolean);

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const overdue = task.status !== "DONE" && task.dueDate !== null && task.dueDate < startOfToday;

  const dueLabel = task.dueDate
    ? task.dueDate.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })
    : null;

  return (
    <div className="pb-16">
      <PageHeader
        backHref={backHref}
        backLabel="← Tareas"
        eyebrow={task.project ? `Tarea · ${task.project.name}` : "Tarea"}
        title={task.title}
        description={meta.join(" · ")}
      />

      {/* Cómo va: estado, fecha y prioridad en una frase. */}
      <p className="mt-6 font-sans text-[15px] text-muted">
        {task.status === "DONE" ? (
          <span className="text-success">Hecha.</span>
        ) : (
          <>
            <span className={task.status === "IN_PROGRESS" ? "text-accent" : "text-fg"}>
              {task.status === "IN_PROGRESS" ? "En marcha" : "Pendiente"}
            </span>
            {dueLabel ? <> · hay que tenerla el {dueLabel}</> : " · sin fecha límite"}
            {(task.priority === "URGENT" || task.priority === "HIGH") && (
              <span className={task.priority === "URGENT" ? "text-danger" : "text-warn"}>
                {" "}
                · prioridad {PRIORITY_LABELS[task.priority].toLowerCase()}
              </span>
            )}
            {task.assignedTo ? <> · la lleva {task.assignedTo}</> : " · sin responsable"}
          </>
        )}
      </p>
      {overdue && task.dueDate && (
        <p className="mt-3 border-l-2 border-danger pl-3 font-sans text-sm text-muted">
          <span className="text-danger">
            Venció el {task.dueDate.toLocaleDateString("es-ES", { day: "numeric", month: "long" })}.
          </span>{" "}
          Cambia la fecha límite o márcala como completada.
        </p>
      )}

      <div className="mt-10 grid items-start gap-x-10 gap-y-14 lg:grid-cols-[minmax(0,1fr)_340px]">
        {/* ------------------------------------------------ ficha (papel) */}
        <div className="paper p-5 sm:p-8">
          {/* Estado: control segmentado, un toque para cambiarlo. */}
          <form action={statusAction} className="flex flex-wrap items-center justify-between gap-3 border-b border-line pb-5">
            <span className={LABEL}>Estado</span>
            <div role="group" aria-label="Estado de la tarea" className="inline-flex flex-wrap rounded-full bg-fg/[0.07] p-1">
              {Object.values(TaskStatus).map((value) => {
                const active = task.status === value;
                return (
                  <button
                    key={value}
                    type="submit"
                    name="status"
                    value={value}
                    aria-pressed={active}
                    className={`rounded-full px-3.5 py-1.5 font-mono text-[11px] tracking-widest uppercase transition-colors sm:px-4 ${
                      active
                        ? value === "DONE"
                          ? "bg-success text-bg-raised"
                          : value === "IN_PROGRESS"
                            ? "bg-accent text-bg-raised"
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

          <form action={updateAction} className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="block sm:col-span-2">
              <span className={LABEL}>Título</span>
              <input name="title" defaultValue={task.title} required className="field mt-1.5 w-full font-sans text-base" />
            </label>
            <label className="block sm:col-span-2">
              <span className={LABEL}>Descripción</span>
              <textarea
                name="description"
                defaultValue={task.description ?? ""}
                rows={5}
                placeholder="Detalles, enlaces, a quién hay que llamar…"
                className="field mt-1.5 w-full leading-relaxed"
              />
            </label>
            <label className="block">
              <span className={LABEL}>Responsable</span>
              <input name="assignedTo" defaultValue={task.assignedTo ?? ""} placeholder="Nadie todavía" className="field mt-1.5 w-full" />
            </label>
            <label className="block">
              <span className={LABEL}>Fecha límite</span>
              <input
                type="date"
                name="dueDate"
                defaultValue={task.dueDate ? task.dueDate.toISOString().slice(0, 10) : ""}
                className="field mt-1.5 w-full"
              />
            </label>
            <label className="block">
              <span className={LABEL}>Prioridad</span>
              <select name="priority" defaultValue={task.priority} className="field mt-1.5 w-full">
                {Object.values(TaskPriority).map((value) => (
                  <option key={value} value={value}>
                    {PRIORITY_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="block">
              <span className={LABEL}>Categoría</span>
              <input name="category" defaultValue={task.category ?? ""} placeholder="Producción, arte…" className="field mt-1.5 w-full" />
            </label>

            <div className="mt-2 sm:col-span-2">
              <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-primary">
                Guardar cambios
              </SubmitButton>
            </div>
          </form>
        </div>

        {/* ------------------------------------------------ comentarios (mesa) */}
        <section aria-labelledby="comentarios">
          <h2 id="comentarios" className="flex items-baseline gap-3 font-display text-lg font-black tracking-tight uppercase">
            Comentarios
            <span className="font-mono text-[11px] font-normal tracking-widest text-muted">{task.comments.length}</span>
          </h2>
          {task.comments.length > 0 ? (
            <ol className="mt-4 space-y-5 border-l border-line pl-4">
              {task.comments.map((comment) => (
                <li key={comment.id} className="relative">
                  <span aria-hidden className="absolute top-1.5 -left-[21px] h-2 w-2 rounded-full bg-accent" />
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
            <p className="mt-3 font-sans text-sm leading-relaxed text-muted">
              Aún no hay comentarios. Úsalos para dejar avances o dudas.
            </p>
          )}
          <form action={commentAction} className="mt-6 space-y-3">
            <label className="block">
              <span className="sr-only">Comentario nuevo</span>
              <textarea name="body" rows={2} placeholder="Escribe un comentario…" required className="field w-full leading-relaxed" />
            </label>
            <SubmitButton pendingLabel="Enviando…" savedLabel="✓ Enviado" className="btn btn-secondary btn-sm">
              Comentar
            </SubmitButton>
          </form>

          <form action={deleteTask.bind(null, taskId)} className="mt-14 border-t border-line pt-4">
            <DeleteButton
              confirmMessage="¿Eliminar esta tarea? No se puede deshacer."
              className="link-action hover:!text-danger"
            >
              Eliminar tarea
            </DeleteButton>
          </form>
        </section>
      </div>
    </div>
  );
}
