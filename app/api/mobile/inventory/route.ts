import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getMobileProfile } from "@/lib/mobile-auth";
import { CORS_HEADERS } from "@/lib/mobile-cors";
import { InventoryItemCategory } from "@/lib/generated/prisma";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/labels";

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

// GET /api/mobile/inventory — el inventario de la organización (igual que app/app/(dashboard)/inventario).
export async function GET(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const items = await prisma.inventoryItem.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: [{ category: "asc" }, { name: "asc" }],
  });
  return NextResponse.json(
    {
      categories: Object.entries(INVENTORY_CATEGORY_LABELS).map(([value, label]) => ({ value, label })),
      items: items.map((i) => ({
        id: i.id,
        name: i.name,
        category: i.category,
        categoryLabel: INVENTORY_CATEGORY_LABELS[i.category],
        quantity: i.quantity,
        notes: i.notes,
      })),
    },
    { headers: CORS_HEADERS },
  );
}

// POST /api/mobile/inventory { name, category?, quantity?, notes? }
export async function POST(request: Request) {
  const profile = await getMobileProfile(request);
  if (!profile) return NextResponse.json({ error: "No autenticado." }, { status: 401, headers: CORS_HEADERS });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const name = typeof body?.name === "string" ? body.name.trim().slice(0, 200) : "";
  if (!name) return NextResponse.json({ error: "Falta el nombre." }, { status: 400, headers: CORS_HEADERS });

  const validCategories = new Set(Object.values(InventoryItemCategory) as string[]);
  const category = validCategories.has(String(body?.category)) ? (body?.category as InventoryItemCategory) : "OTHER";
  const quantityNumber = Number(body?.quantity);
  const quantity = Number.isFinite(quantityNumber) && quantityNumber > 0 ? Math.floor(quantityNumber) : 1;
  const notes = typeof body?.notes === "string" && body.notes.trim() ? body.notes.trim().slice(0, 500) : null;

  const item = await prisma.inventoryItem.create({
    data: { organizationId: profile.organizationId, name, category, quantity, notes },
  });
  return NextResponse.json({ id: item.id }, { headers: CORS_HEADERS });
}
