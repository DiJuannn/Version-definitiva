// Build de Vercel (Vercel ejecuta "vercel-build" en vez de "build" si existe).
// En producción aplica antes las migraciones pendientes, para que la base de
// datos real tenga siempre las columnas que espera el código que se publica.
// Si la migración falla, el build falla y la web anterior sigue publicada.
import { execSync } from "node:child_process";

const run = (cmd, env = process.env) => execSync(cmd, { stdio: "inherit", env });

if (process.env.VERCEL_ENV === "production") {
  // directUrl es obligatoria en el schema; si no está configurada, se usa la principal.
  const env = { ...process.env, DIRECT_URL: process.env.DIRECT_URL || process.env.DATABASE_URL };
  console.log("Producción: aplicando migraciones pendientes…");
  run("npx prisma migrate deploy", env);
} else {
  console.log(`Entorno ${process.env.VERCEL_ENV ?? "local"}: sin migraciones.`);
}

run("npx next build");
