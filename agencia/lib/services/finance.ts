import "server-only";
import { z } from "zod";
import type { FinanceKind, FinanceLineStatus } from "@prisma/client";
import { db } from "@/lib/db";
import { isAdmin, isEditor, type Actor } from "@/lib/authz/actor";
import { canViewProjectFinance, loadProject } from "@/lib/authz/guards";
import { computeMargin, parseMoneyToCents } from "@/lib/domain/money";
import { badRequest, forbidden, notFound } from "@/lib/http/errors";
import { audit } from "./audit";

export const financeLineInput = z.object({
  kind: z.enum(["REVENUE", "DISCOUNT", "EDITOR_COST", "OTHER_COST"]),
  description: z.string().trim().min(2, "Describe la línea").max(200),
  amount: z.string().min(1, "Indica el importe"),
  currency: z.string().regex(/^[A-Z]{3}$/, "Moneda ISO de 3 letras"),
  taxBps: z.coerce.number().int().min(0).max(10000).optional().default(0),
  status: z.enum(["ESTIMATED", "CONFIRMED", "SETTLED"]).default("ESTIMATED"),
  editorId: z.string().optional().transform((v) => v || null),
  dueDate: z.string().optional().transform((v) => (v ? new Date(v) : null)),
});

function assertFinance(a: Actor) {
  if (!canViewProjectFinance(a)) throw forbidden("No tienes acceso a la información económica");
}

export async function projectFinance(a: Actor, projectId: string) {
  assertFinance(a);
  const project = await loadProject(a, projectId);
  const org = await db.organization.findUniqueOrThrow({ where: { id: a.organizationId } });
  const lines = await db.financeLine.findMany({ where: { projectId }, orderBy: { createdAt: "asc" } });
  return {
    project,
    lines,
    estimated: computeMargin(lines, "estimated", org.currency),
    final: computeMargin(lines, "final", org.currency),
    currency: org.currency,
    defaultTaxBps: org.defaultTaxBps,
  };
}

export async function addFinanceLine(a: Actor, projectId: string, raw: unknown) {
  assertFinance(a);
  await loadProject(a, projectId);
  const input = financeLineInput.parse(raw);
  const cents = parseMoneyToCents(input.amount);
  if (cents === null || cents < 0) throw badRequest("Importe no válido (usa por ejemplo 1250,00)");
  if (input.kind === "EDITOR_COST" && input.editorId) {
    const e = await db.user.findFirst({ where: { id: input.editorId, organizationId: a.organizationId, role: "EDITOR" } });
    if (!e) throw badRequest("Editor no válido");
  }
  return db.$transaction(async (tx) => {
    const line = await tx.financeLine.create({
      data: {
        organizationId: a.organizationId,
        projectId,
        kind: input.kind as FinanceKind,
        description: input.description,
        amountCents: cents,
        currency: input.currency,
        taxBps: input.kind === "REVENUE" ? input.taxBps : 0,
        status: input.status as FinanceLineStatus,
        editorId: input.kind === "EDITOR_COST" ? input.editorId : null,
        dueDate: input.dueDate,
        settledAt: input.status === "SETTLED" ? new Date() : null,
        createdById: (a as { id: string }).id,
      },
    });
    await audit(tx, a, { action: "finance.add", entityType: "FinanceLine", entityId: line.id, projectId, data: { kind: line.kind, amountCents: cents, currency: input.currency } });
    return line;
  });
}

export async function setFinanceLineStatus(a: Actor, lineId: string, status: FinanceLineStatus) {
  assertFinance(a);
  const line = await db.financeLine.findFirst({ where: { id: lineId, organizationId: a.organizationId } });
  if (!line) throw notFound("Línea");
  await loadProject(a, line.projectId);
  await db.$transaction(async (tx) => {
    await tx.financeLine.update({ where: { id: lineId }, data: { status, settledAt: status === "SETTLED" ? new Date() : null } });
    await audit(tx, a, { action: "finance.status", entityType: "FinanceLine", entityId: lineId, projectId: line.projectId, data: { from: line.status, to: status } });
  });
}

export async function deleteFinanceLine(a: Actor, lineId: string) {
  if (!isAdmin(a)) throw forbidden();
  const line = await db.financeLine.findFirst({ where: { id: lineId, organizationId: a.organizationId } });
  if (!line) throw notFound("Línea");
  if (line.status === "SETTLED") throw badRequest("Una línea liquidada no se borra; corrígela con otra línea");
  await db.$transaction(async (tx) => {
    await tx.financeLine.delete({ where: { id: lineId } });
    await audit(tx, a, { action: "finance.delete", entityType: "FinanceLine", entityId: lineId, projectId: line.projectId, data: { kind: line.kind, amountCents: line.amountCents } });
  });
}

/** Resumen global: cobros pendientes y pagos pendientes a editores. */
export async function financeOverview(a: Actor) {
  if (!isAdmin(a)) throw forbidden();
  const lines = await db.financeLine.findMany({
    where: { organizationId: a.organizationId, status: { not: "SETTLED" }, kind: { in: ["REVENUE", "EDITOR_COST", "OTHER_COST"] } },
    include: { project: { select: { id: true, name: true, client: { select: { name: true } } } } },
    orderBy: [{ dueDate: { sort: "asc", nulls: "last" } }],
  });
  const editors = await db.user.findMany({ where: { organizationId: a.organizationId, role: "EDITOR" }, select: { id: true, name: true } });
  return { receivables: lines.filter((l) => l.kind === "REVENUE"), payables: lines.filter((l) => l.kind !== "REVENUE"), editors };
}

/** Pagos propios del editor (si su cuenta lo permite). Sin márgenes ni precios al cliente. */
export async function myPayments(a: Actor) {
  if (!isEditor(a) || !a.canViewOwnPay) throw forbidden();
  return db.financeLine.findMany({
    where: { organizationId: a.organizationId, kind: "EDITOR_COST", editorId: a.id },
    select: { id: true, description: true, amountCents: true, currency: true, status: true, dueDate: true, settledAt: true, project: { select: { name: true } } },
    orderBy: { createdAt: "desc" },
  });
}

export const packageInput = z.object({
  name: z.string().trim().min(2).max(120),
  clientId: z.string().optional().transform((v) => v || null),
  period: z.enum(["ONE_OFF", "MONTHLY", "QUARTERLY"]),
  piecesIncluded: z.coerce.number().int().min(1).max(1000),
  price: z.string().min(1),
  currency: z.string().regex(/^[A-Z]{3}$/),
  description: z.string().trim().max(1000).optional().default(""),
});

export async function createPackage(a: Actor, raw: unknown) {
  if (!isAdmin(a)) throw forbidden();
  const input = packageInput.parse(raw);
  const cents = parseMoneyToCents(input.price);
  if (cents === null || cents < 0) throw badRequest("Precio no válido");
  return db.$transaction(async (tx) => {
    const p = await tx.servicePackage.create({
      data: {
        organizationId: a.organizationId,
        name: input.name,
        clientId: input.clientId,
        period: input.period,
        piecesIncluded: input.piecesIncluded,
        priceCents: cents,
        currency: input.currency,
        description: input.description || null,
      },
    });
    await audit(tx, a, { action: "package.create", entityType: "ServicePackage", entityId: p.id });
    return p;
  });
}
