import { Readable } from "node:stream";
import type { NextRequest } from "next/server";
import { db } from "@/lib/db";
import { isLinkUsable } from "@/lib/auth/guest";
import { storage } from "@/lib/storage";
import { verifyMedia } from "@/lib/storage/signed-url";

/**
 * Sirve media privada con URL firmada. Soporta Range (necesario para buscar en
 * el vídeo). En cada petición se comprueba que la sesión o el enlace que
 * originó la firma siguen vigentes: revocar corta el acceso de inmediato.
 */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/media/[token]">) {
  const { token } = await ctx.params;
  const grant = verifyMedia(token);
  if (!grant) return new Response("Enlace caducado", { status: 403 });

  const [kind, subjectId] = grant.subject.split(":");
  if (kind === "u") {
    const s = await db.session.findUnique({ where: { id: subjectId }, include: { user: { select: { active: true } } } });
    if (!s || s.revokedAt || s.expiresAt < new Date() || !s.user.active) return new Response("Sesión no válida", { status: 403 });
  } else if (kind === "g") {
    const g = await db.reviewGuest.findUnique({ where: { id: subjectId }, include: { shareLink: true } });
    if (!g || !isLinkUsable(g.shareLink)) return new Response("Enlace revocado o caducado", { status: 403 });
  } else {
    return new Response("No válido", { status: 403 });
  }

  const asset = await db.mediaAsset.findUnique({ where: { id: grant.assetId } });
  if (!asset || asset.deletedAt || asset.status !== "READY" || !asset.storageKey) return new Response("No encontrado", { status: 404 });
  const size = await storage().size(asset.storageKey);
  if (size === null) return new Response("No encontrado", { status: 404 });

  const headers = new Headers({
    "Content-Type": asset.mimeType ?? "application/octet-stream",
    "Accept-Ranges": "bytes",
    "Cache-Control": "private, max-age=3600",
    "X-Content-Type-Options": "nosniff",
  });
  if (grant.download) {
    headers.set("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(asset.filename)}`);
  }

  const range = req.headers.get("range");
  if (range) {
    const m = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (!m) return new Response("Rango no válido", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    let start = m[1] ? Number(m[1]) : NaN;
    let end = m[2] ? Number(m[2]) : size - 1;
    if (Number.isNaN(start)) {
      start = Math.max(0, size - Number(m[2]));
      end = size - 1;
    }
    end = Math.min(end, size - 1);
    if (start > end || start >= size) return new Response("Rango no válido", { status: 416, headers: { "Content-Range": `bytes */${size}` } });
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
    headers.set("Content-Length", String(end - start + 1));
    const stream = Readable.toWeb(storage().read(asset.storageKey, { start, end })) as ReadableStream;
    return new Response(stream, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(Readable.toWeb(storage().read(asset.storageKey)) as ReadableStream, { status: 200, headers });
}
