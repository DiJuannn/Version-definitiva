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
  if (profile.role !== "ADMIN") redirect("/app");

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="border-b border-line px-6 py-4">
        <div className="flex items-center justify-between">
          <Link href="/admin" className="flex items-center gap-2.5">
            <AjoloteLogo className="h-6 w-auto text-fg" />
            <span className="font-mono text-xs tracking-[0.2em] uppercase">
              Editor de la web pública
            </span>
          </Link>
          <div className="flex items-center gap-6 font-mono text-xs text-muted">
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
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-4xl">{children}</div>
      </main>
    </div>
  );
}
