/** @type {import('next').NextConfig} */

// Derive the Supabase storage hostname from the public URL so next/image can
// optimise avatars and receipts that live in Supabase Storage.
const supabaseHost = (() => {
  try {
    return process.env.NEXT_PUBLIC_SUPABASE_URL
      ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
      : 'localhost';
  } catch {
    return 'localhost';
  }
})();

const isProd = process.env.NODE_ENV === 'production';

const securityHeaders = [
  // HSTS is only sent in production: on http://localhost it would pin the browser to https.
  ...(isProd
    ? [{ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }]
    : []),
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  {
    key: 'Permissions-Policy',
    // Geolocation is required for pickup detection + live tracking.
    value: 'camera=(), microphone=(), geolocation=(self), payment=(self)',
  },
];

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'img.clerk.com' },
      { protocol: 'https', hostname: 'images.clerk.dev' },
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
      { protocol: 'https', hostname: 'avatars.githubusercontent.com' },
      { protocol: 'https', hostname: 'maps.googleapis.com' },
      { protocol: 'https', hostname: 'images.unsplash.com' },
      { protocol: 'https', hostname: supabaseHost },
    ],
  },
  experimental: {
    // Tree-shake heavy icon / animation / chart packages.
    optimizePackageImports: ['lucide-react', 'framer-motion', 'recharts', 'date-fns'],
    serverComponentsExternalPackages: ['stripe', 'nodemailer'],
  },
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
  eslint: {
    ignoreDuringBuilds: false,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
};

module.exports = nextConfig;
