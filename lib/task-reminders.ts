import { prisma } from "@/lib/prisma";
import { getResendClient, escapeHtml } from "@/lib/email/resend-client";
import { isPro } from "@/lib/plan";

const PRIORITY_LABELS: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
};

// "assignedTo" es texto libre (a veces es un nombre, no un email) — solo
// mandamos el recordatorio cuando de verdad parece una dirección de
// correo.
function looksLikeEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function buildTaskReminderHtml(params: {
  title: string;
  description: string | null;
  priority: string;
  dueDateLabel: string;
  projectName: string | null;
}): string {
  const { title, description, priority, dueDateLabel, projectName } = params;
  return `
    <div style="font-family:Helvetica,Arial,sans-serif;color:#1a1a1a;max-width:560px;margin:0 auto;">
      <div style="background:#0a0a0a;padding:16px 20px;">
        <p style="color:#c1440e;font-size:11px;letter-spacing:2px;text-transform:uppercase;margin:0 0 4px;">Tarea pendiente — vence mañana</p>
        <p style="color:#ffffff;font-size:20px;font-weight:bold;margin:0;text-transform:uppercase;">${escapeHtml(title)}</p>
      </div>
      <div style="padding:20px;border:1px solid #e2dfd6;border-top:none;">
        <p style="font-size:14px;margin:0 0 12px;">Fecha límite: <strong>${escapeHtml(dueDateLabel)}</strong> · Prioridad: <strong>${escapeHtml(PRIORITY_LABELS[priority] ?? priority)}</strong></p>
        ${projectName ? `<p style="font-size:13px;color:#6b6b66;margin:0 0 12px;">Proyecto: ${escapeHtml(projectName)}</p>` : ""}
        ${description ? `<p style="font-size:13px;margin:0 0 12px;">${escapeHtml(description)}</p>` : ""}
        <p style="font-size:11px;color:#6b6b66;margin-top:24px;">Este aviso se manda automáticamente el día antes de que venza una tarea — es una función del plan PRO de Taller.</p>
      </div>
    </div>
  `;
}

// Idea 4 (plan PRO): recordatorio por email de tareas que vencen mañana,
// mandado a la persona responsable (Task.assignedTo) si esa casilla
// tiene pinta de email — el campo es texto libre, a veces solo lleva un
// nombre, y en ese caso no hay a quién escribirle.
export async function sendTaskReminders(): Promise<{ processed: number; emailsSent: number }> {
  const now = new Date();
  const tomorrowStart = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1),
  );
  const tomorrowEnd = new Date(tomorrowStart.getTime() + 24 * 60 * 60 * 1000);

  const tasks = await prisma.task.findMany({
    where: {
      dueDate: { gte: tomorrowStart, lt: tomorrowEnd },
      status: { not: "DONE" },
      reminderSentAt: null,
      assignedTo: { not: null },
    },
    include: { organization: true, project: true },
  });

  const client = getResendClient();
  if (!client) return { processed: 0, emailsSent: 0 };
  const { resend, fromEmail } = client;

  let emailsSent = 0;

  for (const task of tasks) {
    const assignedTo = task.assignedTo?.trim();

    if (isPro(task.organization.plan) && assignedTo && looksLikeEmail(assignedTo)) {
      const html = buildTaskReminderHtml({
        title: task.title,
        description: task.description,
        priority: task.priority,
        dueDateLabel: task.dueDate!.toLocaleDateString("es-ES", {
          weekday: "long",
          day: "2-digit",
          month: "long",
          year: "numeric",
        }),
        projectName: task.project?.name ?? null,
      });

      try {
        await resend.emails.send({
          from: fromEmail,
          to: assignedTo,
          subject: `Vence mañana: ${task.title}`,
          html,
        });
        emailsSent += 1;
      } catch (error) {
        console.error("sendTaskReminders: fallo al enviar", { taskId: task.id }, error);
      }
    }

    await prisma.task.update({ where: { id: task.id }, data: { reminderSentAt: new Date() } });
  }

  return { processed: tasks.length, emailsSent };
}
