import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || '';

const nextConfig: NextConfig = {
  output: 'export',
  basePath,
  assetPrefix: basePath,
  sassOptions: {
    quietDeps: true,
  },
  // Allow cross-origin requests from localhost/127.0.0.1 in development
  // (required when accessing containerized dev server from host)
  allowedDevOrigins: ['127.0.0.1', 'localhost'],
};

export default nextConfig;
