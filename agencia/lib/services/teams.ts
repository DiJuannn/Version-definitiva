import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";
import { isAdmin, isManager, type Actor } from "@/lib/authz/actor";
import { badRequest, forbidden, notFound } from "@/lib/http/errors";
import { audit } from "./audit";

export const teamInput = z.object({
  name: z.string().trim().min(2, "Pon un nombre al equipo").max(100),
  coordinatorId: z.string().min(1, "Elige coordinador"),
});

export async function createTeam(a: Actor, raw: unknown) {
  if (!isAdmin(a)) throw forbidden();
  const input = teamInput.parse(raw);
  const c = await db.user.findFirst({ where: { id: input.coordinatorId, organizationId: a.organizationId, role: "COORDINATOR" } });
  if (!c) throw badRequest("Coordinador no válido");
  return db.$transaction(async (tx) => {
    const t = await tx.team.create({ data: { organizationId: a.organizationId, name: input.name, coordinatorId: c.id } });
    await audit(tx, a, { action: "team.create", entityType: "Team", entityId: t.id });
    return t;
  });
}

export async function setTeamMember(a: Actor, teamId: string, userId: string, member: boolean) {
  if (!isManager(a)) throw forbidden();
  const team = await db.team.findFirst({ where: { id: teamId, organizationId: a.organizationId } });
  if (!team) throw notFound("Equipo");
  if (a.role === "COORDINATOR" && team.coordinatorId !== a.id) throw forbidden();
  const u = await db.user.findFirst({ where: { id: userId, organizationId: a.organizationId, role: "EDITOR" } });
  if (!u) throw badRequest("Editor no válido");
  await db.$transaction(async (tx) => {
    if (member) await tx.teamMember.upsert({ where: { teamId_userId: { teamId, userId } }, create: { teamId, userId }, update: {} });
    else await tx.teamMember.deleteMany({ where: { teamId, userId } });
    await audit(tx, a, { action: member ? "team.add" : "team.remove", entityType: "Team", entityId: teamId, data: { userId } });
  });
}
