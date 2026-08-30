import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
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

const ADMIN_NAV = [
  { href: "/app/organizacion", label: "Organización" },
  { href: "/admin", label: "Editor web" },
];

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();
  const nav = profile?.role === "ADMIN" ? [...NAV, ...ADMIN_NAV] : NAV;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="border-b border-line px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/app" className="flex items-center gap-2.5">
            <AjoloteLogo className="h-6 w-auto text-fg" />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">
              {profile?.organization.name ?? "Versión definitiva"}
            </span>
          </Link>
          <div className="flex items-center gap-6 font-mono text-xs text-muted">
            <span>{profile?.email}</span>
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
        <nav className="mt-4 flex flex-wrap gap-6 font-mono text-xs tracking-widest uppercase">
          {nav.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted transition-colors hover:text-accent"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
