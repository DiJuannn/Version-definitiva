import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { logActivity } from "@/lib/activity-log";
import { applyScheduleProposal, buildScheduleProposal, summarizeProposal } from "@/lib/schedule-assistant-core";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/projects/:projectId/plan-de-rodaje/asistente
// { startDate: "YYYY-MM-DD", perDay: number, weekendsOnly: boolean, apply?: boolean }
// Sin `apply` solo calcula la propuesta (no guarda nada); con `apply: true` crea las jornadas.
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as {
    startDate?: unknown;
    perDay?: unknown;
    weekendsOnly?: unknown;
    apply?: unknown;
  } | null;
  const scheduleParams = {
    startDate: typeof body?.startDate === "string" ? body.startDate : "",
    perDay: Number(body?.perDay),
    weekendsOnly: body?.weekendsOnly === true,
  };

  if (body?.apply === true) {
    const result = await applyScheduleProposal(projectId, scheduleParams);
    if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400, headers: CORS_HEADERS });
    await logActivity(
      projectId,
      profile.id,
      `creó un plan de rodaje de ${result.days} día${result.days === 1 ? "" : "s"} con el asistente`,
    );
    return NextResponse.json({ days: result.days }, { headers: CORS_HEADERS });
  }

  const proposal = await buildScheduleProposal(projectId, scheduleParams);
  if ("error" in proposal) return NextResponse.json({ error: proposal.error }, { status: 400, headers: CORS_HEADERS });
  return NextResponse.json(summarizeProposal(proposal.days), { headers: CORS_HEADERS });
}
