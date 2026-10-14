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
import { PageHeader } from "@/components/PageHeader";
import { FileOpenLink } from "@/components/FileOpenLink";
import { SubmitButton } from "@/components/SubmitButton";

export default async function LocationDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ locationId: string }>;
  searchParams: Promise<{ from?: string }>;
}) {
  const { locationId } = await params;
  const { from } = await searchParams;

  const profile = await getCurrentProfile();
  if (!profile) return null;

  const location = await prisma.location.findFirst({
    where: { id: locationId, organizationId: profile.organizationId },
  });
  if (!location) notFound();

  // Si se llegó aquí desde las localizaciones de un proyecto, "atrás" debe
  // volver ahí, no a la biblioteca global.
  const fromProject = from
    ? await prisma.project.findFirst({
        where: { id: from, organizationId: profile.organizationId },
        select: { id: true, name: true },
      })
    : null;
  const backHref = fromProject ? `/app/${fromProject.id}/localizaciones` : "/app/localizaciones";
  const backLabel = fromProject ? `← Localizaciones (${fromProject.name})` : "← Localizaciones";

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

  const LABEL = "font-mono text-[10px] tracking-[0.18em] text-muted uppercase";
  const hasCoords = location.latitude !== null && location.longitude !== null;
  const textFields: { name: string; label: string; value: string; type?: string; placeholder?: string }[] = [
    { name: "name", label: "Nombre", value: location.name },
    { name: "address", label: "Dirección", value: location.address ?? "" },
    { name: "contactName", label: "Contacto", value: location.contactName ?? "" },
    { name: "contactPhone", label: "Teléfono de contacto", value: location.contactPhone ?? "" },
    { name: "availability", label: "Disponibilidad", value: location.availability ?? "", placeholder: "Fines de semana…" },
    { name: "cost", label: "Coste (€)", value: location.cost?.toString() ?? "", type: "number" },
  ];
  const notes: { name: string; label: string; value: string; placeholder: string }[] = [
    { name: "permitsNotes", label: "Permisos", value: location.permitsNotes ?? "", placeholder: "Qué hay que pedir y a quién" },
    { name: "restrictions", label: "Restricciones", value: location.restrictions ?? "", placeholder: "Horarios, ruido, qué no se puede mover…" },
    { name: "productionNotes", label: "Notas de producción", value: location.productionNotes ?? "", placeholder: "Luz, enchufes, dónde aparcar…" },
    { name: "notes", label: "Notas", value: location.notes ?? "", placeholder: "" },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        backHref={backHref}
        backLabel={backLabel}
        eyebrow="Localización"
        title={location.name}
        description={location.address ?? undefined}
      />

      <p className="mt-4 font-sans text-sm text-muted">
        {usageByProject.size > 0 ? (
          <>
            Usada en{" "}
            {[...usageByProject.values()].map((entry, i) => (
              <span key={entry.name}>
                {i > 0 && ", "}
                <span className="text-fg">{entry.name}</span> ({entry.count} {entry.count === 1 ? "escena" : "escenas"})
              </span>
            ))}
            .
          </>
        ) : (
          "Todavía no la usa ninguna escena. Se asigna desde el Guion de cada proyecto."
        )}
      </p>

      {/* ------------------------------------------------ ficha */}
      <form action={updateAction} className="mt-12 grid gap-x-16 gap-y-12 lg:grid-cols-[minmax(0,1fr)_340px]">
        <section aria-labelledby="ficha" className="min-w-0">
          <h2 id="ficha" className="border-b border-line pb-3 font-display text-xl font-black tracking-tight uppercase">
            Ficha
          </h2>
          <div className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {textFields.map((field) => (
              <label key={field.name} className="block">
                <span className={LABEL}>{field.label}</span>
                <input
                  name={field.name}
                  type={field.type}
                  step={field.type === "number" ? "0.01" : undefined}
                  required={field.name === "name"}
                  defaultValue={field.value}
                  placeholder={field.placeholder}
                  className="field-line"
                />
              </label>
            ))}
          </div>

          <fieldset className="mt-8">
            <legend className={LABEL}>Qué tiene</legend>
            <div className="mt-3 flex flex-wrap gap-2">
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
          </fieldset>

          <div className="mt-8 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {notes.map((field) => (
              <label key={field.name} className="block">
                <span className={LABEL}>{field.label}</span>
                <textarea
                  name={field.name}
                  defaultValue={field.value}
                  rows={3}
                  placeholder={field.placeholder}
                  className="field mt-2 w-full leading-relaxed"
                />
              </label>
            ))}
          </div>

          <div className="mt-8">
            <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-primary">
              Guardar ficha
            </SubmitButton>
          </div>
        </section>

        {/* El mapa y las coordenadas van en la misma ficha (mismo formulario). */}
        <aside aria-labelledby="mapa" className="space-y-4">
          <h2 id="mapa" className={`${LABEL} border-b border-line pb-2`}>
            En el mapa
          </h2>
          {hasCoords ? (
            <div className="overflow-hidden rounded-xl">
              <LocationsMapClient
                className="h-[260px]"
                locations={[
                  {
                    id: location.id,
                    name: location.name,
                    address: location.address,
                    latitude: location.latitude as number,
                    longitude: location.longitude as number,
                    sceneCount: scenesUsingLocation.length,
                  },
                ]}
              />
            </div>
          ) : (
            <p className="border-l-2 border-warn pl-3 font-sans text-sm leading-relaxed text-muted">
              Aún no está situada. Escribe la dirección en la ficha y pulsa «Buscar en el mapa», o pon las coordenadas a
              mano. Luego guarda.
            </p>
          )}
          <div className="grid grid-cols-2 gap-x-4 gap-y-4">
            <label className="block">
              <span className={LABEL}>Latitud</span>
              <input name="latitude" type="number" step="any" defaultValue={location.latitude ?? ""} className="field-line" />
            </label>
            <label className="block">
              <span className={LABEL}>Longitud</span>
              <input name="longitude" type="number" step="any" defaultValue={location.longitude ?? ""} className="field-line" />
            </label>
            <GeocodeButton />
          </div>
        </aside>
      </form>

      {/* ------------------------------------------------ fotos */}
      <section aria-labelledby="fotos" className="mt-20">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-line pb-3">
          <h2 id="fotos" className="flex items-baseline gap-3 font-display text-xl font-black tracking-tight uppercase">
            Fotografías
            <span className="font-mono text-[11px] font-normal tracking-widest text-muted">{location.photoUrls.length}</span>
          </h2>
          <form action={addPhotoAction} className="flex flex-wrap items-center gap-3">
            <label>
              <span className="sr-only">Elegir foto</span>
              <input
                type="file"
                name="photo"
                accept="image/*"
                required
                className="max-w-[16rem] font-sans text-[13px] text-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-fg/[0.07] file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:tracking-widest file:text-fg file:uppercase"
              />
            </label>
            <SubmitButton pendingLabel="Subiendo…" savedLabel="✓ Subida" className="btn btn-secondary btn-sm">
              Subir foto
            </SubmitButton>
          </form>
        </div>

        {location.photoUrls.length > 0 ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
            {location.photoUrls.map((url) => (
              <figure key={url} className="group">
                <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-fg/[0.05]">
                  <Image src={url} alt="" fill unoptimized className="object-cover" />
                </div>
                <form action={removeLocationPhoto.bind(null, locationId, url)} className="mt-1">
                  <DeleteButton confirmMessage="¿Eliminar esta foto?" className="link-action">
                    Quitar
                  </DeleteButton>
                </form>
              </figure>
            ))}
          </div>
        ) : (
          <p className="py-6 font-sans text-sm text-muted">
            Sin fotos todavía. Las de la visita de localización ayudan a dirección y a arte a preparar el rodaje.
          </p>
        )}
      </section>

      {/* ------------------------------------------------ vídeos */}
      <section aria-labelledby="videos" className="mt-16">
        <h2 id="videos" className="flex items-baseline gap-3 border-b border-line pb-3 font-display text-xl font-black tracking-tight uppercase">
          Vídeos
          <span className="font-mono text-[11px] font-normal tracking-widest text-muted">{location.videoUrls.length}</span>
        </h2>
        {location.videoUrls.length > 0 && (
          <ul className="divide-y divide-line">
            {location.videoUrls.map((url) => (
              <li key={url} className="flex items-center justify-between gap-4 py-3">
                <FileOpenLink href={url} className="min-w-0 truncate font-sans text-[15px] hover:text-accent">
                  {url}
                </FileOpenLink>
                <form action={removeLocationVideo.bind(null, locationId, url)}>
                  <DeleteButton confirmMessage="¿Eliminar este vídeo?" className="link-action">
                    Quitar
                  </DeleteButton>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addVideoAction} className="flex items-end gap-4 border-t border-line pt-4">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Enlace del vídeo</span>
            <input name="videoUrl" placeholder="Pega el enlace de un vídeo (YouTube, Vimeo, Drive…)" required className="field-line" />
          </label>
          <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadido" className="link-action text-fg">
            Añadir
          </SubmitButton>
        </form>
      </section>

      <form action={deleteLocation.bind(null, locationId)} className="mt-16 border-t border-line pt-4">
        <DeleteButton
          confirmMessage="¿Eliminar esta localización? Se desvinculará de las escenas que la usen."
          className="link-action"
        >
          Eliminar localización
        </DeleteButton>
      </form>
    </div>
  );
}
