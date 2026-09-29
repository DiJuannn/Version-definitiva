import "server-only";
import { z } from "zod";
import type { Availability, Role } from "@prisma/client";
import { db } from "@/lib/db";
import { hashPassword } from "@/lib/auth/crypto";
import { isAdmin, isManager, type Actor } from "@/lib/authz/actor";
import { badRequest, conflict, forbidden, notFound } from "@/lib/http/errors";
import { audit } from "./audit";

export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres")
  .max(200)
  .refine((p) => /[A-Za-z]/.test(p) && /\d/.test(p), "Usa letras y números");

export const userInput = z
  .object({
    name: z.string().trim().min(2, "Escribe el nombre").max(120),
    email: z.string().trim().toLowerCase().email("Email no válido"),
    role: z.enum(["ADMIN", "COORDINATOR", "EDITOR", "CLIENT"]),
    clientId: z.string().optional().transform((v) => v || null),
    password: passwordSchema,
    canViewFinance: z.boolean().optional().default(false),
  })
  .refine((u) => u.role !== "CLIENT" || u.clientId, { message: "Un usuario cliente debe pertenecer a un cliente", path: ["clientId"] });

export async function createUser(a: Actor, raw: unknown) {
  if (!isAdmin(a)) throw forbidden();
  const input = userInput.parse(raw);
  if (input.clientId) {
    const c = await db.client.findFirst({ where: { id: input.clientId, organizationId: a.organizationId } });
    if (!c) throw badRequest("Cliente no válido");
  }
  const exists = await db.user.findUnique({ where: { email: input.email } });
  if (exists) throw conflict("Ya existe un usuario con ese email");
  return db.$transaction(async (tx) => {
    const user = await tx.user.create({
      data: {
        organizationId: a.organizationId,
        name: input.name,
        email: input.email,
        role: input.role as Role,
        clientId: input.role === "CLIENT" ? input.clientId : null,
        canViewFinance: input.role === "COORDINATOR" ? input.canViewFinance : false,
        passwordHash: await hashPassword(input.password),
        editorProfile: input.role === "EDITOR" ? { create: {} } : undefined,
      },
    });
    await audit(tx, a, { action: "user.create", entityType: "User", entityId: user.id, data: { role: user.role } });
    return user;
  });
}

export async function setUserActive(a: Actor, userId: string, active: boolean) {
  if (!isAdmin(a)) throw forbidden();
  if (userId === a.id) throw badRequest("No puedes desactivar tu propia cuenta");
  const u = await db.user.findFirst({ where: { id: userId, organizationId: a.organizationId } });
  if (!u) throw notFound("Usuario");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { active } });
    // Desactivar corta todas sus sesiones al momento.
    if (!active) await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(tx, a, { action: active ? "user.activate" : "user.deactivate", entityType: "User", entityId: userId });
  });
}

export async function setFinancePermission(a: Actor, userId: string, value: boolean) {
  if (!isAdmin(a)) throw forbidden();
  const u = await db.user.findFirst({ where: { id: userId, organizationId: a.organizationId, role: "COORDINATOR" } });
  if (!u) throw notFound("Coordinador");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { canViewFinance: value } });
    await audit(tx, a, { action: "user.finance_permission", entityType: "User", entityId: userId, data: { value } });
  });
}

export async function resetUserPassword(a: Actor, userId: string, password: string) {
  if (!isAdmin(a)) throw forbidden();
  const pw = passwordSchema.parse(password);
  const u = await db.user.findFirst({ where: { id: userId, organizationId: a.organizationId } });
  if (!u) throw notFound("Usuario");
  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(pw) } });
    await tx.session.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    await audit(tx, a, { action: "user.reset_password", entityType: "User", entityId: userId });
  });
}

export async function revokeSession(a: Actor, sessionId: string) {
  if (a.kind !== "user") throw forbidden();
  const s = await db.session.findUnique({ where: { id: sessionId }, include: { user: true } });
  if (!s || s.user.organizationId !== a.organizationId) throw notFound("Sesión");
  if (s.userId !== a.id && !isAdmin(a)) throw forbidden();
  await db.session.update({ where: { id: sessionId }, data: { revokedAt: new Date() } });
}

export const editorProfileInput = z.object({
  specialties: z.string().max(500).optional().default(""),
  software: z.string().max(500).optional().default(""),
  availability: z.enum(["AVAILABLE", "LIMITED", "UNAVAILABLE"]),
  availabilityNote: z.string().trim().max(500).optional().default(""),
  capacity: z.coerce.number().int().min(0).max(50),
  rateCents: z.number().int().min(0).nullable().optional(),
  internalNotes: z.string().trim().max(4000).optional(),
});

const splitList = (s: string) =>
  s
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean)
    .slice(0, 30);

/** Gestión edita el perfil; el propio editor solo su disponibilidad. Tarifas y notas: solo ADMIN. */
export async function updateEditorProfile(a: Actor, userId: string, raw: unknown) {
  if (a.kind !== "user") throw forbidden();
  const self = a.id === userId;
  if (!isManager(a) && !self) throw forbidden();
  const input = editorProfileInput.parse(raw);
  const u = await db.user.findFirst({ where: { id: userId, organizationId: a.organizationId, role: "EDITOR" } });
  if (!u) throw notFound("Editor");
  const data = isManager(a)
    ? {
        specialties: splitList(input.specialties),
        software: splitList(input.software),
        availability: input.availability as Availability,
        availabilityNote: input.availabilityNote || null,
        capacity: input.capacity,
        ...(isAdmin(a) ? { rateCents: input.rateCents ?? null, internalNotes: input.internalNotes ?? null } : {}),
      }
    : { availability: input.availability as Availability, availabilityNote: input.availabilityNote || null };
  await db.$transaction(async (tx) => {
    await tx.editorProfile.upsert({ where: { userId }, create: { userId, ...data }, update: data });
    await audit(tx, a, { action: "editor.profile", entityType: "User", entityId: userId });
  });
}
