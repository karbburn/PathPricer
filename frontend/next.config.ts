import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://sourabhpradhan.in https://www.sourabhpradhan.in http://localhost:* https://*.vercel.app;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
