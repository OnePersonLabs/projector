import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/src/**/*.test.ts", "scripts/**/*.test.ts"],
    // Several integration files each run Git, SQLite, package, and process
    // workflows. Bounding file workers keeps their existing operation limits
    // meaningful instead of turning host-wide scheduler contention into timeouts.
    maxWorkers: 3,
    testTimeout: 10_000,
  },
});
