import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { NextStep } from "@/components/NextStep";
import { StageStepper } from "@/components/StageStepper";
import { StageFocus } from "@/components/StageFocus";
import { ProjectWelcome } from "@/components/ProjectWelcome";
import { ProjectTools } from "@/components/ProjectTools";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { ProjectShareButton } from "@/components/ProjectShareButton";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PageHeader } from "@/components/PageHeader";
import { getProjectOverview } from "@/lib/project-roadmap";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser, getProjectOwnerLabel } from "@/lib/project-access";
import { setProjectStatus, updateProjectDetails } from "@/lib/actions/project-details";
import { getProjectFacts, getToolMode, hasSeenWelcome } from "@/lib/tool-access";
import { computeAccess, computeStage } from "@/lib/tool-rules";

export default async function ProjectTallerPage({
  params,
  searchParams,
}: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ ayuda?: string }>;
}) {
  const { projectId } = await params;
  const { ayuda } = await searchParams;

  const project = await getProjectForCurrentUser(projectId);

  if (!project) {
    notFound();
  }

  const profile = await getCurrentProfile();
  if (!profile) notFound();
  const isOwnerOrg = project.organizationId === profile.organizationId;

  const [ownerLabel, shares, origin, activityLogs] = await Promise.all([
    isOwnerOrg ? null : getProjectOwnerLabel(project),
    isOwnerOrg
      ? prisma.projectShare.findMany({
          where: { projectId: project.id },
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            token: true,
            acceptedAt: true,
            user: { select: { email: true } },
          },
        })
      : Promise.resolve([]),
    headers().then((h) => h.get("origin") ?? ""),
    prisma.activityLog.findMany({
      where: { projectId: project.id },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        summary: true,
        createdAt: true,
        user: { select: { fullName: true, email: true } },
      },
    }),
  ]);

  const updateAction = updateProjectDetails.bind(null, project.id);
  const budgetTarget =
    project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  const [{ steps, toolStats, nextShoot, budget }, facts, mode] = await Promise.all([
    getProjectOverview(project.id, budgetTarget),
    getProjectFacts(project.id),
    getToolMode(profile.organizationId),
  ]);
  const access = computeAccess(facts);
  const stage = computeStage(facts);
  // Bienvenida: la primera vez en un proyecto vacío (modo simple), o cuando se pide con «¿Cómo funciona?».
  const showWelcome = ayuda === "1" || (mode === "simple" && stage === 1 && facts.scenes === 0 && !(await hasSeenWelcome()));

  return (
    <div>
      <PageHeader
        backHref="/app/proyectos"
        backLabel="← Proyectos"
        eyebrow="Proyecto"
        title={project.name}
        description={!isOwnerOrg && ownerLabel ? `Propietario: ${ownerLabel}` : undefined}
        actions={
          isOwnerOrg ? (
            <ProjectShareButton
              projectId={project.id}
              origin={origin}
              shares={shares.map((s) => ({
                id: s.id,
                token: s.token,
                acceptedAt: s.acceptedAt ? s.acceptedAt.toISOString() : null,
                userEmail: s.user?.email ?? null,
              }))}
            />
          ) : undefined
        }
      />

      {showWelcome && <ProjectWelcome projectId={project.id} />}

      {/* "Ahora": una sola tarjeta con la etapa del proyecto y lo único que toca
          hacer. Antes eran cuatro bloques (cabecera con estado/progreso/rodaje/
          dinero, barra de etapas, siguiente paso y foco de etapa) que repetían
          lo mismo; el detalle sigue en Resumen y en cada herramienta. */}
      <section aria-label="Ahora" className="mt-8 border border-accent/40 bg-bg-raised/40">
        {/* Con la bienvenida abierta, sus cuatro etapas ya se ven justo encima. */}
        {!showWelcome && (
          <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b border-line px-6 pt-5 pb-4 sm:px-8">
            <StageStepper stage={stage} className="min-w-0 flex-1" />
            {stage === 1 && facts.scenes === 0 && (
              <Link
                href={`/app/${project.id}?ayuda=1`}
                className="text-xs text-muted hover:text-accent"
              >
                ¿Cómo funciona?
              </Link>
            )}
          </div>
        )}
        {stage >= 3 ? (
          <StageFocus
            projectId={project.id}
            stage={stage as 3 | 4}
            status={project.status}
            nextShoot={nextShoot}
            budget={budget}
            embedded
          />
        ) : (
          <NextStep
            steps={steps}
            startShootAction={
              isOwnerOrg && stage === 2 ? setProjectStatus.bind(null, project.id, "PRODUCTION") : undefined
            }
            embedded
          />
        )}
      </section>

      <ProjectTools projectId={project.id} mode={mode} access={access} toolStats={toolStats} />

      {/* Datos del proyecto y actividad: se consultan poco, así que van
          plegados al final en vez de alargar la portada. */}
      <details className="group mt-10 border-t border-line pt-4">
        <summary className="flex cursor-pointer list-none items-center justify-between py-2 text-xs text-muted hover:text-accent [&::-webkit-details-marker]:hidden">
          <span>Datos del proyecto{activityLogs.length > 0 ? " y actividad reciente" : ""}</span>
          <span aria-hidden className="transition-transform group-open:rotate-90">→</span>
        </summary>
        <div className="mt-4">
          <ProjectSummaryCard project={{ ...project, budgetTarget }} updateAction={updateAction} />
        </div>
        <ActivityFeed
          entries={activityLogs.map((log) => ({
            id: log.id,
            summary: log.summary,
            createdAt: log.createdAt,
            userName: log.user?.fullName ?? log.user?.email ?? null,
          }))}
        />
      </details>
    </div>
  );
}
