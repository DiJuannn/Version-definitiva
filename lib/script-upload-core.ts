import { prisma } from "@/lib/prisma";
import { deleteProjectFile, uploadProjectFile } from "@/lib/storage";
import { countDocumentPages } from "@/lib/document-pages";
import { SCRIPT_PAGE_LIMIT_FREE, SCRIPT_PAGE_LIMIT_PRO } from "@/lib/limits";
import { isPro } from "@/lib/plan";
import type { OrganizationPlan } from "@/lib/generated/prisma";

// Un único guion "actual" por proyecto: subir uno nuevo reemplaza al
// anterior en vez de acumularlo.
export async function uploadScriptCore(
  projectId: string,
  organizationPlan: OrganizationPlan,
  file: File,
): Promise<{ ok: true } | { error: string }> {
  const pro = isPro(organizationPlan);
  const pageLimit = pro ? SCRIPT_PAGE_LIMIT_PRO : SCRIPT_PAGE_LIMIT_FREE;
  const pageCount = await countDocumentPages(file);
  if (pageCount !== null && pageCount > pageLimit) {
    return {
      error: pro
        ? `Este guion tiene ${pageCount} páginas — el máximo por análisis es ${pageLimit}.`
        : `Este guion tiene ${pageCount} páginas — el plan gratuito permite hasta ${pageLimit}. Pásate a PRO para guiones más largos.`,
    };
  }

  const uploaded = await uploadProjectFile(projectId, file);
  if (!uploaded) {
    return { error: "No se pudo subir el archivo. Comprueba tu conexión e inténtalo de nuevo." };
  }

  const previous = await prisma.scriptFile.findMany({ where: { projectId } });

  try {
    await prisma.scriptFile.create({
      data: { projectId, fileUrl: uploaded.url, fileName: uploaded.name },
    });
  } catch {
    return { error: "No se pudo guardar el guion. Inténtalo de nuevo." };
  }

  if (previous.length > 0) {
    await prisma.scriptFile.deleteMany({
      where: { id: { in: previous.map((p) => p.id) } },
    });
    await Promise.allSettled(previous.map((p) => deleteProjectFile(p.fileUrl)));
  }

  return { ok: true };
}
