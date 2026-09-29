import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import type { Role } from "@prisma/client";
import type { UserActor } from "@/lib/authz/actor";
import { readSessionToken, validateSessionToken } from "./session";

/** Usuario autenticado de la petición actual (memoizado por petición). */
export const getCurrentUser = cache(async (): Promise<UserActor | null> => {
  const token = await readSessionToken();
  if (!token) return null;
  const session = await validateSessionToken(token);
  if (!session) return null;
  const u = session.user;
  return {
    kind: "user",
    id: u.id,
    organizationId: u.organizationId,
    role: u.role,
    name: u.name,
    email: u.email,
    clientId: u.clientId,
    canViewFinance: u.role === "ADMIN" || u.canViewFinance,
    canViewOwnPay: u.canViewOwnPay,
    sessionId: session.id,
  };
});

/** Para páginas: exige sesión y, opcionalmente, uno de los roles indicados. */
export async function requireUser(roles?: Role[]): Promise<UserActor> {
  const user = await getCurrentUser();
  if (!user) redirect("/entrar");
  if (roles && !roles.includes(user.role)) notFound();
  return user;
}
