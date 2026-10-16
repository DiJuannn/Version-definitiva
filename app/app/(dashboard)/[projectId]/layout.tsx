import type { ReactNode } from "react";
import { ProjectSidebar, ProjectNavButton } from "@/components/ProjectSidebar";
import { ProjectSearch } from "@/components/ProjectSearch";
import { ProjectMain } from "@/components/MainContainer";
import { getProjectReadiness } from "@/lib/project-readiness";
import { ProjectBreadcrumb } from "@/components/ProjectBreadcrumb";
import { ClaquetaFab } from "@/components/ClaquetaFab";
import { ScenePeek } from "@/components/ScenePeek";
import { PhaseScope } from "@/components/PhaseScope";
import { ProjectPresence } from "@/components/ProjectPresence";
import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { AppMenu } from "@/components/DashboardNav";
import { AccountMenu } from "@/components/AccountMenu";
import { APP_NAV, accountLinks } from "@/lib/app-nav";
import { signOut } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser, listProjectsForProfile } from "@/lib/project-access";
import { getProjectFacts, getToolMode } from "@/lib/tool-access";
import { computeAccess, computeStage } from "@/lib/tool-rules";

// La autorización real (¿este proyecto es de tu organización o te lo
// compartieron?) la hace cada página con getProjectForCurrentUser — aquí solo
// se lee el nombre y la lista de proyectos para pintar las migas.
export default async function ProjectLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const profile = await getCurrentProfile();
  // Todo a la vez (antes eran dos rondas seguidas): si el proyecto no es
  // accesible, los datos de las herramientas simplemente no se usan.
  const [project, projects, factsIfAny, modeIfAny, readinessIfAny] = profile
    ? await Promise.all([
        getProjectForCurrentUser(projectId),
        listProjectsForProfile(profile),
        getProjectFacts(projectId),
        getToolMode(profile.organizationId),
        getProjectReadiness(projectId),
      ])
    : [null, [], null, "full" as const, null];
  const readiness = project ? readinessIfAny : null;
  // Qué herramientas se enseñan: las que ya sirven en este proyecto (o todas en modo completo).
  const facts = project ? factsIfAny : null;
  const mode = project ? modeIfAny : ("full" as const);
  const access = facts ? computeAccess(facts) : {};
  const stage = facts ? computeStage(facts) : 1;

  return (
    <PhaseScope stage={stage}>
      {/* El marco del proyecto sustituye a la cabecera de la organización
          (que se oculta, ver .app-header): una barra arriba y el menú lateral
          con todas las herramientas. Los márgenes negativos anulan el relleno
          de <main> para que vaya de borde a borde. */}
      <div className="-mx-4 -mt-8 sm:-mx-6 sm:-mt-12">
        <header
          data-project-bar
          className="taller-ink sticky top-0 z-40 flex h-14 items-center gap-3 border-b border-line bg-bg/95 px-4 text-fg backdrop-blur-md sm:gap-4 sm:px-5 print:hidden"
        >
          <Link href="/app" title="Inicio" className="flex shrink-0 items-center">
            <AjoloteLogo className="h-6 w-auto text-fg" />
          </Link>
          <AppMenu items={APP_NAV} />
          <span aria-hidden className="h-4 w-px shrink-0 bg-line" />
          {project && (
            <ProjectBreadcrumb compact projectId={projectId} projectName={project.name} projects={projects.map((p) => ({ id: p.id, name: p.name }))} />
          )}
          <ProjectNavButton />
          <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-5">
            <ProjectSearch projectId={projectId} />
            {profile && <ProjectPresence projectId={projectId} userId={profile.id} userLabel={profile.fullName ?? profile.email} />}
            {profile && <AccountMenu name={profile.fullName ?? ""} email={profile.email} links={accountLinks(profile)} signOutAction={signOut} />}
          </div>
        </header>
        <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
          {readiness && (
            <ProjectSidebar
              projectId={projectId}
              access={access}
              mode={mode}
              data={{
                chain: readiness.chain,
                now: readiness.now,
                resources: readiness.resources,
                todayDayId: readiness.todayDayId,
                overdueTasks: readiness.overdueTasks,
              }}
            />
          )}
          <div className="min-w-0 px-4 pt-8 sm:px-8 sm:pt-10">
            <ProjectMain>{children}</ProjectMain>
          </div>
        </div>
      </div>
      {project && <ScenePeek projectId={projectId} />}
      {(mode === "full" || access.claqueta?.unlocked !== false) && <ClaquetaFab projectId={projectId} />}
    </PhaseScope>
  );
}
