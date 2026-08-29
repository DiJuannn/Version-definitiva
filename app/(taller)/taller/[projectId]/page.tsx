import Link from "next/link";
import { notFound } from "next/navigation";
import { ToolCard } from "@/components/ToolCard";
import {
  BudgetIcon,
  CalendarIcon,
  CastIcon,
  DocumentIcon,
  LocationIcon,
  SceneIcon,
  ShotListIcon,
} from "@/components/ToolIcons";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

const TOOLS = [
  { icon: <SceneIcon />, label: "Escenas" },
  { icon: <CastIcon />, label: "Personajes" },
  { icon: <LocationIcon />, label: "Localizaciones" },
  { icon: <BudgetIcon />, label: "Presupuesto" },
  { icon: <CalendarIcon />, label: "Plan de rodaje" },
  { icon: <ShotListIcon />, label: "Shot list" },
  { icon: <DocumentIcon />, label: "Documentos" },
];

export default async function ProjectTallerPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const profile = user
    ? await prisma.user.findUnique({ where: { id: user.id } })
    : null;

  const project = profile
    ? await prisma.project.findFirst({
        where: { id: projectId, organizationId: profile.organizationId },
      })
    : null;

  if (!project) {
    notFound();
  }

  return (
    <div>
      <Link
        href="/taller"
        className="font-mono text-xs tracking-widest text-muted uppercase hover:text-accent"
      >
        ← Proyectos
      </Link>
      <h1 className="mt-3 font-display text-2xl font-bold uppercase">
        {project.name}
      </h1>
      <p className="mt-2 font-mono text-xs text-muted">
        Herramientas de este proyecto.
      </p>

      <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {TOOLS.map((tool) => (
          <ToolCard key={tool.label} {...tool} />
        ))}
      </div>
    </div>
  );
}
