"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalDate, optionalString } from "@/lib/form-utils";
import { TaskPriority, TaskStatus } from "@/lib/generated/prisma";

function revalidateTaskPaths(organizationId: string, projectId: string | null) {
  revalidatePath("/app");
  revalidatePath("/app/tareas");
  if (projectId) revalidatePath(`/app/${projectId}/tareas`);
}

export async function createTask(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const requestedProjectId = optionalString(formData.get("projectId"));
  const project = requestedProjectId
    ? await prisma.project.findFirst({
        where: { id: requestedProjectId, organizationId: profile.organizationId },
      })
    : null;

  const priorityInput = String(formData.get("priority") ?? "");
  const priority = (Object.values(TaskPriority) as string[]).includes(priorityInput)
    ? (priorityInput as TaskPriority)
    : TaskPriority.MEDIUM;

  await prisma.task.create({
    data: {
      organizationId: profile.organizationId,
      projectId: project?.id,
      title,
      description: optionalString(formData.get("description")),
      assignedTo: optionalString(formData.get("assignedTo")),
      dueDate: optionalDate(formData.get("dueDate")),
      priority,
      category: optionalString(formData.get("category")),
    },
  });

  revalidateTaskPaths(profile.organizationId, project?.id ?? null);
}

export async function updateTaskStatus(taskId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: profile.organizationId },
  });
  if (!task) return;

  const statusInput = String(formData.get("status") ?? "");
  if (!(Object.values(TaskStatus) as string[]).includes(statusInput)) return;

  await prisma.task.update({
    where: { id: taskId },
    data: { status: statusInput as TaskStatus },
  });

  revalidatePath(`/app/tareas/${taskId}`);
  revalidateTaskPaths(profile.organizationId, task.projectId);
}

export async function updateTask(taskId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: profile.organizationId },
  });
  if (!task) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const priorityInput = String(formData.get("priority") ?? "");
  const priority = (Object.values(TaskPriority) as string[]).includes(priorityInput)
    ? (priorityInput as TaskPriority)
    : task.priority;

  await prisma.task.update({
    where: { id: taskId },
    data: {
      title,
      description: optionalString(formData.get("description")),
      assignedTo: optionalString(formData.get("assignedTo")),
      dueDate: optionalDate(formData.get("dueDate")),
      priority,
      category: optionalString(formData.get("category")),
    },
  });

  revalidatePath(`/app/tareas/${taskId}`);
  revalidateTaskPaths(profile.organizationId, task.projectId);
}

export async function deleteTask(taskId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: profile.organizationId },
  });
  if (!task) return;

  await prisma.task.delete({ where: { id: taskId } });
  revalidateTaskPaths(profile.organizationId, task.projectId);
}

export async function addTaskComment(taskId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const task = await prisma.task.findFirst({
    where: { id: taskId, organizationId: profile.organizationId },
  });
  if (!task) return;

  const body = String(formData.get("body") ?? "").trim();
  if (!body) return;

  await prisma.taskComment.create({ data: { taskId, body } });
  revalidatePath(`/app/tareas/${taskId}`);
}
