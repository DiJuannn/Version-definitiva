import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";

export default async function CallSheetsPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) notFound();

  const days = await prisma.shootingDay.findMany({
    where: { projectId },
    orderBy: { date: "asc" },
    include: { callSheet: true, _count: { select: { scenes: true } } },
  });

  return (
    <div>
      <Link
        href={`/app/${projectId}`}
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← {project.name}
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        Call sheets
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Un call sheet por día de rodaje, generado a partir de{" "}
        <Link href={`/app/${projectId}/plan-de-rodaje`} className="text-fg hover:text-accent">
          Plan de rodaje
        </Link>
        .
      </p>

      {days.length === 0 ? (
        <p className="mt-10 font-mono text-sm text-muted">
          Todavía no hay días de rodaje planificados.
        </p>
      ) : (
        <div className="mt-10 border-t border-line">
          {days.map((day) => (
            <Link
              key={day.id}
              href={`/app/${projectId}/call-sheets/${day.id}`}
              className="group flex items-center justify-between gap-4 border-b border-line py-4 transition-colors hover:border-accent"
            >
              <span className="font-display text-lg font-bold uppercase transition-colors group-hover:text-accent">
                {day.date.toLocaleDateString("es-ES", {
                  weekday: "long",
                  day: "2-digit",
                  month: "long",
                  year: "numeric",
                })}
              </span>
              <span className="font-mono text-xs text-muted">
                {day.callSheet ? "Generado" : "Sin generar"} · {day._count.scenes}{" "}
                escena{day._count.scenes === 1 ? "" : "s"}
              </span>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
