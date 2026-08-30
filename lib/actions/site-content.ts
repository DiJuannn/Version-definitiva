"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getCurrentProfile } from "@/lib/current-user";
import { optionalString } from "@/lib/form-utils";

async function requireAdminProfile() {
  const profile = await getCurrentProfile();
  if (!profile || profile.role !== "ADMIN") return null;
  return profile;
}

async function requireSiteContent() {
  const profile = await requireAdminProfile();
  if (!profile) return null;

  return prisma.siteContent.upsert({
    where: { organizationId: profile.organizationId },
    create: { organizationId: profile.organizationId },
    update: {},
  });
}

export async function updateSiteContent(formData: FormData) {
  const site = await requireSiteContent();
  if (!site) return;

  const tags = String(formData.get("marqueeTags") ?? "")
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);

  await prisma.siteContent.update({
    where: { id: site.id },
    data: {
      heroTitle: String(formData.get("heroTitle") ?? site.heroTitle),
      heroSubtitle: String(formData.get("heroSubtitle") ?? site.heroSubtitle),
      aboutQuestion: String(formData.get("aboutQuestion") ?? site.aboutQuestion),
      aboutText: String(formData.get("aboutText") ?? site.aboutText),
      contactEmail: String(formData.get("contactEmail") ?? site.contactEmail),
      marqueeTags: tags.length > 0 ? tags : site.marqueeTags,
      legalName: optionalString(formData.get("legalName")),
      legalTaxId: optionalString(formData.get("legalTaxId")),
      legalAddress: optionalString(formData.get("legalAddress")),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createServiceItem(formData: FormData) {
  const site = await requireSiteContent();
  if (!site) return;

  const title = String(formData.get("title") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (!title) return;

  const count = await prisma.serviceItem.count({
    where: { siteContentId: site.id },
  });

  await prisma.serviceItem.create({
    data: {
      siteContentId: site.id,
      title,
      description,
      details: optionalString(formData.get("details")),
      order: count,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function updateServiceItem(itemId: string, formData: FormData) {
  const profile = await requireAdminProfile();
  if (!profile) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await prisma.serviceItem.updateMany({
    where: { id: itemId, siteContent: { organizationId: profile.organizationId } },
    data: {
      title,
      description: String(formData.get("description") ?? "").trim(),
      details: optionalString(formData.get("details")),
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deleteServiceItem(itemId: string) {
  const profile = await requireAdminProfile();
  if (!profile) return;

  await prisma.serviceItem.deleteMany({
    where: { id: itemId, siteContent: { organizationId: profile.organizationId } },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function createPortfolioItem(formData: FormData) {
  const site = await requireSiteContent();
  if (!site) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  const count = await prisma.portfolioItem.count({
    where: { siteContentId: site.id },
  });

  await prisma.portfolioItem.create({
    data: {
      siteContentId: site.id,
      title,
      category: optionalString(formData.get("category")),
      description: optionalString(formData.get("description")),
      videoUrl: optionalString(formData.get("videoUrl")),
      featured: formData.get("featured") === "on",
      order: count,
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function updatePortfolioItem(itemId: string, formData: FormData) {
  const profile = await requireAdminProfile();
  if (!profile) return;

  const title = String(formData.get("title") ?? "").trim();
  if (!title) return;

  await prisma.portfolioItem.updateMany({
    where: { id: itemId, siteContent: { organizationId: profile.organizationId } },
    data: {
      title,
      category: optionalString(formData.get("category")),
      description: optionalString(formData.get("description")),
      videoUrl: optionalString(formData.get("videoUrl")),
      featured: formData.get("featured") === "on",
      published: formData.get("published") === "on",
    },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}

export async function deletePortfolioItem(itemId: string) {
  const profile = await requireAdminProfile();
  if (!profile) return;

  await prisma.portfolioItem.deleteMany({
    where: { id: itemId, siteContent: { organizationId: profile.organizationId } },
  });

  revalidatePath("/admin");
  revalidatePath("/");
}
