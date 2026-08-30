import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { DossierDocument } from "@/lib/pdf/DossierDocument";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const fullProject = await prisma.project.findUniqueOrThrow({
    where: { id: projectId },
    include: {
      scenes: {
        orderBy: [{ order: "asc" }, { number: "asc" }],
        include: {
          location: true,
          characters: { include: { character: true } },
        },
      },
      actors: { include: { characters: true } },
      characters: true,
      shootingDays: {
        orderBy: { date: "asc" },
        include: {
          scenes: { orderBy: { order: "asc" }, include: { scene: true } },
        },
      },
      budgetCategories: {
        orderBy: { order: "asc" },
        include: { items: true },
      },
    },
  });

  const buffer = await renderToBuffer(<DossierDocument project={fullProject} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dossier-${fullProject.name}.pdf"`,
    },
  });
}
