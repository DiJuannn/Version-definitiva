import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { getMoodboard } from "@/lib/moodboard-core";
import { getMoodboardLookup } from "@/lib/moodboard-lookup";

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

  const [board, lookup] = await Promise.all([getMoodboard(projectId), getMoodboardLookup(projectId)]);
  return NextResponse.json(
    { projectName: project.name, cards: board.cards, updatedAt: board.updatedAt, lookup },
    { headers: CORS_HEADERS },
  );
}
