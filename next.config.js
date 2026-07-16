/** @type {import('next').NextConfig} */
const contentSecurityPolicy = `
  default-src 'self';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
  frame-src 'none';
  object-src 'none';
  script-src 'self' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' data: https://fonts.gstatic.com;
  img-src 'self' data: blob:;
  connect-src 'self' https://*.supabase.co wss://*.supabase.co https://*.railway.app;
  manifest-src 'self';
  worker-src 'self' blob:;
  upgrade-insecure-requests;
`.replace(/\s{2,}/g, ' ').trim()

const securityHeaders = [
  {
    key: 'Content-Security-Policy-Report-Only',
    value: contentSecurityPolicy,
  },
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'accelerometer=(), browsing-topics=(), camera=(), fullscreen=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  },
]

const nextConfig = {
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      {
        source: '/reports/geopilot/:path*',
        headers: [
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Robots-Tag', value: 'noindex, nofollow, noarchive' },
          { key: 'Cache-Control', value: 'private, no-store' },
        ],
      },
    ]
  },
  async redirects() {
    return [
      // Keep old subdomain URLs working during transition
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'faq.copypilot.app' }],
        destination: 'https://copypilot.app/faq/:path*',
        permanent: true,
      },
      {
        source: '/:path*',
        has: [{ type: 'host', value: 'intro.copypilot.app' }],
        destination: 'https://copypilot.app/intro/:path*',
        permanent: true,
      },
    ]
  },
}
module.exports = nextConfig
