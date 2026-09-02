import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { createLocationCore } from "@/lib/locations-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/locations — misma biblioteca que
// app/app/(dashboard)/localizaciones/page.tsx: toda la organización, no
// un proyecto (Location se comparte entre proyectos).
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const locations = await prisma.location.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      contactName: true,
      contactPhone: true,
      availability: true,
      cost: true,
      characteristics: true,
      _count: { select: { scenes: true } },
    },
  });

  return NextResponse.json(
    {
      locations: locations.map((l) => ({
        id: l.id,
        name: l.name,
        address: l.address,
        contactName: l.contactName,
        contactPhone: l.contactPhone,
        availability: l.availability,
        cost: l.cost !== null ? Number(l.cost) : null,
        characteristics: l.characteristics,
        sceneCount: l._count.scenes,
      })),
    },
    { headers: CORS_HEADERS },
  );
}

export async function POST(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Falta el nombre." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const location = await createLocationCore(profile.organizationId, {
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
  if (!location) {
    return NextResponse.json(
      { error: "No se pudo crear la localización." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id: location.id }, { headers: CORS_HEADERS });
}
