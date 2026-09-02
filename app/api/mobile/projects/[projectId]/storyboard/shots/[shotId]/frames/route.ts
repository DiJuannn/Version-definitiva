import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { uploadProjectFile } from "@/lib/storage";
import { createStoryboardFrameCore } from "@/lib/storyboard-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST multipart/form-data: campos "image" (opcional) y "description"
// (opcional) — misma forma que el <form> de
// app/app/(dashboard)/[projectId]/storyboard/page.tsx.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; shotId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, shotId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const shot = await prisma.shot.findFirst({ where: { id: shotId, scene: { projectId } } });
  if (!shot) {
    return NextResponse.json(
      { error: "Plano no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return NextResponse.json(
      { error: "Formulario inválido." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const file = formData.get("image");
  let imageUrl: string | null = null;
  if (file instanceof File && file.size > 0) {
    const uploaded = await uploadProjectFile(projectId, file);
    imageUrl = uploaded?.url ?? null;
  }

  const description = formData.get("description");

  const id = await createStoryboardFrameCore(shotId, {
    imageUrl,
    description: typeof description === "string" && description.trim() ? description.trim() : null,
  });

  return NextResponse.json({ id, imageUrl }, { headers: CORS_HEADERS });
}
