import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { analyzeScriptCore } from "@/lib/script-analysis-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// La llamada a Mistral puede tardar más de los 10s que Vercel da por
// defecto a una función — mismo motivo que en la página web
// (app/app/(dashboard)/[projectId]/guion/page.tsx).
export const maxDuration = 60;

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
  if (!body || typeof body.scriptFileId !== "string") {
    return NextResponse.json(
      { error: "Falta el guion a analizar." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const result = await analyzeScriptCore(
    projectId,
    body.scriptFileId,
    profile.id,
    profile.organization.plan,
  );
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: CORS_HEADERS });
  }

  return NextResponse.json({ analysisId: result.analysisId }, { headers: CORS_HEADERS });
}
