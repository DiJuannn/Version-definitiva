import { prisma } from "@/lib/prisma";
import { getProjectForCurrentUser } from "@/lib/project-access";

// Comprobación compartida por las 5 rutas de documentos legales: acceso
// al proyecto + que la organización DUEÑA tenga PRO (documentos legales
// es una función de pago) + el nombre de la productora para el propio
// documento.
export async function getLegalDocumentContext(projectId: string) {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No encontrado" as const, status: 404 as const };

  const org = await prisma.organization.findUnique({
    where: { id: project.organizationId },
    select: { name: true, plan: true },
  });
  if (org?.plan !== "PRO") {
    return {
      error: "Los documentos legales son una función de PRO." as const,
      status: 403 as const,
    };
  }

  return { project, organizationName: org.name };
}

export function fieldFromForm(formData: FormData, name: string): string {
  return String(formData.get(name) ?? "").trim();
}
