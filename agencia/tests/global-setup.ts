import { execSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/**
 * Prepara la base de datos de TEST (nunca la de desarrollo): aplica
 * migraciones y vacía las tablas. Se niega a actuar si el nombre de la base
 * no termina en _test.
 */
export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? "postgresql://corte:corte@localhost:5432/corte_test";
  const name = new URL(url).pathname.slice(1);
  if (!name.endsWith("_test")) throw new Error(`Base de datos de test no válida: ${name}`);
  execSync("npx prisma migrate deploy", { env: { ...process.env, DATABASE_URL: url }, stdio: "pipe" });
  const db = new PrismaClient({ datasources: { db: { url } } });
  const tables = await db.$queryRaw<{ tablename: string }[]>`SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  await db.$executeRawUnsafe(`TRUNCATE ${tables.map((t) => `"${t.tablename}"`).join(", ")} CASCADE`);
  await db.$disconnect();
}
