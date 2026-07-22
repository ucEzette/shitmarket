/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false,
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    // Next.js 14: keep heavy packages as native Node.js requires on the server
    // so webpack doesn't bundle their diagnostics_channel internals that lack
    // tracingChannel (causing prerender failures on all pages).
    serverComponentsExternalPackages: [
      '@solana/web3.js',
      '@coral-xyz/anchor',
      '@solana/wallet-adapter-base',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      '@solana/wallet-adapter-wallets',
      '@solana-mobile/wallet-adapter-mobile',
      '@solana-program/memo',
      'unstorage',
      'pino',
      'pino-pretty',
      'undici',
    ],
  },
  webpack: (config, { isServer }) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      '@stripe/crypto': false,
      '@stripe/stripe-js': false,
      '@farcaster/mini-app-solana': false,
      '@farcaster/miniapp-sdk': false,
      '@solana-program/memo': false,
    };

    if (isServer) {
      // Force BOTH `diagnostics_channel` and `node:diagnostics_channel` to resolve
      // to the native Node.js module so webpack never bundles the old copies from
      // lru-cache (inside unstorage) or pino (inside @privy-io/react-auth /
      // @walletconnect) that call tracingChannel without it being available.
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];

      config.externals = [
        ...existingExternals,
        ({ request }, callback) => {
          if (
            request === 'diagnostics_channel' ||
            request === 'node:diagnostics_channel'
          ) {
            return callback(null, 'commonjs diagnostics_channel');
          }
          callback();
        },
      ];
    }

    return config;
  },
};

export default nextConfig;
