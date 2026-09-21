import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { logActivity } from "@/lib/activity-log";
import { generateAllCallSheetsCore } from "@/lib/call-sheets-core";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// POST /api/mobile/projects/:projectId/call-sheets/generar — crea de una vez el call sheet de todos los
// días con escenas que aún no lo tienen (con hora de llamada sugerida por la luz).
export async function POST(request: Request, { params }: { params: Promise<{ projectId: string }> }) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });

  const created = await generateAllCallSheetsCore(projectId);
  if (created === 0) {
    return NextResponse.json(
      { error: "No hay días con escenas que estén sin hoja de llamada." },
      { status: 400, headers: CORS_HEADERS },
    );
  }
  await logActivity(projectId, profile.id, `generó ${created} call sheet${created === 1 ? "" : "s"} de una vez`);
  return NextResponse.json({ generated: created }, { headers: CORS_HEADERS });
}
