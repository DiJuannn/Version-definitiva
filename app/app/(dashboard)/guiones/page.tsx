import Link from "next/link";
import { courierPrime } from "@/lib/screenplay/font";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { SCREENPLAY_FORMAT_LABELS } from "@/lib/screenplay-core";
import { PageHeader } from "@/components/PageHeader";
import { NewScreenplayButton, NewScreenplayTile } from "@/components/screenplay/NewScreenplayTile";
import { COVER_SHADOW } from "@/components/screenplay/cover-shadow";

const dateFmt = new Intl.DateTimeFormat("es-ES", {
  day: "numeric",
  month: "short",
  timeZone: "Europe/Madrid",
});

// En qué punto está cada guion, deducido de lo que ya hay escrito: sin
// escenas es una idea; con escenas pero sin páginas, las primeras escenas;
// con páginas, un guion; y vinculado a un proyecto, ya en producción.
const STAGES = ["Idea", "Primeras escenas", "Guion", "En producción"] as const;

function stageOf(s: { pageCount: number; sceneCount: number; wordCount: number; project: unknown }): number {
  if (s.project) return 3;
  if (s.pageCount > 0 || s.wordCount > 0) return 2;
  if (s.sceneCount > 0) return 1;
  return 0;
}

function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`;
}

// La mesa de guiones: cada guion es su portada, en papel, apoyada sobre la
// mesa oscura (el mismo papel que se abre al entrar). Debajo de cada una, en
// qué paso está y lo que tiene escrito.
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
          wordCount: true,
          updatedAt: true,
          project: { select: { id: true, name: true } },
        },
      })
    : [];

  const withStage = screenplays.map((s) => ({ ...s, stage: stageOf(s) }));
  const inProduction = withStage.filter((s) => s.stage === 3);
  const writing = withStage.filter((s) => s.stage < 3);
  const totalPages = screenplays.reduce((n, s) => n + s.pageCount, 0);
  // Guiones con páginas que aún no han pasado a producción: el siguiente paso
  // es vincularlos a un proyecto (se hace desde dentro del guion).
  const readyToLink = withStage.filter((s) => s.stage === 2);
  const nextProject = inProduction[0]?.project;

  return (
    <div className={courierPrime.variable}>
      <PageHeader
        eyebrow="Escritura"
        title="Guiones"
        description="Escribe la historia de la idea al guion terminado, con tu equipo y en tiempo real."
        actions={screenplays.length > 0 ? <NewScreenplayButton /> : undefined}
      />

      {/* Cómo va la mesa: cuántos guiones y en qué paso, sin cajas. */}
      {screenplays.length > 0 && (
        <div className="mt-10">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-4 sm:flex sm:flex-wrap sm:gap-x-10">
            {[
              { n: screenplays.length, label: screenplays.length === 1 ? "guion" : "guiones" },
              { n: writing.length, label: "en escritura" },
              { n: inProduction.length, label: "en producción" },
              { n: totalPages, label: totalPages === 1 ? "página escrita" : "páginas escritas" },
            ].map((stat) => (
              <div key={stat.label} className="flex items-baseline gap-2">
                <dt className="sr-only">{stat.label}</dt>
                <dd className="font-display text-3xl font-bold text-fg tabular-nums">{stat.n}</dd>
                <span className="font-sans text-sm text-muted" aria-hidden>
                  {stat.label}
                </span>
              </div>
            ))}
          </dl>
          {readyToLink.length > 0 && (
            <p className="mt-5 max-w-3xl border-l-2 border-warn pl-3 font-sans text-[13px] leading-relaxed text-fg">
              {readyToLink.length === 1 ? (
                <>
                  <Link href={`/app/guiones/${readyToLink[0].id}`} className="font-medium underline-offset-4 hover:underline">
                    «{readyToLink[0].title}»
                  </Link>{" "}
                  ya tiene {plural(readyToLink[0].pageCount, "página", "páginas")} y no está en ningún proyecto.
                </>
              ) : (
                <>
                  {listTitles(readyToLink.map((s) => s.title))} ya tienen páginas y no están en ningún proyecto.
                </>
              )}{" "}
              <span className="text-muted">
                Cuando esté listo, vincúlalo desde el guion para pasar sus escenas y personajes a producción.
              </span>
            </p>
          )}
        </div>
      )}

      <ul className="mt-12 grid grid-cols-2 gap-x-6 gap-y-14 sm:grid-cols-3 sm:gap-x-8 lg:grid-cols-4 xl:grid-cols-5">
        <li>
          <NewScreenplayTile empty={screenplays.length === 0} />
        </li>
        {withStage.map((s) => (
          <li key={s.id}>
            <Link
              href={`/app/guiones/${s.id}`}
              className="sp-cover group block"
              aria-label={`${s.title} · ${STAGES[s.stage]}`}
            >
              <span
                className={`sp-cover-sheet relative flex flex-col px-[12%] pt-[34%] pb-[8%] text-center text-[#1c1b19] ${COVER_SHADOW}`}
              >
                {/* Los dos pasadores de latón de un guion encuadernado. */}
                <span
                  className="absolute top-[14%] left-[6%] h-[7px] w-[7px] rounded-full bg-[#b09155] shadow-[inset_0_-1px_1px_rgb(0_0_0/0.35),0_1px_0_rgb(255_255_255/0.6)]"
                  aria-hidden
                />
                <span
                  className="absolute bottom-[14%] left-[6%] h-[7px] w-[7px] rounded-full bg-[#b09155] shadow-[inset_0_-1px_1px_rgb(0_0_0/0.35),0_1px_0_rgb(255_255_255/0.6)]"
                  aria-hidden
                />
                <span className="font-[family-name:var(--font-courier)] text-[clamp(11px,1.15vw,15px)] leading-tight font-bold uppercase underline underline-offset-4">
                  {s.title}
                </span>
                {s.author && (
                  <span className="mt-[12%] line-clamp-5 font-[family-name:var(--font-courier)] text-[clamp(9px,0.8vw,11px)] text-[#4a4842]">
                    escrito por
                    <span className="mt-1 block">{s.author}</span>
                  </span>
                )}
                <span className="mt-auto text-left font-[family-name:var(--font-courier)] text-[clamp(8px,0.7vw,10px)] text-[#8f897c]">
                  {SCREENPLAY_FORMAT_LABELS[s.format]}
                </span>
              </span>
            </Link>

            <div className="mt-5">
              {/* El camino del guion: cuatro tramos, rellenos hasta donde ha llegado. */}
              <div className="flex gap-1" aria-hidden>
                {STAGES.map((label, i) => (
                  <span
                    key={label}
                    className={`h-1 flex-1 rounded-full ${
                      i <= s.stage ? (s.stage === 3 ? "bg-success" : "bg-accent") : "bg-fg/12"
                    }`}
                  />
                ))}
              </div>
              <p className="mt-2.5 font-sans text-[13px] font-semibold text-fg">
                {STAGES[s.stage]}
                {s.stage === 3 && s.project && (
                  <>
                    <span className="font-normal text-muted"> · </span>
                    <Link
                      href={`/app/${s.project.id}`}
                      className="font-normal text-muted underline-offset-4 hover:text-fg hover:underline"
                    >
                      {s.project.name}
                    </Link>
                  </>
                )}
              </p>
              <p className="mt-1 font-mono text-[11px] tracking-wide text-muted">
                {plural(s.pageCount, "pág.", "pág.")} · {plural(s.sceneCount, "escena", "escenas")} ·{" "}
                <time dateTime={s.updatedAt.toISOString()}>{dateFmt.format(s.updatedAt)}</time>
              </p>
              {s.logline && (
                <p className="mt-3 line-clamp-3 font-sans text-[13px] leading-relaxed text-muted">{s.logline}</p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {nextProject && (
        <p className="mt-16 font-sans text-sm text-muted">
          Siguiente:{" "}
          <Link href={`/app/${nextProject.id}/desglose`} className="link-action text-accent">
            desglosa el guion de {nextProject.name} →
          </Link>
        </p>
      )}
    </div>
  );
}

// «Sal», «Faro» y «Nieve»
function listTitles(titles: string[]) {
  const q = titles.map((t) => `«${t}»`);
  return q.length <= 1 ? q.join("") : `${q.slice(0, -1).join(", ")} y ${q[q.length - 1]}`;
}
