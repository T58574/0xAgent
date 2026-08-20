import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function loadSharedCerts() {
  const home = os.homedir();
  const certPath = path.join(home, ".0xagent", "certs", "cert.pem");
  const keyPath = path.join(home, ".0xagent", "certs", "key.pem");
  if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
    try {
      const cert = fs.readFileSync(certPath, "utf-8");
      const key = fs.readFileSync(keyPath, "utf-8");
      if (cert.trim() && key.trim()) {
        return { cert, key };
      }
    } catch {}
  }
  return null;
}

const certs = loadSharedCerts();
const isHttps = Boolean(certs && process.env.DISABLE_HTTPS !== 'true');

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,
    host: "0.0.0.0", // Bind to all interfaces for local Wi-Fi network sharing
    https: isHttps && certs ? { cert: certs.cert, key: certs.key } : false,
    proxy: {
      "/api": {
        target: isHttps ? "https://127.0.0.1:3001" : "http://127.0.0.1:3001",
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
      "/ws": {
        target: isHttps ? "wss://127.0.0.1:3001" : "ws://127.0.0.1:3001",
        ws: true,
        changeOrigin: true,
        secure: false,
        configure: (proxy) => {
          proxy.on('error', () => {});
        },
      },
    },
  },
});
