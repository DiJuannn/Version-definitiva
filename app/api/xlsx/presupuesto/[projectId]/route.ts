import { NextResponse, type NextRequest } from "next/server";
import { getProjectForCurrentUser } from "@/lib/project-access";
import {
  budgetXlsxFilename,
  buildBudgetWorkbook,
  loadBudgetForExport,
  XLSX_MIME,
} from "@/lib/budget-xlsx";

export const runtime = "nodejs";

// Excel del presupuesto: disponible para todos los planes.
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const categories = await loadBudgetForExport(projectId);
  const buffer = await buildBudgetWorkbook(project, categories);

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": XLSX_MIME,
      "Content-Disposition": `attachment; filename="${budgetXlsxFilename(project.name)}"`,
    },
  });
}
