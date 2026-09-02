import { prisma } from "@/lib/prisma";

export async function createStoryboardFrameCore(
  shotId: string,
  input: { imageUrl: string | null; description: string | null },
) {
  const count = await prisma.storyboardFrame.count({ where: { shotId } });
  const frame = await prisma.storyboardFrame.create({
    data: {
      shotId,
      imageUrl: input.imageUrl,
      description: input.description,
      order: count,
    },
  });
  return frame.id;
}

export async function deleteStoryboardFrameCore(projectId: string, frameId: string) {
  await prisma.storyboardFrame.deleteMany({
    where: { id: frameId, shot: { scene: { projectId } } },
  });
}
