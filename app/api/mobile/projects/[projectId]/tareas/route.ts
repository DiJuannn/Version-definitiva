import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createTaskCore } from "@/lib/tasks-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/tareas — misma lista que
// app/app/(dashboard)/[projectId]/tareas/page.tsx.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const tasks = await prisma.task.findMany({
    where: { projectId },
    orderBy: [{ status: "asc" }, { dueDate: "asc" }, { createdAt: "desc" }],
  });

  return NextResponse.json(
    {
      tasks: tasks.map((task) => ({
        id: task.id,
        title: task.title,
        description: task.description,
        status: task.status,
        priority: task.priority,
        assignedTo: task.assignedTo,
        dueDate: task.dueDate,
        category: task.category,
      })),
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.title !== "string" || !body.title.trim()) {
    return NextResponse.json(
      { error: "Falta el título." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const task = await createTaskCore(profile.organizationId, projectId, profile.id, {
    title: body.title,
    description: typeof body.description === "string" ? body.description : null,
    assignedTo: typeof body.assignedTo === "string" ? body.assignedTo : null,
    dueDate: typeof body.dueDate === "string" && body.dueDate ? new Date(body.dueDate) : null,
    priority: typeof body.priority === "string" ? body.priority : null,
    category: typeof body.category === "string" ? body.category : null,
  });
  if (!task) {
    return NextResponse.json(
      { error: "No se pudo crear la tarea." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id: task.id }, { headers: CORS_HEADERS });
}
