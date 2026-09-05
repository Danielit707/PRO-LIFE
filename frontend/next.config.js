/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ["pdbe-molstar", "molstar"],
  async rewrites() {
    const api = process.env.API_PROXY_URL || "http://localhost:8000";
    return [
      {
        source: "/api/:path*",
        destination: `${api}/api/:path*`,
      },
    ];
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...(config.resolve.fallback || {}),
      fs: false,
      path: false,
      crypto: false,
    };
    return config;
  },
};

module.exports = nextConfig;
