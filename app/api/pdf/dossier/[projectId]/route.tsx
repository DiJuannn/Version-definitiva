import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getProjectSummary } from "@/lib/project-summary";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { DossierDocument } from "@/lib/pdf/DossierDocument";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  if (!(await isProjectOwnerPro(project.organizationId))) {
    return NextResponse.json(
      { error: "El dossier completo en PDF es una función de PRO." },
      { status: 403 },
    );
  }

  // Misma función que usa la pantalla de Resumen — el dossier no debe
  // faltarle nada de lo que ya se ve ahí (equipo técnico, desglose,
  // inventario, vehículos, qué llevar cada día de rodaje).
  const summary = await getProjectSummary(projectId);

  const buffer = await renderToBuffer(<DossierDocument summary={summary} />);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="dossier-${summary.project.name}.pdf"`,
    },
  });
}
