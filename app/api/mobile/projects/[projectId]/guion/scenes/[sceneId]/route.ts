import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { deleteSceneCore, updateSceneCore } from "@/lib/scenes-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/guion/scenes/:sceneId — misma
// escena + mismos datos para los selectores (localizaciones,
// personajes, desglose, equipo) que
// app/app/(dashboard)/[projectId]/guion/[sceneId]/page.tsx.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, sceneId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const [scene, locations, characters, breakdownElements, crewMembers] = await Promise.all([
    prisma.scene.findFirst({
      where: { id: sceneId, projectId },
      include: {
        characters: { select: { characterId: true } },
        breakdownElements: { select: { breakdownElementId: true, condition: true } },
        crewMembers: { select: { crewMemberId: true } },
      },
    }),
    prisma.location.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.character.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.breakdownElement.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, category: true },
    }),
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true, role: true },
    }),
  ]);

  if (!scene) {
    return NextResponse.json(
      { error: "Escena no encontrada." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    {
      scene: {
        id: scene.id,
        number: scene.number,
        intExt: scene.intExt,
        dayPart: scene.dayPart,
        locationId: scene.locationId,
        storyOrder: scene.storyOrder,
        order: scene.order,
        description: scene.description,
        action: scene.action,
        dialogueNotes: scene.dialogueNotes,
        extrasNotes: scene.extrasNotes,
        productionNotes: scene.productionNotes,
        characterIds: scene.characters.map((c) => c.characterId),
        breakdownElementIds: scene.breakdownElements.map((b) => b.breakdownElementId),
        breakdownConditions: Object.fromEntries(
          scene.breakdownElements.map((b) => [b.breakdownElementId, b.condition]),
        ),
        crewMemberIds: scene.crewMembers.map((c) => c.crewMemberId),
      },
      locations,
      characters,
      breakdownElements,
      crewMembers,
    },
    { headers: CORS_HEADERS },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, sceneId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.number !== "string") {
    return NextResponse.json(
      { error: "Falta el número de escena." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const ok = await updateSceneCore(projectId, sceneId, project.organizationId, {
    number: body.number,
    intExt: typeof body.intExt === "string" ? body.intExt : null,
    dayPart: typeof body.dayPart === "string" ? body.dayPart : null,
    locationId: typeof body.locationId === "string" ? body.locationId : null,
    storyOrder: typeof body.storyOrder === "number" ? body.storyOrder : null,
    description: typeof body.description === "string" ? body.description : null,
    action: typeof body.action === "string" ? body.action : null,
    dialogueNotes: typeof body.dialogueNotes === "string" ? body.dialogueNotes : null,
    extrasNotes: typeof body.extrasNotes === "string" ? body.extrasNotes : null,
    productionNotes: typeof body.productionNotes === "string" ? body.productionNotes : null,
    characterIds: Array.isArray(body.characterIds) ? body.characterIds : [],
    breakdownElementIds: Array.isArray(body.breakdownElementIds) ? body.breakdownElementIds : [],
    breakdownConditions:
      body.breakdownConditions && typeof body.breakdownConditions === "object"
        ? body.breakdownConditions
        : {},
    crewMemberIds: Array.isArray(body.crewMemberIds) ? body.crewMemberIds : [],
  });

  if (!ok) {
    return NextResponse.json(
      { error: "No se pudo guardar la escena." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; sceneId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, sceneId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteSceneCore(projectId, sceneId);

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
