import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createInventoryItem, deleteInventoryItem } from "@/lib/actions/inventory";
import { DeleteButton } from "@/components/DeleteButton";
import { INVENTORY_CATEGORY_LABELS } from "@/lib/labels";
import { InventoryItemCategory } from "@/lib/generated/prisma";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { FormField } from "@/components/FormField";
import { SubmitButton } from "@/components/SubmitButton";
import { PageHeader } from "@/components/PageHeader";

// Alta de material. En el diálogo, en una columna; en línea (inventario
// vacío), a lo ancho.
function NewItemForm({ inline }: { inline?: boolean }) {
  return (
    <form
      action={createInventoryItem}
      className={inline ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_6rem_minmax(0,2fr)]" : "grid gap-4"}
    >
      <FormField label="Qué es">
        <input name="name" required placeholder="Ej.: Sony FX6, Aputure 600d" className="field w-full" />
      </FormField>
      <div className={inline ? "contents" : "grid grid-cols-[minmax(0,1fr)_6rem] gap-4"}>
        <FormField label="Categoría">
          <select name="category" defaultValue="OTHER" className="field w-full">
            {Object.values(InventoryItemCategory).map((value) => (
              <option key={value} value={value}>
                {INVENTORY_CATEGORY_LABELS[value]}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Unidades">
          <input name="quantity" type="number" min={1} defaultValue={1} className="field w-full" />
        </FormField>
      </div>
      <FormField label="Notas">
        <input name="notes" placeholder="Accesorios, estado, dónde se guarda…" className="field w-full" />
      </FormField>
      <div className={`flex items-center gap-4 ${inline ? "sm:col-span-2 lg:col-span-4" : "mt-1"}`}>
        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="btn btn-primary">
          Añadir al inventario
        </SubmitButton>
        <DialogCancel />
      </div>
    </form>
  );
}

export default async function InventarioPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const items = await prisma.inventoryItem.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { reservations: true } } },
  });

  // Por categoría, en el orden de siempre (cámara, iluminación, sonido…).
  const groups = Object.values(InventoryItemCategory)
    .map((category) => ({ category, rows: items.filter((item) => item.category === category) }))
    .filter((g) => g.rows.length > 0);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Recursos"
        title="Inventario"
        description="El material de la productora. Se apunta una vez y se reserva para cada día de rodaje desde el Plan de rodaje de cualquier proyecto."
        actions={
          items.length > 0 ? (
            <CreateDialog label="Añadir material" title="Nuevo material">
              <NewItemForm />
            </CreateDialog>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <section aria-labelledby="primer-material" className="mt-12 border-t border-line pt-10">
          <h2 id="primer-material" className="font-display text-xl font-bold">
            Apunta el primer material
          </h2>
          <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
            Cámaras, luces, sonido, vestuario, atrezzo… Si tienes varias unidades iguales, basta con una línea y el número.
          </p>
          <div className="mt-8 max-w-5xl">
            <NewItemForm inline />
          </div>
        </section>
      ) : (
        <>
          <p className="mt-10 flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-sm text-muted">
            <span>
              <span className="font-display text-2xl font-black text-fg tabular-nums">{items.length}</span>{" "}
              {items.length === 1 ? "elemento" : "elementos"}
            </span>
            <span>
              <span className="font-display text-2xl font-black text-fg tabular-nums">{units}</span>{" "}
              {units === 1 ? "unidad" : "unidades"}
            </span>
            <span>
              <span className="font-display text-2xl font-black text-fg tabular-nums">{groups.length}</span>{" "}
              {groups.length === 1 ? "categoría" : "categorías"}
            </span>
          </p>

          <div className="mt-6 border-t border-line">
            {groups.map((group) => (
              <section
                key={group.category}
                aria-labelledby={`cat-${group.category}`}
                className="grid border-b border-line lg:grid-cols-[13rem_minmax(0,1fr)] lg:gap-x-8"
              >
                <h2
                  id={`cat-${group.category}`}
                  className="flex items-baseline gap-2 pt-5 pb-1 font-display text-base font-black tracking-tight uppercase lg:pb-5"
                >
                  {INVENTORY_CATEGORY_LABELS[group.category]}
                  <span className="font-mono text-[11px] font-normal tracking-widest text-muted">{group.rows.length}</span>
                </h2>
                <ul className="divide-y divide-line">
                  {group.rows.map((item) => (
                    <li key={item.id} className="flex items-center gap-4 py-3.5">
                      <span
                        className="w-9 shrink-0 font-mono text-[13px] text-muted tabular-nums"
                        aria-label={`${item.quantity} ${item.quantity === 1 ? "unidad" : "unidades"}`}
                      >
                        ×{item.quantity}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-sans text-[15px] font-medium">{item.name}</span>
                        {item.notes && <span className="block truncate font-sans text-[13px] text-muted">{item.notes}</span>}
                      </span>
                      <span className="hidden shrink-0 font-mono text-[11px] tracking-wide text-muted uppercase tabular-nums sm:inline">
                        {item._count.reservations > 0
                          ? `${item._count.reservations} ${item._count.reservations === 1 ? "reserva" : "reservas"}`
                          : "Sin reservas"}
                      </span>
                      <form action={deleteInventoryItem.bind(null, item.id)} className="shrink-0">
                        <DeleteButton confirmMessage="¿Eliminar este material del inventario?" className="link-action" />
                      </form>
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
