import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  base: "./",
  plugins: [react(), tailwindcss()],
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
          if (/[\\/]node_modules[\\/](?:react|react-dom|scheduler)[\\/]/.test(id)) return "vendor-react";
          if (/[\\/]node_modules[\\/](?:motion|motion-dom|motion-utils|framer-motion)[\\/]/.test(id)) return "vendor-motion";
          if (id.includes("lucide-react")) return "vendor-icons";
          return undefined;
        }
      }
    }
  },
  optimizeDeps: {
    include: ["react", "react-dom", "lucide-react", "motion"]
  }
});

