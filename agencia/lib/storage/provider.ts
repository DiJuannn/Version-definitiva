import type { Readable } from "node:stream";

/**
 * Abstracción de almacenamiento de media. La base de datos guarda solo
 * metadatos (MediaAsset); los bytes viven en el proveedor.
 *
 * Implementaciones:
 *  - LocalDiskStorage (desarrollo / servidor propio). Acepta subida por trozos
 *    reanudable a través de la app. NO apto para originales de cientos de GB
 *    en Vercel: para eso se necesita un proveedor de objetos (S3/R2) con subida
 *    multiparte firmada directa desde el navegador (pendiente, requiere
 *    credenciales; ver ARCHITECTURE.md §Media).
 */
export interface StorageProvider {
  readonly kind: "LOCAL";
  /** Escribe un trozo en la posición indicada. Devuelve bytes totales escritos. */
  writeChunk(key: string, offset: number, data: Uint8Array): Promise<number>;
  size(key: string): Promise<number | null>;
  read(key: string, range?: { start: number; end: number }): Readable;
  sha256(key: string): Promise<string>;
  delete(key: string): Promise<void>;
  writeFile(key: string, data: Uint8Array): Promise<void>;
}

export function storageKey(parts: { organizationId: string; kind: string; assetId: string; filename: string }) {
  const safe = parts.filename.replace(/[^a-zA-Z0-9._-]+/g, "_").slice(-120) || "file";
  return `${parts.organizationId}/${parts.kind.toLowerCase()}/${parts.assetId}/${safe}`;
}
