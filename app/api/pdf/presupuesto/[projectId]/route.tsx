import { NextResponse, type NextRequest } from "next/server";
import { renderToBuffer } from "@react-pdf/renderer";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { BudgetDocument } from "@/lib/pdf/BudgetDocument";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) {
    return NextResponse.json({ error: "No encontrado" }, { status: 404 });
  }

  const categories = await prisma.budgetCategory.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: { items: { orderBy: { createdAt: "asc" } } },
  });

  const buffer = await renderToBuffer(
    <BudgetDocument projectName={project.name} categories={categories} />,
  );

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="presupuesto-${project.name}.pdf"`,
    },
  });
}
