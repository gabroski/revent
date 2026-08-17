import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [react(), tsconfigPaths()],
  test: {
    environment: "jsdom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    globals: true,
    // The hosted Supabase project is in ap-southeast-2; a round trip from
    // Georgia is ~500ms, and the DB-backed suites run several in parallel.
    // Vitest's 5s default is not enough headroom for that.
    testTimeout: 20_000,
    setupFiles: ["./vitest.setup.ts"],
  },
});
