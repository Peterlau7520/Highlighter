import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // Without this, vitest also picks up tsc's compiled duplicate
    // (dist/lib/urlChange.test.js) alongside the real source .test.ts,
    // silently double-running every test.
    exclude: ["**/node_modules/**", "**/dist/**"],
  },
});
