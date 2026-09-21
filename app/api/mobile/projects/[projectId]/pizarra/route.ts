import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { buildMapCards, getMapBoard, getMapEntities, listMapBoards, pickPlacedEntities } from "@/lib/project-map";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/[projectId]/pizarra?board=<id> — la pizarra del proyecto (Resumen → Mapa
// del proyecto de la web) para verla en la app, solo lectura. Devuelve la lista de pizarras, la
// disposición de la elegida y los datos vivos de las tarjetas que hay puestas en ella.
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }
  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }

  const boards = await listMapBoards(projectId);
  const wanted = new URL(request.url).searchParams.get("board");
  const activeId = boards.find((b) => b.id === wanted)?.id ?? boards[0].id;

  const [board, cards, entities] = await Promise.all([
    getMapBoard(projectId, activeId),
    buildMapCards(projectId),
    getMapEntities(projectId),
  ]);
  if (!board) {
    return NextResponse.json({ error: "Pizarra no encontrada." }, { status: 404, headers: CORS_HEADERS });
  }

  return NextResponse.json(
    {
      projectName: project.name,
      boards,
      board: { id: board.id, name: board.name, layout: board.layout, updatedAt: board.updatedAt },
      tools: cards.filter((c) => !board.layout.hidden.includes(c.key)),
      entities: pickPlacedEntities(entities, board.layout.items),
    },
    { headers: CORS_HEADERS },
  );
}
