"use server";

import { renderToBuffer } from "@react-pdf/renderer";
import { getProjectForCurrentUser } from "@/lib/project-access";
import { getProjectSummary } from "@/lib/project-summary";
import { isProjectOwnerPro } from "@/lib/project-plan";
import { getResendClient } from "@/lib/email/resend-client";
import { DossierDocument } from "@/lib/pdf/DossierDocument";

export type SendDossierState = { error: string } | { success: true } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Idea 5 (plan PRO): el dossier ya se puede descargar; esto añade
// mandarlo directamente por email a quien tú digas (un inversor, un
// colaborador) como PDF adjunto, en vez de tener que descargarlo y
// reenviarlo a mano.
export async function sendDossierByEmail(
  projectId: string,
  _prevState: SendDossierState,
  formData: FormData,
): Promise<SendDossierState> {
  const project = await getProjectForCurrentUser(projectId);
  if (!project) return { error: "No tienes acceso a este proyecto." };

  if (!(await isProjectOwnerPro(project.organizationId))) {
    return { error: "Mandar el dossier por email es una función de PRO." };
  }

  const email = String(formData.get("email") ?? "").trim();
  if (!EMAIL_RE.test(email)) {
    return { error: "Escribe un email válido." };
  }

  const client = getResendClient();
  if (!client) {
    return { error: "El envío de emails no está configurado todavía." };
  }
  const { resend, fromEmail } = client;

  const summary = await getProjectSummary(projectId);
  const buffer = await renderToBuffer(<DossierDocument summary={summary} />);

  try {
    await resend.emails.send({
      from: fromEmail,
      to: email,
      subject: `Dossier — ${summary.project.name}`,
      html: `<p>Adjunto el dossier de producción del proyecto <strong>${summary.project.name}</strong>.</p>`,
      attachments: [
        {
          filename: `dossier-${summary.project.name}.pdf`,
          content: buffer,
        },
      ],
    });
  } catch (error) {
    console.error("sendDossierByEmail: fallo al enviar", { projectId }, error);
    return { error: "No se pudo enviar. Inténtalo de nuevo." };
  }

  return { success: true };
}
