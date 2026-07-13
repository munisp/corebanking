import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react({
      babel: {
        plugins: ['babel-plugin-react-compiler'],
      },
    }), tailwindcss()],
  resolve: {
    dedupe: ["lodash-es"],
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
      "dagre-d3-es/node_modules/lodash-es": path.resolve(
        import.meta.dirname,
        "node_modules/lodash-es",
      ),
    },
  },
  build: {
  target: "esnext",

  minify: "esbuild",

  cssMinify: true,

  sourcemap: false,

  rollupOptions: {
    output: {
      manualChunks(id) {
        if (id.includes("node_modules")) {
          return id
            .toString()
            .split("node_modules/")[1]
            .split("/")[0]
            .toString();
        }
      },
    },
  },
},
  optimizeDeps: {
    include: ["lodash-es"],
  },
  server: {
    host: true,
    allowedHosts: ["tenant.54link-dev.upi.dev","bpmgd.54link-dev.upi.dev"],
  },
});
