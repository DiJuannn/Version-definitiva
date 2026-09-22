import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { createFestivalSubmissionCore, listFestivalSubmissionsCore } from "@/lib/festival-submissions-core";
import { logActivity } from "@/lib/activity-log";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/festivales/envios — igual que el seguimiento de la web.
export async function GET(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const submissions = await listFestivalSubmissionsCore(projectId);
  return NextResponse.json(
    {
      submissions: submissions.map((s) => ({
        id: s.id,
        festivalName: s.festivalName,
        deadline: s.deadline,
        submittedAt: s.submittedAt,
        fee: s.fee !== null ? Number(s.fee) : null,
        status: s.status,
        url: s.url,
        notes: s.notes,
      })),
    },
    { headers: CORS_HEADERS },
  );
}

// POST /api/mobile/projects/:projectId/festivales/envios { festivalName, deadline?, fee?, url?, notes? }
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const festivalName = typeof body?.festivalName === "string" ? body.festivalName : "";
  const fee = typeof body?.fee === "number" ? body.fee : typeof body?.fee === "string" && body.fee ? Number(body.fee) : null;
  const created = await createFestivalSubmissionCore(projectId, {
    festivalName,
    deadline: typeof body?.deadline === "string" && body.deadline ? new Date(body.deadline) : null,
    submittedAt: typeof body?.submittedAt === "string" && body.submittedAt ? new Date(body.submittedAt) : null,
    fee: fee !== null && Number.isFinite(fee) ? fee : null,
    status: typeof body?.status === "string" ? body.status : null,
    url: typeof body?.url === "string" ? body.url : null,
    notes: typeof body?.notes === "string" ? body.notes : null,
  });
  if (!created) return NextResponse.json({ error: "Falta el nombre del festival." }, { status: 400, headers: CORS_HEADERS });

  await logActivity(projectId, profile.id, `apuntó un envío a «${festivalName}»`);
  return NextResponse.json({ id: created.id }, { headers: CORS_HEADERS });
}
