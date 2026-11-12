import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api se redirige al backend FastAPI (puerto 8000), así no hay problemas de CORS
export default defineConfig({
  plugins: [react()],
  // allowedHosts: permite abrir la app por un túnel de Cloudflare (https://xxxx.trycloudflare.com) para la demo
  server: { proxy: { "/api": "http://localhost:8000" }, allowedHosts: [".trycloudflare.com"] },
});
