import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { prisma } from "@/lib/prisma";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// DELETE /api/mobile/projects/:projectId/claqueta/clap/:clapLogId —
// misma lógica que deleteClapLog en lib/actions/clapboard.ts.
export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; clapLogId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, clapLogId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await prisma.clapLog.deleteMany({ where: { id: clapLogId, projectId } });

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
