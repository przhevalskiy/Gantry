import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/v1": {
        target: process.env.VITE_GANTRY_API_URL || "http://localhost:8001",
        changeOrigin: true,
      },
      "/health": {
        target: process.env.VITE_GANTRY_API_URL || "http://localhost:8001",
        changeOrigin: true,
      },
    },
  },
});
