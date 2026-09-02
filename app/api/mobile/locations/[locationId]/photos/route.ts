import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { addLocationPhotoCore, removeLocationPhotoCore } from "@/lib/locations-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST multipart/form-data: campo "photo" — misma subida que la web.
export async function POST(
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
  const formData = await request.formData().catch(() => null);
  const file = formData?.get("photo");
  if (!formData || !(file instanceof File) || file.size === 0) {
    return NextResponse.json(
      { error: "Falta la foto." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const location = await addLocationPhotoCore(profile.organizationId, locationId, file);
  if (!location) {
    return NextResponse.json(
      { error: "No se pudo subir la foto." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ photoUrls: location.photoUrls }, { headers: CORS_HEADERS });
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
  const body = await request.json().catch(() => null);
  if (!body || typeof body.photoUrl !== "string") {
    return NextResponse.json(
      { error: "Falta la foto a borrar." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const location = await removeLocationPhotoCore(profile.organizationId, locationId, body.photoUrl);
  if (!location) {
    return NextResponse.json(
      { error: "No se pudo borrar la foto." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ photoUrls: location.photoUrls }, { headers: CORS_HEADERS });
}
