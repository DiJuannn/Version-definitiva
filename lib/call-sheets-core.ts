import { prisma } from "@/lib/prisma";

export type CallSheetInput = {
  generalCallTime: string | null;
  transportNotes: string | null;
  cateringNotes: string | null;
  additionalNotes: string | null;
};

export async function upsertCallSheetCore(
  projectId: string,
  shootingDayId: string,
  data: CallSheetInput,
): Promise<boolean> {
  const day = await prisma.shootingDay.findFirst({ where: { id: shootingDayId, projectId } });
  if (!day) return false;

  await prisma.callSheet.upsert({
    where: { shootingDayId },
    create: { shootingDayId, ...data },
    update: data,
  });
  return true;
}
