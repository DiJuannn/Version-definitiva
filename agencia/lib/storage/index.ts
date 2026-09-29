import "server-only";
import path from "node:path";
import { env } from "@/lib/env";
import { LocalDiskStorage } from "./local";
import type { StorageProvider } from "./provider";

let instance: StorageProvider | null = null;

export function storage(): StorageProvider {
  if (!instance) {
    const e = env();
    instance = new LocalDiskStorage(path.resolve(process.cwd(), e.STORAGE_LOCAL_DIR));
  }
  return instance;
}
