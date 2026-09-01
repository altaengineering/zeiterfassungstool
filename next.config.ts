import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Stellt sicher, dass die Excel-Vorlage (per fs.readFile zur Laufzeit gelesen, siehe
  // src/lib/export/exportExcel.ts) auch im Vercel-Serverless-Bundle enthalten ist.
  outputFileTracingIncludes: {
    "/api/export/**": ["./src/lib/export/template-2026.xlsx"],
  },
};

export default nextConfig;
