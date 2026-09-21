import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { DashboardNav, type NavItem } from "@/components/DashboardNav";
import { MainContainer } from "@/components/MainContainer";
import { signOut } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/current-user";
import { isPro } from "@/lib/plan";
import { getToolMode } from "@/lib/tool-access";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV: NavItem[] = [
  { href: "/app", label: "Inicio", icon: "home" },
  { href: "/app/proyectos", label: "Proyectos", icon: "projects" },
  { href: "/app/calendario", label: "Calendario", icon: "calendar" },
  { href: "/app/tareas", label: "Tareas", icon: "tasks" },
  {
    label: "Recursos",
    icon: "people",
    children: [
      { href: "/app/equipo", label: "Equipo", icon: "people" },
      { href: "/app/localizaciones", label: "Localizaciones", icon: "location" },
      { href: "/app/inventario", label: "Inventario", icon: "box" },
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
  // Modo simple (quien empieza): lo de uso diario a la vista y lo demás recogido en «Más».
  const simple = profile ? (await getToolMode(profile.organizationId)) === "simple" : false;
  const admin = profile?.role === "ADMIN";
  const platformOwner = Boolean(admin && profile?.organization.isPlatformOwner);

  let nav: NavItem[];
  if (simple) {
    const recursos = NAV.find((item) => item.label === "Recursos")?.children ?? [];
    const more = [...recursos];
    if (admin) more.push({ href: "/app/organizacion", label: "Organización y plan", icon: "org" });
    // "Editor web" solo es relevante para la organización dueña de la
    // plataforma (Versión definitiva) — el resto de organizaciones usan
    // Taller pero no tienen web pública propia que editar.
    if (platformOwner) more.push({ href: "/admin", label: "Editor web", icon: "web" });
    nav = [...NAV.filter((item) => item.label !== "Recursos"), { label: "Más", icon: "more", children: more }];
  } else {
    nav = [...NAV];
    if (admin) nav.push({ href: "/app/organizacion", label: "Organización", icon: "org" });
    if (platformOwner) nav.push({ href: "/admin", label: "Editor web", icon: "web" });
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      {/* Fija: Equipo/Localizaciones/Inventario/Vehículos son secciones de
          toda la organización, no de un proyecto — sin esto quedan fuera de
          la vista en cuanto haces scroll dentro de un proyecto, y el único
          camino de vuelta es recargar o usar "atrás" del navegador. */}
      <header className="sticky top-0 z-30 border-b border-line bg-bg/85 px-4 pt-4 pb-4 backdrop-blur-md sm:px-6 lg:pb-0">
        <MainContainer>
          <div className="flex items-center justify-between gap-3">
            <Link href="/app" className="flex min-w-0 items-center gap-2.5">
              <AjoloteLogo className="h-6 w-auto shrink-0 text-fg" />
              <span className="truncate font-mono text-xs tracking-[0.2em] uppercase">
                {profile?.organization.name ?? "Versión definitiva"}
              </span>
              <span className="hidden border-l border-line pl-2.5 font-mono text-[10px] tracking-[0.25em] text-accent uppercase sm:inline">
                Taller
              </span>
            </Link>
            <div className="flex shrink-0 items-center gap-4 font-mono text-xs text-muted sm:gap-6">
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
              <span className="hidden sm:inline">{profile?.email}</span>
              <form action={signOut}>
                <button
                  type="submit"
                  className="tracking-widest uppercase transition-colors hover:text-fg"
                >
                  Salir
                </button>
              </form>
            </div>
          </div>
          <DashboardNav items={nav} />
        </MainContainer>
      </header>
      <main className="flex-1 px-4 pt-8 pb-28 sm:px-6 sm:pt-12 sm:pb-24">
        <MainContainer>{children}</MainContainer>
      </main>
    </div>
  );
}
