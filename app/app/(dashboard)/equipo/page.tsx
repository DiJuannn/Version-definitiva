import Image from "next/image";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { createPerson } from "@/lib/actions/people";
import { CreateDialog, DialogCancel } from "@/components/CreateDialog";
import { PageHeader } from "@/components/PageHeader";
import { SubmitButton } from "@/components/SubmitButton";
import { FormField } from "@/components/FormField";

// Alta de persona. En el diálogo, en una columna; en línea (directorio vacío),
// a lo ancho.
function NewPersonForm({ inline }: { inline?: boolean }) {
  return (
    <form action={createPerson} className={inline ? "grid gap-4 sm:grid-cols-2 lg:grid-cols-3" : "grid gap-4"}>
      <div className={inline ? "contents" : "grid grid-cols-2 gap-4"}>
        <FormField label="Nombre">
          <input name="firstName" required autoComplete="off" className="field w-full" />
        </FormField>
        <FormField label="Apellidos">
          <input name="lastName" autoComplete="off" className="field w-full" />
        </FormField>
      </div>
      <FormField label="Qué hace" hint="Rol principal: dirección de fotografía, sonido, actriz…">
        <input name="primaryRole" className="field w-full" />
      </FormField>
      <div className={inline ? "contents" : "grid grid-cols-2 gap-4"}>
        <FormField label="Email">
          <input name="email" inputMode="email" autoComplete="off" className="field w-full" />
        </FormField>
        <FormField label="Teléfono">
          <input name="phone" type="tel" className="field w-full" />
        </FormField>
      </div>
      <FormField label="Tarifa (€ / día)">
        <input name="rate" type="number" step="0.01" className="field w-full" />
      </FormField>
      <div className={`flex items-center gap-4 ${inline ? "sm:col-span-2 lg:col-span-3" : "mt-1"}`}>
        <SubmitButton pendingLabel="Añadiendo…" savedLabel="✓ Añadida" className="btn btn-primary">
          Añadir al equipo
        </SubmitButton>
        <DialogCancel />
      </div>
    </form>
  );
}

function initials(first: string, last: string | null) {
  return `${first.charAt(0)}${last?.charAt(0) ?? ""}`.toUpperCase();
}

export default async function EquipoPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const people = await prisma.person.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { firstName: "asc" },
    include: {
      _count: { select: { actors: true, crewMembers: true } },
    },
  });

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Recursos"
        title="Equipo"
        description="La agenda de personas de la productora. Se apuntan una vez y se eligen como actor en Personajes o como técnico en Desglose, en cualquier proyecto."
        actions={
          people.length > 0 ? (
            <CreateDialog label="Añadir persona" title="Nueva persona" description="Foto, dirección y disponibilidad se añaden después en su ficha.">
              <NewPersonForm />
            </CreateDialog>
          ) : undefined
        }
      />

      {people.length === 0 ? (
        <section aria-labelledby="primera-persona" className="mt-12 border-t border-line pt-10">
          <h2 id="primera-persona" className="font-display text-xl font-bold">
            Empieza por la primera persona
          </h2>
          <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
            Con nombre basta. Lo demás se completa cuando quieras desde su ficha.
          </p>
          <div className="mt-8 max-w-4xl">
            <NewPersonForm inline />
          </div>
        </section>
      ) : (
        <section aria-label="Personas" className="mt-12">
          <div className="hidden grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1fr)_7rem] gap-x-5 border-b border-line pb-2 md:grid">
            <span />
            <span className="eyebrow">{people.length} {people.length === 1 ? "persona" : "personas"}</span>
            <span className="eyebrow">Contacto</span>
            <span className="eyebrow text-right">Proyectos</span>
          </div>
          <ul className="divide-y divide-line border-b border-line">
            {people.map((person) => {
              const projects = person._count.actors + person._count.crewMembers;
              const contact = [person.email, person.phone].filter(Boolean).join(" · ");
              return (
                <li key={person.id}>
                  <Link
                    href={`/app/equipo/${person.id}`}
                    className="group grid grid-cols-[44px_minmax(0,1fr)_auto] items-center gap-x-5 py-3.5 md:grid-cols-[44px_minmax(0,1.3fr)_minmax(0,1fr)_7rem]"
                  >
                    {person.photoUrl ? (
                      <Image
                        src={person.photoUrl}
                        alt=""
                        width={44}
                        height={44}
                        unoptimized
                        className="h-11 w-11 rounded-full object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="grid h-11 w-11 place-items-center rounded-full bg-fg/[0.07] font-display text-sm font-black text-muted"
                      >
                        {initials(person.firstName, person.lastName)}
                      </span>
                    )}
                    <span className="min-w-0">
                      <span className="block truncate font-sans text-[17px] font-medium transition-colors group-hover:text-accent">
                        {person.firstName} {person.lastName ?? ""}
                      </span>
                      <span className="block truncate font-sans text-[13px] text-muted">
                        {[person.primaryRole, ...person.otherRoles].filter(Boolean).join(", ") || "Sin rol todavía"}
                      </span>
                    </span>
                    <span className="hidden min-w-0 truncate font-sans text-[13px] text-muted md:block">
                      {contact || "—"}
                    </span>
                    <span className="flex items-center justify-end gap-3 font-mono text-[11px] tracking-wide text-muted tabular-nums">
                      {projects > 0 ? `${projects} ${projects === 1 ? "proyecto" : "proyectos"}` : "—"}
                      <span aria-hidden className="font-sans text-base transition-colors group-hover:text-accent">
                        →
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
