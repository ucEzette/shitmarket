import dotenv from 'dotenv';
dotenv.config();

function required(key: string): string {
  const val = process.env[key];
  if (!val) throw new Error(`Missing required env var: ${key}`);
  return val;
}

function optional(key: string, fallback: string): string {
  return process.env[key] ?? fallback;
}

export const config = {
  coreChain: optional('CORE_CHAIN', 'solana'),
  solana: {
    rpcUrl: optional('SOLANA_RPC_URL', 'https://api.devnet.solana.com'),
    secondaryRpcUrl: optional('SOLANA_SECONDARY_RPC_URL', ''),
    wsUrl: optional('SOLANA_WS_URL', 'wss://api.devnet.solana.com'),
    programId: optional('PROGRAM_ID', ''),
    keeperPrivateKey: optional('KEEPER_PRIVATE_KEY', ''),
    relayerPrivateKey: optional('RELAYER_PRIVATE_KEY', ''),
    aiOraclePrivateKey: optional('AI_ORACLE_PRIVATE_KEY', ''),
  },
  evm: {
    rpcUrl: optional('AVALANCHE_RPC_URL', 'https://api.avax-test.network/ext/bc/C/rpc'),
    contractAddress: optional('CORE_CONTRACT_ADDRESS', '0x0000000000000000000000000000000000000000'),
    keeperPrivateKey: optional('EVM_KEEPER_PRIVATE_KEY', ''),
  },
  db: {
    url: required('DATABASE_URL'),
    replicaUrl: optional('DATABASE_REPLICA_URL', ''),
  },
  redis: {
    url: optional('REDIS_URL', 'redis://localhost:6379'),
  },
  api: {
    restPort: parseInt(optional('PORT', optional('REST_API_PORT', '3001')), 10),
    wsPort: parseInt(optional('WS_PORT', '3002'), 10),
  },
  external: {
    dexscreenerUrl: optional('DEXSCREENER_API_URL', 'https://api.dexscreener.com/latest/dex'),
    birdeyeApiKey: optional('BIRDEYE_API_KEY', ''),
    pythRestUrl: optional('PYTH_REST_URL', 'https://hermes.pyth.network'),
    jupiterPriceUrl: optional('JUPITER_PRICE_API_URL', 'https://api.jup.ag/price/v2'),
  },
  pythFeedMapping: JSON.parse(optional('PYTH_FEED_MAPPING', '{}')),
  switchboardFeedMapping: JSON.parse(optional('SWITCHBOARD_FEED_MAPPING', '{}')),
  chainlinkFeedMapping: JSON.parse(optional('CHAINLINK_FEED_MAPPING', '{}')),
  log: {
    level: optional('LOG_LEVEL', 'info'),
  },
  nodeEnv: optional('NODE_ENV', 'development'),
  validation: {
    minimumMarketCap: parseInt(optional('MINIMUM_MARKET_CAP', '50000'), 10),
    minimumTokenAgeMinutes: parseInt(optional('MINIMUM_TOKEN_AGE_MINUTES', '30'), 10),
  }
};
