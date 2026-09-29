"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { FinanceLineStatus } from "@prisma/client";
import { requireUser } from "@/lib/auth/current";
import { db } from "@/lib/db";
import { formToObject, runAction, type ActionState } from "@/lib/http/action";
import { forbidden } from "@/lib/http/errors";
import { audit } from "@/lib/services/audit";
import { createUser, resetUserPassword, revokeSession, setFinancePermission, setUserActive, updateEditorProfile } from "@/lib/services/users";
import { createClient, decideStyleSuggestion, refreshStyleSuggestions, saveStyleProfile } from "@/lib/services/clients";
import { createTeam, setTeamMember } from "@/lib/services/teams";
import { addFinanceLine, createPackage, deleteFinanceLine, setFinanceLineStatus } from "@/lib/services/finance";
import { parseMoneyToCents } from "@/lib/domain/money";
import { STYLE_FIELDS } from "@/lib/domain/style";
import { NOTIFICATION_TYPES } from "@/lib/notifications/types";
import { processOutbox } from "@/lib/notifications/outbox";

export async function createUserAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const o = formToObject(fd);
  return runAction(async () => {
    await createUser(me, { ...o, canViewFinance: o.canViewFinance === true });
    revalidatePath("/ajustes");
  }, "Usuario creado. Comparte la contraseña inicial por un canal seguro.");
}

export async function setUserActiveAction(fd: FormData) {
  const me = await requireUser(["ADMIN"]);
  await setUserActive(me, String(fd.get("userId")), fd.get("active") === "true");
  revalidatePath("/ajustes");
}

export async function financePermAction(fd: FormData) {
  const me = await requireUser(["ADMIN"]);
  await setFinancePermission(me, String(fd.get("userId")), fd.get("value") === "true");
  revalidatePath("/ajustes");
}

export async function resetPasswordAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  return runAction(async () => {
    await resetUserPassword(me, String(fd.get("userId")), String(fd.get("password") ?? ""));
  }, "Contraseña restablecida y sesiones cerradas.");
}

export async function revokeSessionAction(fd: FormData) {
  const me = await requireUser();
  await revokeSession(me, String(fd.get("sessionId")));
  revalidatePath("/cuenta");
}

const orgSchema = z.object({
  name: z.string().trim().min(2).max(120),
  currency: z.string().regex(/^[A-Z]{3}$/, "Moneda ISO de 3 letras"),
  defaultTaxBps: z.coerce.number().int().min(0).max(10000),
  approvalPolicy: z.enum(["BLOCK_IF_OPEN", "ALLOW_WITH_ACK"]),
});

export async function updateOrgAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  const o = formToObject(fd);
  return runAction(async () => {
    const input = orgSchema.parse({ ...o, defaultTaxBps: Math.round(Number(String(o.taxPct ?? "0").replace(",", ".")) * 100) });
    await db.$transaction(async (tx) => {
      await tx.organization.update({
        where: { id: me.organizationId },
        data: { ...input, clientRequests: o.clientRequests === true, aiEnabled: o.aiEnabled === true },
      });
      await audit(tx, me, { action: "org.update", entityType: "Organization", entityId: me.organizationId, data: { ...input, clientRequests: o.clientRequests === true, aiEnabled: o.aiEnabled === true } });
    });
    revalidatePath("/ajustes");
  }, "Ajustes guardados");
}

export async function processOutboxAction() {
  await requireUser(["ADMIN"]);
  await processOutbox(50);
  revalidatePath("/ajustes");
}

export async function createClientAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  let id = "";
  const res = await runAction(async () => {
    id = (await createClient(me, formToObject(fd))).id;
  });
  if (res?.ok) redirect(`/clientes/${id}`);
  return res;
}

export async function saveStyleAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const clientId = String(fd.get("clientId"));
  const data: Record<string, string> = {};
  for (const f of STYLE_FIELDS) {
    const v = fd.get(f.key);
    if (typeof v === "string" && v.trim()) data[f.key] = v.trim();
  }
  return runAction(async () => {
    const sp = await saveStyleProfile(me, clientId, data);
    revalidatePath(`/clientes/${clientId}`);
    return { version: sp.version };
  }, "Nueva versión del perfil guardada. Los proyectos existentes conservan la suya.");
}

