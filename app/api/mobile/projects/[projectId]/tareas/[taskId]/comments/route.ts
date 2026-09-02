import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { addTaskCommentCore } from "@/lib/tasks-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body.body !== "string" || !body.body.trim()) {
    return NextResponse.json(
      { error: "Falta el comentario." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const comment = await addTaskCommentCore(profile.organizationId, taskId, body.body);
  if (!comment) {
    return NextResponse.json(
      { error: "No se pudo añadir el comentario." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    { id: comment.id, body: comment.body, createdAt: comment.createdAt },
    { headers: CORS_HEADERS },
  );
}
