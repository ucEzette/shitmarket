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

// ─── Internal fetch helpers ───────────────────────────────────────────────────

async function fetchDexScreener(tokenMint: string): Promise<number | null> {
  try {
    const url = `${config.external.dexscreenerUrl}/tokens/${tokenMint}`;
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
    const url = `https://public-api.birdeye.so/defi/price?address=${tokenMint}`;
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
    const url = `${config.external.jupiterPriceUrl}?ids=${tokenMint}`;
    const { data } = await axios.get(url, { 
      timeout: 5000,
      headers: {
        "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept": "application/json"
      }
    });
    const priceData = data?.data?.[tokenMint];
    if (!priceData) return null;

    const priceUsd = parseFloat(priceData.price);
    if (!isFinite(priceUsd) || priceUsd <= 0) return null;

    return Math.round(priceUsd * USD_SCALE);
  } catch (err: any) {
    logger.warn({ msg: 'Jupiter price fetch failed', err: err?.message });
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
 * Compute a simple Time-Weighted Average Price from historical samples.
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
  const valid = samples.filter((s) => {
    const age = now - s.timestamp;
    return age >= 0 && age <= windowSeconds;
  });

  if (valid.length < TWAP_MIN_SAMPLES) {
    return null;
  }

  const sum = valid.reduce((acc, s) => acc + s.price, 0);
  return Math.round(sum / valid.length);
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

  const prices = successful.map((s) => s.price);
  const med = median(prices);
  const priceUsd = (med / USD_SCALE).toFixed(6);

  // Phase 3.2: Compute TWAP if historical samples are provided
  let twapPrice: number | undefined;
  if (historicalSamples && historicalSamples.length > 0) {
    const windowSec = twapWindowSeconds ?? 300; // default 5 minutes
    twapPrice = computeTwap(historicalSamples, Math.floor(Date.now() / 1000), windowSec) ?? undefined;
  }

  logger.info({
    msg: 'Price aggregated',
    tokenMint,
    priceUsd,
    sources: successful.map((s) => `${s.source}:${(s.price / USD_SCALE).toFixed(6)}`),
    twapPrice: twapPrice ? (twapPrice / USD_SCALE).toFixed(6) : undefined,
  });

  return {
    priceI64: med,
    priceUsd,
    sources: successful.map((s) => s.source),
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