export async function refreshSuggestionsAction(fd: FormData) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const clientId = String(fd.get("clientId"));
  await refreshStyleSuggestions(me, clientId);
  revalidatePath(`/clientes/${clientId}`);
}

export async function decideSuggestionAction(fd: FormData) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  await decideStyleSuggestion(me, String(fd.get("suggestionId")), fd.get("accept") === "true", String(fd.get("text") ?? "") || undefined);
  revalidatePath(`/clientes/${String(fd.get("clientId"))}`);
}

export async function createTeamAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  return runAction(async () => {
    await createTeam(me, formToObject(fd));
    revalidatePath("/equipo");
  }, "Equipo creado");
}

export async function teamMemberAction(fd: FormData) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  await setTeamMember(me, String(fd.get("teamId")), String(fd.get("userId")), fd.get("member") === "true");
  revalidatePath("/equipo");
}

export async function editorProfileAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "COORDINATOR", "EDITOR"]);
  const userId = String(fd.get("userId"));
  const o = formToObject(fd);
  return runAction(async () => {
    const rate = typeof o.rate === "string" && o.rate ? parseMoneyToCents(o.rate) : null;
    await updateEditorProfile(me, userId, { ...o, rateCents: rate });
    revalidatePath(`/equipo/${userId}`);
    revalidatePath("/equipo");
  }, "Perfil guardado");
}

export async function addFinanceLineAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  const projectId = String(fd.get("projectId"));
  const o = formToObject(fd);
  return runAction(async () => {
    await addFinanceLine(me, projectId, { ...o, taxBps: Math.round(Number(String(o.taxPct ?? "0").replace(",", ".")) * 100) });
    revalidatePath(`/proyectos/${projectId}/finanzas`);
  }, "Línea añadida");
}

export async function financeStatusAction(fd: FormData) {
  const me = await requireUser(["ADMIN", "COORDINATOR"]);
  await setFinanceLineStatus(me, String(fd.get("lineId")), String(fd.get("status")) as FinanceLineStatus);
  revalidatePath(`/proyectos/${String(fd.get("projectId"))}/finanzas`);
  revalidatePath("/finanzas");
}

export async function deleteFinanceLineAction(fd: FormData) {
  const me = await requireUser(["ADMIN"]);
  await deleteFinanceLine(me, String(fd.get("lineId")));
  revalidatePath(`/proyectos/${String(fd.get("projectId"))}/finanzas`);
}

export async function createPackageAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser(["ADMIN"]);
  return runAction(async () => {
    await createPackage(me, formToObject(fd));
    revalidatePath("/finanzas");
  }, "Paquete creado");
}

export async function markNotificationsReadAction(fd: FormData) {
  const me = await requireUser();
  const id = fd.get("id");
  await db.notification.updateMany({ where: { userId: me.id, readAt: null, ...(id ? { id: String(id) } : {}) }, data: { readAt: new Date() } });
  revalidatePath("/avisos");
  revalidatePath("/", "layout");
}

export async function openNotificationAction(fd: FormData) {
  const me = await requireUser();
  const id = String(fd.get("id"));
  const n = await db.notification.findFirst({ where: { id, userId: me.id } });
  if (!n) throw forbidden();
  await db.notification.update({ where: { id }, data: { readAt: new Date() } });
  redirect(n.url ?? "/avisos");
}

export async function notificationPrefsAction(_: ActionState, fd: FormData): Promise<ActionState> {
  const me = await requireUser();
  return runAction(async () => {
    for (const type of Object.keys(NOTIFICATION_TYPES)) {
      const inApp = fd.get(`${type}:inApp`) === "on";
      const email = fd.get(`${type}:email`) === "on";
      await db.notificationPreference.upsert({
        where: { userId_type: { userId: me.id, type } },
        create: { userId: me.id, type, inApp, email },
        update: { inApp, email },
      });
    }
    revalidatePath("/cuenta");
  }, "Preferencias guardadas");
}
