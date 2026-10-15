import path from "node:path";
import { defineConfig } from "vitest/config";

// Pruebas: `tests/unit` no tocan la base de datos; `tests/db` usan la de
// DATABASE_URL (local o la del CI), crean sus propios datos y los borran.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // Las de base de datos comparten la base: una detrás de otra.
    fileParallelism: false,
    testTimeout: 60_000,
    hookTimeout: 60_000,
  },
});
