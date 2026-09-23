import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    testTimeout: 15000,
    // Each test creates its own random-email users via the admin API, so files/tests
    // don't share mutable state and can run concurrently against the one shared local
    // Supabase instance.
    fileParallelism: true,
  },
});
