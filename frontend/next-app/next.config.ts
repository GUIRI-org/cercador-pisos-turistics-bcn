import type { NextConfig } from "next";
import { readFileSync } from "node:fs";

const { version } = JSON.parse(readFileSync("./package.json", "utf-8")) as { version: string };

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

// Also allow the nginx-proxied dev domain (e.g. next.guiripisos.local),
// otherwise the HMR websocket upgrade is rejected as a cross-origin request.
const allowedDevOrigins = ['127.0.0.1', 'localhost'];
if (process.env.MAIN_DOMAIN) {
  allowedDevOrigins.push(`next.${process.env.MAIN_DOMAIN}`);
}

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath,
  // Inlined at build time (and read at runtime by `next dev`); consumed by app/layout.tsx
  env: {
    NEXT_PUBLIC_APP_VERSION: version,
  },
  sassOptions: {
    quietDeps: true,
  },
  // Allow cross-origin requests from localhost/127.0.0.1 in development
  // (required when accessing containerized dev server from host)
  allowedDevOrigins,
};

export default nextConfig;
