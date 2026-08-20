import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";

function getCerts() {
  const home = process.env.USERPROFILE || process.env.HOME || os.homedir();
  const certPath = path.join(home, ".0xagent", "certs", "cert.pem");
  const keyPath = path.join(home, ".0xagent", "certs", "key.pem");

  try {
    if (fs.existsSync(certPath) && fs.existsSync(keyPath)) {
      const cert = fs.readFileSync(certPath, "utf-8");
      const key = fs.readFileSync(keyPath, "utf-8");
      if (cert.trim() && key.trim()) {
        return { cert, key };
      }
    }
  } catch {}
  return null;
}

// https://vite.dev/config/
export default defineConfig(() => {
  const useHttps = process.env.DISABLE_HTTPS !== 'true';
  const clientPort = Number(process.env.CLIENT_PORT || 5173);

  return {
    plugins: [
      react(),
      tailwindcss(),
      ...(useHttps ? [basicSsl({ domains: ['192.168.4.24', '198.18.0.1', 'localhost', '127.0.0.1'] })] : []),
    ],
    clearScreen: false,
    server: {
      port: clientPort,
      strictPort: false,
      host: "0.0.0.0", // Bind to all interfaces for local Wi-Fi network sharing
      https: useHttps,
      proxy: {
        "/api": {
          target: useHttps ? "https://127.0.0.1:3001" : "http://127.0.0.1:3001",
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.removeAllListeners('error');
            proxy.on('error', (_err, _req, res) => {
              if (res && 'writeHead' in res && !(res as any).headersSent) {
                try {
                  (res as any).writeHead(503, { 'Content-Type': 'application/json' });
                  (res as any).end(JSON.stringify({ error: 'Server initializing, retry shortly...' }));
                } catch {}
              }
            });
          },
        },
        "/ws": {
          target: useHttps ? "wss://127.0.0.1:3001" : "ws://127.0.0.1:3001",
          ws: true,
          changeOrigin: true,
          secure: false,
          configure: (proxy) => {
            proxy.removeAllListeners('error');
            proxy.on('error', () => {});
          },
        },
      },
    },
    build: {
      chunkSizeWarningLimit: 600,
      rollupOptions: {
        output: {
          manualChunks(id) {
            const norm = id.replace(/\\/g, '/');
            if (norm.includes('/node_modules/')) {
              if (norm.includes('/react/') || norm.includes('/react-dom/')) {
                return 'vendor-react';
              }
              if (norm.includes('/marked/')) {
                return 'vendor-marked';
              }
              if (norm.includes('/lucide-react/')) {
                return 'vendor-icons';
              }
              return 'vendor-libs';
            }
          },
        },
      },
    },
  };
});
