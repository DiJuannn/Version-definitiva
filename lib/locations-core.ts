import { prisma } from "@/lib/prisma";
import { uploadProjectFile } from "@/lib/storage";
import { LocationCharacteristic } from "@/lib/generated/prisma";

export type LocationInput = {
  name: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  contactName?: string | null;
  contactPhone?: string | null;
  availability?: string | null;
  cost?: number | null;
  characteristics?: string[];
  permitsNotes?: string | null;
  restrictions?: string | null;
  productionNotes?: string | null;
  notes?: string | null;
};

function cleanCharacteristics(values: string[] | undefined): LocationCharacteristic[] {
  const valid = new Set(Object.values(LocationCharacteristic) as string[]);
  return (values ?? []).filter((v): v is LocationCharacteristic => valid.has(v));
}

export async function createLocationCore(organizationId: string, input: LocationInput) {
  const name = input.name.trim();
  if (!name) return null;

  return prisma.location.create({
    data: {
      organizationId,
      name,
      address: input.address || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      contactName: input.contactName || null,
      contactPhone: input.contactPhone || null,
      availability: input.availability || null,
      cost: input.cost ?? null,
      characteristics: cleanCharacteristics(input.characteristics),
      permitsNotes: input.permitsNotes || null,
      restrictions: input.restrictions || null,
      productionNotes: input.productionNotes || null,
      notes: input.notes || null,
    },
  });
}

export async function updateLocationCore(
  organizationId: string,
  locationId: string,
  input: LocationInput,
) {
  const name = input.name.trim();
  if (!name) return null;

  const result = await prisma.location.updateMany({
    where: { id: locationId, organizationId },
    data: {
      name,
      address: input.address || null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      contactName: input.contactName || null,
      contactPhone: input.contactPhone || null,
      availability: input.availability || null,
      cost: input.cost ?? null,
      characteristics: cleanCharacteristics(input.characteristics),
      permitsNotes: input.permitsNotes || null,
      restrictions: input.restrictions || null,
      productionNotes: input.productionNotes || null,
      notes: input.notes || null,
    },
  });

  return result.count > 0;
}

export async function deleteLocationCore(organizationId: string, locationId: string) {
  await prisma.location.deleteMany({ where: { id: locationId, organizationId } });
}

export async function addLocationPhotoCore(organizationId: string, locationId: string, file: File) {
  const location = await prisma.location.findFirst({ where: { id: locationId, organizationId } });
  if (!location) return null;

  const uploaded = await uploadProjectFile(organizationId, file);
  if (!uploaded) return null;

  return prisma.location.update({
    where: { id: locationId },
    data: { photoUrls: [...location.photoUrls, uploaded.url] },
  });
}

export async function removeLocationPhotoCore(
  organizationId: string,
  locationId: string,
  photoUrl: string,
) {
  const location = await prisma.location.findFirst({ where: { id: locationId, organizationId } });
  if (!location) return null;

  return prisma.location.update({
    where: { id: locationId },
    data: { photoUrls: location.photoUrls.filter((url) => url !== photoUrl) },
  });
}
