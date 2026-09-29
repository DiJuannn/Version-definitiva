import "server-only";
import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { mkdir, open, rm, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import type { StorageProvider } from "./provider";

export class LocalDiskStorage implements StorageProvider {
  readonly kind = "LOCAL" as const;
  constructor(private root: string) {}

  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    // Evita path traversal: la ruta final debe quedar dentro de root.
    if (!full.startsWith(path.resolve(this.root) + path.sep)) throw new Error("Clave de almacenamiento no válida");
    return full;
  }

  async writeChunk(key: string, offset: number, data: Uint8Array) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    const current = (await this.size(key)) ?? 0;
    if (offset !== current) throw new Error(`offset ${offset} != ${current}`);
    const fh = await open(file, current === 0 ? "w" : "r+");
    try {
      await fh.write(data, 0, data.length, offset);
    } finally {
      await fh.close();
    }
    return offset + data.length;
  }

  async size(key: string) {
    try {
      return (await stat(this.resolve(key))).size;
    } catch {
      return null;
    }
  }

  read(key: string, range?: { start: number; end: number }) {
    return createReadStream(this.resolve(key), range);
  }

  async sha256(key: string) {
    const hash = createHash("sha256");
    await new Promise<void>((resolve, reject) => {
      const s = createReadStream(this.resolve(key));
      s.on("data", (c) => hash.update(c));
      s.on("end", () => resolve());
      s.on("error", reject);
    });
    return hash.digest("hex");
  }

  async delete(key: string) {
    await rm(this.resolve(key), { force: true });
  }

  async writeFile(key: string, data: Uint8Array) {
    const file = this.resolve(key);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, data);
  }
}
