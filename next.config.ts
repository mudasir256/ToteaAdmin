import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    root: process.cwd(),
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "to-tea.vercel.app",
        pathname: "/assets/**",
      },
      {
        protocol: "https",
        hostname: "ypxjfnizqvishmgijjzg.supabase.co",
        pathname: "/storage/v1/object/public/menu-images/**",
      },
    ],
  },
};

export default nextConfig;
