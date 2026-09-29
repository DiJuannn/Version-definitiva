import "server-only";
import { notFound } from "next/navigation";
import { AppError } from "./errors";

/**
 * Para páginas: un recurso fuera de alcance (404/403 del servicio) se muestra
 * como página no encontrada con estado 404, sin revelar que existe.
 */
export async function orNotFound<T>(p: Promise<T>): Promise<T> {
  try {
    return await p;
  } catch (err) {
    if (err instanceof AppError && (err.status === 404 || err.status === 403)) notFound();
    throw err;
  }
}
