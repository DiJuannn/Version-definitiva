import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { buildMapCards, getMapEntities, pickPlacedEntities, sanitizeMapLayout } from "@/lib/project-map";
import { ProjectMapViewerLoader } from "@/components/project-map/ProjectMapViewerLoader";

// Pizarra pública de solo lectura: se abre con el enlace que genera el equipo, sin cuenta.
// Nunca se indexa. Solo enseña lo que hay puesto en esa pizarra (las tarjetas de herramienta
// ocultas y las cosas del proyecto que no se han colocado no llegan al navegador).
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Pizarra",
  robots: { index: false, follow: false },
};

export default async function PublicBoardPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  if (!token || token.length < 16) notFound();

  const board = await prisma.projectMap.findUnique({
    where: { shareToken: token },
    select: { name: true, projectId: true, data: true, project: { select: { name: true } } },
  });
  if (!board) notFound();

  const layout = sanitizeMapLayout(board.data);
  const [cards, entities] = await Promise.all([buildMapCards(board.projectId), getMapEntities(board.projectId)]);
  const tools = cards.filter((c) => !layout.hidden.includes(c.key));

  return (
    <main className="mx-auto max-w-[110rem] px-4 py-6 sm:px-6">
      <header className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
        <div>
          <p className="font-mono text-[11px] tracking-widest text-accent uppercase">{board.project.name}</p>
          <h1 className="font-display text-2xl font-black tracking-tight uppercase sm:text-3xl">{board.name}</h1>
        </div>
        <p className="font-mono text-[11px] tracking-widest text-muted uppercase">Solo lectura · Hecho con Taller</p>
      </header>
      <ProjectMapViewerLoader tools={tools} entities={pickPlacedEntities(entities, layout.items)} layout={layout} />
    </main>
  );
}
