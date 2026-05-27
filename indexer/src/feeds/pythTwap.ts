import axios from 'axios';
import { logger } from '../logger';

/**
 * Normalizes a Pyth Price Feed ID to a standard 66-character lowercase hex string with '0x' prefix.
 */
function normalizeFeedId(feedId: string): string | null {
  const clean = feedId.trim();
  const normalized = clean.startsWith('0x') ? clean : '0x' + clean;
  if (normalized.length === 66 && /^0x[0-9a-fA-F]{64}$/.test(normalized)) {
    return normalized.toLowerCase();
  }
  return null;
}

/**
 * Calculates the Time-Weighted Average Price (TWAP) for a given Pyth price feed ID
 * over a time window ending at the room's expiry timestamp.
 *
 * It samples historical price data from both the Pyth Hermes REST API and the
 * Pyth Benchmarks API in parallel for high availability and redundancy.
 *
 * @param feedId - The Pyth Price Feed ID (hex string)
 * @param expiryTimestampMs - Expiry timestamp of the room in milliseconds
 * @param windowMinutes - The lookback window in minutes (default: 5)
 * @returns The TWAP price as a float (normal decimal price), or null if calculations fail.
 */
export async function calculatePythTwap(
  feedId: string,
  expiryTimestampMs: number,
  windowMinutes: number = 5
): Promise<number | null> {
  const normalizedFeedId = normalizeFeedId(feedId);
  if (!normalizedFeedId) {
    logger.warn({ msg: 'calculatePythTwap: Skipping invalid feed ID format', feedId });
    return null;
  }

  const expirySec = Math.floor(expiryTimestampMs / 1000);
  const windowSec = windowMinutes * 60;
  
  // Sample prices at 60-second intervals across the lookback window
  const timestamps: number[] = [];
  for (let t = expirySec - windowSec; t <= expirySec; t += 60) {
    timestamps.push(t);
  }

  logger.info({
    msg: 'Attempting to calculate Pyth TWAP price',
    feedId: normalizedFeedId,
    expirySec,
    windowMinutes,
    samplesExpected: timestamps.length,
  });

  const pricePromises = timestamps.map(async (t) => {
    // 1. Try Hermes v2 updates API first
    const hermesUrl = `https://hermes.pyth.network/v2/updates/price/${t}?ids[]=${normalizedFeedId}&parsed=true`;
    try {
      const response = await axios.get(hermesUrl, { timeout: 3500 });
      const parsed = response.data?.parsed?.[0];
      if (parsed?.price) {
        const priceVal = parseFloat(parsed.price.price);
        const expo = parseInt(parsed.price.expo, 10);
        const floatPrice = priceVal * Math.pow(10, expo);
        if (isFinite(floatPrice) && floatPrice > 0) {
          return { timestamp: t, price: floatPrice, source: 'hermes' };
        }
      }
    } catch (hermesErr: any) {
      // Hermes request failed, fallback to Pyth Benchmarks API
      const benchmarksUrl = `https://benchmarks.pyth.network/v1/updates/price/${t}?ids[]=${normalizedFeedId}`;
      try {
        const response = await axios.get(benchmarksUrl, { timeout: 3500 });
        const parsed = response.data?.parsed?.[0];
        if (parsed?.price) {
          const priceVal = parseFloat(parsed.price.price);
          const expo = parseInt(parsed.price.expo, 10);
          const floatPrice = priceVal * Math.pow(10, expo);
          if (isFinite(floatPrice) && floatPrice > 0) {
            return { timestamp: t, price: floatPrice, source: 'benchmarks' };
          }
        }
      } catch (benchmarksErr: any) {
        logger.warn({
          msg: 'Failed to fetch Pyth price tick at timestamp from both Hermes and Benchmarks APIs',
          timestamp: t,
          hermesErr: hermesErr?.message,
          benchmarksErr: benchmarksErr?.message,
        });
      }
    }
    return null;
  });

  const results = await Promise.all(pricePromises);
  const validSamples = results.filter((r): r is { timestamp: number; price: number; source: string } => r !== null);

  if (validSamples.length < 3) {
    logger.error({
      msg: 'Pyth TWAP calculation failed: Insufficient valid price ticks',
      feedId: normalizedFeedId,
      expected: timestamps.length,
      received: validSamples.length,
    });
    return null;
  }

  // Calculate simple average price of regularly spaced ticks (mathematically equivalent to duration-weighted TWAP)
  const sum = validSamples.reduce((acc, sample) => acc + sample.price, 0);
  const twap = sum / validSamples.length;

  logger.info({
    msg: 'Successfully calculated Pyth TWAP price',
    feedId: normalizedFeedId,
    twapPrice: twap,
    validSamplesCount: validSamples.length,
    sourcesUsed: Array.from(new Set(validSamples.map((s) => s.source))),
  });

  return twap;
}
