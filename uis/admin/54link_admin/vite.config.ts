import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import path from "path";
import { defineConfig } from "vite";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id: string) {
          if (!id.includes("node_modules")) return undefined;
          if (/node_modules[\\/](react|react-dom|react-router-dom|react-router|wouter)[\\/]/.test(id)) return "vendor-react";
          if (id.includes("node_modules/@radix-ui")) return "vendor-radix";
          if (id.includes("node_modules/@tanstack")) return "vendor-query";
          if (/node_modules[\\/](recharts|d3-[^\\/]+|victory-vendor)[\\/]/.test(id)) return "vendor-charts";
          if (/node_modules[\\/](jspdf|jspdf-autotable|xlsx)[\\/]/.test(id)) return "vendor-export";
          return "vendor";
        },
      },
    },
  },
  server: {
    host: true,
    allowedHosts: ["admin.54link-dev.upi.dev","54link-dev.upi.dev"],
  },
});
