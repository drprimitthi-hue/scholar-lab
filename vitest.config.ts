import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src"), "@shared": path.resolve(__dirname, "shared"), "server-only": path.resolve(__dirname, "tests/server-only-stub.ts") } },
  test: { environment: "node", testTimeout: 20000 },
});
