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
    // Next.js 14: keep heavy Solana/web3 packages as native Node.js requires
    // on the server so webpack doesn't bundle their stale diagnostics_channel
    // internals that lack tracingChannel (causing prerender failures).
    serverComponentsExternalPackages: [
      '@solana/web3.js',
      '@coral-xyz/anchor',
      '@solana/wallet-adapter-base',
      '@solana/wallet-adapter-react',
      '@solana/wallet-adapter-react-ui',
      '@solana/wallet-adapter-wallets',
      '@solana-mobile/wallet-adapter-mobile',
      '@solana-program/memo',
      'undici',
      'pino',
      'pino-pretty',
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

    // Force diagnostics_channel to the native Node.js module on the server
    // so any remaining bundled code doesn't use an old polyfilled copy.
    if (isServer) {
      const existingExternals = Array.isArray(config.externals)
        ? config.externals
        : config.externals
        ? [config.externals]
        : [];
      config.externals = [
        ...existingExternals,
        ({ request }, callback) => {
          if (request === 'diagnostics_channel') {
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
