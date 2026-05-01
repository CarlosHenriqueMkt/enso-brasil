import type { NextConfig } from "next";

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  typedRoutes: true,
  // D-03 (P2 CONTEXT) — pino + Next 16 Turbopack bundling fix
  // (vercel/next.js#86099, vercel/next.js#84766)
  serverExternalPackages: ["pino", "pino-pretty", "thread-stream", "real-require"],
};

export default config;
