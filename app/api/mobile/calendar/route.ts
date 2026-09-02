import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { createCalendarEventCore } from "@/lib/calendar-events-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

function parseMonthParam(month: string | null): Date {
  if (month && /^\d{4}-\d{2}$/.test(month)) {
    const [year, m] = month.split("-").map(Number);
    return new Date(year, m - 1, 1);
  }
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), 1);
}

// GET /api/mobile/calendar?month=YYYY-MM — mismos eventos + días de
// rodaje que app/app/(dashboard)/calendario/page.tsx, para todo el mes
// (organización entera, igual que en la web).
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { searchParams } = new URL(request.url);
  const monthStart = parseMonthParam(searchParams.get("month"));
  const monthEnd = new Date(monthStart.getFullYear(), monthStart.getMonth() + 1, 0);
  const organizationId = profile.organizationId;

  const [events, shootingDays, projects] = await Promise.all([
    prisma.calendarEvent.findMany({
      where: { organizationId, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
      select: {
        id: true,
        title: true,
        type: true,
        date: true,
        notes: true,
        project: { select: { id: true, name: true } },
      },
    }),
    prisma.shootingDay.findMany({
      where: { project: { organizationId }, date: { gte: monthStart, lte: monthEnd } },
      orderBy: { date: "asc" },
      select: { id: true, date: true, projectId: true, project: { select: { name: true } } },
    }),
    prisma.project.findMany({
      where: { organizationId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  return NextResponse.json({ events, shootingDays, projects }, { headers: CORS_HEADERS });
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
  if (!body || typeof body.title !== "string" || !body.title.trim() || typeof body.date !== "string") {
    return NextResponse.json(
      { error: "Faltan datos del evento." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const id = await createCalendarEventCore(profile.organizationId, {
    title: body.title,
    date: new Date(body.date),
    type: typeof body.type === "string" ? body.type : null,
    projectId: typeof body.projectId === "string" ? body.projectId : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  if (!id) {
    return NextResponse.json(
      { error: "No se pudo crear el evento." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id }, { headers: CORS_HEADERS });
}
