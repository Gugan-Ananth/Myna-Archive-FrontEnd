import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    // Homepage cards go through next/image → prefer modern formats for speed.
    // Detail view uses a native <img> with the original jpg/png (not this pipeline).
    formats: ["image/webp", "image/avif"],
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
