import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { createLocation } from "@/lib/actions/locations";
import { LOCATION_CHARACTERISTIC_LABELS } from "@/lib/labels";
import { LocationCharacteristic } from "@/lib/generated/prisma";
import { GeocodeButton } from "@/components/GeocodeButton";
import { LocationsMapClient } from "@/components/LocationsMapClient";
import { FormField } from "@/components/FormField";
import { ChipOption } from "@/components/ChipOption";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { LinkPendingHint } from "@/components/LinkPendingHint";
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

// Biblioteca de localizaciones de la organización (mapa, alta y listado). La
// usan /app/localizaciones y la pestaña «Toda la biblioteca» de las
// localizaciones de un proyecto.
export async function LocationsLibrary({
  organizationId,
  from,
}: {
  organizationId: string;
  // projectId de origen: si viene de la pestaña "biblioteca" de un
  // proyecto, para que el detalle de cada localización sepa volver ahí.
  from?: string;
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

  const mappedLocations = locations
    .filter((l) => l.latitude !== null && l.longitude !== null)
    .map((l) => ({
      id: l.id,
      name: l.name,
      address: l.address,
      latitude: l.latitude as number,
      longitude: l.longitude as number,
      sceneCount: l._count.scenes,
    }));
  const unmapped = locations.length - mappedLocations.length;

  if (locations.length === 0) {
    return (
      <section aria-labelledby="primera-localizacion" className="mt-12 border-t border-line pt-10">
        <h2 id="primera-localizacion" className="font-display text-xl font-bold">
          Añade la primera localización
        </h2>
        <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
          Se guarda una vez y luego se elige desde el Guion de cualquier proyecto. Con la dirección, «Buscar en el
          mapa» la sitúa para verla aquí junto a las demás.
        </p>
        <div className="mt-8 max-w-3xl">
          <NewLocationForm inline />
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="mt-10 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
        <p className="flex flex-wrap items-baseline gap-x-6 gap-y-1 font-sans text-sm text-muted">
          <span>
            <span className="font-display text-2xl font-black text-fg tabular-nums">{locations.length}</span>{" "}
            {locations.length === 1 ? "localización" : "localizaciones"}
          </span>
          <span>
            <span className="font-display text-2xl font-black text-fg tabular-nums">{mappedLocations.length}</span> en
            el mapa
          </span>
        </p>
        <CreateDialog
          label="Añadir localización"
          title="Nueva localización"
          description="Fotos, permisos y notas de producción se añaden después en su ficha."
        >
          <NewLocationForm />
        </CreateDialog>
      </div>

      {mappedLocations.length > 0 && (
        <div className="mt-5 overflow-hidden rounded-xl">
          <LocationsMapClient locations={mappedLocations} />
        </div>
      )}
      {unmapped > 0 && (
        <p className="mt-5 border-l-2 border-warn pl-3 font-sans text-sm text-muted">
          {unmapped === locations.length
            ? "Ninguna está en el mapa todavía."
            : `${unmapped} ${unmapped === 1 ? "no sale" : "no salen"} en el mapa.`}{" "}
          Abre su ficha y pulsa «Buscar en el mapa» con la dirección escrita.
        </p>
      )}

      <ul className="mt-8 divide-y divide-line border-y border-line">
        {locations.map((location) => (
          <li key={location.id}>
            <Link
              href={`/app/localizaciones/${location.id}${from ? `?from=${from}` : ""}`}
              className="group flex items-center gap-5 py-4"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate font-sans text-[17px] font-medium transition-colors group-hover:text-accent">
                  {location.name}
                </span>
                <span className="block truncate font-sans text-[13px] text-muted">
                  {[location.address, location.contactName].filter(Boolean).join(" · ") || "Sin dirección ni contacto"}
                </span>
                {location.characteristics.length > 0 && (
                  <span className="mt-1 hidden truncate font-mono text-[10px] tracking-widest text-muted/80 uppercase sm:block">
                    {location.characteristics.map((c) => LOCATION_CHARACTERISTIC_LABELS[c]).join(" · ")}
                  </span>
                )}
              </span>
              {location.latitude === null && (
                <span className="hidden shrink-0 items-center gap-1.5 font-mono text-[11px] tracking-wide text-warn uppercase sm:flex">
                  <span aria-hidden className="h-1.5 w-1.5 rounded-full bg-current" />
                  Sin mapa
                </span>
              )}
              <span className="w-20 shrink-0 text-right font-mono text-[11px] tracking-wide text-muted uppercase tabular-nums">
                {location._count.scenes > 0
                  ? `${location._count.scenes} ${location._count.scenes === 1 ? "escena" : "escenas"}`
                  : "Sin usar"}
              </span>
              <span aria-hidden className="font-sans text-base text-muted transition-colors group-hover:text-accent">
                →
              </span>
              <LinkPendingHint className="shrink-0" />
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
