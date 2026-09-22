import { prisma } from "@/lib/prisma";

// Montaje → Créditos automáticos (PRO): la lista de reparto y equipo técnico ya está en el
// proyecto (Personajes, Desglose → equipo, Datos del proyecto) — aquí solo se ordena en el
// formato de créditos de cierre, por departamento. No se guarda nada nuevo.
//
// Nombre "project-credits" (no "credits") para no chocar con lib/credits.ts, que es la función
// creditsToText del editor de contenido de la web pública — algo totalmente distinto.

export type CreditsBlock = { label: string; names: string[] };

export type ProjectCredits = {
  projectName: string;
  director: string | null;
  producer: string | null;
  cast: { character: string; actor: string }[];
  crew: CreditsBlock[];
};

// Agrupa por el "rol" tal como se escribió en Equipo — capitaliza para que "sonido" y "Sonido"
// no salgan como dos grupos distintos, pero respeta el texto que puso la persona.
function normalizeRole(role: string | null): string {
  const trimmed = (role ?? "").trim();
  if (!trimmed) return "Equipo técnico";
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

export async function getProjectCredits(projectId: string): Promise<ProjectCredits> {
  const [project, characters, crewMembers] = await Promise.all([
    prisma.project.findUnique({
      where: { id: projectId },
      select: { name: true, director: true, producer: true },
    }),
    prisma.character.findMany({
      where: { projectId, actor: { isNot: null } },
      orderBy: { name: "asc" },
      select: { name: true, actor: { select: { name: true } } },
    }),
    prisma.crewMember.findMany({
      where: { projectId },
      orderBy: { name: "asc" },
      select: { name: true, role: true },
    }),
  ]);

  const cast = characters
    .filter((c) => c.actor)
    .map((c) => ({ character: c.name, actor: c.actor!.name }));

  const byRole = new Map<string, string[]>();
  for (const member of crewMembers) {
    const label = normalizeRole(member.role);
    const list = byRole.get(label) ?? [];
    list.push(member.name);
    byRole.set(label, list);
  }
  const crew = [...byRole.entries()]
    .sort(([a], [b]) => a.localeCompare(b, "es"))
    .map(([label, names]) => ({ label, names }));

  return {
    projectName: project?.name ?? "",
    director: project?.director ?? null,
    producer: project?.producer ?? null,
    cast,
    crew,
  };
}

// El mismo texto que se ve en pantalla, listo para copiar o exportar.
export function formatProjectCreditsText(credits: ProjectCredits): string {
  const lines: string[] = [credits.projectName.toUpperCase(), ""];
  if (credits.director) lines.push(`Dirección: ${credits.director}`);
  if (credits.producer) lines.push(`Producción: ${credits.producer}`);
  if (credits.director || credits.producer) lines.push("");

  if (credits.cast.length > 0) {
    lines.push("REPARTO");
    for (const c of credits.cast) lines.push(`${c.character} — ${c.actor}`);
    lines.push("");
  }

  for (const block of credits.crew) {
    lines.push(block.label.toUpperCase());
    for (const name of block.names) lines.push(name);
    lines.push("");
  }

  return lines.join("\n").trim();
}
