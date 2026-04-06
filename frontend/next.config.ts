import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Increase body size limit for image uploads (OCR)
  serverExternalPackages: [],
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
};

export default nextConfig;
