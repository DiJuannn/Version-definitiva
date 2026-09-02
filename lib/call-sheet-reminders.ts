import { prisma } from "@/lib/prisma";
import { getResendClient } from "@/lib/email/resend-client";
import { buildCallSheetEmailHtml, getCallSheetEmailData } from "@/lib/email/call-sheet-email";

// Función 1 (plan PRO): manda un recordatorio con el call sheet del día
// siguiente al equipo técnico de cada rodaje planificado para mañana —
// solo si el proyecto es de una organización PRO y solo una vez por día
// de rodaje (ver ShootingDay.reminderSentAt).
export async function sendCallSheetReminders(): Promise<{
  processed: number;
  emailsSent: number;
}> {
  const now = new Date();
  const tomorrowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);

  const shootingDays = await prisma.shootingDay.findMany({
    where: {
      date: { gte: tomorrowStart, lt: tomorrowEnd },
      reminderSentAt: null,
    },
    include: { project: { include: { organization: true } } },
  });

  const client = getResendClient();
  if (!client) return { processed: 0, emailsSent: 0 };
  const { resend, fromEmail } = client;

  let emailsSent = 0;

  for (const shootingDay of shootingDays) {
    // Solo PRO — en Free, el call sheet se sigue compartiendo a mano.
    if (shootingDay.project.organization.plan === "PRO") {
      const data = await getCallSheetEmailData(shootingDay.id);

      if (data && data.crewEmails.length > 0) {
        const html = buildCallSheetEmailHtml({
          eyebrow: "Recordatorio de rodaje — mañana",
          footerNote:
            "Este aviso se manda automáticamente el día antes de cada rodaje — es una función del plan PRO de Taller.",
          ...data,
        });

        try {
          await resend.emails.send({
            from: fromEmail,
            to: data.crewEmails,
            subject: `Rodaje mañana — ${data.projectName}`,
            html,
          });
          emailsSent += 1;
        } catch (error) {
          console.error("sendCallSheetReminders: fallo al enviar", { shootingDayId: shootingDay.id }, error);
        }
      }
    }

    await prisma.shootingDay.update({
      where: { id: shootingDay.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return { processed: shootingDays.length, emailsSent };
}
