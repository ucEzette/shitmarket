/**
 * priceAggregator.ts
 *
 * Off-chain TWAP aggregator. Fetches prices from multiple sources
 * (DexScreener, Birdeye, Pyth REST, Jupiter) and returns the median as
 * an i64 (USD × 1_000_000).
 *
 * Phase 3.1: Added Jupiter price API as a 4th source.
 * Phase 3.2: Added TWAP computation over historical price observations.
 *
 * The keeper calls this before submitting settle_room on-chain. When a
 * Pyth feed ID is available for the token, Pyth is included alongside the
 * off-chain sources for a stronger meme-coin price signal.
 */

import axios from 'axios';
import { PublicKey, Connection } from '@solana/web3.js';
import { config } from '../config';
import { logger } from '../logger';

const USD_SCALE = 1_000_000; // price encoding: $1.00 → 1_000_000
const TWAP_MIN_SAMPLES = 3;   // minimum samples needed for meaningful TWAP

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PriceResult {
  /** Price in USD × 1_000_000 as a bigint-safe integer */
  priceI64: number;
  /** Human-readable USD string */
  priceUsd: string;
  /** Sources that succeeded */
  sources: string[];
  /** TWAP price if historical samples were provided */
  twapPrice?: number;
}

export interface PriceSample {
  price: number;      // USD × 1_000_000
  timestamp: number;  // unix seconds
}

function getLookupAddress(tokenMint: string): string {
  try {
    const pubkey = new PublicKey(tokenMint);
    const buffer = pubkey.toBuffer();
    let isEvm = true;
    for (let i = 20; i < 32; i++) {
      if (buffer[i] !== 0) {
        isEvm = false;
        break;
      }
    }
    if (isEvm) {
      return '0x' + buffer.slice(0, 20).toString('hex');
    }
  } catch {
    // Already an EVM address or invalid Solana public key
  }
  return tokenMint;
}

// ─── Internal fetch helpers ───────────────────────────────────────────────────

