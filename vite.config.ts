import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// @ts-expect-error process is a nodejs global
const host = process.env.TAURI_DEV_HOST;

export default defineConfig(async () => ({
  plugins: [react(), tailwindcss()],

  // Prevent Vite from obscuring Rust errors
  clearScreen: false,

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
