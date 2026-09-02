import { Resend } from "resend";
import { prisma } from "@/lib/prisma";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { INT_EXT_LABELS, DAY_PART_LABELS } from "@/lib/labels";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function buildEmailHtml(params: {
  projectName: string;
  dateLabel: string;
  generalCallTime: string | null;
  locations: string[];
  scenes: { callTime: string | null; label: string }[];
  transportNotes: string | null;
  cateringNotes: string | null;
  additionalNotes: string | null;
}): string {
  const { projectName, dateLabel, generalCallTime, locations, scenes, transportNotes, cateringNotes, additionalNotes } =
    params;

  const sceneRows = scenes
    .map(
      (s) =>
        `<tr><td style="padding:6px 10px;border-bottom:1px solid #e2dfd6;font-family:monospace;font-size:13px;">${escapeHtml(s.callTime ?? "—")}</td><td style="padding:6px 10px;border-bottom:1px solid #e2dfd6;font-size:13px;">${escapeHtml(s.label)}</td></tr>`,
    )
    .join("");

  const notesRow = (label: string, value: string | null) =>
    value
      ? `<tr><td style="padding:8px 10px;font-size:12px;color:#6b6b66;">${label}</td><td style="padding:8px 10px;font-size:13px;">${escapeHtml(value)}</td></tr>`
      : "";

  return `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;">
      <div style="background:#0a0a0a;padding:16px 20px;">
        <p style="color:#c1440e;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">Recordatorio de rodaje — mañana</p>
        <p style="color:#ffffff;font-size:20px;font-weight:bold;margin:0;text-transform:uppercase;">${escapeHtml(projectName)}</p>
      </div>
      <div style="padding:20px;border:1px solid #e2dfd6;border-top:none;">
        <p style="font-size:14px;margin:0 0 16px;">Rodaje: <strong>${escapeHtml(dateLabel)}</strong>${generalCallTime ? ` · Hora de convocatoria: <strong>${escapeHtml(generalCallTime)}</strong>` : ""}</p>
        ${locations.length > 0 ? `<p style="font-size:13px;color:#6b6b66;margin:0 0 16px;">Localización${locations.length > 1 ? "es" : ""}: ${escapeHtml(locations.join(", "))}</p>` : ""}
        ${
          scenes.length > 0
            ? `<table style="width:100%;border-collapse:collapse;margin-bottom:16px;">
                <thead><tr><th style="text-align:left;padding:6px 10px;font-size:11px;color:#6b6b66;border-bottom:2px solid #0a0a0a;">Hora</th><th style="text-align:left;padding:6px 10px;font-size:11px;color:#6b6b66;border-bottom:2px solid #0a0a0a;">Escena</th></tr></thead>
                <tbody>${sceneRows}</tbody>
              </table>`
            : ""
        }
        <table style="width:100%;border-collapse:collapse;">
          ${notesRow("Transporte", transportNotes)}
          ${notesRow("Catering", cateringNotes)}
          ${notesRow("Notas", additionalNotes)}
        </table>
        <p style="font-size:11px;color:#6b6b66;margin-top:24px;">Este aviso se manda automáticamente el día antes de cada rodaje — es una función del plan PRO de Taller.</p>
      </div>
    </div>
  `;
}

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

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!resendApiKey || !fromEmail) {
    console.error("sendCallSheetReminders: falta RESEND_API_KEY o RESEND_FROM_EMAIL");
    return { processed: 0, emailsSent: 0 };
  }
  const resend = new Resend(resendApiKey);

  let emailsSent = 0;

  for (const shootingDay of shootingDays) {
    // Solo PRO — en Free, el call sheet se sigue compartiendo a mano.
    if (shootingDay.project.organization.plan !== "PRO") continue;

    const summary = await getShootingDaySummary(shootingDay.id);
    if (!summary) continue;

    const crewEmails = summary.crewMembers
      .map((c) => c.email?.trim())
      .filter((email): email is string => Boolean(email));

    if (crewEmails.length > 0) {
      const html = buildEmailHtml({
        projectName: shootingDay.project.name,
        dateLabel: shootingDay.date.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        generalCallTime: summary.shootingDay.callSheet?.generalCallTime ?? null,
        locations: summary.locations.map((l) => l.name),
        scenes: summary.sceneAssignments.map((a) => ({
          callTime: a.callTime,
          label: `Escena ${a.scene.number} — ${INT_EXT_LABELS[a.scene.intExt]} ${DAY_PART_LABELS[a.scene.dayPart]}${a.scene.location ? ` · ${a.scene.location.name}` : ""}`,
        })),
        transportNotes: summary.shootingDay.callSheet?.transportNotes ?? null,
        cateringNotes: summary.shootingDay.callSheet?.cateringNotes ?? null,
        additionalNotes: summary.shootingDay.callSheet?.additionalNotes ?? null,
      });

      try {
        await resend.emails.send({
          from: fromEmail,
          to: crewEmails,
          subject: `Rodaje mañana — ${shootingDay.project.name}`,
          html,
        });
        emailsSent += 1;
      } catch (error) {
        console.error("sendCallSheetReminders: fallo al enviar", { shootingDayId: shootingDay.id }, error);
      }
    }

    await prisma.shootingDay.update({
      where: { id: shootingDay.id },
      data: { reminderSentAt: new Date() },
    });
  }

  return { processed: shootingDays.length, emailsSent };
}
