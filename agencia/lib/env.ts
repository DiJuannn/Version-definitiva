import "server-only";
import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  APP_URL: z.string().url().default("http://localhost:3100"),
  // Secreto para firmar URLs de media. Mínimo 32 caracteres.
  APP_SECRET: z.string().min(32, "APP_SECRET debe tener al menos 32 caracteres"),
  STORAGE_DRIVER: z.enum(["local"]).default("local"),
  STORAGE_LOCAL_DIR: z.string().default(".storage"),
  // Email (opcional). Sin clave, los emails quedan en la bandeja como "omitidos".
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),
  CRON_SECRET: z.string().optional(),
  // IA (opcional). Sin proveedor configurado, todas las funciones de IA se desactivan.
  AI_PROVIDER: z.enum(["none", "anthropic"]).default("none"),
  ANTHROPIC_API_KEY: z.string().optional(),
  AI_MODEL: z.string().optional(),
});

let cached: z.infer<typeof schema> | null = null;

export function env() {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}
