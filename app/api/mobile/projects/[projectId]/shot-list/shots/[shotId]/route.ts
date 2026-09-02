import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { deleteShotCore, updateShotCore } from "@/lib/shots-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(
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

  const shot = await prisma.shot.findFirst({
    where: { id: shotId, scene: { projectId } },
    include: { scene: { select: { number: true } } },
  });
  if (!shot) {
    return NextResponse.json(
      { error: "Plano no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ shot }, { headers: CORS_HEADERS });
}

export async function PATCH(
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body.number !== "string" || !body.number.trim()) {
    return NextResponse.json(
      { error: "Falta el número de plano." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const ok = await updateShotCore(projectId, shotId, {
    number: body.number,
    shotType: typeof body.shotType === "string" ? body.shotType : null,
    shotSize: typeof body.shotSize === "string" ? body.shotSize : null,
    angle: typeof body.angle === "string" ? body.angle : null,
    movement: typeof body.movement === "string" ? body.movement : null,
    camera: typeof body.camera === "string" ? body.camera : null,
    lens: typeof body.lens === "string" ? body.lens : null,
    fps: typeof body.fps === "number" ? body.fps : null,
    durationSec: typeof body.durationSec === "number" ? body.durationSec : null,
    description: typeof body.description === "string" ? body.description : null,
    audio: typeof body.audio === "string" ? body.audio : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  if (!ok) {
    return NextResponse.json(
      { error: "No se pudo guardar el plano." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
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

  await deleteShotCore(projectId, shotId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
