import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { CallSheetView } from "@/components/CallSheetView";

// Call sheet público de solo lectura: se abre con el enlace que genera el
// equipo de producción, sin cuenta. Nunca se indexa. Enseña lo mismo que la
// hoja del proyecto salvo los formularios de edición (y no lleva teléfonos ni
// correos de nadie: el call sheet no los incluye).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Call sheet",
  robots: { index: false, follow: false },
};

export default async function PublicCallSheetPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const day = await prisma.shootingDay.findUnique({
    where: { shareToken: token },
    select: { id: true, project: { select: { name: true } } },
  });
  if (!day) notFound();

  const summary = await getShootingDaySummary(day.id);
  if (!summary) notFound();

  return (
    <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6 sm:py-12">
      <CallSheetView projectName={day.project.name} summary={summary} />
      <p className="mt-6 text-center font-mono text-[11px] tracking-widest text-muted uppercase">
        Hecho con Taller · Versión definitiva
      </p>
    </main>
  );
}
