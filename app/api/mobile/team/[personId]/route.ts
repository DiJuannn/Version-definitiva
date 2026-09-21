import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// DELETE /api/mobile/team/:personId — quita a una persona del directorio de la organización.
export async function DELETE(request: Request, { params }: { params: Promise<{ personId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { personId } = await params;
  await prisma.person.deleteMany({ where: { id: personId, organizationId: profile.organizationId } });
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
