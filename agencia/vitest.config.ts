import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname),
      // Los módulos de servidor importan "server-only"; en tests es un módulo vacío.
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/global-setup.ts"],
    env: {
      DATABASE_URL: process.env.TEST_DATABASE_URL ?? "postgresql://corte:corte@localhost:5432/corte_test",
      APP_SECRET: "test-secret-test-secret-test-secret-000",
      APP_URL: "http://localhost:3100",
      STORAGE_LOCAL_DIR: ".storage-test",
    },
    fileParallelism: false,
    testTimeout: 30000,
  },
});
