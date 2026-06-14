import type { NextConfig } from "next";

const agentexAPIBaseURL =
  process.env.NEXT_PUBLIC_AGENTEX_API_BASE_URL ?? "http://localhost:5003";

const nextConfig: NextConfig = {
  async rewrites() {
    return [
      // Proxy Agentex API calls (tasks, messages, agents) — avoids CORS
      {
        source: "/api/agentex/:path*",
        destination: `${agentexAPIBaseURL}/:path*`,
      },
    ];
  },
};

export default nextConfig;
