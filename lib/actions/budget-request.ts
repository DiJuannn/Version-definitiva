"use server";

import { prisma } from "@/lib/prisma";
import { getResendClient, escapeHtml } from "@/lib/email/resend-client";
import { optionalString } from "@/lib/form-utils";

export type BudgetRequestState = { ok: true } | { error: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function submitBudgetRequest(
  _prevState: BudgetRequestState,
  formData: FormData,
): Promise<BudgetRequestState> {
  // Honeypot: campo oculto para humanos, invisible por CSS — cualquier bot
  // que rellene todos los inputs de un formulario también lo rellenará a
  // este, así que si llega con contenido descartamos el envío sin más.
  if (String(formData.get("website") ?? "").trim().length > 0) {
    return { ok: true };
  }

  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim();
  const projectType = String(formData.get("projectType") ?? "").trim();
  const budgetRange = String(formData.get("budgetRange") ?? "").trim();
  const message = optionalString(formData.get("message"));

  if (!name || !email || !projectType || !budgetRange) {
    return { error: "Faltan campos por rellenar." };
  }
  if (!EMAIL_RE.test(email)) {
    return { error: "Ese email no parece válido." };
  }

  const site = await prisma.siteContent.findFirst({
    where: { organization: { isPlatformOwner: true } },
    select: { organizationId: true, contactEmail: true },
  });
  if (!site) {
    return { error: "No se pudo enviar la solicitud. Inténtalo por email." };
  }

  await prisma.budgetRequest.create({
    data: {
      organizationId: site.organizationId,
      name,
      email,
      projectType,
      budgetRange,
      message,
    },
  });

  const client = getResendClient();
  if (client) {
    const { resend, fromEmail } = client;
    try {
      await resend.emails.send({
        from: fromEmail,
        to: site.contactEmail,
        replyTo: email,
        subject: `Nueva solicitud de presupuesto — ${name}`,
        html: `
          <p><strong>Nombre:</strong> ${escapeHtml(name)}</p>
          <p><strong>Email:</strong> ${escapeHtml(email)}</p>
          <p><strong>Tipo de proyecto:</strong> ${escapeHtml(projectType)}</p>
          <p><strong>Presupuesto orientativo:</strong> ${escapeHtml(budgetRange)}</p>
          ${message ? `<p><strong>Mensaje:</strong><br />${escapeHtml(message).replace(/\n/g, "<br />")}</p>` : ""}
        `,
      });
    } catch (error) {
      // El aviso por email es una comodidad, no la fuente de verdad — la
      // solicitud ya quedó guardada en BudgetRequest, así que un fallo de
      // Resend no debe hacer perder la solicitud al usuario.
      console.error("submitBudgetRequest: fallo al enviar email", error);
    }
  }

  return { ok: true };
}
