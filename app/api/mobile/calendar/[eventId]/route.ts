import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { deleteCalendarEventCore } from "@/lib/calendar-events-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ eventId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { eventId } = await params;
  await deleteCalendarEventCore(profile.organizationId, eventId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
