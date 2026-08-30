import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { DeleteButton } from "@/components/DeleteButton";
import {
  addLocationPhoto,
  addLocationVideo,
  deleteLocation,
  removeLocationPhoto,
  removeLocationVideo,
  updateLocation,
} from "@/lib/actions/locations";
import { LOCATION_CHARACTERISTIC_LABELS } from "@/lib/labels";
import { LocationCharacteristic } from "@/lib/generated/prisma";
import { GeocodeButton } from "@/components/GeocodeButton";
import { LocationsMapClient } from "@/components/LocationsMapClient";
import { ChipOption } from "@/components/ChipOption";
import { BackLink } from "@/components/BackLink";
import { FileOpenLink } from "@/components/FileOpenLink";

export default async function LocationDetailPage({
  params,
}: {
  params: Promise<{ locationId: string }>;
}) {
  const { locationId } = await params;

  const profile = await getCurrentProfile();
  if (!profile) return null;

  const location = await prisma.location.findFirst({
    where: { id: locationId, organizationId: profile.organizationId },
  });
  if (!location) notFound();

  const scenesUsingLocation = await prisma.scene.findMany({
    where: { locationId },
    select: { number: true, project: { select: { id: true, name: true } } },
  });
  const usageByProject = new Map<string, { name: string; count: number }>();
  for (const scene of scenesUsingLocation) {
    const entry = usageByProject.get(scene.project.id);
    if (entry) {
      entry.count += 1;
    } else {
      usageByProject.set(scene.project.id, { name: scene.project.name, count: 1 });
    }
  }

  const updateAction = updateLocation.bind(null, locationId);
  const addPhotoAction = addLocationPhoto.bind(null, locationId);
  const addVideoAction = addLocationVideo.bind(null, locationId);
  const selectedCharacteristics = new Set(location.characteristics);

  return (
    <div>
      <BackLink href="/app/localizaciones">← Localizaciones</BackLink>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        {location.name}
      </h1>

      {usageByProject.size > 0 && (
        <p className="mt-2 font-mono text-xs text-muted">
          Usada en:{" "}
          {[...usageByProject.values()]
            .map((entry) => `${entry.name} (${entry.count})`)
            .join(", ")}
        </p>
      )}

      {location.latitude !== null && location.longitude !== null && (
        <div className="mt-6 border border-line">
          <LocationsMapClient
            locations={[
              {
                id: location.id,
                name: location.name,
                address: location.address,
                latitude: location.latitude,
                longitude: location.longitude,
                sceneCount: scenesUsingLocation.length,
              },
            ]}
          />
        </div>
      )}

      <form
        action={updateAction}
        className="mt-8 grid gap-4 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Nombre
          </span>
          <input
            name="name"
            defaultValue={location.name}
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Dirección
          </span>
          <input
            name="address"
            defaultValue={location.address ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Contacto
          </span>
          <input
            name="contactName"
            defaultValue={location.contactName ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Teléfono de contacto
          </span>
          <input
            name="contactPhone"
            defaultValue={location.contactPhone ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Disponibilidad
          </span>
          <input
            name="availability"
            defaultValue={location.availability ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Coste
          </span>
          <input
            name="cost"
            type="number"
            step="0.01"
            defaultValue={location.cost?.toString() ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Latitud
          </span>
          <input
            name="latitude"
            type="number"
            step="any"
            defaultValue={location.latitude ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Longitud
          </span>
          <input
            name="longitude"
            type="number"
            step="any"
            defaultValue={location.longitude ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <GeocodeButton />

        <div className="sm:col-span-2 lg:col-span-3">
          <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Características
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            {Object.values(LocationCharacteristic).map((value) => (
              <ChipOption
                key={value}
                type="checkbox"
                name="characteristics"
                value={value}
                label={LOCATION_CHARACTERISTIC_LABELS[value]}
                defaultChecked={selectedCharacteristics.has(value)}
              />
            ))}
          </div>
        </div>

        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Permisos
          </span>
          <textarea
            name="permitsNotes"
            defaultValue={location.permitsNotes ?? ""}
            rows={2}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Restricciones
          </span>
          <textarea
            name="restrictions"
            defaultValue={location.restrictions ?? ""}
            rows={2}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Notas de producción
          </span>
          <textarea
            name="productionNotes"
            defaultValue={location.productionNotes ?? ""}
            rows={2}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Notas
          </span>
          <textarea
            name="notes"
            defaultValue={location.notes ?? ""}
            rows={2}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <div>
          <button
            type="submit"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Guardar
          </button>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
          Fotografías
        </h2>
        <form action={addPhotoAction} className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="file"
            name="photo"
            accept="image/*"
            required
            className="font-mono text-xs text-muted"
          />
          <button
            type="submit"
            className="rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Subir
          </button>
        </form>

        {location.photoUrls.length > 0 && (
          <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-4">
            {location.photoUrls.map((url) => (
              <div key={url} className="group relative aspect-square">
                <Image src={url} alt="" fill unoptimized className="object-cover" />
                <form
                  action={removeLocationPhoto.bind(null, locationId, url)}
                  className="absolute inset-x-0 bottom-0 bg-bg/80 p-1 opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <DeleteButton
                    confirmMessage="¿Eliminar esta foto?"
                    className="w-full font-mono text-[10px] tracking-widest text-muted uppercase hover:text-accent"
                  />
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-muted uppercase">
          Vídeos
        </h2>
        <form action={addVideoAction} className="mt-4 flex max-w-md gap-2">
          <input
            name="videoUrl"
            placeholder="URL del vídeo"
            required
            className="w-full border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <button
            type="submit"
            className="shrink-0 rounded-full bg-fg px-4 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Añadir
          </button>
        </form>
        {location.videoUrls.length > 0 && (
          <div className="mt-4 border-t border-line">
            {location.videoUrls.map((url) => (
              <div
                key={url}
                className="flex items-center justify-between gap-4 border-b border-line py-3"
              >
                <FileOpenLink
                  href={url}
                  className="truncate font-mono text-sm hover:text-accent"
                >
                  {url}
                </FileOpenLink>
                <form action={removeLocationVideo.bind(null, locationId, url)}>
                  <DeleteButton
                    confirmMessage="¿Eliminar este vídeo?"
                    className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
                  />
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <form action={deleteLocation.bind(null, locationId)} className="mt-10">
        <DeleteButton
          confirmMessage="¿Eliminar esta localización? Se desvinculará de las escenas que la usen."
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          Eliminar localización
        </DeleteButton>
      </form>
    </div>
  );
}
