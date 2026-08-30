import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { createTask } from "@/lib/actions/tasks";
import { TaskPriority } from "@/lib/generated/prisma";

const PRIORITY_LABELS: Record<TaskPriority, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  URGENT: "Urgente",
};

export default async function ProjectTareasPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return (
    <div>
      <Link
        href={`/app/${projectId}`}
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">Tareas</h1>

      <form
        action={createTask}
        className="mt-8 grid gap-2 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input type="hidden" name="projectId" value={projectId} />
        <input
          name="title"
          placeholder="Título"
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent sm:col-span-2"
        />
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
        <div className="sm:col-span-2 lg:col-span-4">
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Crear tarea
          </button>
        </div>
      </form>

      {tasks.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          Todavía no hay tareas en este proyecto.
        </p>
      ) : (
        <div className="mt-10 border-t border-line">
          {tasks.map((task) => (
            <Link
              key={task.id}
              href={`/app/tareas/${task.id}`}
              className="group flex items-center justify-between gap-4 border-b border-line py-3 transition-colors hover:border-accent"
            >
              <span className="font-mono text-sm transition-colors group-hover:text-accent">
                {task.status === "DONE" ? "☑" : "☐"} {task.title}
              </span>
              <span className="font-mono text-xs text-muted">
                {PRIORITY_LABELS[task.priority]}
                {task.dueDate ? ` · ${task.dueDate.toLocaleDateString("es-ES")}` : ""}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
