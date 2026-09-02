import { prisma } from "@/lib/prisma";
import { getShootingDaySummary } from "@/lib/shooting-day-summary";
import { INT_EXT_LABELS, DAY_PART_LABELS } from "@/lib/labels";
import { escapeHtml } from "@/lib/email/resend-client";

// Compartido por el recordatorio del día antes (lib/call-sheet-reminders.ts)
// y el aviso de cambio de última hora (lib/call-sheet-change-alert.ts) —
// mismo aspecto de email para los dos, solo cambia el titular de arriba.
export function buildCallSheetEmailHtml(params: {
  eyebrow: string;
  projectName: string;
  dateLabel: string;
  generalCallTime: string | null;
  locations: string[];
  scenes: { callTime: string | null; label: string }[];
  transportNotes: string | null;
  cateringNotes: string | null;
  additionalNotes: string | null;
  footerNote: string;
}): string {
  const {
    eyebrow,
    projectName,
    dateLabel,
    generalCallTime,
    locations,
    scenes,
    transportNotes,
    cateringNotes,
    additionalNotes,
    footerNote,
  } = params;

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
        <p style="color:#c1440e;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">${escapeHtml(eyebrow)}</p>
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
        <p style="font-size:11px;color:#6b6b66;margin-top:24px;">${escapeHtml(footerNote)}</p>
      </div>
    </div>
  `;
}

export type CallSheetEmailData = {
  projectName: string;
  dateLabel: string;
  generalCallTime: string | null;
  locations: string[];
  scenes: { callTime: string | null; label: string }[];
  transportNotes: string | null;
  cateringNotes: string | null;
  additionalNotes: string | null;
  crewEmails: string[];
};

// Junta el resumen del día + la lista de emails del equipo técnico (solo
// CrewMember, nunca actores) — usado tanto por el cron del recordatorio
// como por el aviso de cambio de última hora, para no calcular esto dos
// veces de formas distintas.
export async function getCallSheetEmailData(shootingDayId: string): Promise<CallSheetEmailData | null> {
  const summary = await getShootingDaySummary(shootingDayId);
  if (!summary) return null;

  const project = await prisma.project.findUnique({ where: { id: summary.shootingDay.projectId } });
  if (!project) return null;

  const crewEmails = summary.crewMembers
    .map((c) => c.email?.trim())
    .filter((email): email is string => Boolean(email));

  return {
    projectName: project.name,
    dateLabel: summary.shootingDay.date.toLocaleDateString("es-ES", {
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
    crewEmails,
  };
}
