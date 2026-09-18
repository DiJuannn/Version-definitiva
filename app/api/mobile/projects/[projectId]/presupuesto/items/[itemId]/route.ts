import { NextResponse } from "next/server";
import { getMobileProfile } from "@/lib/mobile-auth";
import { getProjectForProfile } from "@/lib/project-access";
import { deleteBudgetItemCore, setBudgetItemActualCore } from "@/lib/budget-core";
import { CORS_HEADERS } from "@/lib/mobile-cors";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ projectId: string; itemId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json(
      { error: "No autenticado." },
      { status: 401, headers: CORS_HEADERS },
    );
  }

  const { projectId, itemId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json(
      { error: "Proyecto no encontrado." },
      { status: 404, headers: CORS_HEADERS },
    );
  }

  await deleteBudgetItemCore(projectId, itemId);
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}

// PATCH /api/mobile/projects/:projectId/presupuesto/items/:itemId
// Body: { actualAmount: number | null } — gasto real de la partida.
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ projectId: string; itemId: string }> },
) {
  const profile = await getMobileProfile(request);
  if (!profile) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });
  }

  const { projectId, itemId } = await params;
  const project = await getProjectForProfile(profile, projectId);
  if (!project) {
    return NextResponse.json({ error: "Proyecto no encontrado." }, { status: 404, headers: CORS_HEADERS });
  }

  const body = await request.json().catch(() => null);
  const raw = body?.actualAmount;
  const amount = raw === null || raw === undefined || raw === "" ? null : Number(raw);
  if (amount !== null && (!Number.isFinite(amount) || amount < 0)) {
    return NextResponse.json({ error: "Importe no válido." }, { status: 400, headers: CORS_HEADERS });
  }

  const ok = await setBudgetItemActualCore(projectId, itemId, amount);
  if (!ok) {
    return NextResponse.json({ error: "Partida no encontrada." }, { status: 404, headers: CORS_HEADERS });
  }
  return NextResponse.json({ ok: true }, { headers: CORS_HEADERS });
}
