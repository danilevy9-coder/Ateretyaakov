/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export', // <--- Magic Ingredient #1: Tells Next.js to build a static site
  images: {
    unoptimized: true, // <--- Magic Ingredient #2: Required for static exports
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'img.youtube.com',
      },
      {
        protocol: 'https',
        hostname: 'i.imgur.com',
      },
    ],
    formats: ['image/avif', 'image/webp'],
  },
  experimental: {
    optimizePackageImports: ['framer-motion', 'gsap'],
  },
};

module.exports = nextConfig;