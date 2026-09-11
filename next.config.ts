import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sharp", "satori"],
  // sharp 0.35+ native libvips files are often dropped from the Vercel
  // serverless trace (Turbopack). Pin the linux binaries into the two
  // routes that import sharp, plus caption fonts read from disk at runtime.
  outputFileTracingIncludes: {
    "/api/caption/render": [
      "./app/lib/caption/fonts/**/*",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/media/thumb": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  images: {
    // Grid pins use the default optimizer (Bunny Optimizer is not enabled on
    // the pull zone). Keep modern formats for those resized thumbs.
    formats: ["image/webp", "image/avif"],
    // Next.js 16 only allows the default quality of 75 unless explicitly
    // configured. Grid / filmstrip / detail-preview thumbs use 40.
    qualities: [40, 60, 72, 75],
    // Grid columns are ~16–50vw — smaller breakpoints cut wasted bytes.
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [96, 128, 192, 256, 320, 384, 480, 640],
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
