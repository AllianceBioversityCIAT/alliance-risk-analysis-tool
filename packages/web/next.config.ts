import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  output: 'export',

  images: {
    unoptimized: true,
  },

  reactStrictMode: true,
  experimental: {
    optimizePackageImports: [
      'lucide-react',
      'class-variance-authority',
      '@radix-ui/react-icons',
    ],
  },
};

export default nextConfig;
