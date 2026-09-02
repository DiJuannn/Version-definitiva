import { prisma } from "@/lib/prisma";

export type VehicleInput = {
  name: string;
  type?: string | null;
  plate?: string | null;
  notes?: string | null;
};

export async function createVehicleCore(organizationId: string, input: VehicleInput) {
  const name = input.name.trim();
  if (!name) return null;

  return prisma.vehicle.create({
    data: {
      organizationId,
      name,
      type: input.type || null,
      plate: input.plate || null,
      notes: input.notes || null,
    },
  });
}

export async function updateVehicleCore(
  organizationId: string,
  vehicleId: string,
  input: VehicleInput,
) {
  const name = input.name.trim();
  if (!name) return null;

  const result = await prisma.vehicle.updateMany({
    where: { id: vehicleId, organizationId },
    data: {
      name,
      type: input.type || null,
      plate: input.plate || null,
      notes: input.notes || null,
    },
  });

  return result.count > 0;
}

export async function deleteVehicleCore(organizationId: string, vehicleId: string) {
  await prisma.vehicle.deleteMany({ where: { id: vehicleId, organizationId } });
}
