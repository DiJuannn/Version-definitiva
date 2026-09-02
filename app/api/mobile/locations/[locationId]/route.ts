import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { deleteLocationCore, updateLocationCore } from "@/lib/locations-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/locations/:locationId — misma ficha que
// app/app/(dashboard)/localizaciones/[locationId]/page.tsx (sin el mapa
// ni los vídeos, que se quedan en la web por ahora).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { locationId } = await params;
  const location = await prisma.location.findFirst({
    where: { id: locationId, organizationId: profile.organizationId },
  });
  if (!location) {
    return NextResponse.json(
      { error: "Localización no encontrada." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const scenesUsingLocation = await prisma.scene.findMany({
    where: { locationId },
    select: { project: { select: { id: true, name: true } } },
  });
  const usageByProject = new Map<string, { name: string; count: number }>();
  for (const scene of scenesUsingLocation) {
    const entry = usageByProject.get(scene.project.id);
    if (entry) entry.count += 1;
    else usageByProject.set(scene.project.id, { name: scene.project.name, count: 1 });
  }

  return NextResponse.json(
    {
      id: location.id,
      name: location.name,
      address: location.address,
      contactName: location.contactName,
      contactPhone: location.contactPhone,
      availability: location.availability,
      cost: location.cost !== null ? Number(location.cost) : null,
      characteristics: location.characteristics,
      permitsNotes: location.permitsNotes,
      restrictions: location.restrictions,
      productionNotes: location.productionNotes,
      notes: location.notes,
      photoUrls: location.photoUrls,
      usedIn: [...usageByProject.values()],
    },
    { headers: CORS_HEADERS },
  );
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { locationId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Falta el nombre." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const ok = await updateLocationCore(profile.organizationId, locationId, {
    name: body.name,
    address: typeof body.address === "string" ? body.address : null,
    contactName: typeof body.contactName === "string" ? body.contactName : null,
    contactPhone: typeof body.contactPhone === "string" ? body.contactPhone : null,
    availability: typeof body.availability === "string" ? body.availability : null,
    cost: typeof body.cost === "number" ? body.cost : null,
    characteristics: Array.isArray(body.characteristics) ? body.characteristics : [],
    permitsNotes: typeof body.permitsNotes === "string" ? body.permitsNotes : null,
    restrictions: typeof body.restrictions === "string" ? body.restrictions : null,
    productionNotes: typeof body.productionNotes === "string" ? body.productionNotes : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  });
  if (!ok) {
    return NextResponse.json(
      { error: "No se pudo guardar." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { locationId } = await params;
  await deleteLocationCore(profile.organizationId, locationId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
