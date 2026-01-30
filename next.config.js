/** @type {import('next').NextConfig} */
const nextConfig = {
  // Mode standalone pour Docker
  output: 'standalone',

  // Configuration pour les images externes (Instagram, etc.)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '**.cdninstagram.com',
      },
      {
        protocol: 'https',
        hostname: '**.fbcdn.net',
      },
    ],
  },
}

module.exports = nextConfig
