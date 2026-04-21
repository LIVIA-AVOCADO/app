import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ['mercadopago'],
  async redirects() {
    return [
      {
        source: '/livechat',
        destination: '/inbox',
        permanent: true,
      },
      {
        source: '/livechat/:path*',
        destination: '/inbox/:path*',
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
