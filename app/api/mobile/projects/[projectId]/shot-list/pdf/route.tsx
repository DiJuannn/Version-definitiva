import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { ShotListDocument } from "@/lib/pdf/ShotListDocument";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/shot-list/pdf — mismo PDF que
// app/api/pdf/shot-list/[projectId]/route.tsx.
export async function GET(
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
      ...CORS_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="shot-list-${project.name}.pdf"`,
    },
  });
}
