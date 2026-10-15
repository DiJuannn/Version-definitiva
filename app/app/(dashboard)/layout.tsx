import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { DashboardNav, type NavItem } from "@/components/DashboardNav";
import { AccountMenu } from "@/components/AccountMenu";
import { MainContainer } from "@/components/MainContainer";
import { signOut } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/current-user";
import { isPro } from "@/lib/plan";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

// Lo que se usa para trabajar. La cuenta (organización, plan, editor web,
// salir) va en el avatar.
const NAV: NavItem[] = [
  { href: "/app", label: "Inicio", icon: "home" },
  { href: "/app/proyectos", label: "Proyectos", icon: "projects" },
  { href: "/app/guiones", label: "Guiones", icon: "pen" },
  { href: "/app/calendario", label: "Agenda", icon: "calendar", also: ["/app/tareas"] },
  {
    label: "Recursos",
    icon: "people",
    children: [
      { href: "/app/equipo", label: "Equipo", icon: "people" },
      { href: "/app/localizaciones", label: "Localizaciones", icon: "location" },
      { href: "/app/inventario", label: "Material", icon: "box" },
      { href: "/app/vehiculos", label: "Vehículos", icon: "vehicle" },
    ],
  },
];

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();
  const admin = profile?.role === "ADMIN";
  const platformOwner = Boolean(admin && profile?.organization.isPlatformOwner);
  const accountLinks = [
    ...(admin ? [{ href: "/app/organizacion", label: "Organización y plan" }] : []),
    ...(platformOwner ? [{ href: "/admin", label: "Editor web" }] : []),
  ];

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      {/* Fija: Equipo/Localizaciones/Inventario/Vehículos son secciones de
          toda la organización, no de un proyecto — sin esto quedan fuera de
          la vista en cuanto haces scroll dentro de un proyecto, y el único
          camino de vuelta es recargar o usar "atrás" del navegador. */}
      <header className="taller-ink sticky top-0 z-30 border-b border-line bg-bg/95 px-4 backdrop-blur-md print:hidden sm:px-6">
        <MainContainer>
          <div className="flex min-h-14 flex-wrap items-center gap-x-4 sm:gap-x-8">
            <Link href="/app" className="flex min-w-0 items-center gap-2.5">
              <AjoloteLogo className="h-6 w-auto shrink-0 text-fg" />
              <span className="hidden truncate font-mono text-xs tracking-[0.2em] uppercase min-[420px]:inline">
                {profile?.organization.name ?? "Versión definitiva"}
              </span>
              <span className="hidden border-l border-line pl-2.5 font-mono text-[10px] tracking-[0.25em] text-accent uppercase sm:inline">
                Taller
              </span>
            </Link>
            <DashboardNav items={NAV} />
            <div className="ml-auto flex shrink-0 items-center gap-3 sm:gap-4">
              {profile && (
                <Link
                  href="/app/organizacion"
                  className={
                    isPro(profile.organization.plan)
                      ? "shrink-0 rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] tracking-widest text-bg uppercase"
                      : "shrink-0 rounded-full border border-accent/60 px-2.5 py-1 font-mono text-[10px] tracking-widest text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
                  }
                >
                  {isPro(profile.organization.plan) ? "PRO" : "Hazte PRO"}
                </Link>
              )}
              {profile && (
                <AccountMenu
                  name={profile.fullName ?? ""}
                  email={profile.email}
                  links={accountLinks}
                  signOutAction={signOut}
                />
              )}
            </div>
          </div>
        </MainContainer>
      </header>
      {/* La mesa de trabajo: oscura y suave; el contenido va en hojas (.sheet). */}
      <main className="taller-desk flex-1 bg-bg px-4 pt-8 pb-28 text-fg sm:px-6 sm:pt-12 sm:pb-24">
        <MainContainer>{children}</MainContainer>
      </main>
    </div>
  );
}
