import { prisma } from "@/lib/prisma";
import { createLocation } from "@/lib/actions/locations";
import { LOCATION_CHARACTERISTIC_LABELS } from "@/lib/labels";
import { LocationCharacteristic } from "@/lib/generated/prisma";
import { GeocodeButton } from "@/components/GeocodeButton";
import { LocationsMapClient } from "@/components/LocationsMapClient";
import { FormField } from "@/components/FormField";
import { ChipOption } from "@/components/ChipOption";
import { EmptyState } from "@/components/EmptyState";
import { ListRow } from "@/components/ListRow";
import { SubmitButton } from "@/components/SubmitButton";

const FIELD =
  "border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent";

// Biblioteca de localizaciones de la organización (mapa, alta y listado). La
// usan /app/localizaciones y la pestaña «Toda la biblioteca» de las
// localizaciones de un proyecto.
export async function LocationsLibrary({ organizationId }: { organizationId: string }) {
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

  return (
    <>
      {mappedLocations.length > 0 ? (
        <div className="mt-6 border border-line">
          <LocationsMapClient locations={mappedLocations} />
        </div>
      ) : (
        <div className="mt-6 flex h-[160px] items-center justify-center border border-line">
          <p className="max-w-sm text-center font-mono text-xs text-muted">
            Ninguna localización tiene coordenadas todavía. Añade una dirección y pulsa
            &ldquo;Buscar coordenadas&rdquo; para que aparezca aquí en el mapa.
          </p>
        </div>
      )}

      <form
        action={createLocation}
        className="mt-6 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <FormField label="Nombre">
          <input name="name" required className={FIELD} />
        </FormField>
        <FormField label="Dirección">
          <input name="address" className={FIELD} />
        </FormField>
        <input type="hidden" name="latitude" />
        <input type="hidden" name="longitude" />
        <GeocodeButton />
        <FormField label="Contacto">
          <input name="contactName" className={FIELD} />
        </FormField>
        <FormField label="Teléfono de contacto">
          <input name="contactPhone" className={FIELD} />
        </FormField>
        <FormField label="Coste">
          <input name="cost" type="number" step="0.01" className={FIELD} />
        </FormField>
        <FormField label="Disponibilidad">
          <input name="availability" className={FIELD} />
        </FormField>
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">Características</p>
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
        </div>
        <div>
          <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadida">
            Añadir localización
          </SubmitButton>
        </div>
      </form>

      {locations.length === 0 ? (
        <EmptyState
          title="Todavía no hay localizaciones"
          description="Añade la primera con el formulario de arriba — luego se selecciona desde el Guion de cualquier proyecto, sin recrearla."
        />
      ) : (
        <div className="mt-8 border-t border-line">
          {locations.map((location) => (
            <ListRow
              key={location.id}
              href={`/app/localizaciones/${location.id}`}
              title={
                <span className="font-display text-lg font-bold transition-colors group-hover:text-accent">
                  {location.name}
                </span>
              }
              meta={
                [location.address, location.contactName].filter(Boolean).join(" · ") || "Sin datos"
              }
              trailing={
                <span className="flex items-center gap-3 font-mono text-xs text-muted">
                  {location.latitude === null && <span className="text-warn">Sin coordenadas</span>}
                  {location._count.scenes} escena
                  {location._count.scenes === 1 ? "" : "s"}
                </span>
              }
            />
          ))}
        </div>
      )}
    </>
  );
}
