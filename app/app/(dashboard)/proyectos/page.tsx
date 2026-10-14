import Link from "next/link";
import { deleteProject } from "@/lib/actions/projects";
import { getCurrentProfile } from "@/lib/current-user";
import { listProjectsForProfile } from "@/lib/project-access";
import { getProjectsProgress } from "@/lib/projects-progress";
import { ProjectStageTrack } from "@/components/ProjectStageTrack";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { NewProjectPanel } from "@/components/NewProjectPanel";
import { NewProjectWizard } from "@/components/NewProjectWizard";
import { ToolPickerGrid } from "@/components/ToolPickerGrid";
import { PageHeader } from "@/components/PageHeader";
import { TOOL_GROUPS } from "@/lib/tool-groups";
import { getProjectOverview, type RoadmapStep, type NextShoot } from "@/lib/project-roadmap";
import { getProjectFacts } from "@/lib/tool-access";
import { STAGES, computeStage } from "@/lib/tool-rules";

function daysUntil(date: Date) {
  const now = new Date();
  const a = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return Math.round((a - b) / 86400000);
}

function shootText(n: NextShoot) {
  const d = daysUntil(n.date);
  return d === 0 ? "Rueda hoy" : d === 1 ? "Rueda mañana" : `Rueda en ${d} días`;
}

// Lo que toca en cada proyecto: el primer paso esencial sin hacer o, si está todo, el rodaje.
function nextFor(steps: RoadmapStep[], nextShoot: NextShoot | null, projectId: string, stage: number) {
  const step = steps.find((s) => s.required && !s.isDone);
  if (nextShoot && !nextShoot.hasCallSheet && daysUntil(nextShoot.date) <= 7) {
    return { title: "Hoja de llamada", detail: `${shootText(nextShoot)} y aún no hay hoja`, href: `/app/${projectId}/call-sheets`, warn: true };
  }
  if (step) return { title: step.title, detail: step.detail, href: step.href, warn: false };
  if (stage >= 4) return { title: "Entregar", detail: "Dossier, montaje y festivales", href: `/app/${projectId}/festivales`, warn: false };
  return { title: "Listo para rodar", detail: "Lo esencial está hecho", href: `/app/${projectId}`, warn: false };
}

