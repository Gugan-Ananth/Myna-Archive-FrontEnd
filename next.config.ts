import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Homepage pins use a Bunny edge loader (see archive-card); keep modern
    // formats for any default-loader remote images.
    formats: ["image/webp", "image/avif"],
    // Next.js 16 only allows the default quality of 75 unless explicitly
    // configured. The archive cards use 72 to keep dashboard images light.
    qualities: [72, 75],
    // Grid columns are ~20–50vw — smaller breakpoints cut wasted bytes.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [96, 128, 256, 320, 384, 480, 640],
    // Optimized (or CDN) thumbs are immutable enough to cache longer.
    minimumCacheTTL: 60 * 60 * 24 * 7, // 7 days
    remotePatterns: [
      {
        protocol: "https",
        hostname: "picsum.photos",
        pathname: "/**",
      },
      // Bunny Pull Zone / Stream CDN (*.b-cdn.net)
      {
        protocol: "https",
        hostname: "*.b-cdn.net",
        pathname: "/**",
      },
      {
        protocol: "https",
        hostname: "b-cdn.net",
        pathname: "/**",
      },
    ],
  },
};

export default nextConfig;
