import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  // experimental: {
  //   instrumentationHook: true,
  // }
  experimental: {
    serverComponentsExternalPackages: [
      "puppeteer-extra",
      "puppeteer-extra-plugin-stealth",
      "puppeteer-extra-plugin-recaptcha",
    ],
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  eslint: {
    ignoreDuringBuilds: true,
  },
  // env: {
  //   NEXT_PUBLIC_DOMAIN: "http://localhost:3000",
  // },
  images: {
    remotePatterns: [
      { hostname: "imgcld.yatra.com" },
      { hostname: "content.r9cdn.net" },
    ],
  },
};

export default nextConfig;
