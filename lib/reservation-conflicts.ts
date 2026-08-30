import { prisma } from "@/lib/prisma";

export type ItemReservationConflict = {
  id: string;
  itemName: string;
  available: number;
  needed: number;
  projects: string[];
};

export type VehicleReservationConflict = {
  id: string;
  vehicleName: string;
  projects: string[];
};

// Un mismo recurso (material/vehículo) es compartido por toda la organización,
// así que un conflicto puede darse entre dos proyectos distintos que coinciden
// en fecha — no solo dentro del mismo proyecto.
export async function getReservationConflicts(organizationId: string, date: Date) {
  const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

  const [itemReservations, vehicleReservations] = await Promise.all([
    prisma.itemReservation.findMany({
      where: {
        shootingDay: {
          date: { gte: dayStart, lt: dayEnd },
          project: { organizationId },
        },
      },
      include: {
        inventoryItem: true,
        shootingDay: { include: { project: true } },
      },
    }),
    prisma.vehicleReservation.findMany({
      where: {
        shootingDay: {
          date: { gte: dayStart, lt: dayEnd },
          project: { organizationId },
        },
      },
      include: {
        vehicle: true,
        shootingDay: { include: { project: true } },
      },
    }),
  ]);

  const itemConflicts: ItemReservationConflict[] = [];
  const byItem = new Map<string, typeof itemReservations>();
  for (const reservation of itemReservations) {
    const list = byItem.get(reservation.inventoryItemId) ?? [];
    list.push(reservation);
    byItem.set(reservation.inventoryItemId, list);
  }
  for (const [itemId, list] of byItem) {
    const needed = list.reduce((sum, r) => sum + r.quantity, 0);
    const available = list[0].inventoryItem.quantity;
    if (needed <= available) continue;
    itemConflicts.push({
      id: itemId,
      itemName: list[0].inventoryItem.name,
      available,
      needed,
      projects: [...new Set(list.map((r) => r.shootingDay.project.name))],
    });
  }

  const vehicleConflicts: VehicleReservationConflict[] = [];
  const byVehicle = new Map<string, typeof vehicleReservations>();
  for (const reservation of vehicleReservations) {
    const list = byVehicle.get(reservation.vehicleId) ?? [];
    list.push(reservation);
    byVehicle.set(reservation.vehicleId, list);
  }
  for (const [vehicleId, list] of byVehicle) {
    if (list.length < 2) continue;
    vehicleConflicts.push({
      id: vehicleId,
      vehicleName: list[0].vehicle.name,
      projects: [...new Set(list.map((r) => r.shootingDay.project.name))],
    });
  }

  return { itemConflicts, vehicleConflicts };
}
