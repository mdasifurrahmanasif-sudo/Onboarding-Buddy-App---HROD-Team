import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Inlined at build: the runtime image gets no .env files. Only referenced
  // from server-only lib/push.ts, so the private key never reaches the browser.
  env: {
    VAPID_PUBLIC_KEY: process.env.VAPID_PUBLIC_KEY ?? "",
    VAPID_PRIVATE_KEY: process.env.VAPID_PRIVATE_KEY ?? "",
    VAPID_SUBJECT: process.env.VAPID_SUBJECT ?? "",
  },
  experimental: {
    // Lets the client Router Cache reuse an already-visited tab's RSC payload
    // for 30s instead of always re-fetching from the server — the bottom-nav
    // tabs (Home/Journey/Team/Profile) are exactly this kind of quick back-
    // and-forth navigation, so this is what makes revisits feel instant.
    staleTimes: {
      dynamic: 30,
      static: 180,
    },
  },
};

export default nextConfig;
