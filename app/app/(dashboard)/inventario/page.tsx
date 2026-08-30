import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createInventoryItem, deleteInventoryItem } from "@/lib/actions/inventory";
import { DeleteButton } from "@/components/DeleteButton";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/labels";
import { InventoryItemCategory } from "@/lib/generated/prisma";
import { FormField } from "@/components/FormField";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { SubmitButton } from "@/components/SubmitButton";
import { BackLink } from "@/components/BackLink";

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
      <BackLink href="/app">← Taller</BackLink>
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
        <FormField label="Nombre">
          <input
            name="name"
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </FormField>
        <FormField label="Categoría">
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
        </FormField>
        <FormField label="Cantidad">
          <input
            name="quantity"
            type="number"
            min={1}
            defaultValue={1}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </FormField>
        <FormField label="Notas">
          <input
            name="notes"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </FormField>
        <div>
          <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido">
            Añadir material
          </SubmitButton>
        </div>
      </form>

      {items.length === 0 ? (
        <EmptyState
          title="Todavía no hay material en el inventario"
          description="Añádelo con el formulario de arriba — luego se reserva por día de rodaje desde cualquier proyecto."
        />
      ) : (
        <div className="mt-10 border-t border-line">
          {items.map((item) => (
            <ListRow
              key={item.id}
              title={
                <span className="font-display text-lg font-bold uppercase">
                  {item.name}
                </span>
              }
              meta={`${INVENTORY_CATEGORY_LABELS[item.category]} · cantidad ${item.quantity}${item.notes ? ` · ${item.notes}` : ""}`}
              trailing={
                <>
                  <span className="font-mono text-xs text-muted">
                    {item._count.reservations} reserva
                    {item._count.reservations === 1 ? "" : "s"}
                  </span>
                  <form action={deleteInventoryItem.bind(null, item.id)}>
                    <DeleteButton confirmMessage="¿Eliminar este material del inventario?" />
                  </form>
                </>
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}
