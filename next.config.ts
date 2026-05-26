import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  async redirects() {
    // v3.0: capital-flow and watchlist merged into /entity; audit merged into /settings
    return [
      { source: "/capital-flow", destination: "/entity", permanent: true },
      { source: "/watchlist",    destination: "/entity", permanent: true },
      { source: "/audit",        destination: "/settings", permanent: true }
    ];
  }
};

export default nextConfig;
