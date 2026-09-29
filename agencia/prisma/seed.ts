/**
 * Datos de DEMOSTRACIÓN (aislados en organizaciones "demo" y "otra-agencia").
 * No borra nada: si la organización demo ya existe, no hace nada.
 * Uso: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import { hashPassword } from "../lib/auth/crypto";

const db = new PrismaClient();
export const DEMO_PASSWORD = "demo-corte-2026";

async function main() {
  if (await db.organization.findUnique({ where: { slug: "demo" } })) {
    console.log("La organización demo ya existe; no se modifica nada.");
    return;
  }
  const pw = await hashPassword(DEMO_PASSWORD);
  const org = await db.organization.create({ data: { name: "Estudio Demo", slug: "demo", currency: "EUR" } });
  const u = (email: string, name: string, role: "ADMIN" | "COORDINATOR" | "EDITOR" | "CLIENT", extra: object = {}) =>
    db.user.create({ data: { organizationId: org.id, email, name, role, passwordHash: pw, ...extra } });

  const admin = await u("admin@demo.test", "Ana Robles", "ADMIN");
  const coord = await u("coord@demo.test", "Carlos Méndez", "COORDINATOR");
  await u("coord2@demo.test", "Irene Sáez", "COORDINATOR", { canViewFinance: true });
  const lucia = await u("lucia@demo.test", "Lucía Fernández", "EDITOR", {
    editorProfile: { create: { specialties: ["Reels", "Motion graphics"], software: ["Premiere Pro", "After Effects"], capacity: 4, rateCents: 18000 } },
  });
  const marco = await u("marco@demo.test", "Marco Villa", "EDITOR", {
    editorProfile: { create: { specialties: ["Entrevistas", "Color"], software: ["Premiere Pro", "DaVinci Resolve"], capacity: 3, rateCents: 22000 } },
  });
  await u("sara@demo.test", "Sara Ortiz", "EDITOR", {
    editorProfile: { create: { specialties: ["Subtítulos"], software: ["Premiere Pro"], availability: "UNAVAILABLE", availabilityNote: "Vacaciones hasta el lunes", capacity: 2 } },
  });

  const cafe = await db.client.create({ data: { organizationId: org.id, name: "Café Norte", contactName: "Marta Gil", contactEmail: "marta@cafenorte.test" } });
  const brisa = await db.client.create({ data: { organizationId: org.id, name: "Pilates Brisa", contactName: "Jon Arrieta", contactEmail: "jon@brisa.test" } });
  await u("marta@cafenorte.test", "Marta Gil", "CLIENT", { clientId: cafe.id });
  await u("jon@brisa.test", "Jon Arrieta", "CLIENT", { clientId: brisa.id });

  await db.team.create({
    data: { organizationId: org.id, name: "Social", coordinatorId: coord.id, members: { create: [{ userId: lucia.id }, { userId: marco.id }] } },
  });

  const style = await db.styleProfile.create({
    data: {
      clientId: cafe.id,
      version: 1,
      createdById: admin.id,
      data: {
        subtitles: "Blancos, sans serif, caja negra al 60 %, máximo 2 líneas.",
        colors: "Marrón café #5B3A29 y crema #F3E6D0.",
        pacing: "Cortes rápidos al principio, respirar en el producto.",
        logoPosition: "Esquina inferior derecha, últimos 3 segundos.",
        avoid: "Transiciones de barrido; música con voz.",
      },
    },
  });

  await db.servicePackage.create({
    data: { organizationId: org.id, clientId: cafe.id, name: "Social mensual", period: "MONTHLY", piecesIncluded: 6, priceCents: 150000, currency: "EUR" },
  });

  const p1 = await db.project.create({
    data: {
      organizationId: org.id,
      clientId: cafe.id,
      coordinatorId: coord.id,
      name: "Campaña de otoño",
      description: "Lanzamiento de la nueva mezcla de temporada en redes.",
      contentType: "Redes sociales",
      status: "ACTIVE",
      priority: "HIGH",
      dueDate: new Date(Date.now() + 6 * 86400_000),
      styleProfileId: style.id,
      createdById: admin.id,
      brief: {
        create: {
          status: "DRAFT",
          data: {
            objective: "Dar a conocer la mezcla de otoño y llevar tráfico a la tienda online.",
            contentType: "Reel y spot",
            audience: "Clientes habituales 25–45 en Instagram.",
            duration: "Reel 20–30 s; spot 30 s",
            format: "9:16 1080×1920 y 16:9 1920×1080",
            cta: "Pídela en cafenorte.test",
          },
        },
      },
    },
  });
  await db.piece.create({
    data: { organizationId: org.id, projectId: p1.id, title: "Reel de lanzamiento", format: "Reel", aspectRatio: "9:16", resolution: "1080×1920", targetDurationSec: 25, status: "PENDING_ASSIGNMENT", priority: "HIGH", dueDate: new Date(Date.now() + 4 * 86400_000) },
  });
  await db.piece.create({
    data: { organizationId: org.id, projectId: p1.id, title: "Spot horizontal", format: "Spot", aspectRatio: "16:9", resolution: "1920×1080", targetDurationSec: 30, status: "PENDING_ASSIGNMENT", dueDate: new Date(Date.now() + 6 * 86400_000) },
  });
  await db.financeLine.createMany({
    data: [
      { organizationId: org.id, projectId: p1.id, kind: "REVENUE", description: "Reel + spot", amountCents: 120000, currency: "EUR", taxBps: 2100, status: "CONFIRMED", createdById: admin.id },
      { organizationId: org.id, projectId: p1.id, kind: "EDITOR_COST", description: "Edición reel", amountCents: 18000, currency: "EUR", status: "ESTIMATED", editorId: lucia.id, createdById: admin.id },
    ],
  });

  const p2 = await db.project.create({
    data: {
      organizationId: org.id,
      clientId: brisa.id,
      coordinatorId: coord.id,
      name: "Clases online — temporada 1",
      contentType: "Formación",
      status: "ACTIVE",
      dueDate: new Date(Date.now() + 12 * 86400_000),
      createdById: admin.id,
      brief: { create: { data: {} } },
    },
  });
  await db.piece.create({
    data: { organizationId: org.id, projectId: p2.id, title: "Clase 1: respiración", aspectRatio: "16:9", editorId: marco.id, status: "ASSIGNED", dueDate: new Date(Date.now() + 9 * 86400_000) },
  });

  // Segunda organización: solo sirve para comprobar el aislamiento entre organizaciones.
  const other = await db.organization.create({ data: { name: "Otra Agencia", slug: "otra-agencia" } });
  const otherClient = await db.client.create({ data: { organizationId: other.id, name: "Cliente ajeno" } });
  await db.user.create({ data: { organizationId: other.id, email: "admin@otra.test", name: "Admin Ajeno", role: "ADMIN", passwordHash: pw } });
  await db.user.create({ data: { organizationId: other.id, email: "cliente@otra.test", name: "Cliente Ajeno", role: "CLIENT", clientId: otherClient.id, passwordHash: pw } });

  console.log(`Demo creada. Contraseña de todos los usuarios: ${DEMO_PASSWORD}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
