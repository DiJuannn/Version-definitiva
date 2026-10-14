import Link from "next/link";
import { getCurrentProfile } from "@/lib/current-user";
import { createScreenplay } from "@/lib/actions/screenplays";
import { listScreenplays, SCREENPLAY_FORMAT_LABELS } from "@/lib/screenplay-core";
import { PageHeader } from "@/components/PageHeader";
import { NewScreenplayForm } from "@/components/screenplay/NewScreenplayForm";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

export default async function GuionesPage() {
  const profile = await getCurrentProfile();
  const screenplays = profile ? await listScreenplays(profile.organizationId) : [];

  return (
    <div>
      <PageHeader
        backHref="/app"
        backLabel="← Inicio"
        eyebrow="Escritura"
        title="Guiones"
        description="Escribe cortos, largos y series con formato profesional, a la vez con tu equipo y en tiempo real. Cuando el guion esté listo, pásalo a producción."
      />

      <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_380px]">
        <section aria-labelledby="mis-guiones">
          <h2 id="mis-guiones" className="font-mono text-[11px] tracking-widest text-muted uppercase">
            {screenplays.length ? `${screenplays.length} ${screenplays.length === 1 ? "guion" : "guiones"}` : "Aún no hay guiones"}
          </h2>

          {screenplays.length === 0 ? (
            <div className="mt-4 border border-dashed border-line p-8">
              <p className="font-display text-sm font-bold">La página en blanco es el primer paso.</p>
              <p className="mt-2 max-w-md font-sans text-sm text-muted">
                Crea tu primer guion a la derecha o importa uno en Fountain. Escribe con Tab y Enter: el formato se pone
                solo.
              </p>
            </div>
          ) : (
            <ul className="mt-4 grid gap-4 sm:grid-cols-2">
              {screenplays.map((s) => (
                <li key={s.id}>
                  <Link
                    href={`/app/guiones/${s.id}`}
                    className="group flex h-full flex-col border border-line bg-bg-raised p-5 transition-colors hover:border-accent"
                  >
                    <span className="font-mono text-[10px] tracking-widest text-accent uppercase">
                      {SCREENPLAY_FORMAT_LABELS[s.format]}
                    </span>
                    <span className="mt-2 font-display text-xl leading-tight font-black tracking-tight uppercase">
                      {s.title}
                    </span>
                    {s.logline && <span className="mt-2 line-clamp-2 font-sans text-sm text-muted">{s.logline}</span>}
                    <span className="mt-auto flex flex-wrap gap-x-4 gap-y-1 pt-5 font-mono text-[11px] text-muted">
                      <span>
                        <span className="text-fg">{s.pageCount}</span> pág. · ≈{s.pageCount} min
                      </span>
                      <span>
                        <span className="text-fg">{s.sceneCount}</span> escenas
                      </span>
                      <span className="ml-auto">{dateFmt.format(s.updatedAt)}</span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <aside aria-labelledby="nuevo-guion" className="h-fit border border-line p-6">
          <h2 id="nuevo-guion" className="font-display text-lg font-black tracking-tight uppercase">
            Nuevo guion
          </h2>
          <div className="mt-5">
            <NewScreenplayForm action={createScreenplay} />
          </div>
        </aside>
      </div>
    </div>
  );
}
