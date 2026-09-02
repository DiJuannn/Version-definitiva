import { Resend } from "resend";

// Un solo sitio que sabe leer las credenciales de Resend — todos los
// envíos automáticos (recordatorios, avisos de cambio, tareas, dossier
// por email) pasan por aquí.
export function getResendClient(): { resend: Resend; fromEmail: string } | null {
  const apiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.RESEND_FROM_EMAIL;
  if (!apiKey || !fromEmail) {
    console.error("getResendClient: falta RESEND_API_KEY o RESEND_FROM_EMAIL");
    return null;
  }
  return { resend: new Resend(apiKey), fromEmail };
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
