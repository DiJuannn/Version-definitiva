"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { UserRole } from "@/lib/generated/prisma";

async function requireAdmin() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") return null;
  return profile;
}

function parseRole(value: FormDataEntryValue | null): UserRole {
  return value === "ADMIN" ? "ADMIN" : "MEMBER";
}

export async function createInvite(formData: FormData) {
  const profile = await requireAdmin();
  if (!profile) return;

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!email) return;
  const role = parseRole(formData.get("role"));

  const existingUser = await prisma.user.findUnique({ where: { email } });
  if (existingUser) return;

  await prisma.invite.deleteMany({
    where: { organizationId: profile.organizationId, email, status: "PENDING" },
  });

  await prisma.invite.create({
    data: { organizationId: profile.organizationId, email, role },
  });

  revalidatePath("/app/organizacion");
}

export async function revokeInvite(inviteId: string) {
  const profile = await requireAdmin();
  if (!profile) return;

  await prisma.invite.updateMany({
    where: { id: inviteId, organizationId: profile.organizationId },
    data: { status: "REVOKED" },
  });

  revalidatePath("/app/organizacion");
}

export async function updateMemberRole(userId: string, formData: FormData) {
  const profile = await requireAdmin();
  if (!profile) return;

  const newRole = parseRole(formData.get("role"));

  if (userId === profile.id && newRole !== "ADMIN") {
    const otherAdmins = await prisma.user.count({
      where: { organizationId: profile.organizationId, role: "ADMIN", id: { not: userId } },
    });
    if (otherAdmins === 0) return;
  }

  await prisma.user.updateMany({
    where: { id: userId, organizationId: profile.organizationId },
    data: { role: newRole },
  });

  revalidatePath("/app/organizacion");
}
