import Image from "next/image";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { deletePerson, updatePerson, uploadPersonPhoto } from "@/lib/actions/people";
import { DeleteButton } from "@/components/DeleteButton";
import {
  deletePersonAvailability,
  setPersonAvailability,
} from "@/lib/actions/person-availability";
import { PersonAvailabilityStatus } from "@/lib/generated/prisma";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";

const LABEL = "font-mono text-[10px] tracking-[0.18em] text-muted uppercase";

const STATUS_LABELS: Record<PersonAvailabilityStatus, string> = {
  AVAILABLE: "Disponible",
  UNAVAILABLE: "No disponible",
};

export default async function PersonDetailPage({
  params,
}: {
  params: Promise<{ personId: string }>;
}) {
  const { personId } = await params;

  const profile = await getCurrentProfile();
  if (!profile) return null;

  const person = await prisma.person.findFirst({
    where: { id: personId, organizationId: profile.organizationId },
  });
  if (!person) notFound();

  const [availability, actorRoles, crewRoles] = await Promise.all([
    prisma.personAvailability.findMany({
      where: { personId },
      orderBy: { date: "asc" },
    }),
    prisma.actor.findMany({
      where: { personId },
      include: { project: { select: { name: true } } },
    }),
    prisma.crewMember.findMany({
      where: { personId },
      include: { project: { select: { name: true } } },
    }),
  ]);

  const updateAction = updatePerson.bind(null, personId);
  const uploadPhotoAction = uploadPersonPhoto.bind(null, personId);
  const availabilityAction = setPersonAvailability.bind(null, personId);

  const fullName = `${person.firstName} ${person.lastName ?? ""}`.trim();
  const projectCount = actorRoles.length + crewRoles.length;
  const fields: {
    name: string;
    label: string;
    value: string;
    wide?: boolean;
    type?: string;
    placeholder?: string;
  }[] = [
    { name: "firstName", label: "Nombre", value: person.firstName },
    { name: "lastName", label: "Apellidos", value: person.lastName ?? "" },
    { name: "primaryRole", label: "Rol principal", value: person.primaryRole ?? "" },
    { name: "rate", label: "Tarifa (€ / día)", value: person.rate?.toString() ?? "", type: "number" },
    {
      name: "otherRoles",
      label: "Otros roles",
      value: person.otherRoles.join(", "),
      wide: true,
      placeholder: "Separados por comas: operadora de cámara, foquista…",
    },
    { name: "email", label: "Email", value: person.email ?? "" },
    { name: "phone", label: "Teléfono", value: person.phone ?? "" },
    { name: "address", label: "Dirección", value: person.address ?? "", wide: true },
  ];

  return (
    <div className="pb-16">
      <PageHeader
        backHref="/app/equipo"
        backLabel="← Equipo"
        eyebrow="Equipo"
        title={fullName}
        description={
          [person.primaryRole, projectCount > 0 ? `${projectCount} ${projectCount === 1 ? "proyecto" : "proyectos"}` : null]
            .filter(Boolean)
            .join(" · ") || undefined
        }
      />

      <div className="mt-12 grid gap-x-16 gap-y-14 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ------------------------------------------------ ficha */}
        <section aria-labelledby="ficha">
          <h2 id="ficha" className="border-b border-line pb-3 font-display text-xl font-black tracking-tight uppercase">
            Ficha
          </h2>
          <form action={updateAction} className="mt-6 grid gap-x-8 gap-y-6 sm:grid-cols-2">
            {fields.map((field) => (
              <label key={field.name} className={`block ${field.wide ? "sm:col-span-2" : ""}`}>
                <span className={LABEL}>{field.label}</span>
                <input
                  name={field.name}
                  type={field.type}
                  step={field.type === "number" ? "0.01" : undefined}
                  required={field.name === "firstName"}
                  defaultValue={field.value}
                  placeholder={field.placeholder}
                  className="field-line"
                />
              </label>
            ))}
            <label className="block sm:col-span-2">
              <span className={LABEL}>Notas</span>
              <textarea
                name="notes"
                defaultValue={person.notes ?? ""}
                rows={3}
                placeholder="Alergias, talla de vestuario, con quién suele trabajar…"
                className="field mt-2 w-full leading-relaxed"
              />
            </label>
            <div className="sm:col-span-2">
              <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-primary">
                Guardar ficha
              </SubmitButton>
            </div>
          </form>
        </section>

        <aside className="space-y-12">
          {/* ------------------------------------------------ foto */}
          <section aria-labelledby="foto">
            <h2 id="foto" className={LABEL}>
              Foto
            </h2>
            <form action={uploadPhotoAction} className="mt-3 flex items-center gap-4">
              {person.photoUrl ? (
                <Image
                  src={person.photoUrl}
                  alt={`Foto de ${fullName}`}
                  width={72}
                  height={72}
                  unoptimized
                  className="h-[72px] w-[72px] shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  aria-hidden
                  className="grid h-[72px] w-[72px] shrink-0 place-items-center rounded-full bg-fg/[0.07] font-display text-xl font-black text-muted"
                >
                  {`${person.firstName.charAt(0)}${person.lastName?.charAt(0) ?? ""}`.toUpperCase()}
                </span>
              )}
              <div className="min-w-0 space-y-2">
                <label className="block">
                  <span className="sr-only">Elegir foto</span>
                  <input
                    type="file"
                    name="photo"
                    accept="image/*"
                    required
                    className="w-full font-sans text-[13px] text-muted file:mr-3 file:cursor-pointer file:rounded-full file:border-0 file:bg-fg/[0.07] file:px-3 file:py-1.5 file:font-mono file:text-[11px] file:tracking-widest file:text-fg file:uppercase"
                  />
                </label>
                <SubmitButton pendingLabel="Subiendo…" savedLabel="✓ Subida" className="link-action text-fg">
                  {person.photoUrl ? "Cambiar foto" : "Subir foto"}
                </SubmitButton>
              </div>
            </form>
          </section>

          {/* ------------------------------------------------ proyectos */}
          <section aria-labelledby="proyectos">
            <h2 id="proyectos" className={`${LABEL} border-b border-line pb-2`}>
              En proyectos
            </h2>
            {projectCount === 0 ? (
              <p className="py-3 font-sans text-sm leading-relaxed text-muted">
                Todavía en ningún proyecto. Se le asigna desde Personajes (como actor) o Desglose (equipo técnico).
              </p>
            ) : (
              <ul className="divide-y divide-line">
                {actorRoles.map((actor) => (
                  <li key={actor.id} className="py-2.5">
                    <p className="font-sans text-[15px]">{actor.project.name}</p>
                    <p className="font-sans text-[13px] text-muted">Actor / actriz</p>
                  </li>
                ))}
                {crewRoles.map((crew) => (
                  <li key={crew.id} className="py-2.5">
                    <p className="font-sans text-[15px]">{crew.project.name}</p>
                    <p className="font-sans text-[13px] text-muted">
                      Equipo técnico{crew.role ? ` · ${crew.role}` : ""}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------ disponibilidad */}
          <section aria-labelledby="disponibilidad">
            <h2 id="disponibilidad" className={`${LABEL} border-b border-line pb-2`}>
              Disponibilidad
            </h2>
            {availability.length > 0 && (
              <ul className="divide-y divide-line">
                {availability.map((entry) => (
                  <li key={entry.id} className="flex items-center justify-between gap-3 py-2.5">
                    <span className="min-w-0">
                      <span className="flex items-center gap-2 font-sans text-[15px]">
                        <span
                          aria-hidden
                          className={`h-2 w-2 shrink-0 rounded-full ${
                            entry.status === "UNAVAILABLE" ? "bg-danger" : "bg-success"
                          }`}
                        />
                        {entry.date.toLocaleDateString("es-ES", { weekday: "short", day: "numeric", month: "short" })}
                        <span className={entry.status === "UNAVAILABLE" ? "text-danger" : "text-success"}>
                          {STATUS_LABELS[entry.status]}
                        </span>
                      </span>
                      {entry.note && <span className="block truncate pl-4 font-sans text-[13px] text-muted">{entry.note}</span>}
                    </span>
                    <form action={deletePersonAvailability.bind(null, personId, entry.id)}>
                      <DeleteButton confirmMessage="¿Eliminar esta entrada de disponibilidad?" className="link-action">
                        Quitar
                      </DeleteButton>
                    </form>
                  </li>
                ))}
              </ul>
            )}
            <form action={availabilityAction} className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
              <label className="block">
                <span className={LABEL}>Día</span>
                <input type="date" name="date" required className="field-line" />
              </label>
              <label className="block">
                <span className={LABEL}>Estado</span>
                <select name="status" defaultValue="UNAVAILABLE" className="field-line">
                  {Object.values(PersonAvailabilityStatus).map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 block">
                <span className={LABEL}>Nota</span>
                <input name="note" placeholder="Opcional: otro rodaje, viaje…" className="field-line" />
              </label>
              <div className="col-span-2">
                <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-outline btn-sm">
                  Marcar el día
                </SubmitButton>
              </div>
            </form>
          </section>
        </aside>
      </div>

      <form action={deletePerson.bind(null, personId)} className="mt-16 border-t border-line pt-4">
        <DeleteButton
          confirmMessage="¿Eliminar a esta persona del directorio? No se puede deshacer."
          className="link-action"
        >
          Eliminar persona
        </DeleteButton>
      </form>
    </div>
  );
}
