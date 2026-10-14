import Link from "next/link";
import { courierPrime } from "@/lib/screenplay/font";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { SCREENPLAY_FORMAT_LABELS } from "@/lib/screenplay-core";
import { PageHeader } from "@/components/PageHeader";
import { NewScreenplayTile } from "@/components/screenplay/NewScreenplayTile";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "Europe/Madrid",
});

// La mesa de guiones: cada guion es su portada, en papel, como el que se
// abre al entrar. Así el paso de Taller (oscuro) a la página (clara) empieza
// aquí y no es un salto.
export default async function GuionesPage() {
  const profile = await getCurrentProfile();
  const screenplays = profile
    ? await prisma.screenplay.findMany({
        where: { organizationId: profile.organizationId },
        orderBy: { updatedAt: "desc" },
        select: {
          id: true,
          title: true,
          format: true,
          logline: true,
          author: true,
          pageCount: true,
          sceneCount: true,
          updatedAt: true,
          project: { select: { name: true } },
        },
      })
    : [];

  return (
    <div className={courierPrime.variable}>
      <PageHeader
        backHref="/app"
        backLabel="← Inicio"
        eyebrow="Escritura"
        title="Guiones"
        description="De la idea al guion terminado, con tu equipo y en tiempo real. Cuando esté listo, vincúlalo a un proyecto y sus personajes y referencias pasan a producción."
      />

      <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-12 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        <li>
          <NewScreenplayTile empty={screenplays.length === 0} />
        </li>
        {screenplays.map((s) => (
          <li key={s.id}>
            <Link href={`/app/guiones/${s.id}`} className="sp-cover group block">
              <span className="sp-cover-sheet flex flex-col px-[10%] pt-[34%] pb-[8%] text-center text-[#1c1b19]">
                <span className="font-[family-name:var(--font-courier)] text-[clamp(11px,1.15vw,15px)] leading-tight font-bold uppercase underline underline-offset-4">
                  {s.title}
                </span>
                {s.author && (
                  <span className="mt-[12%] font-[family-name:var(--font-courier)] text-[clamp(9px,0.8vw,11px)] text-[#4a4842]">
                    escrito por
                    <span className="mt-1 block">{s.author}</span>
                  </span>
                )}
                <span className="mt-auto text-left font-[family-name:var(--font-courier)] text-[clamp(8px,0.7vw,10px)] text-[#8f897c]">
                  {SCREENPLAY_FORMAT_LABELS[s.format]}
                </span>
              </span>
            </Link>
            <div className="mt-3">
              <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                {s.pageCount} pág. · {s.sceneCount} {s.sceneCount === 1 ? "escena" : "escenas"}
                {s.project && <span className="text-accent"> · {s.project.name}</span>}
              </p>
              {s.logline && <p className="mt-1.5 line-clamp-3 font-sans text-[13px] leading-snug text-fg/75">{s.logline}</p>}
              <p className="mt-1.5 font-mono text-[10px] text-muted">{dateFmt.format(s.updatedAt)}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
