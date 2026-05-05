import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  transpilePackages: ['@vera/types', '@vera/ui', '@vera/domain', '@vera/utils'],
};

export default nextConfig;
