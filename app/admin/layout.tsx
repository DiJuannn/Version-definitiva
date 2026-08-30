import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { signOut } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/current-user";

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/app/login");
  if (profile.role !== "ADMIN" || !profile.organization.isPlatformOwner) {
    redirect("/app");
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="border-b border-line px-4 py-4 sm:px-6">
        <div className="flex items-center justify-between gap-3">
          <Link href="/admin" className="flex min-w-0 items-center gap-2.5">
            <AjoloteLogo className="h-6 w-auto shrink-0 text-fg" />
            <span className="truncate font-mono text-xs tracking-[0.2em] uppercase">
              Editor de la web pública
            </span>
          </Link>
          <form action={signOut} className="shrink-0">
            <button
              type="submit"
              className="font-mono text-xs tracking-widest text-muted uppercase transition-colors hover:text-accent"
            >
              Salir
            </button>
          </form>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-xs text-muted">
          <a
            href="/"
            target="_blank"
            rel="noreferrer"
            className="tracking-widest uppercase transition-colors hover:text-accent"
          >
            Ver web →
          </a>
          <Link
            href="/app"
            className="tracking-widest uppercase transition-colors hover:text-accent"
          >
            Ir al Taller
          </Link>
          <span className="truncate">{profile?.email}</span>
        </div>
      </header>
      <main className="flex-1 px-4 py-8 sm:px-6 sm:py-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
