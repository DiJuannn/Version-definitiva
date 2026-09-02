import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { ShotListDocument } from "@/lib/pdf/ShotListDocument";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const scenes = await prisma.scene.findMany({
    where: { projectId },
    orderBy: [{ order: "asc" }, { number: "asc" }],
    include: { shots: { orderBy: [{ order: "asc" }, { number: "asc" }] } },
  });

  const isPro = await isProjectOwnerPro(project.organizationId);

  const buffer = await renderToBuffer(
    <ShotListDocument projectName={project.name} scenes={scenes} watermark={!isPro} />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="shot-list-${project.name}.pdf"`,
    },
  });
}
