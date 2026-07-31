import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  webpack: (config, { isServer }) => {
    // Stub out packages that are browser-only or unused on the server
    config.resolve.alias = {
      ...config.resolve.alias,
      '@stripe/crypto': false,
      '@stripe/stripe-js': false,
      '@farcaster/mini-app-solana': false,
      '@farcaster/miniapp-sdk': false,
      '@solana-program/memo': false,
      'diagnostics_channel': path.resolve(__dirname, 'diagnostics_channel_mock.js'),
      'node:diagnostics_channel': path.resolve(__dirname, 'diagnostics_channel_mock.js'),
    };

    if (isServer) {
      // Force `diagnostics_channel` (both bare and `node:` prefixed) to resolve
      // to the native Node.js built-in so webpack never bundles old copies from
      // lru-cache (inside unstorage) or pino that call tracingChannel.
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];

      config.externals = [
        ...existingExternals,
        // Removed server-side externals function since we are mocking it globally
      ];
    }

    return config;
  },
};

export default nextConfig;
