"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";
import { createVehicleCore, deleteVehicleCore, updateVehicleCore } from "@/lib/vehicles-core";

export async function createVehicle(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await createVehicleCore(profile.organizationId, {
    name: String(formData.get("name") ?? ""),
    type: optionalString(formData.get("type")),
    plate: optionalString(formData.get("plate")),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath("/app/vehiculos");
}

export async function updateVehicle(vehicleId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await updateVehicleCore(profile.organizationId, vehicleId, {
    name: String(formData.get("name") ?? ""),
    type: optionalString(formData.get("type")),
    plate: optionalString(formData.get("plate")),
    notes: optionalString(formData.get("notes")),
  });

  revalidatePath("/app/vehiculos");
}

export async function deleteVehicle(vehicleId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await deleteVehicleCore(profile.organizationId, vehicleId);
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
