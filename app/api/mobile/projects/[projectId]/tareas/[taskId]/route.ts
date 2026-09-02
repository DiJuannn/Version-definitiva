import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { deleteTaskCore, updateTaskCore, updateTaskStatusCore } from "@/lib/tasks-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/tareas/:taskId — misma ficha que
// app/app/(dashboard)/tareas/[taskId]/page.tsx, con los comentarios.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, taskId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const task = await prisma.task.findFirst({
    where: { id: taskId, projectId },
    include: { comments: { orderBy: { createdAt: "asc" } } },
  });
  if (!task) {
    return NextResponse.json(
      { error: "Tarea no encontrada." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      id: task.id,
      title: task.title,
      description: task.description,
      status: task.status,
      priority: task.priority,
      assignedTo: task.assignedTo,
      dueDate: task.dueDate,
      category: task.category,
      comments: task.comments.map((c) => ({
        id: c.id,
        body: c.body,
        createdAt: c.createdAt,
      })),
    },
    { headers: CORS_HEADERS },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, taskId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const existing = await prisma.task.findFirst({ where: { id: taskId, projectId } });
  if (!existing) {
    return NextResponse.json(
      { error: "Tarea no encontrada." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body) {
    return NextResponse.json({ error: "Cuerpo inválido." }, { status: 400, headers: CORS_HEADERS });
  }

  // Cambiar solo el estado (arrastrar la tarea entre columnas) y editar el
  // resto de campos son dos acciones separadas en la web — aquí conviven
  // en el mismo PATCH: cada una solo se aplica si el móvil manda ese campo.
  if (typeof body.status === "string") {
    const updated = await updateTaskStatusCore(profile.organizationId, taskId, profile.id, body.status);
    if (!updated) {
      return NextResponse.json({ error: "Estado inválido." }, { status: 400, headers: CORS_HEADERS });
    }
  }

  if (typeof body.title === "string") {
    const updated = await updateTaskCore(profile.organizationId, taskId, {
      title: body.title,
      description: typeof body.description === "string" ? body.description : null,
      assignedTo: typeof body.assignedTo === "string" ? body.assignedTo : null,
      dueDate: typeof body.dueDate === "string" && body.dueDate ? new Date(body.dueDate) : null,
      priority: typeof body.priority === "string" ? body.priority : null,
      category: typeof body.category === "string" ? body.category : null,
    });
    if (!updated) {
      return NextResponse.json({ error: "No se pudo guardar." }, { status: 400, headers: CORS_HEADERS });
    }
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; taskId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, taskId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const existing = await prisma.task.findFirst({ where: { id: taskId, projectId } });
  if (!existing) {
    return NextResponse.json(
      { error: "Tarea no encontrada." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteTaskCore(profile.organizationId, taskId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
