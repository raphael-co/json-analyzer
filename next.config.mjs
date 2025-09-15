/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },
  reactStrictMode: true,
};

export default nextConfig;
