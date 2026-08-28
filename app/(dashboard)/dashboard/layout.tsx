import type { ReactNode } from "react";
import Link from "next/link";
import { AjoloteLogo } from "@/components/AjoloteLogo";
import { signOut } from "@/lib/actions/auth";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export default async function DashboardLayout({
  children,
}: {
  children: ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? await prisma.user.findUnique({
        where: { id: user.id },
        include: { organization: true },
      })
    : null;

  return (
    <div className="flex min-h-screen flex-col bg-bg text-fg">
      <header className="flex items-center justify-between border-b border-line px-6 py-4">
        <Link href="/dashboard" className="flex items-center gap-2.5">
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
      </header>
      <main className="flex-1 px-6 py-10">
        <div className="mx-auto max-w-5xl">{children}</div>
      </main>
    </div>
  );
}
