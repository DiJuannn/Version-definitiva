import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// DELETE /api/mobile/inventory/:itemId — quita un objeto del inventario de la organización.
export async function DELETE(request: Request, { params }: { params: Promise<{ itemId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { itemId } = await params;
  await prisma.inventoryItem.deleteMany({ where: { id: itemId, organizationId: profile.organizationId } });
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
