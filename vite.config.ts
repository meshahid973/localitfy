import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

function shouldIgnoreWatchPath(watchPath: string) {
  const normalized = watchPath.replace(/\\/g, "/");
  return (
    normalized.endsWith("/src-tauri") ||
    normalized.includes("/src-tauri/") ||
    normalized.includes("/.tauri-target/")
  );
}

export default defineConfig({
  base: "./",
  plugins: [react()],
  clearScreen: false,
  envPrefix: ["VITE_", "TAURI_ENV_"],
  server: {
    host: "127.0.0.1",
    port: 5173,
    strictPort: true,
    watch: {
      ignored: shouldIgnoreWatchPath
    }
  },
  build: {
    outDir: "dist",
    emptyOutDir: true,
    target: process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari13",
    minify: process.env.TAURI_ENV_DEBUG ? false : "esbuild",
    sourcemap: Boolean(process.env.TAURI_ENV_DEBUG),
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