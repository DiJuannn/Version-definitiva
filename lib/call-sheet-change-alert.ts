import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/email/resend-client";
import { buildCallSheetEmailHtml, getCallSheetEmailData } from "@/lib/email/call-sheet-email";
import { isProjectOwnerPro } from "@/lib/project-plan";

// Idea 2 (plan PRO): si el equipo técnico ya recibió el recordatorio del
// día antes (ShootingDay.reminderSentAt) y alguien cambia el call sheet
// o la fecha/notas del día DESPUÉS de eso, avisa por email de que algo
// cambió — para que nadie se entere tarde de un cambio de hora o
// localización. Si todavía no se había mandado ningún recordatorio para
// ese día, no hace nada (no hay nada que "corregir" todavía).
export async function notifyCallSheetChange(projectId: string, shootingDayId: string): Promise<void> {
  const shootingDay = await prisma.shootingDay.findFirst({
    where: { id: shootingDayId, projectId },
  });
  if (!shootingDay || !shootingDay.reminderSentAt) return;

  if (!(await isProjectOwnerPro(shootingDay.projectId))) return;

  const client = getResendClient();
  if (!client) return;
  const { resend, fromEmail } = client;

  const data = await getCallSheetEmailData(shootingDayId);
  if (!data || data.crewEmails.length === 0) return;

  const html = buildCallSheetEmailHtml({
    eyebrow: "⚠️ Cambio en el rodaje",
    footerNote:
      "Ya te habíamos avisado de este rodaje antes — esto es una actualización porque algo cambió. Es una función del plan PRO de Taller.",
    ...data,
  });

  try {
    await resend.emails.send({
      from: fromEmail,
      to: data.crewEmails,
      subject: `⚠️ Cambio en el rodaje — ${data.projectName}`,
      html,
    });
  } catch (error) {
    console.error("notifyCallSheetChange: fallo al enviar", { shootingDayId }, error);
  }
}