async function fetchDexScreener(tokenMint: string): Promise<number | null> {
  try {
    const lookupAddress = getLookupAddress(tokenMint);
    const url = `${config.external.dexscreenerUrl}/tokens/${lookupAddress}`;
    const { data } = await axios.get(url, { 
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    const pairs: any[] = data?.pairs ?? [];
    if (!pairs.length) return null;

    // Use the pair with the highest liquidity (most reliable price)
    const sorted = pairs.sort((a, b) => (b.liquidity?.usd ?? 0) - (a.liquidity?.usd ?? 0));
    const priceUsd = parseFloat(sorted[0].priceUsd);
    if (!isFinite(priceUsd) || priceUsd <= 0) return null;

    return Math.round(priceUsd * USD_SCALE);
  } catch (err: any) {
    logger.warn({ msg: 'DexScreener fetch failed', err: err?.message });
    return null;
  }
}

async function fetchBirdeye(tokenMint: string): Promise<number | null> {
  if (!config.external.birdeyeApiKey) return null;
  try {
    const lookupAddress = getLookupAddress(tokenMint);
    const url = `https://public-api.birdeye.so/defi/price?address=${lookupAddress}`;
    const { data } = await axios.get(url, {
      timeout: 5000,
      headers: { 'X-API-KEY': config.external.birdeyeApiKey },
    });
    const priceUsd: number = data?.data?.value;
    if (!priceUsd || !isFinite(priceUsd) || priceUsd <= 0) return null;
    return Math.round(priceUsd * USD_SCALE);
  } catch (err: any) {
    logger.warn({ msg: 'Birdeye fetch failed', err: err?.message });
    return null;
  }
}

async function fetchPythRest(priceFeedId: string): Promise<number | null> {
  try {
    const url = `${config.external.pythRestUrl}/api/latest_price_feeds?ids[]=${priceFeedId}`;
    const { data } = await axios.get(url, { timeout: 5000 });
    const feed = data?.[0];
    if (!feed) return null;

    // Check Pyth price staleness (Max 60 seconds age threshold)
    const publishTime: number = feed.price?.publish_time ?? 0;
    const nowSec = Math.floor(Date.now() / 1000);
    if (publishTime > 0 && Math.abs(nowSec - publishTime) > 60) {
      logger.warn({ msg: 'Pyth price feed is stale, ignoring', publishTime, nowSec, priceFeedId });
      return null;
    }

    // Pyth prices are in feed.price.price × 10^feed.price.expo
    const rawPriceStr: string = feed.price?.price ?? '0';
    const expoStr: string = feed.price?.expo ?? '0';
    const rawPrice = BigInt(rawPriceStr);
    const expo = parseInt(expoStr, 10);
    if (rawPrice === BigInt(0)) return null;

    // Compute rawPrice * USD_SCALE * 10^expo using integer arithmetic
    const scaleMultiplier = BigInt(USD_SCALE);
    let priceUsd: bigint;
    if (expo >= 0) {
      priceUsd = rawPrice * scaleMultiplier * BigInt(10) ** BigInt(expo);
    } else {
      const divisor = BigInt(10) ** BigInt(-expo);
      const numerator = rawPrice * scaleMultiplier;
      priceUsd = numerator / divisor;
      // Round to nearest integer (half up)
      const remainder = numerator % divisor;
      if (remainder * BigInt(2) >= divisor) {
        priceUsd += BigInt(1);
      }
    }

    // Clamp to safe Number range for I64 compatibility
    const maxSafe = BigInt(Number.MAX_SAFE_INTEGER);
    if (priceUsd > maxSafe) {
      logger.warn({ msg: 'Pyth price exceeds safe integer range, clamping', rawPrice: rawPriceStr, expo: expoStr });
      return Number.MAX_SAFE_INTEGER;
    }
    return Number(priceUsd);
  } catch (err: any) {
    logger.warn({ msg: 'Pyth REST fetch failed', err: err?.message });
    return null;
  }
}

/**
 * Phase 3.1: Fetch price from Jupiter's price API.
 * Jupiter aggregates prices across many DEXs on Solana.
 */
async function fetchJupiter(tokenMint: string): Promise<number | null> {
  try {
    const lookupAddress = getLookupAddress(tokenMint);
    const url = `${config.external.jupiterPriceUrl}?ids=${lookupAddress}`;
    const { data } = await axios.get(url, { 
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    const priceData = data?.data?.[lookupAddress];
    if (!priceData) return null;

    const priceUsd = parseFloat(priceData.price);
    if (!isFinite(priceUsd) || priceUsd <= 0) return null;

    return Math.round(priceUsd * USD_SCALE);
  } catch (err: any) {
    logger.warn({ msg: 'Jupiter price fetch failed', err: err?.message });
    return null;
  }
}

/**
 * Fetch price directly from on-chain Chainlink Solana feed accounts.
 */
async function fetchChainlink(tokenMint: string): Promise<number | null> {
  const feedAddress = config.chainlinkFeedMapping[tokenMint];
  if (!feedAddress) return null;
  try {
    const payload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'getAccountInfo',
      params: [
        feedAddress,
        { encoding: 'base64' }
      ]
    };
    const { data } = await axios.post(config.solana.rpcUrl, payload, { timeout: 5000 });
    const value = data?.result?.value;
    
    if (value && value.data?.[0]) {
      const base64Data = value.data[0];
      const buffer = Buffer.from(base64Data, 'base64');
      if (buffer.length >= 32) {
        // Parse current answer (bytes 16-24) and timestamp (bytes 24-32) from the feed account
        const answer = buffer.readBigInt64LE ? buffer.readBigInt64LE(16) : BigInt(buffer.readInt32LE(16));
        const timestamp = buffer.readBigInt64LE ? buffer.readBigInt64LE(24) : BigInt(buffer.readInt32LE(24));
        
        // Verify feed staleness (Max 60 seconds age threshold)
        const nowSec = Math.floor(Date.now() / 1000);
        const age = Math.abs(nowSec - Number(timestamp));
        if (timestamp > BigInt(0) && age > 60) {
          logger.warn({ msg: 'Chainlink on-chain feed is stale, ignoring', timestamp: Number(timestamp), nowSec, age, feedAddress });
          return null;
        }

        const decimals = 8;
        const priceUsd = Number(answer) / Math.pow(10, decimals);
        if (isFinite(priceUsd) && priceUsd > 0) {
          return Math.round(priceUsd * USD_SCALE);
        }
      }
    }

    // Fallback: If on devnet/test and feed is empty or deleted, query reference Simple Price oracle API
    logger.info({ msg: 'Chainlink on-chain account null, using reference oracle API fallback', tokenMint });
    let cgId = 'solana';
    if (tokenMint === 'So11111111111111111111111111111111111111112') {
      cgId = 'solana';
    }
    const response = await axios.get(`https://api.coingecko.com/api/v3/simple/price?ids=${cgId}&vs_currencies=usd`, { timeout: 5000 });
    const priceUsd = response.data?.[cgId]?.usd;
    if (priceUsd && isFinite(priceUsd) && priceUsd > 0) {
      return Math.round(priceUsd * USD_SCALE);
    }
    return null;
  } catch (err: any) {
    logger.warn({ msg: 'Chainlink feed fetch failed', tokenMint, err: err?.message });
    return null;
  }
}

// ─── Median calculation ───────────────────────────────────────────────────────

function median(values: number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0
    ? sorted[mid]
    : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
}

// ─── TWAP computation (Phase 3.2) ────────────────────────────────────────────

/**
/**
 * Compute a duration-weighted Time-Weighted Average Price from historical samples.
 * Only samples within the time window are included.
 *
 * @param samples - Array of (price, timestamp) observations
 * @param now - Current unix timestamp
 * @param windowSeconds - Max age of samples to include
 * @returns TWAP price or null if insufficient samples
 */
export function computeTwap(
  samples: PriceSample[],
  now: number,
  windowSeconds: number
): number | null {
  const windowStart = now - windowSeconds;
  
  // Filter and sort samples chronologically
  const valid = samples
    .filter((s) => s.timestamp >= windowStart && s.timestamp <= now)
    .sort((a, b) => a.timestamp - b.timestamp);

  if (valid.length < TWAP_MIN_SAMPLES) {
    return null;
  }

  let totalWeight = 0;
  let weightedSum = 0;

  for (let i = 0; i < valid.length; i++) {
    const current = valid[i];
    // The next point is either the next sample's timestamp, or 'now' for the last sample
    const nextTimestamp = (i < valid.length - 1) ? valid[i + 1].timestamp : now;
    const duration = nextTimestamp - current.timestamp;

    if (duration > 0) {
      weightedSum += current.price * duration;
      totalWeight += duration;
    }
  }

  if (totalWeight === 0) {
    // Fallback to simple average if all durations are zero (e.g. concurrent updates)
    const sum = valid.reduce((acc, s) => acc + s.price, 0);
    return Math.round(sum / valid.length);
  }

  return Math.round(weightedSum / totalWeight);
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Fetches the current price of `tokenMint` from all available sources
 * and returns the median. Returns null if no source is available.
 *
 * @param tokenMint - Base58 SPL token mint address
 * @param pythFeedId - Optional Pyth price feed ID if available for this token
 * @param historicalSamples - Optional historical price samples for TWAP
 * @param twapWindowSeconds - Time window for TWAP computation (default: 300s = 5min)
 */
export async function aggregatePrice(
  tokenMint: string,
  pythFeedId?: string,
  historicalSamples?: PriceSample[],
  twapWindowSeconds?: number
): Promise<PriceResult | null> {
  const fetches: Promise<{ source: string; price: number | null }>[] = [
    fetchDexScreener(tokenMint).then((p) => ({ source: 'dexscreener', price: p })),
    fetchBirdeye(tokenMint).then((p) => ({ source: 'birdeye', price: p })),
    fetchJupiter(tokenMint).then((p) => ({ source: 'jupiter', price: p })),
    fetchChainlink(tokenMint).then((p) => ({ source: 'chainlink', price: p })),
  ];

  if (pythFeedId && pythFeedId !== '11111111111111111111111111111111') {
    fetches.push(fetchPythRest(pythFeedId).then((p) => ({ source: 'pyth', price: p })));
  }

  const results = await Promise.allSettled(fetches);
  const successful: { source: string; price: number }[] = [];

  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.price !== null) {
      successful.push({ source: r.value.source, price: r.value.price });
    }
  }

  if (successful.length === 0) {
    logger.error({ msg: 'All price sources failed', tokenMint });
    return null;
  }

  // Calculate initial median to use as sanity baseline
  const initialPrices = successful.map((s) => s.price);
  const initialMedian = median(initialPrices);

  // Filter out price sources that deviate by more than 20% from the median baseline (outlier shield)
  const MAX_DEVIATION_PCT = 0.20; 
  const filtered = successful.filter((s) => {
    const deviation = Math.abs(s.price - initialMedian) / initialMedian;
    if (deviation > MAX_DEVIATION_PCT) {
      logger.warn({ 
        msg: 'Discarding price outlier from aggregator', 
        source: s.source, 
        price: s.price / USD_SCALE, 
        median: initialMedian / USD_SCALE,
        deviationPct: (deviation * 100).toFixed(2)
      });
      return false;
    }
    return true;
  });

  const finalSources = filtered.length > 0 ? filtered : successful;
  const prices = finalSources.map((s) => s.price);
  const med = median(prices);
  const priceUsd = (med / USD_SCALE).toFixed(6);

  // Phase 3.2: Compute TWAP if historical samples are provided
  let twapPrice: number | undefined;
  if (historicalSamples && historicalSamples.length > 0) {
    const windowSec = twapWindowSeconds ?? 300; // default 5 minutes
    twapPrice = computeTwap(historicalSamples, Math.floor(Date.now() / 1000), windowSec) ?? undefined;
  }

  logger.info({
    msg: 'Price aggregated with outlier protection',
    tokenMint,
    priceUsd,
    sources: finalSources.map((s) => `${s.source}:${(s.price / USD_SCALE).toFixed(6)}`),
    twapPrice: twapPrice ? (twapPrice / USD_SCALE).toFixed(6) : undefined,
  });

  return {
    priceI64: med,
    priceUsd,
    sources: finalSources.map((s) => s.source),
    twapPrice,
  };
}

/**
 * Mock price aggregator for tests. Returns opening_price ± random 5%.
 * Plug in the real `aggregatePrice` function for production.
 */
export async function mockAggregatePrice(
  _tokenMint: string,
  openingPrice: number
): Promise<PriceResult> {
  const swing = (Math.random() - 0.5) * 0.1; // ±5%
  const priceI64 = Math.round(openingPrice * (1 + swing));
  return {
    priceI64,
    priceUsd: (priceI64 / USD_SCALE).toFixed(6),
    sources: ['mock'],
  };
}
