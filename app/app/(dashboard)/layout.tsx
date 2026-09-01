import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { DashboardNav } from "@/components/DashboardNav";
import { signOut } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/current-user";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

const NAV = [
  { href: "/app", label: "Taller" },
  { href: "/app/proyectos", label: "Proyectos" },
  { href: "/app/calendario", label: "Calendario" },
  { href: "/app/tareas", label: "Tareas" },
  { href: "/app/equipo", label: "Equipo" },
  { href: "/app/localizaciones", label: "Localizaciones" },
  { href: "/app/inventario", label: "Inventario" },
  { href: "/app/vehiculos", label: "Vehículos" },
];

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();
  const nav = [...NAV];
  if (profile?.role === "ADMIN") {
    nav.push({ href: "/app/organizacion", label: "Organización" });
    // "Editor web" solo es relevante para la organización dueña de la
    // plataforma (Versión definitiva) — el resto de organizaciones usan
    // Taller pero no tienen web pública propia que editar.
    if (profile.organization.isPlatformOwner) {
      nav.push({ href: "/admin", label: "Editor web" });
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/app" className="flex min-w-0 items-center gap-2.5">
            <AjoloteLogo className="h-6 w-auto shrink-0 text-fg" />
            <span className="truncate font-mono text-xs tracking-[0.2em] uppercase">
              {profile?.organization.name ?? "Versión definitiva"}
            </span>
          </Link>
          <div className="flex shrink-0 items-center gap-4 font-mono text-xs text-muted sm:gap-6">
            {profile && (
              <Link
                href="/app/organizacion"
                className={
                  profile.organization.plan === "PRO"
                    ? "shrink-0 rounded-full bg-accent px-2.5 py-1 font-mono text-[10px] tracking-widest text-bg uppercase"
                    : "shrink-0 rounded-full border border-accent px-2.5 py-1 font-mono text-[10px] tracking-widest text-accent uppercase transition-colors hover:bg-accent hover:text-bg"
                }
              >
                {profile.organization.plan === "PRO" ? "PRO" : "Hazte PRO"}
              </Link>
            )}
            <span className="hidden sm:inline">{profile?.email}</span>
            <form action={signOut}>
              <button
                type="submit"
                className="tracking-widest uppercase transition-colors hover:text-accent"
              >
                Salir
              </button>
            </form>
          </div>
        </div>
        <DashboardNav items={nav} />
      </header>
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
