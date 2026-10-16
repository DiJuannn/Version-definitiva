import { prisma } from "@/lib/prisma";
import { BreakdownCategory } from "@/lib/generated/prisma";

const VALID_CATEGORIES = new Set<string>(Object.values(BreakdownCategory));

// Compartido por las Server Actions de la web (lib/actions/breakdown.ts) y
// las rutas /api/mobile/projects/:id/desglose/** — misma validación en
// los dos sitios, igual que el resto de herramientas ya portadas.
export async function createBreakdownElementCore(
  projectId: string,
  input: { name: string; category: string; notes: string | null },
) {
  const name = input.name.trim();
  if (!name || !VALID_CATEGORIES.has(input.category)) return null;

  return prisma.breakdownElement.create({
    data: {
      projectId,
      name,
      category: input.category as BreakdownCategory,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function deleteBreakdownElementCore(projectId: string, elementId: string) {
  await prisma.breakdownElement.deleteMany({
    where: { id: elementId, projectId },
  });
}

// Solo la categoría, no el nombre ni las notas — pensado para corregir
// elementos que el análisis de IA clasificó mal (por ejemplo vestuario
// metido en Atrezzo) sin tener que borrarlos y perder sus escenas
// vinculadas.
export async function updateBreakdownElementCategoryCore(
  projectId: string,
  elementId: string,
  category: string,
) {
  if (!VALID_CATEGORIES.has(category)) return;

  await prisma.breakdownElement.updateMany({
    where: { id: elementId, projectId },
    data: { category: category as BreakdownCategory },
  });
}

export async function createCrewMemberCore(
  projectId: string,
  organizationId: string,
  input: {
    personId: string | null;
    name: string;
    role: string | null;
    email: string | null;
    phone: string | null;
    notes: string | null;
  },
) {
  const person = input.personId
    ? await prisma.person.findFirst({
        where: { id: input.personId, organizationId },
      })
    : null;

  const typedName = input.name.trim();
  const name = typedName || (person ? `${person.firstName} ${person.lastName ?? ""}`.trim() : "");
  if (!name) return null;

  return prisma.crewMember.create({
    data: {
      projectId,
      personId: person?.id,
      name,
      role: input.role?.trim() || person?.primaryRole || null,
      email: input.email?.trim() || person?.email || null,
      phone: input.phone?.trim() || person?.phone || null,
      notes: input.notes?.trim() || null,
    },
  });
}

export async function deleteCrewMemberCore(projectId: string, crewMemberId: string) {
  await prisma.crewMember.deleteMany({
    where: { id: crewMemberId, projectId },
  });
}

const norm = (s: string) =>
  s.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase().replace(/\s+/g, " ").trim();

// Desglose sobre el texto de la escena: marcar «claqueta» como atrezzo en la
// escena 3. Si ya existe un elemento con ese nombre y categoría en el
// proyecto, se reutiliza (el mismo objeto en varias escenas es una sola cosa
// que conseguir); si no, se crea.
export async function markElementInSceneCore(
  projectId: string,
  sceneId: string,
  input: { name: string; category: string },
): Promise<{ id: string } | null> {
  const name = input.name.trim().replace(/\s+/g, " ").slice(0, 120);
  if (!name || !VALID_CATEGORIES.has(input.category)) return null;
  const scene = await prisma.scene.findFirst({ where: { id: sceneId, projectId }, select: { id: true } });
  if (!scene) return null;

  const category = input.category as BreakdownCategory;
  const candidates = await prisma.breakdownElement.findMany({
    where: { projectId, category },
    select: { id: true, name: true },
  });
  const element =
    candidates.find((c) => norm(c.name) === norm(name)) ??
    (await prisma.breakdownElement.create({ data: { projectId, category, name }, select: { id: true, name: true } }));

  await prisma.sceneBreakdownElement.upsert({
    where: { sceneId_breakdownElementId: { sceneId, breakdownElementId: element.id } },
    create: { sceneId, breakdownElementId: element.id },
    update: {},
  });
  return { id: element.id };
}

export async function linkElementToSceneCore(projectId: string, sceneId: string, elementId: string, on: boolean) {
  const [scene, element] = await Promise.all([
    prisma.scene.findFirst({ where: { id: sceneId, projectId }, select: { id: true } }),
    prisma.breakdownElement.findFirst({ where: { id: elementId, projectId }, select: { id: true } }),
  ]);
  if (!scene || !element) return false;
  if (on) {
    await prisma.sceneBreakdownElement.upsert({
      where: { sceneId_breakdownElementId: { sceneId, breakdownElementId: elementId } },
      create: { sceneId, breakdownElementId: elementId },
      update: {},
    });
  } else {
    await prisma.sceneBreakdownElement.deleteMany({ where: { sceneId, breakdownElementId: elementId } });
  }
  return true;
}
