import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
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
