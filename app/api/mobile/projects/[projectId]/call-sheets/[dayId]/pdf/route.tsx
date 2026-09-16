import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { CallSheetDocument } from "@/lib/pdf/CallSheetDocument";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/call-sheets/:dayId/pdf — mismo PDF
// que app/api/pdf/call-sheet/[dayId]/route.tsx, con marca de agua si la
// organización dueña del proyecto no es PRO.
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string; dayId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, dayId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const summary = await getShootingDaySummary(dayId);
  if (!summary || summary.shootingDay.projectId !== projectId) {
    return NextResponse.json(
      { error: "Día no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const isPro = await isProjectOwnerPro(project.organizationId);

  const buffer = await renderToBuffer(
    <CallSheetDocument projectName={project.name} summary={summary} watermark={!isPro} />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="call-sheet-${summary.shootingDay.date.toISOString().slice(0, 10)}.pdf"`,
    },
  });
}
