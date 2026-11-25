import type { CapacitorConfig } from "@capacitor/cli";

/**
 * De mobiele MagisterPro-shell laadt de live webapp. Daardoor blijven alle
 * API-routes (inclusief de Magister-tokenuitwisseling) op dezelfde origin.
 * Zet MAGISTERPRO_URL op http://localhost:3000 voor een lokale build.
 */
const config: CapacitorConfig = {
  appId: "dev.magisterpro.app",
  appName: "MagisterPro",
  // De shell laadt de live webapp via server.url; deze map bestaat alleen
  // zodat `cap sync` lokale assets (manifest/service worker) kan meenemen.
  webDir: "public",
  server: {
    url: process.env.MAGISTERPRO_URL?.trim() || "https://magisterpro.vercel.app",
    cleartext: false,
  },
  plugins: {
    Browser: {},
  },
};

export default config;
