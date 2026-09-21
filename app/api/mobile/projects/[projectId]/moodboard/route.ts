import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { getMoodboard } from "@/lib/moodboard-core";
import { getMoodboardLookup } from "@/lib/moodboard-lookup";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { MOODBOARD_AI_FREE_PER_PROJECT, MOODBOARD_AI_PRO_DAILY_LIMIT } from "@/lib/limits";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/moodboard — el moodboard del proyecto para verlo en la app (solo
// lectura): las tarjetas y lo que hace falta para pintar las tarjetas vivas (escenas, personajes, sitios).
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const pro = await isProjectOwnerPro(project.organizationId);
  const [board, lookup] = await Promise.all([getMoodboard(projectId, pro), getMoodboardLookup(projectId)]);
  return NextResponse.json(
    {
      projectName: project.name,
      cards: board.cards,
      updatedAt: board.updatedAt,
      lookup,
      // «Completar con IA»: cuántas sugerencias van usadas (gratis: 1 por proyecto; PRO: 10 al día).
      ai: { pro, used: board.aiUsed, limit: pro ? MOODBOARD_AI_PRO_DAILY_LIMIT : MOODBOARD_AI_FREE_PER_PROJECT },
    },
    { headers: CORS_HEADERS },
  );
}
