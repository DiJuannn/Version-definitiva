"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteProjectCore } from "@/lib/project-delete-core";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.project.create({
    data: { name, organizationId: profile.organizationId, createdById: profile.id },
  });

  revalidatePath("/app");
  revalidatePath("/app/proyectos");
}

// Igual que createProject, pero para cuando se entra a la Claqueta sin
// tener ningún proyecto todavía — crea el proyecto y entra directo a su
// claqueta, en vez de dejar al usuario en el dashboard para que la
// vuelva a buscar.
export async function createProjectAndOpenClaqueta(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  const profile = await getCurrentProfile();
  if (!profile) return;

  const project = await prisma.project.create({
    data: { name, organizationId: profile.organizationId, createdById: profile.id },
  });

  revalidatePath("/app");
  revalidatePath("/app/proyectos");
  redirect(`/app/${project.id}/claqueta`);
}

// Borrar un Project no cascada solo con la FK en la base de datos: Actor,
// Character, ScriptFile, Scene, BreakdownElement, CrewMember, ShootingDay,
// BudgetCategory y Document apuntan a Project sin onDelete Cascade (para no
// arrastrar sin querer datos compartidos entre proyectos como Location o
// Person, que sí cascadean desde ahí). Por eso se borran a mano aquí, en
// orden seguro, antes de borrar el Project — lo demás (ScriptAnalysis,
// ContinuityCheck, Task, CalendarEvent, y todo lo colgado de Scene/
// ShootingDay/BudgetCategory) sí tiene Cascade declarado y se borra solo.
export async function deleteProject(projectId: string, formData: FormData) {
  void formData;

  const profile = await getCurrentProfile();
  if (!profile) return;

  const project = await getProjectForCurrentUser(projectId);
  if (!project) return;

  // Solo la organización propietaria puede borrar — getProjectForCurrentUser
  // también deja pasar proyectos compartidos contigo (para verlos/editarlos),
  // pero borrar el proyecto entero es cosa solo de quien es dueño.
  if (project.organizationId !== profile.organizationId) return;

  await deleteProjectCore(projectId);

  revalidatePath("/app");
  revalidatePath("/app/proyectos");
}
