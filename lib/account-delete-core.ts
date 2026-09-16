import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { deleteProjectFile } from "@/lib/storage";
import { deleteProjectCore } from "@/lib/project-delete-core";

export type DeleteAccountResult = { ok: true } | { error: string };

// Cumple con la obligación de Apple/Google de dejar borrar la cuenta
// desde dentro de la app. Dos casos, según si eres la única persona de
// tu organización o no:
//
// - Si eres la única persona: se borra TODO — proyectos y cada dato
//   colgado de la organización (localizaciones, flota, inventario,
//   equipo, tareas, calendario) — antes de borrar la organización y tu
//   usuario. Es lo que casi todo el mundo espera de "borrar mi cuenta",
//   y encaja porque la inmensa mayoría de organizaciones son de una sola
//   persona.
// - Si hay más gente en tu organización: solo se borra tu propio
//   usuario. Los proyectos, localizaciones, etc. no son "tuyos", son de
//   la organización — se quedan intactos para el resto. Las relaciones
//   que sí apuntaban a ti (autoría de proyectos/análisis, comentarios de
//   actividad) ya están preparadas en el esquema para quedarse en null
//   en vez de romperse (ver Project.createdBy, ActivityLog.user).
//
// La organización dueña de la plataforma (la web pública) nunca se
// puede borrar por aquí — haría desaparecer versiondefinitiva.com
// entero. Si alguien de esa organización quiere irse, que lo pida por
// soporte en vez de hacerlo con un clic.
export async function deleteOwnAccountCore(
  userId: string,
  organizationId: string,
): Promise<DeleteAccountResult> {
  const organization = await prisma.organization.findUnique({
    where: { id: organizationId },
    select: { isPlatformOwner: true },
  });
  if (!organization) return { error: "No se encontró la organización." };

  if (organization.isPlatformOwner) {
    return {
      error:
        "Esta cuenta administra la plataforma y no se puede borrar desde aquí. Escribe a soporte.",
    };
  }

  const otherMembers = await prisma.user.count({
    where: { organizationId, id: { not: userId } },
  });

  if (otherMembers === 0) {
    await deleteWholeOrganization(organizationId);
  } else {
    await prisma.user.delete({ where: { id: userId } });
  }

  const admin = createAdminClient();
  const { error: authError } = await admin.auth.admin.deleteUser(userId);
  if (authError) {
    // Los datos de la app ya se borraron (lo importante) — que falle
    // borrar la identidad de Supabase Auth no debe hacer parecer que la
    // cuenta sigue intacta; se registra para revisarlo a mano.
    console.error("deleteOwnAccountCore: fallo borrando el usuario de Supabase Auth", userId, authError);
  }

  return { ok: true };
}

async function deleteWholeOrganization(organizationId: string): Promise<void> {
  const [projects, locations, people] = await Promise.all([
    prisma.project.findMany({ where: { organizationId }, select: { id: true } }),
    prisma.location.findMany({ where: { organizationId }, select: { photoUrls: true } }),
    prisma.person.findMany({ where: { organizationId }, select: { photoUrl: true } }),
  ]);

  // Cada proyecto tiene su propio borrado en cascada manual (scenes,
  // personajes, presupuesto...) ya probado en producción — se reutiliza
  // tal cual, uno por uno, en vez de duplicar esa lógica aquí.
  for (const project of projects) {
    await deleteProjectCore(project.id);
  }

  await prisma.$transaction([
    prisma.invite.deleteMany({ where: { organizationId } }),
    prisma.task.deleteMany({ where: { organizationId } }),
    prisma.calendarEvent.deleteMany({ where: { organizationId } }),
    prisma.checklistTemplate.deleteMany({ where: { organizationId } }),
    prisma.inventoryItem.deleteMany({ where: { organizationId } }),
    prisma.vehicle.deleteMany({ where: { organizationId } }),
    prisma.location.deleteMany({ where: { organizationId } }),
    prisma.person.deleteMany({ where: { organizationId } }),
  ]);

  const fileUrls = [
    ...locations.flatMap((l) => l.photoUrls),
    ...people.flatMap((p) => (p.photoUrl ? [p.photoUrl] : [])),
  ];
  await Promise.allSettled(fileUrls.map((url) => deleteProjectFile(url)));

  // El usuario se borra dentro de este mismo borrado de organización —
  // deleteOwnAccountCore no vuelve a tocarlo en este caso (solo en el de
  // "hay más gente"), así que se hace aquí.
  await prisma.user.deleteMany({ where: { organizationId } });
  await prisma.organization.delete({ where: { id: organizationId } });
}
