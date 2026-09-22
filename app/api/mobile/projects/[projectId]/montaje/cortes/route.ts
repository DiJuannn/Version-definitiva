import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { createEditCutCore, listEditCutsCore } from "@/lib/edit-cuts-core";
import { logActivity } from "@/lib/activity-log";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/montaje/cortes — igual que Montaje → Cortes en la web.
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const cuts = await listEditCutsCore(projectId);
  return NextResponse.json(
    {
      cuts: cuts.map((c) => ({
        id: c.id,
        name: c.name,
        durationLabel: c.durationLabel,
        date: c.date,
        status: c.status,
        notes: c.notes,
      })),
    },
    { headers: CORS_HEADERS },
  );
}

// POST /api/mobile/projects/:projectId/montaje/cortes { name, durationLabel?, date?, status?, notes? }
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name : "";
  const created = await createEditCutCore(projectId, {
    name,
    durationLabel: typeof body?.durationLabel === "string" ? body.durationLabel : null,
    date: typeof body?.date === "string" && body.date ? new Date(body.date) : null,
    status: typeof body?.status === "string" ? body.status : null,
    notes: typeof body?.notes === "string" ? body.notes : null,
  });
  if (!created) return NextResponse.json({ error: "Falta el nombre." }, { status: 400, headers: CORS_HEADERS });

  await logActivity(projectId, profile.id, `añadió un corte de montaje (${name})`);
  return NextResponse.json({ id: created.id }, { headers: CORS_HEADERS });
}
