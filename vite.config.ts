import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  base: "./",
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: "es2022",
    sourcemap: false,
    cssCodeSplit: true,
    modulePreload: {
      polyfill: false
    },
    chunkSizeWarningLimit: 950,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return undefined;
          if (id.includes("react") || id.includes("react-dom")) return "vendor-react";
          if (id.includes("motion")) return "vendor-motion";
          if (id.includes("lucide-react") || id.includes("@animateicons")) return "vendor-icons";
          if (id.includes("posthog-js")) return "vendor-analytics";
          if (id.includes("fast-average-color")) return "vendor-cover-tools";
          return "vendor";
        }
      }
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react", "motion"],
    exclude: ["posthog-js"]
  }
});

