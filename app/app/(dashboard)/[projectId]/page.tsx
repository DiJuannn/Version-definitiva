import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ToolCard } from "@/components/ToolCard";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { ProjectShareButton } from "@/components/ProjectShareButton";
import { ProjectRoadmap } from "@/components/ProjectRoadmap";
import { ProjectHeaderCard } from "@/components/ProjectHeaderCard";
import { ActivityFeed } from "@/components/ActivityFeed";
import { DashboardStagger } from "@/components/DashboardMotion";
import { PdfLink } from "@/components/PdfLink";
import { PageHeader } from "@/components/PageHeader";
import { getProjectOverview } from "@/lib/project-roadmap";
import { getCurrentProfile } from "@/lib/current-user";
import { SummaryIcon } from "@/components/ToolIcons";
import { getProjectForCurrentUser, getProjectOwnerLabel } from "@/lib/project-access";
import { updateProjectDetails } from "@/lib/actions/project-details";
import { TOOL_GROUPS } from "@/lib/tool-groups";

export default async function ProjectTallerPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

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
  const { steps, toolStats, nextShoot, budget } = await getProjectOverview(
    project.id,
    budgetTarget,
  );

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

      <ProjectHeaderCard
        projectId={project.id}
        status={project.status}
        steps={steps}
        nextShoot={nextShoot}
        budget={budget}
      />

      <ProjectRoadmap steps={steps} />

      <section className="mt-10">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">
            Herramientas
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/${project.id}/resumen`}
              className="link-action gap-1.5"
            >
              <SummaryIcon className="h-4 w-4" />
              Resumen completo
            </Link>
            <PdfLink
              href={`/api/pdf/dossier/${project.id}`}
              label="Descargar dossier"
            />
          </div>
        </div>

        {TOOL_GROUPS.map((group) => (
          <div key={group.label} className="mt-6">
            <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
              {group.label}
            </p>
            <DashboardStagger className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {group.tools.map((tool) => (
                <ToolCard
                  key={tool.label}
                  variant="row"
                  icon={tool.icon}
                  label={tool.label}
                  description={tool.description}
                  href={tool.absolute ? tool.href : `/app/${project.id}/${tool.href}`}
                  badge={tool.pro ? "PRO" : undefined}
                  stat={toolStats[tool.href]}
                />
              ))}
            </DashboardStagger>
          </div>
        ))}
      </section>

      <div className="mt-10">
        <ProjectSummaryCard
          project={{ ...project, budgetTarget }}
          updateAction={updateAction}
        />
      </div>

      <ActivityFeed
        entries={activityLogs.map((log) => ({
          id: log.id,
          summary: log.summary,
          createdAt: log.createdAt,
          userName: log.user?.fullName ?? log.user?.email ?? null,
        }))}
      />
    </div>
  );
}
