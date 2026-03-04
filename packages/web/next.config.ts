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

  webpack: (config) => {
    // pdfjs-dist optionally depends on `canvas` (Node native module) — not needed in browser
    config.resolve.alias.canvas = false;
    return config;
  },
};

export default nextConfig;
