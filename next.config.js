/** @type {import('next').NextConfig} */
const nextConfig = {
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
