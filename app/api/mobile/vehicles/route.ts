import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { createVehicleCore } from "@/lib/vehicles-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/vehicles — misma flota que
// app/app/(dashboard)/vehiculos/page.tsx: toda la organización.
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  return NextResponse.json(
    {
      vehicles: vehicles.map((v) => ({
        id: v.id,
        name: v.name,
        type: v.type,
        plate: v.plate,
        notes: v.notes,
        reservationCount: v._count.reservations,
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

  const vehicle = await createVehicleCore(profile.organizationId, {
    name: body.name,
    type: typeof body.type === "string" ? body.type : null,
    plate: typeof body.plate === "string" ? body.plate : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  });
  if (!vehicle) {
    return NextResponse.json(
      { error: "No se pudo crear el vehículo." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id: vehicle.id }, { headers: CORS_HEADERS });
}
