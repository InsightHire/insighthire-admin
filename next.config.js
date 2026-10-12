/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    // Force all pages to be dynamic (no static generation)
    isrMemoryCacheSize: 0,
  },
  typescript: {
    ignoreBuildErrors: true, // Skip TS errors during build
  },
  swcMinify: false, // Disable SWC minifier if causing issues
  eslint: {
    ignoreDuringBuilds: true,
  },
  // These have moved out of experimental in Next.js 14
  skipTrailingSlashRedirect: true,
  skipMiddlewareUrlNormalize: true,
  images: {
    domains: [
      'localhost',
      'talentscreen.ai',
      's3.amazonaws.com',
      'cdn.insighthire.com',
    ],
  },
  env: {
    CUSTOM_KEY: process.env.CUSTOM_KEY,
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL,
    NEXT_PUBLIC_WORKOS_CLIENT_ID: process.env.NEXT_PUBLIC_WORKOS_CLIENT_ID,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
          { key: 'Content-Security-Policy', value: "frame-ancestors 'self'" },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ];
  },
  transpilePackages: ['@talentscreen/types', '@talentscreen/ui'],
  async redirects() {
    return [
      {
        source: '/admin/personas/heygen-catalog',
        destination: '/admin/personas/avatar-library',
        permanent: true,
      },
    ];
  },
};

module.exports = nextConfig;