// Proyectos: la lista (hoja; por fila, el proyecto, su etapa en una vía de 4 tramos y lo que toca
// ahora, enlazado) y, debajo, los atajos para ir directo a una
// herramienta. Crear es un botón arriba que abre un diálogo; sin proyectos, el asistente va directo.
export default async function ProyectosPage() {
  const profile = await getCurrentProfile();

  const projects = profile ? await listProjectsForProfile(profile) : [];
  const projectOptions = projects.map((p) => ({ id: p.id, name: p.name }));
  // Solo lectura: etapa y siguiente paso de cada proyecto (los 24 primeros; el resto, solo progreso).
  const [progress, details] = await Promise.all([
    getProjectsProgress(projects.map((p) => p.id)),
    Promise.all(
      projects.slice(0, 24).map(async (p) => {
        const [overview, facts] = await Promise.all([
          getProjectOverview(p.id, p.budgetTarget !== null ? Number(p.budgetTarget) : null),
          getProjectFacts(p.id),
        ]);
        const stage = computeStage(facts);
        return [p.id, { stage, nextShoot: overview.nextShoot, next: nextFor(overview.steps, overview.nextShoot, p.id, stage) }] as const;
      }),
    ).then((rows) => Object.fromEntries(rows)),
  ]);
  const byStage = STAGES.map((st) => ({ ...st, n: Object.values(details).filter((d) => d.stage === st.id).length })).filter((s) => s.n > 0);

  return (
    <div className="pb-8">
      <PageHeader
        title="Proyectos"
        description={
          projects.length === 0
            ? "Todo en Taller cuelga de un proyecto. Crea el primero para empezar."
            : "En qué etapa está cada proyecto y qué toca ahora. Pulsa lo que toca para ir directo, o el nombre para abrir el proyecto."
        }
        actions={projects.length > 0 ? <NewProjectPanel /> : undefined}
      />

      {projects.length === 0 ? (
        <div className="sheet mx-auto mt-10 max-w-xl p-8 sm:p-10">
          <p className="eyebrow text-center text-accent">Tu primer proyecto</p>
          <div className="mt-6">
            <NewProjectWizard />
          </div>
        </div>
      ) : (
        <>
          {byStage.length > 0 && (
            <p className="mt-8 font-sans text-sm text-muted">
              {byStage.map((st, i) => (
                <span key={st.id}>
                  {i > 0 && " · "}
                  <span className="text-fg">{st.n}</span> en {st.label.toLowerCase()}
                </span>
              ))}
            </p>
          )}
          <ul className="sheet mt-4 divide-y divide-line overflow-hidden">
            <li aria-hidden className="hidden grid-cols-[minmax(0,1fr)_15rem_minmax(0,1fr)_2rem] gap-x-8 px-6 pt-4 pb-3 md:grid">
              <span className="eyebrow">Proyecto</span>
              <span className="eyebrow">Etapa</span>
              <span className="eyebrow">Qué toca ahora</span>
              <span />
            </li>
            {projects.map((project) => {
              const isOwnProject = project.organizationId === profile?.organizationId;
              const ownerLabel = project.createdBy?.fullName ?? project.createdBy?.email ?? project.organization.name;
              const d = details[project.id];
              const p = progress[project.id];
              return (
                <li
                  key={project.id}
                  className="group/row grid grid-cols-[minmax(0,1fr)_2rem] items-center gap-x-4 gap-y-4 py-5 pr-3 pl-5 transition-colors hover:bg-bg/50 md:grid-cols-[minmax(0,1fr)_15rem_minmax(0,1fr)_2rem] md:gap-x-8 md:pl-6"
                >
                  <Link href={`/app/${project.id}`} className="group min-w-0 rounded focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent">
                    <span className="block truncate font-display text-xl font-black tracking-tight transition-colors group-hover:text-accent">
                      {project.name}
                    </span>
                    <span className="mt-0.5 block truncate font-sans text-sm text-muted">
                      {[
                        project.type ?? "Sin tipo todavía",
                        !isOwnProject ? `de ${ownerLabel}` : null,
                        p ? `${p.done}/${p.total} esenciales` : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </Link>
                  {isOwnProject ? (
                    <span className="col-start-2 row-start-1 md:col-start-4">
                      <DeleteProjectButton projectName={project.name} action={deleteProject.bind(null, project.id)} />
                    </span>
                  ) : (
                    <span className="col-start-2 row-start-1 md:col-start-4" />
                  )}
                  {d ? (
                    <>
                      <ProjectStageTrack stage={d.stage} className="col-span-2 md:col-span-1 md:col-start-2 md:row-start-1" />
                      <Link
                        href={d.next.href}
                        className={`group col-span-2 min-w-0 rounded border-l-2 pl-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent md:col-span-1 md:col-start-3 md:row-start-1 ${
                          d.next.warn ? "border-warn" : "border-accent"
                        }`}
                      >
                        <span className="block truncate font-sans text-[15px] font-semibold transition-colors group-hover:text-accent">
                          {d.next.title} <span aria-hidden>→</span>
                        </span>
                        <span className={`block truncate font-sans text-sm ${d.next.warn ? "text-warn" : "text-muted"}`}>
                          {d.next.detail}
                          {d.nextShoot && !d.next.warn ? ` · ${shootText(d.nextShoot).toLowerCase()}` : ""}
                        </span>
                      </Link>
                    </>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </>
      )}

      <section aria-labelledby="tool-picker-title" className="mt-16">
        <h2 id="tool-picker-title" className="font-display text-xl font-black tracking-tight">
          Ir directo a una herramienta
        </h2>
        <p className="mt-1 max-w-xl font-sans text-sm text-muted">
          {projects.length > 1
            ? "Elige la herramienta y te preguntamos en qué proyecto antes de entrar."
            : "Elige la herramienta y entras directamente."}
        </p>
        <div className="mt-8">
          <ToolPickerGrid groups={TOOL_GROUPS} projects={projectOptions} />
        </div>
      </section>
    </div>
  );
}
