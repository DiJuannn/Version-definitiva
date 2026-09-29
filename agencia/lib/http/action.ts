import "server-only";
import { unstable_rethrow } from "next/navigation";
import { ZodError } from "zod";
import { AppError } from "./errors";

export type ActionState = {
  ok: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  data?: Record<string, unknown>;
  // Cambia en cada envío para que la interfaz pueda reaccionar (limpiar, cerrar...).
  at?: number;
} | null;

/** Ejecuta la lógica de una Server Action y traduce errores a un estado mostrable. */
export async function runAction(fn: () => Promise<void | Record<string, unknown>>, message?: string): Promise<ActionState> {
  try {
    const data = (await fn()) ?? undefined;
    return { ok: true, message, data: data || undefined, at: Date.now() };
  } catch (err) {
    unstable_rethrow(err);
    if (err instanceof AppError) return { ok: false, error: err.message, at: Date.now() };
    if (err instanceof ZodError) {
      const fieldErrors: Record<string, string> = {};
      for (const i of err.issues) {
        const k = String(i.path[0] ?? "_");
        fieldErrors[k] ??= i.message;
      }
      return { ok: false, error: err.issues[0]?.message ?? "Revisa los datos", fieldErrors, at: Date.now() };
    }
    console.error(err);
    return { ok: false, error: "Algo falló al guardar. Inténtalo de nuevo.", at: Date.now() };
  }
}

/** FormData → objeto plano (checkbox "on" → true). */
export function formToObject(fd: FormData): Record<string, string | boolean> {
  const out: Record<string, string | boolean> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (typeof v !== "string") continue;
    out[k] = v === "on" ? true : v;
  }
  return out;
}
