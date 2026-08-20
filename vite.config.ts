import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), basicSsl()],
  clearScreen: false,
  server: {
    port: 5173,
    strictPort: false,
    host: "0.0.0.0", // Bind to all interfaces for local Wi-Fi network sharing
    proxy: {
      "/api": {
        target: "http://127.0.0.1:3001",
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Suppress noisy connection reset logs during restarts
          });
        },
      },
      "/ws": {
        target: "ws://127.0.0.1:3001",
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            // Suppress noisy ws connection drop logs during restarts
          });
        },
      },
    },
  },
});
