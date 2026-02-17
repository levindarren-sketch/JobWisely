import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This is CRITICAL. It prevents the build from failing when it sees
  // the 'canvas' or 'test' folder inside pdf-parse.
  serverExternalPackages: ["pdf-parse"],
  
  // Strict mode helps catch double-render bugs in dev
  reactStrictMode: true,
};

export default nextConfig;