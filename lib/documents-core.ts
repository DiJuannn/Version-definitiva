import { prisma } from "@/lib/prisma";
import { uploadProjectFile } from "@/lib/storage";

export type UploadDocumentInput = {
  file: File;
  notes?: string | null;
  actorId?: string | null;
  locationId?: string | null;
};

export async function uploadDocumentCore(
  projectId: string,
  organizationId: string,
  input: UploadDocumentInput,
) {
  const uploaded = await uploadProjectFile(projectId, input.file);
  if (!uploaded) return null;

  const [actor, location] = await Promise.all([
    input.actorId ? prisma.actor.findFirst({ where: { id: input.actorId, projectId } }) : null,
    input.locationId
      ? prisma.location.findFirst({ where: { id: input.locationId, organizationId } })
      : null,
  ]);

  return prisma.document.create({
    data: {
      projectId,
      fileUrl: uploaded.url,
      fileName: uploaded.name,
      notes: input.notes || null,
      actorId: actor?.id,
      locationId: location?.id,
    },
  });
}

export async function deleteDocumentCore(projectId: string, documentId: string) {
  await prisma.document.deleteMany({ where: { id: documentId, projectId } });
}
