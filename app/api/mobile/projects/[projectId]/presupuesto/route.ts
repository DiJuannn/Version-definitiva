import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createBudgetCategoryCore } from "@/lib/budget-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/projects/:projectId/presupuesto — mismas categorías
// y partidas que app/app/(dashboard)/[projectId]/presupuesto/page.tsx,
// con los totales ya calculados.
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

  const categories = await prisma.budgetCategory.findMany({
    where: { projectId },
    orderBy: { order: "asc" },
    include: {
      items: {
        orderBy: { createdAt: "asc" },
        include: {
          actor: { select: { name: true } },
          location: { select: { name: true } },
          crewMember: { select: { name: true } },
          breakdownElement: { select: { name: true } },
        },
      },
    },
  });

  const categoriesWithTotals = categories.map((category) => {
    const items = category.items.map((item) => {
      const quantity = Number(item.quantity);
      const unitPrice = Number(item.unitPrice);
      const taxRate = Number(item.taxRate);
      const subtotal = quantity * unitPrice;
      const total = subtotal * (1 + taxRate / 100);
      const linked = [item.actor?.name, item.location?.name, item.crewMember?.name, item.breakdownElement?.name].filter(
        Boolean,
      );
      return {
        id: item.id,
        description: item.description,
        quantity,
        unitPrice,
        taxRate,
        total,
        linked,
      };
    });
    const categoryTotal = items.reduce((sum, item) => sum + item.total, 0);
    return { id: category.id, name: category.name, items, categoryTotal };
  });

  const grandTotal = categoriesWithTotals.reduce((sum, c) => sum + c.categoryTotal, 0);

  return NextResponse.json({ categories: categoriesWithTotals, grandTotal }, { headers: CORS_HEADERS });
}

export async function POST(
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

  const body = await request.json().catch(() => null);
  if (!body || typeof body.name !== "string" || !body.name.trim()) {
    return NextResponse.json(
      { error: "Falta el nombre de la categoría." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const id = await createBudgetCategoryCore(projectId, body.name);
  if (!id) {
    return NextResponse.json(
      { error: "No se pudo crear la categoría." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id }, { headers: CORS_HEADERS });
}
