import type { ReviewPayload } from "@/lib/services/review";

export type Payload = ReviewPayload;
export type ReviewComment = Payload["comments"][number];
export type Perms = Payload["perms"];

/** Construye URLs de la API conservando el enlace de invitado si lo hay. */
export function apiUrl(path: string, linkId: string | null) {
  if (!linkId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}link=${encodeURIComponent(linkId)}`;
}

export async function apiFetch<T = unknown>(path: string, linkId: string | null, init?: RequestInit): Promise<T> {
  const res = await fetch(apiUrl(path, linkId), {
    ...init,
    headers: { "Content-Type": "application/json", ...(init?.headers ?? {}) },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error ?? `Error ${res.status}`) as Error & { status?: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}
