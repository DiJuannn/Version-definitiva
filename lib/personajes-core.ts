import { prisma } from "@/lib/prisma";

export type CreateActorInput = {
  personId?: string | null;
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  rate?: number | null;
  availability?: string | null;
  notes?: string | null;
};

export async function createActorCore(
  projectId: string,
  organizationId: string,
  input: CreateActorInput,
): Promise<string | null> {
  const person = input.personId
    ? await prisma.person.findFirst({ where: { id: input.personId, organizationId } })
    : null;

  const typedName = (input.name ?? "").trim();
  const name = typedName || (person ? `${person.firstName} ${person.lastName ?? ""}`.trim() : "");
  if (!name) return null;

  const actor = await prisma.actor.create({
    data: {
      projectId,
      personId: person?.id,
      name,
      email: input.email ?? person?.email ?? null,
      phone: input.phone ?? person?.phone ?? null,
      rate: input.rate ?? (person?.rate ? Number(person.rate) : null),
      availability: input.availability ?? null,
      notes: input.notes ?? null,
    },
  });
  return actor.id;
}

export async function deleteActorCore(projectId: string, actorId: string) {
  await prisma.actor.deleteMany({ where: { id: actorId, projectId } });
}

export async function createCharacterCore(
  projectId: string,
  input: { name: string; actorId?: string | null; notes?: string | null },
): Promise<string | null> {
  const name = input.name.trim();
  if (!name) return null;

  const character = await prisma.character.create({
    data: {
      projectId,
      name,
      actorId: input.actorId ?? undefined,
      notes: input.notes ?? null,
    },
  });
  return character.id;
}

export async function updateCharacterActorCore(
  projectId: string,
  characterId: string,
  actorId: string | null,
) {
  await prisma.character.updateMany({
    where: { id: characterId, projectId },
    data: { actorId },
  });
}

export async function deleteCharacterCore(projectId: string, characterId: string) {
  await prisma.character.deleteMany({ where: { id: characterId, projectId } });
}
