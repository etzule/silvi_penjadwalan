import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Empty turbopack config to silence warning
  turbopack: {},

  // Set the workspace root to silence multiple lockfiles warning
  outputFileTracingRoot: __dirname,

  webpack: (config, { isServer }) => {
    if (isServer) {
      // Externalize packages that cause issues with Next.js bundling
      config.externals = config.externals || [];
      config.externals.push({
        'jimp': 'commonjs jimp',
        'sharp': 'commonjs sharp',
        '@whiskeysockets/baileys': 'commonjs @whiskeysockets/baileys'
      });
    }
    return config;
  },
};

export default nextConfig;
