import { prisma } from "@/lib/prisma";

// Función 2 (plan Free, sin restricciones): una línea de "Actividad
// reciente" por cada acción relevante que hace un colaborador. `summary`
// es solo la parte de después del nombre — ej. "editó la escena 12" —
// para que el nombre y el "hace X" se calculen al mostrarlo, nunca al
// guardarlo.
//
// Nunca debe romper la acción que la llama: si falla el registro (un
// borrado en curso, una carrera rara), la operación real ya tuvo éxito y
// no tiene sentido que el usuario vea un error por esto.
export async function logActivity(
  projectId: string,
  userId: string | null | undefined,
  summary: string,
) {
  try {
    await prisma.activityLog.create({
      data: { projectId, userId: userId ?? null, summary },
    });
  } catch (error) {
    console.error("logActivity: fallo al registrar actividad", { projectId, summary }, error);
  }
}
