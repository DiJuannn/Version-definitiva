import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createShotCore } from "@/lib/shots-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, sceneId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.number !== "string" || !body.number.trim()) {
    return NextResponse.json(
      { error: "Falta el número de plano." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const id = await createShotCore(projectId, sceneId, {
    number: body.number,
    shotSize: typeof body.shotSize === "string" ? body.shotSize : null,
    description: typeof body.description === "string" ? body.description : null,
  });

  if (!id) {
    return NextResponse.json(
      { error: "No se pudo crear el plano." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id }, { headers: CORS_HEADERS });
}
