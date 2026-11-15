import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import packageJson from "./package.json";

export default defineConfig(({ mode }) => ({
  base: loadEnv(mode, ".", "VITE_").VITE_BASE_PATH || "/",
  define: {
    __APP_VERSION__: JSON.stringify(packageJson.version)
  },
  plugins: [react()]
}));
