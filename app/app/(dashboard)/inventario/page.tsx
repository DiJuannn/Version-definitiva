import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createInventoryItem, deleteInventoryItem } from "@/lib/actions/inventory";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/labels";
import { InventoryItemCategory } from "@/lib/generated/prisma";

export default async function InventarioPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const items = await prisma.inventoryItem.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  return (
    <div>
      <Link
        href="/app"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Taller
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Inventario
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Material de la organización — se reserva por día de rodaje desde
        cualquier proyecto, sin recrearlo.
      </p>

      <form
        action={createInventoryItem}
        className="mt-8 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-4"
      >
        <input
          name="name"
          placeholder="Nombre"
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <select
          name="category"
          defaultValue="OTHER"
          className="border border-line bg-transparent px-3 py-2 font-mono text-xs uppercase outline-none focus:border-accent"
        >
          {Object.values(InventoryItemCategory).map((value) => (
            <option key={value} value={value} className="bg-bg">
              {INVENTORY_CATEGORY_LABELS[value]}
            </option>
          ))}
        </select>
        <input
          name="quantity"
          type="number"
          min={1}
          defaultValue={1}
          placeholder="Cantidad"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="notes"
          placeholder="Notas"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <div>
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Añadir material
          </button>
        </div>
      </form>

      {items.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          Todavía no hay material en el inventario.
        </p>
      ) : (
        <div className="mt-10 border-t border-line">
          {items.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-4 border-b border-line py-4"
            >
              <div>
                <span className="font-display text-lg font-bold uppercase">
                  {item.name}
                </span>
                <p className="font-mono text-xs text-muted">
                  {INVENTORY_CATEGORY_LABELS[item.category]} · cantidad {item.quantity}
                  {item.notes ? ` · ${item.notes}` : ""}
                </p>
              </div>
              <div className="flex items-center gap-4">
                <span className="font-mono text-xs text-muted">
                  {item._count.reservations} reserva
                  {item._count.reservations === 1 ? "" : "s"}
                </span>
                <form action={deleteInventoryItem.bind(null, item.id)}>
                  <button
                    type="submit"
                    className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
