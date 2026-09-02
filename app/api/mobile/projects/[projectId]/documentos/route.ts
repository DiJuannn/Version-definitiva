import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { uploadDocumentCore } from "@/lib/documents-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/documentos — mismo contenido que
// app/app/(dashboard)/[projectId]/documentos/page.tsx: guion, call sheets
// generados, y el resto de documentos sueltos (contratos, permisos...).
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

  const [scriptFiles, documents, actors, locations, shootingDays] = await Promise.all([
    prisma.scriptFile.findMany({
      where: { projectId },
      orderBy: { uploadedAt: "desc" },
    }),
    prisma.document.findMany({
      where: { projectId },
      orderBy: { uploadedAt: "desc" },
      include: {
        actor: { select: { name: true } },
        location: { select: { name: true } },
      },
    }),
    prisma.actor.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.location.findMany({
      where: { organizationId: project.organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.shootingDay.findMany({
      where: { projectId, callSheet: { isNot: null } },
      orderBy: { date: "asc" },
      select: { id: true, date: true },
    }),
  ]);

  return NextResponse.json(
    {
      scriptFiles: scriptFiles.map((f) => ({
        id: f.id,
        fileName: f.fileName,
        fileUrl: f.fileUrl,
        uploadedAt: f.uploadedAt,
      })),
      callSheets: shootingDays.map((d) => ({ dayId: d.id, date: d.date })),
      documents: documents.map((d) => ({
        id: d.id,
        fileName: d.fileName,
        fileUrl: d.fileUrl,
        notes: d.notes,
        actorName: d.actor?.name ?? null,
        locationName: d.location?.name ?? null,
        uploadedAt: d.uploadedAt,
      })),
      actors,
      locations,
    },
    { headers: CORS_HEADERS },
  );
}

// POST multipart/form-data: campos "file" (obligatorio), "notes",
// "actorId" y "locationId" (opcionales) — misma forma que el <form> de
// la web.
export async function POST(
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

  const formData = await request.formData().catch(() => null);
  const file = formData?.get("file");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Falta el archivo." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const notes = formData.get("notes");
  const actorId = formData.get("actorId");
  const locationId = formData.get("locationId");

  const document = await uploadDocumentCore(projectId, project.organizationId, {
    file,
    notes: typeof notes === "string" ? notes : null,
    actorId: typeof actorId === "string" ? actorId : null,
    locationId: typeof locationId === "string" ? locationId : null,
  });
  if (!document) {
    return NextResponse.json(
      { error: "No se pudo subir el archivo." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json(
    { id: document.id, fileName: document.fileName, fileUrl: document.fileUrl },
    { headers: CORS_HEADERS },
  );
}
