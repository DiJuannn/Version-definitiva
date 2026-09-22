import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { importShotListCore } from "@/lib/shot-list-import-core";
import type { ShotListProposal } from "@/lib/mistral";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; importId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId, importId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const importRow = await prisma.shotListImport.findFirst({ where: { id: importId, projectId } });
  if (!importRow) return NextResponse.json({ error: "No encontrado." }, { status: 404, headers: CORS_HEADERS });

  const existingScenes = await prisma.scene.findMany({
    where: { projectId },
    select: { number: true, shots: { select: { number: true } } },
  });
  const existingShotsByScene: Record<string, string[]> = {};
  for (const scene of existingScenes) {
    existingShotsByScene[scene.number] = scene.shots.map((s) => s.number);
  }

  return NextResponse.json(
    {
      fileName: importRow.fileName,
      proposal: importRow.proposedData as unknown as ShotListProposal,
      existingShotsByScene,
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; importId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId, importId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as { proposal?: unknown } | null;
  const ok = await importShotListCore(projectId, importId, body?.proposal);
  if (!ok) return NextResponse.json({ error: "No se encontró la importación." }, { status: 404, headers: CORS_HEADERS });

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; importId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId, importId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  await prisma.shotListImport.deleteMany({ where: { id: importId, projectId } });
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
