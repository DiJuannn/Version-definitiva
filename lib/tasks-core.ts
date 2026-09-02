import { prisma } from "@/lib/prisma";
import { logActivity } from "@/lib/activity-log";
import { TaskPriority, TaskStatus } from "@/lib/generated/prisma";

export type TaskInput = {
  title: string;
  description?: string | null;
  assignedTo?: string | null;
  dueDate?: Date | null;
  priority?: string | null;
  category?: string | null;
};

function resolvePriority(value: string | null | undefined, fallback: TaskPriority): TaskPriority {
  return (Object.values(TaskPriority) as string[]).includes(value ?? "")
    ? (value as TaskPriority)
    : fallback;
}

export async function createTaskCore(
  organizationId: string,
  projectId: string | null,
  userId: string,
  input: TaskInput,
) {
  const title = input.title.trim();
  if (!title) return null;

  const task = await prisma.task.create({
    data: {
      organizationId,
      projectId: projectId ?? undefined,
      title,
      description: input.description || null,
      assignedTo: input.assignedTo || null,
      dueDate: input.dueDate ?? null,
      priority: resolvePriority(input.priority, TaskPriority.MEDIUM),
      category: input.category || null,
    },
  });

  if (projectId) {
    await logActivity(projectId, userId, `creó la tarea "${title}"`);
  }

  return task;
}

export async function updateTaskCore(
  organizationId: string,
  taskId: string,
  input: TaskInput,
) {
  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId } });
  if (!task) return null;

  const title = input.title.trim();
  if (!title) return null;

  return prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: input.description || null,
      assignedTo: input.assignedTo || null,
      dueDate: input.dueDate ?? null,
      priority: resolvePriority(input.priority, task.priority),
      category: input.category || null,
    },
  });
}

export async function updateTaskStatusCore(
  organizationId: string,
  taskId: string,
  userId: string,
  status: string,
) {
  if (!(Object.values(TaskStatus) as string[]).includes(status)) return null;

  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId } });
  if (!task) return null;

  const updated = await prisma.task.update({
    where: { id: taskId },
    data: { status: status as TaskStatus },
  });

  if (task.projectId && status === TaskStatus.DONE) {
    await logActivity(task.projectId, userId, `marcó como hecha la tarea "${task.title}"`);
  }

  return updated;
}

export async function deleteTaskCore(organizationId: string, taskId: string) {
  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId } });
  if (!task) return null;

  await prisma.task.delete({ where: { id: taskId } });
  return task;
}

export async function addTaskCommentCore(organizationId: string, taskId: string, body: string) {
  const trimmed = body.trim();
  if (!trimmed) return null;

  const task = await prisma.task.findFirst({ where: { id: taskId, organizationId } });
  if (!task) return null;

  return prisma.taskComment.create({ data: { taskId, body: trimmed } });
}
