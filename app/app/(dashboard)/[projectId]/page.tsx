import Link from "next/link";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import { prisma } from "@/lib/prisma";
import { ToolCard } from "@/components/ToolCard";
import { ProjectSummaryCard } from "@/components/ProjectSummaryCard";
import { ProjectShareButton } from "@/components/ProjectShareButton";
import { ProjectRoadmap } from "@/components/ProjectRoadmap";
import { ProjectHealthMini } from "@/components/ProjectHealthMini";
import { DashboardStagger } from "@/components/DashboardMotion";
import { ToolGroupCarousel } from "@/components/ToolGroupCarousel";
import { PdfLink } from "@/components/PdfLink";
import { BackLink } from "@/components/BackLink";
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

  const [ownerLabel, shares, origin] = await Promise.all([
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
  ]);

  const updateAction = updateProjectDetails.bind(null, project.id);
  const budgetTarget =
    project.budgetTarget !== null ? Number(project.budgetTarget) : null;
  const { steps, healthMetrics } = await getProjectOverview(project.id, budgetTarget);

  // Los hrefs deben llegar ya resueltos: una función no se puede pasar de
  // un Server Component (esta página) a ToolGroupCarousel (Client Component).
  const resolvedToolGroups = TOOL_GROUPS.map((group) => ({
    label: group.label,
    tools: group.tools.map((tool) => ({
      icon: tool.icon,
      label: tool.label,
      description: tool.description,
      href: tool.absolute ? tool.href : `/app/${project.id}/${tool.href}`,
      pro: tool.pro,
    })),
  }));

  return (
    <div>
      <BackLink href="/app">← Proyectos</BackLink>
      <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="font-display text-2xl font-bold uppercase">
            {project.name}
          </h1>
          {!isOwnerOrg && ownerLabel && (
            <p className="mt-1 font-mono text-xs text-muted">
              Propietario: {ownerLabel}
            </p>
          )}
        </div>
        {isOwnerOrg && (
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
        )}
      </div>

      <ProjectSummaryCard
        project={{ ...project, budgetTarget }}
        updateAction={updateAction}
      />

      <ProjectRoadmap steps={steps} />

      <div className="mt-10 border border-line p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-mono text-[10px] tracking-widest text-accent uppercase">
            Herramientas
          </p>
          <div className="flex items-center gap-4">
            <Link
              href={`/app/${project.id}/resumen`}
              className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-muted uppercase transition-colors hover:text-accent"
            >
              <SummaryIcon />
              Resumen completo →
            </Link>
            <PdfLink
              href={`/api/pdf/dossier/${project.id}`}
              label="Descargar dossier"
            />
          </div>
        </div>

        <div className="mt-4">
          <ToolGroupCarousel groups={resolvedToolGroups} />
        </div>

        <div className="hidden sm:block">
          {TOOL_GROUPS.map((group) => (
            <div key={group.label} className="mt-6 first:mt-4">
              <p className="font-mono text-[10px] tracking-widest text-muted uppercase">
                {group.label}
              </p>
              <DashboardStagger className="mt-3 grid grid-cols-3 gap-4">
                {group.tools.map((tool) => (
                  <ToolCard
                    key={tool.label}
                    icon={tool.icon}
                    label={tool.label}
                    description={tool.description}
                    href={tool.absolute ? tool.href : `/app/${project.id}/${tool.href}`}
                    badge={tool.pro ? "PRO" : undefined}
                  />
                ))}
              </DashboardStagger>
            </div>
          ))}
        </div>
      </div>

      <ProjectHealthMini metrics={healthMetrics} />
    </div>
  );
}
