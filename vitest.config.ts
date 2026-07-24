import { defineConfig } from "vitest/config";
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globalSetup: "./vitest.global-setup.ts",
    // Bound real-Chrome concurrency without serialising the whole suite.
    minWorkers: 1,
    maxWorkers: 2,
  },
});
