import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createLocation } from "@/lib/actions/locations";
import { LOCATION_CHARACTERISTIC_LABELS } from "@/lib/labels";
import { LocationCharacteristic } from "@/lib/generated/prisma";
import { GeocodeButton } from "@/components/GeocodeButton";
import { LocationsExplorer } from "@/components/LocationsExplorer";
import { FormField } from "@/components/FormField";
import { ChipOption } from "@/components/ChipOption";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { SubmitButton } from "@/components/SubmitButton";

// Alta de localización. En el diálogo va en una columna; en línea (biblioteca
// vacía), a lo ancho.
function NewLocationForm({ inline }: { inline?: boolean }) {
  const pair = inline ? "contents" : "grid grid-cols-2 gap-4";
  return (
    <form action={createLocation} className={inline ? "grid gap-4 sm:grid-cols-2" : "grid gap-4"}>
      <FormField label="Nombre" className={inline ? "sm:col-span-2" : undefined}>
        <input name="name" required placeholder="Ej.: bar de la esquina, piso de Lavapiés" className="field w-full" />
      </FormField>
      <FormField label="Dirección" className={inline ? "sm:col-span-2" : undefined}>
        <input name="address" placeholder="Calle, número, ciudad" className="field w-full" />
      </FormField>
      <input type="hidden" name="latitude" />
      <input type="hidden" name="longitude" />
      <GeocodeButton />
      <div className={pair}>
        <FormField label="Contacto">
          <input name="contactName" className="field w-full" />
        </FormField>
        <FormField label="Teléfono de contacto">
          <input name="contactPhone" className="field w-full" />
        </FormField>
      </div>
      <div className={pair}>
        <FormField label="Coste (€)">
          <input name="cost" type="number" step="0.01" className="field w-full" />
        </FormField>
        <FormField label="Disponibilidad">
          <input name="availability" placeholder="Fines de semana…" className="field w-full" />
        </FormField>
      </div>
      <fieldset className={inline ? "sm:col-span-2" : undefined}>
        <legend className="font-mono text-[10px] tracking-widest text-muted uppercase">Qué tiene</legend>
        <div className="mt-2 flex flex-wrap gap-2">
          {Object.values(LocationCharacteristic).map((value) => (
            <ChipOption
              key={value}
              type="checkbox"
              name="characteristics"
              value={value}
              label={LOCATION_CHARACTERISTIC_LABELS[value]}
            />
          ))}
        </div>
      </fieldset>
      <div className={`flex items-center gap-4 ${inline ? "sm:col-span-2" : "mt-1"}`}>
        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadida" className="btn btn-primary">
          Añadir a la biblioteca
        </SubmitButton>
        <DialogCancel />
      </div>
    </form>
  );
}

// Botón «Añadir localización» con su diálogo, para las acciones de la
// cabecera de la página.
export function NewLocationButton() {
  return (
    <CreateDialog
      label="Añadir localización"
      title="Nueva localización"
      description="Fotos, permisos y notas de producción se añaden después en su ficha."
    >
      <NewLocationForm />
    </CreateDialog>
  );
}

// Biblioteca de localizaciones de la organización (mapa, alta y listado). La
// usan /app/localizaciones y la pestaña «Toda la biblioteca» de las
// localizaciones de un proyecto.
export async function LocationsLibrary({
  organizationId,
  from,
  hideCreate,
}: {
  organizationId: string;
  // projectId de origen: si viene de la pestaña "biblioteca" de un
  // proyecto, para que el detalle de cada localización sepa volver ahí.
  from?: string;
  // La página ya pone «Añadir localización» en su cabecera.
  hideCreate?: boolean;
}) {
  const locations = await prisma.location.findMany({
    where: { organizationId },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      address: true,
      contactName: true,
      latitude: true,
      longitude: true,
      characteristics: true,
      _count: { select: { scenes: true } },
    },
  });

  if (locations.length === 0) {
    return (
      <section aria-labelledby="primera-localizacion" className="mt-12 pt-4">
        <h2 id="primera-localizacion" className="font-display text-xl font-bold">
          Añade la primera localización
        </h2>
        <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
          Se guarda una vez y luego se elige desde el Guion de cualquier proyecto. Con la dirección, «Buscar en el
          mapa» la sitúa para verla aquí junto a las demás.
        </p>
        <div className="paper mt-8 max-w-3xl p-6">
          <NewLocationForm inline />
        </div>
      </section>
    );
  }

  // Numeradas en el orden de la lista, para encontrarlas en el mapa.
  let n = 0;
  const numbered = locations.map((l) => ({
    ...l,
    label: l.latitude !== null && l.longitude !== null ? String(++n) : null,
  }));
  const mappedLocations = numbered
    .filter((l) => l.label !== null)
    .map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      latitude: l.latitude as number,
      longitude: l.longitude as number,
      sceneCount: l._count.scenes,
      label: l.label ?? undefined,
    }));
  const unmapped = numbered.filter((l) => l.label === null);
  const used = locations.filter((l) => l._count.scenes > 0).length;
  const href = (id: string) => `/app/localizaciones/${id}${from ? `?from=${from}` : ""}`;

  return (
    <>
      {/* Cómo voy */}
      <div className="mt-8 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="font-sans text-[15px] leading-relaxed text-muted">
          <span className="font-display text-2xl font-black text-fg tabular-nums">{locations.length}</span>{" "}
          {locations.length === 1 ? "localización" : "localizaciones"} · {mappedLocations.length} en el mapa ·{" "}
          {used === 0 ? "ninguna asignada todavía a una escena" : `${used} en uso en escenas`}.
        </p>
        {!hideCreate && <NewLocationButton />}
      </div>
      {unmapped.length > 0 && (
        <p className="mt-3 border-l-2 border-warn pl-3 font-sans text-sm text-muted">
          Sin situar en el mapa:{" "}
          {unmapped.map((l, i) => (
            <span key={l.id}>
              {i > 0 && ", "}
              <Link href={href(l.id)} className="text-fg hover:text-accent">
                {l.name}
              </Link>
            </span>
          ))}
          . Abre su ficha y pulsa «Buscar en el mapa» con la dirección escrita.
        </p>
      )}

      <LocationsExplorer
        mapLocations={mappedLocations}
        locations={numbered.map((l) => ({
          id: l.id,
          href: href(l.id),
          name: l.name,
          address: l.address,
          contactName: l.contactName,
          characteristics: l.characteristics.map((c) => LOCATION_CHARACTERISTIC_LABELS[c]),
          sceneCount: l._count.scenes,
          label: l.label,
        }))}
      />
    </>
  );
}
