// SPDX-License-Identifier: Apache-2.0
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;
// @ts-expect-error process is a nodejs global
const isPlaywrightTest = process.env.VITE_TEST === "playwright";

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

  // Swap @tauri-apps/api modules for mocks when running Playwright tests
  // against the plain Vite dev server (no Tauri shell available).
  resolve: isPlaywrightTest ? {
    alias: {
      "@tauri-apps/api/core":  fileURLToPath(new URL("src/test-setup/tauri-mock-core.ts",  import.meta.url)),
      "@tauri-apps/api/event": fileURLToPath(new URL("src/test-setup/tauri-mock-event.ts", import.meta.url)),
    },
  } : {},

  server: {
    // Port 1421 — LumaWeave holds 1420 (strictPort). See ADR-013.
    port: 1421,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: "ws",
          host,
          // 1422 — LumaWeave's HMR port is 1421 (remote dev mode only)
          port: 1422,
        }
      : undefined,
    watch: {
      ignored: ["**/src-tauri/**"],
    },
  },
}));
