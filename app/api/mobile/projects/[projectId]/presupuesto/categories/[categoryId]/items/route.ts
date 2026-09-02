import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { createBudgetItemCore } from "@/lib/budget-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// Sin vincular actor/localización/equipo/desglose desde el móvil (la
// web lo permite con selects) — se puede seguir editando desde ahí si
// hace falta esa relación.
export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string; categoryId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, categoryId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body.description !== "string" || !body.description.trim()) {
    return NextResponse.json(
      { error: "Falta el concepto." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  const id = await createBudgetItemCore(projectId, project.organizationId, categoryId, {
    description: body.description,
    quantity: typeof body.quantity === "number" ? body.quantity : null,
    unitPrice: typeof body.unitPrice === "number" ? body.unitPrice : null,
    taxRate: typeof body.taxRate === "number" ? body.taxRate : null,
    notes: typeof body.notes === "string" ? body.notes : null,
  });

  if (!id) {
    return NextResponse.json(
      { error: "No se pudo crear la partida." },
      { status: 400, headers: CORS_HEADERS },
    );
  }

  return NextResponse.json({ id }, { headers: CORS_HEADERS });
}
