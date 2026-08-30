"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";

export async function createVehicle(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.vehicle.create({
    data: {
      organizationId: profile.organizationId,
      name,
      plate: optionalString(formData.get("plate")),
      type: optionalString(formData.get("type")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/app/vehiculos");
}

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;

  await prisma.vehicle.updateMany({
    where: { id: vehicleId, organizationId: profile.organizationId },
    data: {
      name,
      plate: optionalString(formData.get("plate")),
      type: optionalString(formData.get("type")),
      notes: optionalString(formData.get("notes")),
    },
  });

  revalidatePath("/app/vehiculos");
}

export async function deleteVehicle(vehicleId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await prisma.vehicle.deleteMany({
    where: { id: vehicleId, organizationId: profile.organizationId },
  });

  revalidatePath("/app/vehiculos");
}

export async function updateDayVehicleReservations(
  projectId: string,
  dayId: string,
  formData: FormData,
) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const day = await prisma.shootingDay.findFirst({
    where: { id: dayId, projectId, project: { organizationId: profile.organizationId } },
  });
  if (!day) return;

  const vehicles = await prisma.vehicle.findMany({
    where: { organizationId: profile.organizationId },
    select: { id: true },
  });

  await prisma.$transaction(async (tx) => {
    await tx.vehicleReservation.deleteMany({ where: { shootingDayId: dayId } });

    const toCreate = vehicles
      .filter((vehicle) => formData.get(`reserve_${vehicle.id}`) === "on")
      .map((vehicle) => ({ shootingDayId: dayId, vehicleId: vehicle.id }));

    if (toCreate.length > 0) {
      await tx.vehicleReservation.createMany({ data: toCreate });
    }
  });

  revalidatePath(`/app/${projectId}/plan-de-rodaje/${dayId}`);
}
