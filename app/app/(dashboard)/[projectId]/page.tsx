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
import { ProjectHeaderCard } from "@/components/ProjectHeaderCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { PageHeader } from "@/components/PageHeader";
import { getProjectOverview } from "@/lib/project-roadmap";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser, getProjectOwnerLabel } from "@/lib/project-access";
import { setProjectStatus, updateProjectDetails } from "@/lib/actions/project-details";
import { getProjectFacts, getToolMode, hasSeenWelcome } from "@/lib/tool-access";
import { STAGES, computeAccess, computeStage } from "@/lib/tool-rules";

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

  const stageInfo = STAGES[stage - 1];
  const hasActivity = activityLogs.length > 0;

  // Jerarquía de arriba abajo: quién es el proyecto → dónde está (cifras y etapas) → qué toca ahora
  // (una sola hoja) → con qué herramientas → la ficha y lo último que ha pasado. Una sola capa de
  // superficie: la hoja del «siguiente paso»; el resto va sobre el papel, separado por espacio y rayas.
  return (
    <div className="pb-16">
      <PageHeader
        eyebrow={project.type ? `Proyecto · ${project.type}` : "Proyecto"}
        title={project.name}
        description={
          <>
            Etapa {stage} de 4: <span className="text-fg">{stageInfo.label}</span>, {stageInfo.hint.toLowerCase()}.
            {!isOwnerOrg && ownerLabel ? ` Propietario: ${ownerLabel}.` : ""}
          </>
        }
        actions={
          isOwnerOrg ? (
            <ProjectShareButton
              variant="button"
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

      {/* Con el proyecto vacío solo repetiría «sin nada» y los pasos: se enseña cuando ya hay datos. */}
      {(mode === "full" || facts.scenes > 0) && (
        <ProjectHeaderCard
          projectId={project.id}
          status={project.status}
          steps={steps}
          nextShoot={nextShoot}
          budget={budget}
        />
      )}

      {/* La bienvenida ya explica las cuatro etapas; con ella delante, el recorrido sobraría. */}
      {showWelcome ? (
        <ProjectWelcome projectId={project.id} />
      ) : (
        <div className="mt-10">
          <StageStepper stage={stage} className="" />
          {stage === 1 && facts.scenes === 0 && (
            <p className="mt-4">
              <Link href={`/app/${project.id}?ayuda=1`} className="link-action !px-0 hover:!text-accent">
                ¿Cómo funciona? →
              </Link>
            </p>
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
        />
      ) : (
        <NextStep
          steps={steps}
          startShootAction={
            isOwnerOrg && stage === 2 ? setProjectStatus.bind(null, project.id, "PRODUCTION") : undefined
          }
        />
      )}

      <ProjectTools projectId={project.id} mode={mode} access={access} toolStats={toolStats} />

      <div
        className={`mt-16 grid gap-x-16 gap-y-12 border-t border-line pt-10 ${
          hasActivity ? "lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]" : ""
        }`}
      >
        <div className={hasActivity ? "" : "max-w-3xl"}>
          <ProjectSummaryCard project={{ ...project, budgetTarget }} updateAction={updateAction} />
        </div>
        {hasActivity && (
          <ActivityFeed
            entries={activityLogs.map((log) => ({
              id: log.id,
              summary: log.summary,
              createdAt: log.createdAt,
              userName: log.user?.fullName ?? log.user?.email ?? null,
            }))}
          />
        )}
      </div>
    </div>
  );
}
