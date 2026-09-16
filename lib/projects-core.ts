import { prisma } from "@/lib/prisma";
import { FREE_ACTIVE_PROJECTS_LIMIT } from "@/lib/limits";

// Cuenta los proyectos que ya tiene la organización (los creados por
// ella, no los que le comparten) y bloquea crear uno más si el plan
// gratuito ya llegó al tope — los proyectos existentes no se tocan
// nunca, solo se bloquea sumar uno nuevo por encima del límite.
// Compartido entre la Server Action de la web y la ruta /api/mobile,
// para que el tope no dependa de por dónde se cree el proyecto.
export async function createProjectCore(
  organizationId: string,
  createdById: string,
  name: string,
  isPro: boolean,
): Promise<{ id: string; name: string } | { error: string; upgrade?: boolean }> {
  const trimmed = name.trim();
  if (!trimmed) return { error: "Ponle un nombre al proyecto." };

  if (!isPro) {
    const count = await prisma.project.count({ where: { organizationId } });
    if (count >= FREE_ACTIVE_PROJECTS_LIMIT) {
      return {
        error: `El plan gratuito permite hasta ${FREE_ACTIVE_PROJECTS_LIMIT} proyectos. Pásate a PRO para crear más.`,
        // Marca este error como "de plan" para que la UI pueda enseñar un
        // enlace directo a Organización en vez de solo el texto suelto.
        upgrade: true,
      };
    }
  }

  const project = await prisma.project.create({
    data: { name: trimmed, organizationId, createdById },
  });
  return { id: project.id, name: project.name };
}
