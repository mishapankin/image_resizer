import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === "production";

const nextConfig: NextConfig = {
  basePath: isProd ? "/image_resizer" : "",
  assetPrefix: isProd ? "/image_resizer/" : "",
  output: "export",
};

export default nextConfig;
