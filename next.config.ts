import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["127.0.0.1"],
  serverExternalPackages: ["pdfkit", "subset-font"],
  outputFileTracingIncludes: {
    "/api/export/*": ["./public/fonts/NotoSansCJKsc-Regular.otf"],
  },
};

export default nextConfig;
