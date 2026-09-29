"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { verifyPassword, hashPassword } from "@/lib/auth/crypto";
import { rateLimit } from "@/lib/auth/rate-limit";
import { clientIp, createSession, destroyCurrentSession } from "@/lib/auth/session";
import { getCurrentUser } from "@/lib/auth/current";
import { runAction, type ActionState } from "@/lib/http/action";
import { AppError } from "@/lib/http/errors";
import { passwordSchema } from "@/lib/services/users";

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email("Escribe un email válido"),
  password: z.string().min(1, "Escribe tu contraseña"),
});

// Hash de relleno para igualar el tiempo de respuesta cuando el email no existe.
let dummyHash: Promise<string> | null = null;

export async function loginAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const parsed = loginSchema.safeParse({ email: fd.get("email"), password: fd.get("password") });
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message };
  const { email, password } = parsed.data;
  const ip = clientIp(await headers()) ?? "?";
  if (!(await rateLimit(`login:ip:${ip}`, 30, 15 * 60_000)) || !(await rateLimit(`login:email:${email}`, 8, 15 * 60_000))) {
    return { ok: false, error: "Demasiados intentos. Espera 15 minutos y vuelve a probar." };
  }
  const user = await db.user.findUnique({ where: { email } });
  dummyHash ??= hashPassword("relleno-no-valido-000");
  const ok = user ? await verifyPassword(password, user.passwordHash) : (await verifyPassword(password, await dummyHash), false);
  if (!user || !ok || !user.active) {
    return { ok: false, error: "Email o contraseña incorrectos." };
  }
  await createSession(user.id);
  await db.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
  const next = String(fd.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/inicio");
}

export async function logoutAction() {
  await destroyCurrentSession();
  redirect("/entrar");
}

const changePwSchema = z.object({ current: z.string().min(1, "Escribe tu contraseña actual"), next: passwordSchema });

export async function changePasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return runAction(async () => {
    const me = await getCurrentUser();
    if (!me) throw new AppError(401, "Sesión caducada");
    const input = changePwSchema.parse({ current: fd.get("current"), next: fd.get("next") });
    const user = await db.user.findUniqueOrThrow({ where: { id: me.id } });
    if (!(await verifyPassword(input.current, user.passwordHash))) throw new AppError(400, "La contraseña actual no es correcta");
    await db.$transaction([
      db.user.update({ where: { id: me.id }, data: { passwordHash: await hashPassword(input.next) } }),
      // Cambiar la contraseña cierra el resto de sesiones.
      db.session.updateMany({ where: { userId: me.id, revokedAt: null, id: { not: me.sessionId } }, data: { revokedAt: new Date() } }),
    ]);
  }, "Contraseña cambiada. Se cerraron tus otras sesiones.");
}
