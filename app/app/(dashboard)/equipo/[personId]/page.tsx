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
import { BackLink } from "@/components/BackLink";
import { SubmitButton } from "@/components/SubmitButton";

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

  return (
    <div>
      <BackLink href="/app/equipo">← Equipo</BackLink>
      <div className="mt-3 flex items-center gap-4">
        {person.photoUrl && (
          <Image
            src={person.photoUrl}
            alt=""
            width={64}
            height={64}
            unoptimized
            className="h-16 w-16 rounded-full object-cover"
          />
        )}
        <h1 className="font-display text-2xl font-bold uppercase">
          {person.firstName} {person.lastName ?? ""}
        </h1>
      </div>

      <form
        action={uploadPhotoAction}
        className="mt-4 flex flex-wrap items-center gap-3"
      >
        <input
          type="file"
          name="photo"
          accept="image/*"
          required
          className="font-mono text-xs text-muted"
        />
        <SubmitButton
          pendingLabel="Subiendo…"
          savedLabel="✓ Subida"
          className="rounded-full bg-fg px-4 py-1.5 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
        >
          Subir foto
        </SubmitButton>
      </form>

      <form
        action={updateAction}
        className="mt-8 grid gap-4 border border-line p-5 sm:grid-cols-2 lg:grid-cols-3"
      >
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Nombre
          </span>
          <input
            name="firstName"
            defaultValue={person.firstName}
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Apellidos
          </span>
          <input
            name="lastName"
            defaultValue={person.lastName ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Rol principal
          </span>
          <input
            name="primaryRole"
            defaultValue={person.primaryRole ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Otros roles (separados por comas)
          </span>
          <input
            name="otherRoles"
            defaultValue={person.otherRoles.join(", ")}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Email
          </span>
          <input
            name="email"
            defaultValue={person.email ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Teléfono
          </span>
          <input
            name="phone"
            defaultValue={person.phone ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Tarifa
          </span>
          <input
            name="rate"
            type="number"
            step="0.01"
            defaultValue={person.rate?.toString() ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Dirección
          </span>
          <input
            name="address"
            defaultValue={person.address ?? ""}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <label className="flex flex-col gap-1 sm:col-span-2 lg:col-span-3">
          <span className="font-mono text-[10px] tracking-widest text-muted uppercase">
            Notas
          </span>
          <textarea
            name="notes"
            defaultValue={person.notes ?? ""}
            rows={2}
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
        </label>
        <div>
          <SubmitButton
            pendingLabel="Guardando…"
            savedLabel="✓ Guardado"
            className="rounded-full bg-fg px-5 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Guardar
          </SubmitButton>
        </div>
      </form>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Proyectos en los que participa
        </h2>
        {actorRoles.length === 0 && crewRoles.length === 0 ? (
          <p className="mt-3 font-mono text-sm text-muted">
            Todavía no está vinculada/o a ningún proyecto.
          </p>
        ) : (
          <ul className="mt-3 space-y-1.5">
            {actorRoles.map((actor) => (
              <li key={actor.id} className="font-mono text-sm">
                {actor.project.name}{" "}
                <span className="text-muted">— Actor/Actriz</span>
              </li>
            ))}
            {crewRoles.map((crew) => (
              <li key={crew.id} className="font-mono text-sm">
                {crew.project.name}{" "}
                <span className="text-muted">
                  — Equipo técnico{crew.role ? ` (${crew.role})` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10">
        <h2 className="font-mono text-xs tracking-widest text-accent uppercase">
          Disponibilidad
        </h2>
        <form
          action={availabilityAction}
          className="mt-4 flex flex-wrap items-center gap-2"
        >
          <input
            type="date"
            name="date"
            required
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <select
            name="status"
            defaultValue="UNAVAILABLE"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          >
            {Object.values(PersonAvailabilityStatus).map((value) => (
              <option key={value} value={value} className="bg-bg">
                {STATUS_LABELS[value]}
              </option>
            ))}
          </select>
          <input
            name="note"
            placeholder="Nota"
            className="border border-line bg-transparent px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
          />
          <SubmitButton
            pendingLabel="Guardando…"
            savedLabel="✓ Guardado"
            className="rounded-full bg-fg px-4 py-2 font-mono text-xs tracking-widest text-bg uppercase transition-opacity hover:opacity-90"
          >
            Guardar día
          </SubmitButton>
        </form>

        {availability.length > 0 && (
          <div className="mt-6 border-t border-line">
            {availability.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-4 border-b border-line py-2.5"
              >
                <span className="font-mono text-sm">
                  {entry.date.toLocaleDateString("es-ES")} —{" "}
                  <span
                    className={
                      entry.status === "UNAVAILABLE" ? "text-accent" : ""
                    }
                  >
                    {STATUS_LABELS[entry.status]}
                  </span>
                  {entry.note ? ` · ${entry.note}` : ""}
                </span>
                <form
                  action={deletePersonAvailability.bind(null, personId, entry.id)}
                >
                  <DeleteButton
                    confirmMessage="¿Eliminar esta entrada de disponibilidad?"
                    className="font-mono text-[11px] tracking-widest text-muted uppercase hover:text-accent"
                  />
                </form>
              </div>
            ))}
          </div>
        )}
      </section>

      <form action={deletePerson.bind(null, personId)} className="mt-10">
        <DeleteButton
          confirmMessage="¿Eliminar a esta persona del directorio? No se puede deshacer."
          className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
        >
          Eliminar persona
        </DeleteButton>
      </form>
    </div>
  );
}
