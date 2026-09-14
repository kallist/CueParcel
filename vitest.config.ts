import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    // tests/e2e is Playwright territory (MV3 extension E2E).
    // `.local/` is the gitignored scratch area; without this exclusion any
    // throwaway *.test.ts left there is silently swept into `npm test`, which
    // makes the reported suite size depend on local leftovers.
    exclude: ["**/node_modules/**", "**/dist/**", "**/dist-e2e/**", ".local/**", "tests/e2e/**"],
  },
});
