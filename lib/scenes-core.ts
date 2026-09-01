import { prisma } from "@/lib/prisma";
import { DayPart, IntExt } from "@/lib/generated/prisma";

export async function createSceneCore(projectId: string, number: string) {
  const trimmed = number.trim();
  if (!trimmed) return null;

  const count = await prisma.scene.count({ where: { projectId } });
  return prisma.scene.create({
    data: { projectId, number: trimmed, order: count },
  });
}

export type UpdateSceneInput = {
  number: string;
  intExt: string | null;
  dayPart: string | null;
  locationId: string | null;
  storyOrder: number | null;
  description: string | null;
  action: string | null;
  dialogueNotes: string | null;
  extrasNotes: string | null;
  productionNotes: string | null;
  characterIds: string[];
  breakdownElementIds: string[];
  breakdownConditions: Record<string, string | null>;
  crewMemberIds: string[];
};

// Compartido por la Server Action de la web (lib/actions/scenes.ts) y
// la ruta PATCH de la app móvil — misma validación y mismo patrón de
// "borra y vuelve a crear" para los vínculos con personajes/desglose/
// equipo, que ya usaba la web.
export async function updateSceneCore(
  projectId: string,
  sceneId: string,
  organizationId: string,
  input: UpdateSceneInput,
) {
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId } });
  if (!scene) return false;

  const number = input.number.trim();
  if (!number) return false;

  const intExt = (Object.values(IntExt) as string[]).includes(input.intExt ?? "")
    ? (input.intExt as IntExt)
    : scene.intExt;
  const dayPart = (Object.values(DayPart) as string[]).includes(input.dayPart ?? "")
    ? (input.dayPart as DayPart)
    : scene.dayPart;

  const [location, validCharacters, validBreakdown, validCrew] = await Promise.all([
    input.locationId
      ? prisma.location.findFirst({ where: { id: input.locationId, organizationId } })
      : null,
    prisma.character.findMany({
      where: { projectId, id: { in: input.characterIds } },
      select: { id: true },
    }),
    prisma.breakdownElement.findMany({
      where: { projectId, id: { in: input.breakdownElementIds } },
      select: { id: true },
    }),
    prisma.crewMember.findMany({
      where: { projectId, id: { in: input.crewMemberIds } },
      select: { id: true },
    }),
  ]);

  await prisma.$transaction([
    prisma.scene.update({
      where: { id: sceneId },
      data: {
        number,
        intExt,
        dayPart,
        locationId: location?.id ?? null,
        storyOrder: input.storyOrder,
        description: input.description?.trim() || null,
        action: input.action?.trim() || null,
        dialogueNotes: input.dialogueNotes?.trim() || null,
        extrasNotes: input.extrasNotes?.trim() || null,
        productionNotes: input.productionNotes?.trim() || null,
      },
    }),
    prisma.sceneCharacter.deleteMany({ where: { sceneId } }),
    prisma.sceneCharacter.createMany({
      data: validCharacters.map((c) => ({ sceneId, characterId: c.id })),
    }),
    prisma.sceneBreakdownElement.deleteMany({ where: { sceneId } }),
    prisma.sceneBreakdownElement.createMany({
      data: validBreakdown.map((b) => ({
        sceneId,
        breakdownElementId: b.id,
        condition: input.breakdownConditions[b.id]?.trim() || null,
      })),
    }),
    prisma.sceneCrewMember.deleteMany({ where: { sceneId } }),
    prisma.sceneCrewMember.createMany({
      data: validCrew.map((c) => ({ sceneId, crewMemberId: c.id })),
    }),
  ]);

  return true;
}

export async function deleteSceneCore(projectId: string, sceneId: string) {
  await prisma.scene.deleteMany({ where: { id: sceneId, projectId } });
}

export async function deleteAllScenesCore(projectId: string) {
  await prisma.scene.deleteMany({ where: { projectId } });
}
