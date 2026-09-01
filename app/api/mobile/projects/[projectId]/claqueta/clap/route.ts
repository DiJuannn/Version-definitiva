import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { logClapCore } from "@/lib/clapboard-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/projects/:projectId/claqueta/clap — misma validación
// y creación que logClap en lib/actions/clapboard.ts (extraída a
// lib/clapboard-core.ts), la app manda JSON en vez de FormData.
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
  if (!body) {
    return NextResponse.json(
      { error: "Datos inválidos." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const result = await logClapCore(projectId, body);
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: CORS_HEADERS });
  }

  return NextResponse.json({ id: result.id }, { status: 201, headers: CORS_HEADERS });
}
