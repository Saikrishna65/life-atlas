import type { NextConfig } from "next";

const isExport = process.env.NEXT_EXPORT === "true";

const nextConfig: NextConfig = {
  ...(isExport ? { output: "export" } : {}),
  serverExternalPackages: ["@distube/ytdl-core", "youtubei.js", "undici"],
  images: {
    unoptimized: isExport,
    qualities: [75, 90],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: '**.neon.tech',
      },
    ],
  },
};

export default nextConfig;
