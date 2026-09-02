"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalDate, optionalString } from "@/lib/form-utils";
import {
  addTaskCommentCore,
  createTaskCore,
  deleteTaskCore,
  updateTaskCore,
  updateTaskStatusCore,
} from "@/lib/tasks-core";

function revalidateTaskPaths(organizationId: string, projectId: string | null) {
  revalidatePath("/app");
  revalidatePath("/app/tareas");
  if (projectId) revalidatePath(`/app/${projectId}/tareas`);
}

export async function createTask(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const requestedProjectId = optionalString(formData.get("projectId"));
  const project = requestedProjectId
    ? await prisma.project.findFirst({
        where: { id: requestedProjectId, organizationId: profile.organizationId },
      })
    : null;

  const created = await createTaskCore(profile.organizationId, project?.id ?? null, profile.id, {
    title: String(formData.get("title") ?? ""),
    description: optionalString(formData.get("description")),
    assignedTo: optionalString(formData.get("assignedTo")),
    dueDate: optionalDate(formData.get("dueDate")),
    priority: String(formData.get("priority") ?? ""),
    category: optionalString(formData.get("category")),
  });
  if (!created) return;

  revalidateTaskPaths(profile.organizationId, project?.id ?? null);
}

export async function updateTaskStatus(taskId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const updated = await updateTaskStatusCore(
    profile.organizationId,
    taskId,
    profile.id,
    String(formData.get("status") ?? ""),
  );
  if (!updated) return;

  revalidatePath(`/app/tareas/${taskId}`);
  revalidateTaskPaths(profile.organizationId, updated.projectId);
}

export async function updateTask(taskId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const updated = await updateTaskCore(profile.organizationId, taskId, {
    title: String(formData.get("title") ?? ""),
    description: optionalString(formData.get("description")),
    assignedTo: optionalString(formData.get("assignedTo")),
    dueDate: optionalDate(formData.get("dueDate")),
    priority: String(formData.get("priority") ?? ""),
    category: optionalString(formData.get("category")),
  });
  if (!updated) return;

  revalidatePath(`/app/tareas/${taskId}`);
  revalidateTaskPaths(profile.organizationId, updated.projectId);
}

export async function deleteTask(taskId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const deleted = await deleteTaskCore(profile.organizationId, taskId);
  if (!deleted) return;

  revalidateTaskPaths(profile.organizationId, deleted.projectId);
}

export async function addTaskComment(taskId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const created = await addTaskCommentCore(
    profile.organizationId,
    taskId,
    String(formData.get("body") ?? ""),
  );
  if (!created) return;

  revalidatePath(`/app/tareas/${taskId}`);
}
