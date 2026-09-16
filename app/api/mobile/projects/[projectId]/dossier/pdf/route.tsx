import { NextResponse } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { getProjectSummary } from "@/lib/project-summary";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { DossierDocument } from "@/lib/pdf/DossierDocument";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/dossier/pdf — mismo PDF que
// app/api/pdf/dossier/[projectId]/route.tsx (exclusivo de PRO).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  if (!(await isProjectOwnerPro(project.organizationId))) {
    return NextResponse.json(
      { error: "El dossier completo en PDF es una función de PRO." },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const summary = await getProjectSummary(projectId);

  const buffer = await renderToBuffer(<DossierDocument summary={summary} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dossier-${summary.project.name}.pdf"`,
    },
  });
}
