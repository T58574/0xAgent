import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
// https://vite.dev/config/
export default defineConfig({
    plugins: [react(), tailwindcss()],
    clearScreen: false,
    server: {
        port: 5173,
        strictPort: false,
        host: "0.0.0.0", // Bind to all interfaces for local Wi-Fi network sharing
        proxy: {
            "/api": {
                target: "http://127.0.0.1:3001",
                changeOrigin: true,
            },
            "/ws": {
                target: "ws://127.0.0.1:3001",
                ws: true,
            },
        },
    },
});
