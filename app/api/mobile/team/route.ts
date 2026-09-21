import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

const clean = (v: unknown, max = 200): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);

// GET /api/mobile/team — el directorio de personas de la organización (igual que app/app/(dashboard)/equipo).
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const people = await prisma.person.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { firstName: "asc" },
    include: { _count: { select: { actors: true, crewMembers: true } } },
  });
  return NextResponse.json(
    {
      people: people.map((p) => ({
        id: p.id,
        name: [p.firstName, p.lastName].filter(Boolean).join(" "),
        role: p.primaryRole,
        email: p.email,
        phone: p.phone,
        projects: p._count.actors + p._count.crewMembers,
      })),
    },
    { headers: CORS_HEADERS },
  );
}

// POST /api/mobile/team { firstName, lastName?, primaryRole?, email?, phone? }
export async function POST(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const firstName = clean(body?.firstName);
  if (!firstName) return NextResponse.json({ error: "Falta el nombre." }, { status: 400, headers: CORS_HEADERS });

  const person = await prisma.person.create({
    data: {
      organizationId: profile.organizationId,
      firstName,
      lastName: clean(body?.lastName),
      primaryRole: clean(body?.primaryRole),
      email: clean(body?.email),
      phone: clean(body?.phone, 40),
    },
  });
  return NextResponse.json({ id: person.id }, { headers: CORS_HEADERS });
}
