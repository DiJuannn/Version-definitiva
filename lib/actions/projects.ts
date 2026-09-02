"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getCurrentProfile } from "@/lib/current-user";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { deleteProjectCore } from "@/lib/project-delete-core";
import { createProjectCore } from "@/lib/projects-core";
import { isPro } from "@/lib/plan";

export type CreateProjectState = { error: string } | undefined;

export async function createProject(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo crear el proyecto." };

  const result = await createProjectCore(
    profile.organizationId,
    profile.id,
    String(formData.get("name") ?? ""),
    isPro(profile.organization.plan),
  );
  if ("error" in result) return result;

  revalidatePath("/app");
  revalidatePath("/app/proyectos");
  return undefined;
}

// Compartido por createProjectAndOpenClaqueta y createProjectAndOpenTool
// (el selector de herramientas de /app/proyectos): crea el proyecto y
// entra directo a la herramienta elegida, en vez de dejar al usuario en
// el dashboard para que la vuelva a buscar.
async function createProjectAndOpenPath(
  toolPath: string,
  formData: FormData,
): Promise<CreateProjectState> {
  const profile = await getCurrentProfile();
  if (!profile) return { error: "No se pudo crear el proyecto." };

  const result = await createProjectCore(
    profile.organizationId,
    profile.id,
    String(formData.get("name") ?? ""),
    isPro(profile.organization.plan),
  );
  if ("error" in result) return result;

  revalidatePath("/app");
  revalidatePath("/app/proyectos");
  redirect(`/app/${result.id}/${toolPath}`);
}

export async function createProjectAndOpenClaqueta(
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  return createProjectAndOpenPath("claqueta", formData);
}

// Usada por ToolPickerGrid (selector de herramientas de /app/proyectos)
// con el href de la herramienta elegida ya enlazado vía `.bind(null, toolPath)`
// antes de llegar al cliente.
export async function createProjectAndOpenTool(
  toolPath: string,
  _prevState: CreateProjectState,
  formData: FormData,
): Promise<CreateProjectState> {
  return createProjectAndOpenPath(toolPath, formData);
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
