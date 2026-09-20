import { headers } from "next/headers";

// Dirección pública de la web (para enlaces que se mandan por WhatsApp, etc.):
// la configurada en NEXT_PUBLIC_SITE_URL y, si no hay, la de la petición.
// Esta versión es para las rutas de la app móvil (reciben el Request).
export function originFromRequest(request: Request): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured && !configured.includes("localhost")) return configured;
  return new URL(request.url).origin;
}

// Igual, para páginas y acciones del servidor (leen las cabeceras).
export async function getSiteOrigin(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (configured && !configured.includes("localhost")) return configured;

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return configured ?? "http://localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
