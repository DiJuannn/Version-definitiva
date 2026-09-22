import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { createTaskCore } from "@/lib/tasks-core";
import { logActivity } from "@/lib/activity-log";
import { DELIVERY_CATEGORY, DELIVERY_CHECKLIST_DEFAULTS } from "@/lib/delivery-checklist";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/montaje/entrega — la checklist de entrega: son Tareas con
// category "Entrega" (también se ven en Tareas), igual que en la web.
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const tasks = await prisma.task.findMany({
    where: { projectId, category: DELIVERY_CATEGORY },
    orderBy: [{ status: "asc" }, { createdAt: "asc" }],
    select: { id: true, title: true, status: true },
  });
  return NextResponse.json({ tasks }, { headers: CORS_HEADERS });
}

// POST /api/mobile/projects/:projectId/montaje/entrega — crea la checklist de siempre (solo si el
// proyecto todavía no tiene ninguna).
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const existing = await prisma.task.count({ where: { projectId, category: DELIVERY_CATEGORY } });
  if (existing > 0) {
    return NextResponse.json(
      { error: "Ya tienes una checklist de entrega en este proyecto." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  for (const title of DELIVERY_CHECKLIST_DEFAULTS) {
    await createTaskCore(project.organizationId, projectId, profile.id, { title, category: DELIVERY_CATEGORY });
  }
  await logActivity(projectId, profile.id, "creó la checklist de entrega");
  return NextResponse.json({ created: DELIVERY_CHECKLIST_DEFAULTS.length }, { headers: CORS_HEADERS });
}
