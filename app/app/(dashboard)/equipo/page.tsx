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

// Departamentos de un rodaje, deducidos del rol con palabras clave (el rol
// es texto libre). El orden importa: «directora de fotografía» es Cámara y
// «directora de arte» es Arte antes que Dirección. El color es de categoría,
// para reconocer el departamento de un vistazo en la mesa oscura.
const DEPARTMENTS = [
  { id: "direccion", label: "Dirección", color: "#b3a4e6", words: ["direc", "director", "directora", "script", "realizad"] },
  { id: "produccion", label: "Producción", color: "#e0956c", words: ["produc", "localizac", "runner", "meritorio", "catering", "transporte"] },
  { id: "reparto", label: "Reparto", color: "#f08f8f", words: ["actor", "actriz", "reparto", "figurac", "intérprete", "interprete", "doble"] },
  { id: "camara", label: "Cámara", color: "#7fb8e0", words: ["fotograf", "cámara", "camara", "foquista", "steadicam", "operador de cámara", "operadora", "drone", "dron"] },
  { id: "electricos", label: "Eléctricos y maquinistas", color: "#e3b25c", words: ["eléctric", "electric", "gaffer", "maquinista", "iluminac", "grip"] },
  { id: "sonido", label: "Sonido", color: "#7cc79a", words: ["sonid", "microfon", "pértiga", "pertiga", "boom", "mezcla"] },
  { id: "arte", label: "Arte", color: "#e3a3c8", words: ["arte", "atrezz", "vestuario", "maquillaje", "peluquer", "escenograf", "decorad", "ambientad", "caracteriza"] },
  { id: "post", label: "Postproducción", color: "#8fd3cf", words: ["montaje", "montador", "editor", "edición", "postpro", "color", "vfx", "efectos"] },
] as const;
const OTHER_DEPARTMENT = { id: "otros", label: "Sin departamento", color: "#9a99a0" } as const;

// Orden de búsqueda (lo más específico primero: «operador de sonido» es
// Sonido; «director de producción», Producción; «postproducción» no es
// Producción). El de pantalla es el de DEPARTMENTS.
const MATCH_ORDER = ["sonido", "camara", "arte", "electricos", "post", "produccion", "reparto", "direccion"];

function departmentOf(roles: string[]) {
  for (const role of roles) {
    const text = role.toLowerCase();
    const found = MATCH_ORDER.map((id) => DEPARTMENTS.find((d) => d.id === id)!).find((d) =>
      d.words.some((w) => text.includes(w)),
    );
    if (found) return found;
  }
  return OTHER_DEPARTMENT;
}

function MailIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
function PhoneIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden>
      <path
        d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a1 1 0 0 1-1 1A16 16 0 0 1 4 5a1 1 0 0 1 1-1Z"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function EquipoPage() {
  const profile = await getCurrentProfile();
  if (!profile) return null;

  const people = await prisma.person.findMany({
    where: { organizationId: profile.organizationId },
    orderBy: { firstName: "asc" },
    include: {
      // Solo lectura: en qué proyectos está cada persona.
      actors: { select: { project: { select: { id: true, name: true } } } },
      crewMembers: { select: { project: { select: { id: true, name: true } } } },
    },
  });

  const enriched = people.map((person) => {
    const roles = [person.primaryRole, ...person.otherRoles].filter((r): r is string => Boolean(r));
    const projectMap = new Map<string, string>();
    for (const link of [...person.actors, ...person.crewMembers]) projectMap.set(link.project.id, link.project.name);
    return {
      person,
      roles,
      department: departmentOf(roles),
      projects: [...projectMap.entries()].map(([id, name]) => ({ id, name })),
    };
  });
  const groups = [...DEPARTMENTS, OTHER_DEPARTMENT]
    .map((department) => ({ department, rows: enriched.filter((e) => e.department.id === department.id) }))
    .filter((g) => g.rows.length > 0);

  const withoutContact = enriched.filter((e) => !e.person.email && !e.person.phone);
  const withoutEmail = enriched.filter((e) => !e.person.email && e.person.phone);
  const inProjects = enriched.filter((e) => e.projects.length > 0).length;

  return (
    <div className="pb-16">
      <PageHeader
        eyebrow="Recursos"
        title="Equipo"
        description="La agenda de la productora, por departamentos. Cada persona se apunta una vez y se elige como actor en Personajes o como técnico en Desglose."
        actions={
          people.length > 0 ? (
            <CreateDialog label="Añadir persona" title="Nueva persona" description="Foto, dirección y disponibilidad se añaden después en su ficha.">
              <NewPersonForm />
            </CreateDialog>
          ) : undefined
        }
      />

      {people.length === 0 ? (
        <section aria-labelledby="primera-persona" className="mt-12 pt-4">
          <h2 id="primera-persona" className="font-display text-xl font-bold">
            Empieza por la primera persona
          </h2>
          <p className="mt-2 max-w-xl font-sans text-sm leading-relaxed text-muted">
            Con nombre basta. Lo demás se completa cuando quieras desde su ficha.
          </p>
          <div className="paper mt-8 max-w-4xl p-6">
            <NewPersonForm inline />
          </div>
        </section>
      ) : (
        <>
          {/* Cómo voy */}
          <div className="mt-8 space-y-2 font-sans text-[15px] leading-relaxed text-muted">
            <p>
              <span className="font-display text-2xl font-black text-fg tabular-nums">{people.length}</span>{" "}
              {people.length === 1 ? "persona" : "personas"} en {groups.length}{" "}
              {groups.length === 1 ? "departamento" : "departamentos"} ·{" "}
              {inProjects === 0
                ? "ninguna asignada todavía a un proyecto"
                : `${inProjects} ${inProjects === 1 ? "trabaja" : "trabajan"} en algún proyecto`}
              .
            </p>
            {withoutContact.length > 0 && (
              <p className="border-l-2 border-warn pl-3 text-sm">
                Sin forma de contactar:{" "}
                {withoutContact.map((e, i) => (
                  <span key={e.person.id}>
                    {i > 0 && ", "}
                    <Link href={`/app/equipo/${e.person.id}`} className="text-fg hover:text-accent">
                      {e.person.firstName} {e.person.lastName ?? ""}
                    </Link>
                  </span>
                ))}
                . Añade un teléfono o email en su ficha.
              </p>
            )}
            {withoutEmail.length > 0 && (
              <p className="border-l-2 border-warn pl-3 text-sm">
                Sin email (solo teléfono):{" "}
                {withoutEmail.map((e, i) => (
                  <span key={e.person.id}>
                    {i > 0 && ", "}
                    <Link href={`/app/equipo/${e.person.id}`} className="text-fg hover:text-accent">
                      {e.person.firstName} {e.person.lastName ?? ""}
                    </Link>
                  </span>
                ))}
                .
              </p>
            )}
          </div>

          {/* Departamentos en columnas, como la lista de equipo de un rodaje. */}
          <div className="mt-10 grid items-start gap-x-5 gap-y-10 sm:grid-cols-2 xl:grid-cols-3">
          {groups.map(({ department, rows }) => (
            <section
              key={department.id}
              aria-labelledby={`dep-${department.id}`}
              style={{ "--c": department.color } as React.CSSProperties}
            >
              <h2 id={`dep-${department.id}`} className="flex items-center gap-3">
                <span aria-hidden className="h-4 w-1 rounded-full bg-[var(--c)]" />
                <span className="font-display text-lg font-black tracking-tight uppercase">{department.label}</span>
                <span className="font-mono text-[11px] text-muted tabular-nums">{rows.length}</span>
              </h2>
              <ul className="mt-3 grid gap-3">
                {rows.map(({ person, roles, projects }) => {
                  const fullName = `${person.firstName} ${person.lastName ?? ""}`.trim();
                  return (
                    // Tarjeta de contacto: la tarjeta entera abre la ficha; el
                    // email y el teléfono son atajos que van por encima.
                    <li
                      key={person.id}
                      className="tile group relative flex flex-col p-4 transition-transform focus-within:-translate-y-0.5 hover:-translate-y-0.5 motion-reduce:transform-none"
                    >
                      <div className="flex items-start gap-3.5">
                        {person.photoUrl ? (
                          <Image
                            src={person.photoUrl}
                            alt=""
                            width={48}
                            height={48}
                            unoptimized
                            className="h-12 w-12 shrink-0 rounded-full object-cover"
                          />
                        ) : (
                          <span
                            aria-hidden
                            className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-[color-mix(in_srgb,var(--c)_22%,transparent)] font-display text-base font-black text-[var(--c)]"
                          >
                            {initials(person.firstName, person.lastName)}
                          </span>
                        )}
                        <div className="min-w-0 flex-1">
                          <Link
                            href={`/app/equipo/${person.id}`}
                            className="block truncate font-display text-[17px] font-bold transition-colors after:absolute after:inset-0 after:rounded-xl group-hover:text-accent"
                          >
                            {fullName}
                          </Link>
                          <p className="mt-0.5 line-clamp-2 font-sans text-[13px] leading-snug text-muted">
                            {roles.join(" · ") || "Sin rol todavía"}
                          </p>
                        </div>
                      </div>

                      <div className="mt-4 flex flex-wrap items-center gap-1.5 font-sans text-[12px]">
                        {projects.length > 0 ? (
                          projects.map((project) => (
                            <span key={project.id} className="rounded-full bg-accent/15 px-2 py-0.5 text-fg/90">
                              {project.name}
                            </span>
                          ))
                        ) : (
                          <span className="text-muted/80">Sin proyectos todavía</span>
                        )}
                      </div>

                      <div className="relative z-10 mt-4 flex flex-wrap gap-2 border-t border-line pt-3">
                        {person.email ? (
                          <a
                            href={`mailto:${person.email}`}
                            title={person.email}
                            className="inline-flex min-h-8 min-w-0 items-center gap-1.5 rounded-full bg-fg/[0.06] px-3 font-sans text-[12px] text-fg/90 transition-colors hover:bg-accent hover:text-bg"
                          >
                            <MailIcon className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">Escribir</span>
                            <span className="sr-only"> a {person.email}</span>
                          </a>
                        ) : null}
                        {person.phone ? (
                          <a
                            href={`tel:${person.phone.replace(/\s+/g, "")}`}
                            className="inline-flex min-h-8 items-center gap-1.5 rounded-full bg-fg/[0.06] px-3 font-sans text-[12px] text-fg/90 tabular-nums transition-colors hover:bg-accent hover:text-bg"
                          >
                            <PhoneIcon className="h-3.5 w-3.5 shrink-0" />
                            {person.phone}
                          </a>
                        ) : null}
                        {!person.email && !person.phone && (
                          <span className="inline-flex min-h-8 items-center font-sans text-[12px] text-warn">Sin contacto</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
          </div>

          <p className="mt-16 border-t border-line pt-4 font-sans text-sm text-muted">
            Siguiente: asignar personas a un proyecto desde{" "}
            <Link href="/app/proyectos" className="text-fg underline decoration-accent/60 underline-offset-4 hover:text-accent">
              Personajes o Desglose
            </Link>
            .
          </p>
        </>
      )}
    </div>
  );
}
