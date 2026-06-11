import path from 'path';
import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  basePath: '/nav',
  assetPrefix: '/nav/',
  trailingSlash: true,
  reactStrictMode: true,
  turbopack: { root: path.resolve('../..') },
};

export default nextConfig;
