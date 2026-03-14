import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  devIndicators: {
    position: "bottom-right",
  },
  experimental: {
    serverComponentsExternalPackages: [],
  },
  serverRuntimeConfig: {
    timeout: 100000, // 100 seconds in milliseconds
  },
};

export default nextConfig;
