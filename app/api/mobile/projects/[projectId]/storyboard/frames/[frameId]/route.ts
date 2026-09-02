import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { deleteStoryboardFrameCore } from "@/lib/storyboard-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; frameId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, frameId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteStoryboardFrameCore(projectId, frameId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
