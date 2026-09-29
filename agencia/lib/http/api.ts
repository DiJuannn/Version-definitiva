import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { ZodError } from "zod";
import { getCurrentUser } from "@/lib/auth/current";
import { getGuestActor } from "@/lib/auth/guest";
import type { Actor } from "@/lib/authz/actor";
import { AppError, unauthorized } from "./errors";

/**
 * Resuelve quién hace la petición: si llega `link` (id del enlace), se usa la
 * sesión de invitado de ese enlace; si no, la sesión de usuario.
 */
export async function resolveActor(req: NextRequest): Promise<Actor> {
  const link = req.nextUrl.searchParams.get("link");
  const actor = link ? await getGuestActor(link) : await getCurrentUser();
  if (!actor) throw unauthorized();
  return actor;
}

/** Protección CSRF para mutaciones JSON: el Origin debe coincidir con el host. */
export function assertSameOrigin(req: NextRequest) {
  if (req.method === "GET" || req.method === "HEAD") return;
  const origin = req.headers.get("origin");
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!origin || !host || new URL(origin).host !== host) {
    throw new AppError(403, "Origen de la petición no permitido", "bad_origin");
  }
}

export async function readJson(req: NextRequest): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    throw new AppError(400, "Cuerpo JSON no válido", "bad_json");
  }
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Envuelve un route handler: CSRF, errores tipados y respuestas JSON. */
export function api<C>(handler: Handler<C>): Handler<C> {
  return async (req, ctx) => {
    try {
      assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}

export function errorResponse(err: unknown) {
  if (err instanceof AppError) {
    return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
  }
  if (err instanceof ZodError) {
    return NextResponse.json(
      { error: err.issues[0]?.message ?? "Datos no válidos", code: "invalid", issues: err.issues },
      { status: 422 },
    );
  }
  console.error(err);
  return NextResponse.json({ error: "Error interno. Inténtalo de nuevo.", code: "internal" }, { status: 500 });
}
