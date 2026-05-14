import type { NextConfig } from 'next';

const config: NextConfig = {
  reactStrictMode: true,
  // Permite hot reload encontrar arquivos no monorepo
  outputFileTracingRoot: process.cwd() + '/../..',
};

export default config;
