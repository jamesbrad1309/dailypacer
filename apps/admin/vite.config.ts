import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

// The admin dashboard: the web app's stack (see docs/admin/overview.md), on
// its own port so both can run side by side.
export default defineConfig({
  plugins: [
    // Must come before react(): it generates src/routeTree.gen.ts from src/routes/.
    tanstackRouter({ target: "react", autoCodeSplitting: true }),
    react(),
    tailwindcss(),
  ],
  server: {
    // IPv4 loopback only, like apps/web: no sign-in yet, so keep it off the LAN.
    host: "127.0.0.1",
    port: 5174,
    strictPort: true,
    proxy: {
      // apps/bff — same GraphQL endpoint the web app uses.
      "/graphql": process.env.BFF_URL ?? "http://localhost:4000",
    },
  },
});
