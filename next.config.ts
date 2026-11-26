import type { NextConfig } from 'next';
const config: NextConfig = {
  poweredByHeader: false,
  async headers() { return [{ source: '/(.*)', headers: [
    { key: 'X-Content-Type-Options', value: 'nosniff' },
    { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    { key: 'X-Frame-Options', value: 'DENY' },
    { key: 'Content-Security-Policy', value: "base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'" },
    { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' }
  ]}, {source:'/api/:path*',headers:[{key:'Cache-Control',value:'private, no-store, max-age=0'}]}, {source:'/auth/:path*',headers:[{key:'Cache-Control',value:'private, no-store, max-age=0'}]}]; }
};
export default config;
