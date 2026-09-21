import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { requestMoodboardSuggestions } from "@/lib/moodboard-ai-request";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// La IA puede tardar más de los 10 s por defecto de una función de Vercel.
export const maxDuration = 60;

// POST /api/mobile/projects/:projectId/moodboard/ia — «Completar con IA»: propone tono, paleta, referencias e ideas a
// partir del resumen del proyecto. Solo propone (no toca el tablero). Gratis: 1 por proyecto; PRO: 10 al día.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const result = await requestMoodboardSuggestions(projectId, project.organizationId);
  if (!result.ok) {
    return NextResponse.json(
      { error: result.error, upgrade: Boolean(result.upgrade) },
      { status: result.upgrade ? 403 : 400, headers: CORS_HEADERS },
    );
  }
  return NextResponse.json({ proposal: result.proposal }, { headers: CORS_HEADERS });
}
