import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: ["10.69.188.52", "192.168.1.100"],
    },
  },
};

export default nextConfig;
