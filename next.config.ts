import type { NextConfig } from 'next';
const config: NextConfig = {
  devIndicators: false,
  env: {
    NEXT_PUBLIC_DEMO_ONLY:
      process.env.NEXT_PUBLIC_DEMO_ONLY ?? (process.env.VERCEL ? 'true' : 'false'),
    NEXT_PUBLIC_MAX_REQUEST_BYTES:
      process.env.NEXT_PUBLIC_MAX_REQUEST_BYTES ?? (process.env.VERCEL ? '4400000' : '18000000'),
  },
  poweredByHeader: false,
  serverExternalPackages: ['unpdf', '@pdf-lib/fontkit'],
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(self), microphone=(self), geolocation=()' },
        ],
      },
      { source: '/api/(.*)', headers: [{ key: 'Cache-Control', value: 'no-store' }] },
    ];
  },
};
export default config;
