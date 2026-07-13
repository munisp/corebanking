import { defineConfig, Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import { createHash } from "crypto";

/**
 * Vite plugin: stamps a unique build hash into sw.js at build time.
 * This ensures the service worker cache name changes on every deploy,
 * triggering the activate handler to purge stale caches.
 */
function swVersionStamp(): Plugin {
  return {
    name: "sw-version-stamp",
    closeBundle() {
      const swPath = resolve(__dirname, "dist/sw.js");
      try {
        let sw = readFileSync(swPath, "utf-8");
        const hash = createHash("md5")
          .update(Date.now().toString())
          .digest("hex")
          .slice(0, 8);
        sw = sw.replace("__BUILD_HASH__", hash);
        writeFileSync(swPath, sw);
      } catch {
        // sw.js may not exist if public/ wasn't copied — safe to skip
      }
    },
  };
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), swVersionStamp()],
  build: {
    // Content-hash filenames for all JS/CSS chunks (Vite default, made explicit)
    rollupOptions: {
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["app.54link-dev.upi.dev"],
  },
});
