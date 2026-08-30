import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createLocation } from "@/lib/actions/locations";
import { LOCATION_CHARACTERISTIC_LABELS } from "@/lib/labels";
import { LocationCharacteristic } from "@/lib/generated/prisma";
import { GeocodeButton } from "@/components/GeocodeButton";
import { LocationsMapClient } from "@/components/LocationsMapClient";

export default async function LocalizacionesPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const locations = await prisma.location.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { name: "asc" },
    include: { _count: { select: { scenes: true } } },
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
    <div>
      <Link
        href="/app"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Taller
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Localizaciones
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Biblioteca de la organización — se seleccionan desde el Guion de
        cualquier proyecto, sin recrearlas.
      </p>

      {mappedLocations.length > 0 ? (
        <div className="mt-8 border border-line">
          <LocationsMapClient locations={mappedLocations} />
        </div>
      ) : (
        <div className="mt-8 flex h-[160px] items-center justify-center border border-line">
          <p className="max-w-sm text-center font-mono text-xs text-muted">
            Ninguna localización tiene coordenadas todavía. Añade una dirección
            y pulsa &ldquo;Buscar coordenadas&rdquo; para que aparezca aquí en
            el mapa.
          </p>
        </div>
      )}

      <form
        action={createLocation}
        className="mt-8 grid gap-3 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <input
          name="name"
          placeholder="Nombre"
          required
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="address"
          placeholder="Dirección"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input type="hidden" name="latitude" />
        <input type="hidden" name="longitude" />
        <GeocodeButton />
        <input
          name="contactName"
          placeholder="Contacto"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="contactPhone"
          placeholder="Teléfono de contacto"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="cost"
          type="number"
          step="0.01"
          placeholder="Coste"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <input
          name="availability"
          placeholder="Disponibilidad"
          className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
        />
        <div className="sm:col-span-2 lg:col-span-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Características
          </p>
          <div className="mt-2 flex flex-wrap gap-x-6 gap-y-2">
            {Object.values(LocationCharacteristic).map((value) => (
              <label key={value} className="flex items-center gap-2 font-mono text-xs">
                <input type="checkbox" name="characteristics" value={value} />
                {LOCATION_CHARACTERISTIC_LABELS[value]}
              </label>
            ))}
          </div>
        </div>
        <div>
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Añadir localización
          </button>
        </div>
      </form>

      {locations.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          Todavía no hay localizaciones en la biblioteca.
        </p>
      ) : (
        <div className="mt-10 border-t border-line">
          {locations.map((location) => (
            <Link
              key={location.id}
              href={`/app/localizaciones/${location.id}`}
              className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:border-accent"
            >
              <div>
                <span className="font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
                  {location.name}
                </span>
                <p className="font-mono text-xs text-muted">
                  {[location.address, location.contactName].filter(Boolean).join(" · ") ||
                    "Sin datos"}
                </p>
              </div>
              <span className="flex items-center gap-3 font-mono text-xs text-muted">
                {location.latitude === null && (
                  <span className="text-accent">Sin coordenadas</span>
                )}
                {location._count.scenes} escena{location._count.scenes === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
