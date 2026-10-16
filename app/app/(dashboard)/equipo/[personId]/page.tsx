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

  const initialsText = `${person.firstName.charAt(0)}${person.lastName?.charAt(0) ?? ""}`.toUpperCase();
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcoming = availability.filter((a) => a.date >= startOfToday);
  const past = availability.length - upcoming.length;
  const nextBusy = upcoming.find((a) => a.status === "UNAVAILABLE");
  const projects = [
    ...actorRoles.map((a) => ({ id: a.id, project: a.project.name, as: "Actor / actriz" })),
    ...crewRoles.map((c) => ({ id: c.id, project: c.project.name, as: c.role ? `Equipo · ${c.role}` : "Equipo técnico" })),
  ];

  return (
    <div className="pb-16">
      <PageHeader
        backHref="/app/equipo"
        backLabel="← Equipo"
        eyebrow="Ficha de persona"
        title={fullName}
        description={
          [[person.primaryRole, ...person.otherRoles].filter(Boolean).join(" · "), projectCount > 0 ? `${projectCount} ${projectCount === 1 ? "proyecto" : "proyectos"}` : null]
            .filter(Boolean)
            .join(" — ") || undefined
        }
      />

      {/* Contacto a un clic y cómo está, antes que el formulario. */}
      <div className="mt-6 flex flex-wrap items-center gap-2">
        {person.email && (
          <a href={`mailto:${person.email}`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-fg/[0.06] px-4 font-sans text-[14px] text-fg transition-colors hover:bg-accent hover:text-bg">
            <span aria-hidden>✉</span> {person.email}
          </a>
        )}
        {person.phone && (
          <a href={`tel:${person.phone.replace(/\s+/g, "")}`} className="inline-flex min-h-9 items-center gap-2 rounded-full bg-fg/[0.06] px-4 font-sans text-[14px] text-fg transition-colors hover:bg-accent hover:text-bg tabular-nums">
            <span aria-hidden>☎</span> {person.phone}
          </a>
        )}
        {!person.email && !person.phone && (
          <p className="border-l-2 border-warn pl-3 font-sans text-sm text-muted">
            Sin email ni teléfono: añádelos en la ficha para poder convocarla.
          </p>
        )}
      </div>
      {nextBusy && (
        <p className="mt-4 border-l-2 border-warn pl-3 font-sans text-sm text-muted">
          <span className="text-fg">
            No está disponible el{" "}
            {nextBusy.date.toLocaleDateString("es-ES", { weekday: "long", day: "numeric", month: "long" })}
          </span>
          {nextBusy.note ? ` (${nextBusy.note})` : ""}.
        </p>
      )}

      <div className="mt-10 grid items-start gap-x-10 gap-y-14 lg:grid-cols-[minmax(0,1fr)_320px]">
        {/* ------------------------------------------------ ficha (papel) */}
        <section aria-labelledby="ficha" className="paper p-5 sm:p-8">
          <div className="flex items-center gap-4 border-b border-line pb-5">
            {person.photoUrl ? (
              <Image
                src={person.photoUrl}
                alt={`Foto de ${fullName}`}
                width={64}
                height={64}
                unoptimized
                className="h-16 w-16 shrink-0 rounded-full object-cover"
              />
            ) : (
              <span
                aria-hidden
                className="grid h-16 w-16 shrink-0 place-items-center rounded-full bg-accent/15 font-display text-xl font-black text-accent"
              >
                {initialsText}
              </span>
            )}
            <div className="min-w-0">
              <h2 id="ficha" className="font-display text-xl font-black tracking-tight">
                Datos
              </h2>
              <p className="font-sans text-[13px] text-muted">Lo que se usa al convocarla y al presupuestar.</p>
            </div>
          </div>
          <form action={updateAction} className="mt-6 grid gap-5 sm:grid-cols-2">
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
                  className="field mt-1.5 w-full"
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
                className="field mt-1.5 w-full leading-relaxed"
              />
            </label>
            <div className="mt-1 sm:col-span-2">
              <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-primary">
                Guardar ficha
              </SubmitButton>
            </div>
          </form>
        </section>

        <aside className="space-y-12">
          {/* ------------------------------------------------ proyectos */}
          <section aria-labelledby="proyectos">
            <h2 id="proyectos" className="font-display text-lg font-black tracking-tight uppercase">
              En proyectos
            </h2>
            {projects.length === 0 ? (
              <p className="mt-2 font-sans text-sm leading-relaxed text-muted">
                Todavía en ningún proyecto. Se le asigna desde Personajes (como actor) o Desglose (equipo técnico).
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {projects.map((p) => (
                  <li key={p.id} className="border-l-2 border-accent pl-3">
                    <p className="font-sans text-[15px]">{p.project}</p>
                    <p className="font-sans text-[13px] text-muted">{p.as}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* ------------------------------------------------ disponibilidad */}
          <section aria-labelledby="disponibilidad">
            <h2 id="disponibilidad" className="font-display text-lg font-black tracking-tight uppercase">
              Disponibilidad
            </h2>
            <p className="mt-1 font-sans text-[13px] text-muted">
              Marca los días que no puede (o que confirma) para cuadrar el plan de rodaje.
              {past > 0 ? ` ${past} ${past === 1 ? "día pasado" : "días pasados"} al final.` : ""}
            </p>
            {availability.length > 0 && (
              <ul className="mt-3 space-y-1.5">
                {[...upcoming, ...availability.filter((a) => a.date < startOfToday)].map((entry) => {
                  const busy = entry.status === "UNAVAILABLE";
                  const isPast = entry.date < startOfToday;
                  return (
                    <li key={entry.id} className={`flex items-center gap-3 ${isPast ? "opacity-50" : ""}`}>
                      <span
                        className={`grid w-10 shrink-0 overflow-hidden rounded-md text-center leading-none ${
                          busy ? "bg-danger/15 text-danger" : "bg-success/15 text-success"
                        }`}
                      >
                        <span className="py-0.5 font-mono text-[10px] tracking-widest uppercase">
                          {entry.date.toLocaleDateString("es-ES", { month: "short" }).replace(".", "")}
                        </span>
                        <span className="pb-1 font-display text-base font-black tabular-nums">{entry.date.getDate()}</span>
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className={`block font-sans text-[14px] ${busy ? "text-danger" : "text-success"}`}>
                          {STATUS_LABELS[entry.status]}
                          <span className="text-muted">
                            {" "}
                            · {entry.date.toLocaleDateString("es-ES", { weekday: "long" })}
                          </span>
                        </span>
                        {entry.note && <span className="block truncate font-sans text-[13px] text-muted">{entry.note}</span>}
                      </span>
                      <form action={deletePersonAvailability.bind(null, personId, entry.id)}>
                        <DeleteButton confirmMessage="¿Eliminar esta entrada de disponibilidad?" className="link-action">
                          Quitar
                        </DeleteButton>
                      </form>
                    </li>
                  );
                })}
              </ul>
            )}
            <form action={availabilityAction} className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 border-t border-line pt-4">
              <label className="block">
                <span className={LABEL}>Día</span>
                <input type="date" name="date" required className="field mt-1.5 w-full" />
              </label>
              <label className="block">
                <span className={LABEL}>Estado</span>
                <select name="status" defaultValue="UNAVAILABLE" className="field mt-1.5 w-full">
                  {Object.values(PersonAvailabilityStatus).map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="col-span-2 block">
                <span className={LABEL}>Nota</span>
                <input name="note" placeholder="Opcional: otro rodaje, viaje…" className="field mt-1.5 w-full" />
              </label>
              <div className="col-span-2">
                <SubmitButton pendingLabel="Guardando…" savedLabel="✓ Guardado" className="btn btn-outline btn-sm">
                  Marcar el día
                </SubmitButton>
              </div>
            </form>
          </section>

          {/* ------------------------------------------------ foto */}
          <section aria-labelledby="foto">
            <h2 id="foto" className="font-display text-lg font-black tracking-tight uppercase">
              Foto
            </h2>
            <form action={uploadPhotoAction} className="mt-3 space-y-2">
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
            </form>
          </section>

          <form action={deletePerson.bind(null, personId)} className="border-t border-line pt-4">
            <DeleteButton
              confirmMessage="¿Eliminar a esta persona del directorio? No se puede deshacer."
              className="link-action hover:!text-danger"
            >
              Eliminar persona
            </DeleteButton>
          </form>
        </aside>
      </div>
    </div>
  );
}
