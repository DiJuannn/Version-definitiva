import "server-only";
import { env } from "@/lib/env";
import { hmac, safeEqual } from "@/lib/auth/crypto";

/**
 * URLs firmadas para media. El token incluye el asset, el sujeto (sesión de
 * usuario "u:<sessionId>" o invitado "g:<guestId>") y la caducidad. En cada
 * petición se comprueba además que el sujeto sigue vigente (sesión no revocada,
 * enlace no revocado ni caducado), así que revocar corta el acceso al momento.
 */
export const MEDIA_URL_TTL_MS = 2 * 60 * 60 * 1000;

export type MediaGrant = { assetId: string; subject: string; exp: number; download: boolean };

export function signMedia(grant: Omit<MediaGrant, "exp">, ttlMs = MEDIA_URL_TTL_MS): string {
  const payload: MediaGrant = { ...grant, exp: Date.now() + ttlMs };
  const body = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${body}.${hmac(env().APP_SECRET, `media:${body}`)}`;
}

export function verifyMedia(token: string): MediaGrant | null {
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  if (!safeEqual(sig, hmac(env().APP_SECRET, `media:${body}`))) return null;
  try {
    const g = JSON.parse(Buffer.from(body, "base64url").toString()) as MediaGrant;
    if (typeof g.exp !== "number" || g.exp < Date.now()) return null;
    return g;
  } catch {
    return null;
  }
}

export function mediaUrl(token: string) {
  return `/api/media/${token}`;
}
