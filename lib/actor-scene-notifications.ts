import { prisma } from "@/lib/prisma";
import { getResendClient, escapeHtml } from "@/lib/email/resend-client";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { INT_EXT_LABELS, DAY_PART_LABELS } from "@/lib/labels";

// Idea 1 (plan PRO): al asignar un actor a un personaje, se le manda por
// email la lista de escenas donde sale ese personaje — no el guion
// entero, solo lo que le toca a él o ella. Solo dispara si el actor
// tiene email y el proyecto es de una organización PRO.
export async function notifyActorOfScenes(projectId: string, characterId: string): Promise<void> {
  if (!(await isProjectOwnerPro(projectId))) return;

  const character = await prisma.character.findFirst({
    where: { id: characterId, projectId },
    include: { actor: true, project: true },
  });
  if (!character?.actor?.email) return;

  const scenes = await prisma.scene.findMany({
    where: { projectId, characters: { some: { characterId } } },
    include: { location: true },
    orderBy: [{ order: "asc" }, { number: "asc" }],
  });
  if (scenes.length === 0) return;

  const client = getResendClient();
  if (!client) return;
  const { resend, fromEmail } = client;

  const rows = scenes
    .map(
      (scene) =>
        `<tr>
          <td style="padding:6px 10px;border-bottom:1px solid #e2dfd6;font-family:monospace;font-size:13px;">${escapeHtml(scene.number)}</td>
          <td style="padding:6px 10px;border-bottom:1px solid #e2dfd6;font-size:13px;">${INT_EXT_LABELS[scene.intExt]} · ${DAY_PART_LABELS[scene.dayPart]}${scene.location ? ` · ${escapeHtml(scene.location.name)}` : ""}</td>
        </tr>`,
    )
    .join("");

  const html = `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;">
      <div style="background:#0a0a0a;padding:16px 20px;">
        <p style="color:#c1440e;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">Tus escenas</p>
        <p style="color:#ffffff;font-size:20px;font-weight:bold;margin:0;text-transform:uppercase;">${escapeHtml(character.project.name)}</p>
      </div>
      <div style="padding:20px;border:1px solid #e2dfd6;border-top:none;">
        <p style="font-size:14px;margin:0 0 16px;">Te han asignado el personaje <strong>${escapeHtml(character.name)}</strong>. Estas son las escenas donde aparece por ahora:</p>
        <table style="width:100%;border-collapse:collapse;">
          <thead><tr><th style="text-align:left;padding:6px 10px;font-size:11px;color:#6b6b66;border-bottom:2px solid #0a0a0a;">Escena</th><th style="text-align:left;padding:6px 10px;font-size:11px;color:#6b6b66;border-bottom:2px solid #0a0a0a;">Detalles</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p style="font-size:11px;color:#6b6b66;margin-top:24px;">Este aviso se manda automáticamente al asignar un personaje — es una función del plan PRO de Taller.</p>
      </div>
    </div>
  `;

  try {
    await resend.emails.send({
      from: fromEmail,
      to: character.actor.email,
      subject: `Tus escenas — ${character.project.name}`,
      html,
    });
  } catch (error) {
    console.error("notifyActorOfScenes: fallo al enviar", { characterId }, error);
  }
}
