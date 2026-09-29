import path from "node:path";

import type { NextConfig } from "next";

const SUPABASE_CONNECT = "https://*.supabase.co wss://*.supabase.co";

const csp = [
  "default-src 'self'",
  // Next.js injects inline bootstrap scripts; three.js/WebGL needs no extra source.
  "script-src 'self' 'unsafe-inline'",
  "style-src 'self' 'unsafe-inline'",
  "font-src 'self' data:",
  "img-src 'self' data: blob:",
  `connect-src 'self' ${SUPABASE_CONNECT}`,
  "worker-src 'self' blob:",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains",
  },
  {
    key: "Permissions-Policy",
    value: "camera=(), microphone=(), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // Pin the tracing root to this project so stray lockfiles elsewhere on the
  // machine cannot change what gets bundled.
  outputFileTracingRoot: path.join(process.cwd()),
  eslint: {
    // Lint is run explicitly via `npm run lint`; keep builds focused on types.
    ignoreDuringBuilds: true,
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
