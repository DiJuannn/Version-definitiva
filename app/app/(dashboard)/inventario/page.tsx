import Link from "next/link";
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

// Color de cada categoría (como las tiras de un stripboard), para leer el
// almacén por estanterías.
const CATEGORY_COLOR: Record<InventoryItemCategory, string> = {
  CAMERA: "#7fb8e0",
  LIGHTING: "#e3b25c",
  SOUND: "#7cc79a",
  GRIP: "#e0956c",
  COSTUME: "#e3a3c8",
  PROPS: "#b3a4e6",
  OFFICE: "#8fd3cf",
  OTHER: "#9a99a0",
};

function dayKey(date: Date) {
  return date.toISOString().slice(0, 10);
}
function shortDay(date: Date) {
  return date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" }).replace(/\./g, "");
}

export default async function InventarioPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);

  const [items, nextDay] = await Promise.all([
    prisma.inventoryItem.findMany({
      where: { organizationId: profile.organizationId },
      orderBy: { name: "asc" },
      include: {
        _count: { select: { reservations: true } },
        // Solo lectura: las reservas que vienen, para ver la disponibilidad.
        reservations: {
          where: { shootingDay: { date: { gte: startOfToday } } },
          select: {
            id: true,
            quantity: true,
            shootingDay: { select: { id: true, date: true, projectId: true, project: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.shootingDay.findFirst({
      where: { project: { organizationId: profile.organizationId }, date: { gte: startOfToday } },
      orderBy: { date: "asc" },
      include: { project: { select: { name: true } } },
    }),
  ]);

  // Por categoría, en el orden de siempre (cámara, iluminación, sonido…).
  const groups = Object.values(InventoryItemCategory)
    .map((category) => ({ category, rows: items.filter((item) => item.category === category) }))
    .filter((g) => g.rows.length > 0);
  const units = items.reduce((sum, item) => sum + item.quantity, 0);

  // Por elemento: reservas futuras agrupadas por día, y si algún día se pide
  // más de lo que hay.
  const byItem = new Map(
    items.map((item) => {
      const days = new Map<string, { date: Date; qty: number; project: string; href: string }>();
      for (const r of item.reservations) {
        const key = dayKey(r.shootingDay.date);
        const entry = days.get(key);
        if (entry) entry.qty += r.quantity;
        else
          days.set(key, {
            date: r.shootingDay.date,
            qty: r.quantity,
            project: r.shootingDay.project.name,
            href: `/app/${r.shootingDay.projectId}/plan-de-rodaje/${r.shootingDay.id}`,
          });
      }
      const list = [...days.values()].sort((a, b) => a.date.getTime() - b.date.getTime());
      return [item.id, { days: list, overbooked: list.filter((d) => d.qty > item.quantity) }];
    }),
  );
  const overbooked = items.filter((item) => (byItem.get(item.id)?.overbooked.length ?? 0) > 0);
  const nextDayKey = nextDay ? dayKey(nextDay.date) : null;
  const reservedNext = nextDayKey
    ? items.filter((item) => byItem.get(item.id)?.days.some((d) => dayKey(d.date) === nextDayKey))
    : [];

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Recursos"
        title="Inventario"
        description="El material de la productora por categorías, con cuántas unidades hay y qué días está reservado. Se reserva desde el Plan de rodaje."
        actions={
          items.length > 0 ? (
            <CreateDialog label="Añadir material" title="Nuevo material">
              <NewItemForm />
            </CreateDialog>
          ) : undefined
        }
      />

      {items.length === 0 ? (
        <section aria-labelledby="primer-material" className="mt-12 pt-4">
          <h2 id="primer-material" className="font-display text-xl font-bold">
            Apunta el primer material
          </h2>
          <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
            Cámaras, luces, sonido, vestuario, atrezzo… Si tienes varias unidades iguales, basta con una línea y el número.
          </p>
          <div className="paper mt-8 max-w-5xl p-6">
            <NewItemForm inline />
          </div>
        </section>
      ) : (
        <>
          {/* Cómo voy */}
          <div className="mt-8 space-y-2 font-sans text-[15px] leading-relaxed text-muted">
            <p>
              <span className="font-display text-2xl font-black text-fg tabular-nums">{items.length}</span>{" "}
              {items.length === 1 ? "elemento" : "elementos"} ({units} {units === 1 ? "unidad" : "unidades"}) en{" "}
              {groups.length} {groups.length === 1 ? "categoría" : "categorías"}
              {nextDay ? (
                <>
                  {" "}
                  · próximo rodaje <span className="text-fg">{shortDay(nextDay.date)}</span> ({nextDay.project.name}):{" "}
                  {reservedNext.length === 0
                    ? "nada reservado todavía"
                    : `${reservedNext.length} ${reservedNext.length === 1 ? "elemento reservado" : "elementos reservados"}`}
                </>
              ) : (
                " · no hay rodajes por delante"
              )}
              .
            </p>
            {overbooked.map((item) => (
              <p key={item.id} className="border-l-2 border-danger pl-3 text-sm">
                <span className="text-fg">{item.name}</span>: se piden más unidades de las que hay (
                {byItem
                  .get(item.id)!
                  .overbooked.map((d) => `${d.qty} de ${item.quantity} el ${shortDay(d.date)}`)
                  .join(", ")}
                ).
              </p>
            ))}
          </div>

          <div className="mt-10 grid items-start gap-x-6 gap-y-10 lg:grid-cols-2">
            {groups.map((group) => {
              const color = CATEGORY_COLOR[group.category];
              const groupUnits = group.rows.reduce((n, i) => n + i.quantity, 0);
              return (
                <section
                  key={group.category}
                  aria-labelledby={`cat-${group.category}`}
                  style={{ "--c": color } as React.CSSProperties}
                >
                  <h2 id={`cat-${group.category}`} className="flex items-center gap-3">
                    <span aria-hidden className="h-4 w-1 rounded-full bg-[var(--c)]" />
                    <span className="font-display text-lg font-black tracking-tight uppercase">
                      {INVENTORY_CATEGORY_LABELS[group.category]}
                    </span>
                    <span className="font-sans text-[13px] text-muted">
                      {group.rows.length} {group.rows.length === 1 ? "elemento" : "elementos"} · {groupUnits}{" "}
                      {groupUnits === 1 ? "unidad" : "unidades"}
                    </span>
                  </h2>
                  <ul className="sheet mt-3 divide-y divide-line overflow-hidden">
                    {group.rows.map((item) => {
                      const info = byItem.get(item.id)!;
                      const nextEntry = nextDayKey ? info.days.find((d) => dayKey(d.date) === nextDayKey) : undefined;
                      return (
                        <li key={item.id} className="flex items-start gap-x-4 px-4 py-3.5 sm:px-5">
                          {/* Cantidad como en la etiqueta de la caja. */}
                          <span
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-lg bg-[color-mix(in_srgb,var(--c)_16%,transparent)] font-display text-lg font-black text-[var(--c)] tabular-nums"
                            aria-label={`${item.quantity} ${item.quantity === 1 ? "unidad" : "unidades"}`}
                          >
                            {item.quantity}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-sans text-[15px] leading-snug font-medium">{item.name}</span>
                            {item.notes && <span className="block truncate font-sans text-[13px] text-muted">{item.notes}</span>}
                          {/* Disponibilidad: libre, o los días que ya está pedido. */}
                          <span className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                            {info.days.length === 0 ? (
                              <span className="inline-flex items-center gap-1.5 font-sans text-[12px] text-success">
                                <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-success" />
                                Libre
                              </span>
                            ) : (
                              <>
                                {nextEntry && nextEntry.qty >= item.quantity && (
                                  <span className="mr-1 font-sans text-[12px] text-warn">Agotado el próximo rodaje</span>
                                )}
                                {info.days.slice(0, 4).map((d) => {
                                  const over = d.qty > item.quantity;
                                  return (
                                    <Link
                                      key={dayKey(d.date)}
                                      href={d.href}
                                      title={`${d.qty} de ${item.quantity} reservadas · ${d.project}`}
                                      className={`rounded-full px-2 py-0.5 font-mono text-[10px] tracking-wide uppercase tabular-nums transition-colors ${
                                        over
                                          ? "bg-danger/15 text-danger"
                                          : "bg-fg/[0.07] text-fg/85 hover:bg-accent hover:text-bg"
                                      }`}
                                    >
                                      {shortDay(d.date)} · {d.qty}/{item.quantity}
                                    </Link>
                                  );
                                })}
                                {info.days.length > 4 && (
                                  <span className="font-mono text-[10px] text-muted">+{info.days.length - 4}</span>
                                )}
                              </>
                            )}
                          </span>
                          </span>
                          <form
                            action={deleteInventoryItem.bind(null, item.id)}
                            className="shrink-0"
                          >
                            <DeleteButton confirmMessage="¿Eliminar este material del inventario?" className="link-action !text-[10px] opacity-60 hover:opacity-100">
                              Quitar
                            </DeleteButton>
                          </form>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              );
            })}
          </div>

          {nextDay && (
            <p className="mt-16 border-t border-line pt-4 font-sans text-sm text-muted">
              Siguiente: reservar material para el rodaje del {shortDay(nextDay.date)} en el{" "}
              <Link
                href={`/app/${nextDay.projectId}/plan-de-rodaje/${nextDay.id}`}
                className="text-fg underline decoration-accent/60 underline-offset-4 hover:text-accent"
              >
                Plan de rodaje de {nextDay.project.name}
              </Link>
              .
            </p>
          )}
        </>
      )}
    </div>
  );
}
