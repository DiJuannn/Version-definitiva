import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { deleteOwnAccountCore } from "@/lib/account-delete-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/account — si eres la única persona de tu organización,
// para que la app pueda avisar de qué se borra antes de pedir
// confirmación (mismo aviso que ya da /app/organizacion en la web).
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const otherMembers = await prisma.user.count({
    where: { organizationId: profile.organizationId, id: { not: profile.id } },
  });

  return NextResponse.json({ soleMember: otherMembers === 0 }, { headers: CORS_HEADERS });
}

// DELETE /api/mobile/account — mismo borrado que el botón "Eliminar mi
// cuenta" de la web (lib/account-delete-core.ts), obligatorio para pasar
// la revisión de Apple/Google en cualquier app con creación de cuenta.
export async function DELETE(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const result = await deleteOwnAccountCore(profile.id, profile.organizationId);
  if ("error" in result) {
    return NextResponse.json({ error: result.error }, { status: 400, headers: CORS_HEADERS });
  }

  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
