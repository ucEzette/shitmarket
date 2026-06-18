import diagnostics_channel from 'node:diagnostics_channel';

if (!diagnostics_channel.tracingChannel) {
  diagnostics_channel.tracingChannel = (name) => {
    return {
      name,
      subscribe: () => {},
      unsubscribe: () => {},
      tracePromise: (fn, context, ...args) => fn(...args),
      traceSync: (fn, context, ...args) => fn(...args),
      traceCallback: (fn, position, context, ...args) => fn(...args),
      hasSubscribers: false,
    };
  };
}

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
    config.resolve.alias = {
      ...config.resolve.alias,
      '@stripe/crypto': false,
      '@stripe/stripe-js': false,
      '@farcaster/mini-app-solana': false,
      '@farcaster/miniapp-sdk': false,
      '@solana-program/memo': false,
    };
    return config;
  }
};

export default nextConfig;
