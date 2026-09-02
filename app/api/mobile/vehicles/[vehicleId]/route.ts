import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { deleteVehicleCore, updateVehicleCore } from "@/lib/vehicles-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { vehicleId } = await params;
  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Falta el nombre." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const ok = await updateVehicleCore(profile.organizationId, vehicleId, {
    name: body.name,
    type: typeof body.type === "string" ? body.type : null,
    plate: typeof body.plate === "string" ? body.plate : null,
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
  { params }: { params: Promise<{ vehicleId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { vehicleId } = await params;
  await deleteVehicleCore(profile.organizationId, vehicleId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
