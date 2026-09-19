import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { isProjectOwnerPro } from "@/lib/project-plan";
import {
  budgetXlsxFilename,
  buildBudgetWorkbook,
  loadBudgetForExport,
  XLSX_MIME,
} from "@/lib/budget-xlsx";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export const runtime = "nodejs";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/presupuesto/xlsx — mismo Excel que
// app/api/xlsx/presupuesto/[projectId]/route.ts (función PRO).
export async function GET(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }

  const { projectId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }

  if (!(await isProjectOwnerPro(project.organizationId))) {
    return NextResponse.json(
      { error: "Exportar el presupuesto a Excel es una función de PRO." },
      { status: 403, headers: CORS_HEADERS },
    );
  }

  const categories = await loadBudgetForExport(projectId);
  const buffer = await buildBudgetWorkbook(project, categories);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      ...CORS_HEADERS,
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${budgetXlsxFilename(project.name)}"`,
    },
  });
}
