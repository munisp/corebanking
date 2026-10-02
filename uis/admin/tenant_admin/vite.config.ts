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
      // Curated vendor groups instead of one chunk per package — per-package
      // splitting produced 100s of tiny chunks (request overhead, no shared cache).
      manualChunks(id: string) {
        if (!id.includes("node_modules")) return undefined;
        if (/node_modules[\\/](react|react-dom|wouter)[\\/]/.test(id)) return "vendor-react";
        if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
        if (id.includes("node_modules/@tanstack")) return "vendor-query";
        if (/node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return "vendor-charts";
        if (/node_modules[\\/](jspdf|jspdf-autotable|xlsx)[\\/]/.test(id)) return "vendor-export";
        return "vendor";
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
