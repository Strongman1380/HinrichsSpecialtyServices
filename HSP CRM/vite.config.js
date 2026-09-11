import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => ({
  plugins: [react()],
  base: mode === "hostinger" ? "/crm/" : "/",
  publicDir: mode === "hostinger" ? false : undefined,
  build: mode === "hostinger" ? { outDir: "../dist/crm", emptyOutDir: true } : undefined,
}));
