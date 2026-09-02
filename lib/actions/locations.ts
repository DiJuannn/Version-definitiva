"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalDecimal, optionalString } from "@/lib/form-utils";
import {
  addLocationPhotoCore,
  createLocationCore,
  deleteLocationCore,
  removeLocationPhotoCore,
  updateLocationCore,
  type LocationInput,
} from "@/lib/locations-core";
import { LocationCharacteristic } from "@/lib/generated/prisma";

function optionalFloat(value: FormDataEntryValue | null): number | null {
  const str = String(value ?? "").trim();
  if (!str) return null;
  const num = Number(str);
  return Number.isFinite(num) ? num : null;
}

function readCharacteristics(formData: FormData): LocationCharacteristic[] {
  const valid = new Set(Object.values(LocationCharacteristic) as string[]);
  return formData
    .getAll("characteristics")
    .map(String)
    .filter((value): value is LocationCharacteristic => valid.has(value));
}

function readLocationInput(formData: FormData): LocationInput {
  return {
    name: String(formData.get("name") ?? ""),
    address: optionalString(formData.get("address")),
    latitude: optionalFloat(formData.get("latitude")),
    longitude: optionalFloat(formData.get("longitude")),
    contactName: optionalString(formData.get("contactName")),
    contactPhone: optionalString(formData.get("contactPhone")),
    availability: optionalString(formData.get("availability")),
    cost: optionalDecimal(formData.get("cost")),
    characteristics: readCharacteristics(formData),
    permitsNotes: optionalString(formData.get("permitsNotes")),
    restrictions: optionalString(formData.get("restrictions")),
    productionNotes: optionalString(formData.get("productionNotes")),
    notes: optionalString(formData.get("notes")),
  };
}

export type GeocodeCandidate = { lat: number; lng: number; label: string };

export async function geocodeAddress(address: string): Promise<GeocodeCandidate[]> {
  const trimmed = address.trim();
  if (!trimmed) return [];

  const url = `https://nominatim.openstreetmap.org/search?format=json&addressdetails=0&limit=5&q=${encodeURIComponent(trimmed)}`;
  const response = await fetch(url, {
    headers: {
      "User-Agent": "VersionDefinitiva-Taller/1.0 (uso interno de productora)",
    },
  });
  if (!response.ok) return [];

  const results = (await response.json()) as {
    lat: string;
    lon: string;
    display_name: string;
  }[];

  return results.map((result) => ({
    lat: Number(result.lat),
    lng: Number(result.lon),
    label: result.display_name,
  }));
}

export async function createLocation(formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await createLocationCore(profile.organizationId, readLocationInput(formData));

  revalidatePath("/app/localizaciones");
}

export async function updateLocation(locationId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await updateLocationCore(profile.organizationId, locationId, readLocationInput(formData));

  revalidatePath("/app/localizaciones");
  revalidatePath(`/app/localizaciones/${locationId}`);
}

export async function addLocationPhoto(locationId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) return;

  await addLocationPhotoCore(profile.organizationId, locationId, file);
  revalidatePath(`/app/localizaciones/${locationId}`);
}

export async function removeLocationPhoto(locationId: string, photoUrl: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await removeLocationPhotoCore(profile.organizationId, locationId, photoUrl);
  revalidatePath(`/app/localizaciones/${locationId}`);
}

export async function addLocationVideo(locationId: string, formData: FormData) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const url = String(formData.get("videoUrl") ?? "").trim();
  if (!url) return;

  const location = await prisma.location.findFirst({
    where: { id: locationId, organizationId: profile.organizationId },
  });
  if (!location) return;

  await prisma.location.update({
    where: { id: locationId },
    data: { videoUrls: [...location.videoUrls, url] },
  });

  revalidatePath(`/app/localizaciones/${locationId}`);
}

export async function removeLocationVideo(locationId: string, videoUrl: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  const location = await prisma.location.findFirst({
    where: { id: locationId, organizationId: profile.organizationId },
  });
  if (!location) return;

  await prisma.location.update({
    where: { id: locationId },
    data: { videoUrls: location.videoUrls.filter((url) => url !== videoUrl) },
  });

  revalidatePath(`/app/localizaciones/${locationId}`);
}

export async function deleteLocation(locationId: string) {
  const profile = await getCurrentProfile();
  if (!profile) return;

  await deleteLocationCore(profile.organizationId, locationId);
  revalidatePath("/app/localizaciones");
}
