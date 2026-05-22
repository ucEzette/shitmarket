/// price.rs — Off-chain keeper price submission helper.
///
/// Since most meme coins have no Pyth price feed, ShitMarket uses a
/// keeper-signed settlement model: the keeper wallet aggregates prices
/// from DexScreener, Birdeye, and the Pyth REST API off-chain, computes
/// a TWAP, then submits the final i64 price (in USD with 6 decimals of
/// precision, e.g. 1_000_000 = $1.00) on-chain by signing the
/// `settle_room` transaction. The program only needs to verify that the
/// signer is the registered keeper in PlatformConfig.
///
/// Price encoding:
///   price_i64 = (price_usd * 1_000_000) as i64
///   e.g.  $0.000042 → 42   (42 millionths of a dollar)
///          $1.50     → 1_500_000
///
/// Winner determination:
///   final_price > opening_price  → Moon wins
///   final_price <= opening_price → Jeet wins
///
/// This is intentionally simple. A v2 upgrade can add on-chain Pyth
/// validation for tokens that DO have a feed.

use anchor_lang::prelude::*;
use crate::error::ShitMarketError;

/// Encodes a price as a i64 with 6 decimal places.
/// Returns Err if price is zero or negative.
pub fn validate_price(price: i64) -> Result<()> {
    require!(price > 0, ShitMarketError::InvalidPrice);
    Ok(())
}

/// Determine the winner given opening and final prices.
/// Returns true if Moon wins (price went up).
pub fn moon_wins(opening_price: i64, final_price: i64) -> bool {
    final_price > opening_price
}

/// Safe proportional payout calculation.
///
/// winner_share = (user_bet * total_payout_pool) / winning_pool
///
/// Uses u128 intermediate arithmetic to avoid overflow on large numbers.
/// `total_payout_pool` is the winning+losing pool minus the platform fee.
pub fn calc_payout(
    user_bet: u64,
    winning_pool: u64,
    total_payout_pool: u64,
) -> Result<u64> {
    require!(winning_pool > 0, ShitMarketError::EmptyWinningPool);

    // u128 to avoid overflow: max SOL supply ~569M SOL = 569e15 lamports
    // user_bet * total_payout_pool fits in u128 easily
    let numerator = (user_bet as u128)
        .checked_mul(total_payout_pool as u128)
        .ok_or(ShitMarketError::Overflow)?;

    let payout = numerator
        .checked_div(winning_pool as u128)
        .ok_or(ShitMarketError::DivisionByZero)?;

    // Safe downcast — payout can never exceed total_payout_pool (u64)
    Ok(payout as u64)
}

/// Calculate the platform fee given bps.
/// fee = total_pool * fee_bps / 10_000
pub fn calc_platform_fee(total_pool: u64, fee_bps: u16) -> Result<u64> {
    let fee = (total_pool as u128)
        .checked_mul(fee_bps as u128)
        .ok_or(ShitMarketError::Overflow)?
        .checked_div(10_000)
        .ok_or(ShitMarketError::DivisionByZero)?;
    Ok(fee as u64)
}

// ─────────────────────────────────────────────
//  Phase 3.2: SMA / TWAP / EMA utilities
// ─────────────────────────────────────────────

/// Compute an Exponential Moving Average (EMA).
///
/// The formula is:
///   ema_{n} = (sample_{n} * alpha_num + ema_{n-1} * (alpha_den - alpha_num)) / alpha_den
///
/// The initial_value is used as the first EMA (ema_{0}).
/// `alpha_num / alpha_den` is the smoothing factor. Common values:
///   - 2 / (N+1) where N is the number of samples (equivalent to SMA window N)
///   - Higher alpha = more weight on recent prices
///
/// Uses i128 arithmetic to prevent overflow during intermediate multiplication.
pub fn compute_ema(initial_value: i64, samples: &[i64], alpha_num: u64, alpha_den: u64) -> i64 {
    if samples.is_empty() {
        return initial_value;
    }

    let alpha_num = alpha_num as i128;
    let alpha_den = alpha_den as i128;

    let mut ema = initial_value as i128;

    for &sample in samples {
        let sample = sample as i128;
        // ema = (sample * alpha_num + ema * (alpha_den - alpha_num)) / alpha_den
        let numerator = sample
            .checked_mul(alpha_num)
            .and_then(|n| n.checked_add(ema.checked_mul(alpha_den - alpha_num)?))
            .unwrap_or(ema);

        if alpha_den != 0 {
            ema = numerator / alpha_den;
        }
    }

    ema as i64
}

/// Compute Simple TWAP (Time-Weighted Average Price).
///
/// Takes an array of (price, timestamp) observations and computes the
/// mean of all samples that fall within `window_seconds` of `now`.
///
/// Returns `None` if no samples are within the window.
pub fn twap_smooth(
    prices: &[i64],
    timestamps: &[i64],
    now: i64,
    window_seconds: i64,
) -> Option<i64> {
    assert_eq!(
        prices.len(),
        timestamps.len(),
        "prices and timestamps must have the same length"
    );

    let mut sum: i128 = 0;
    let mut count: i128 = 0;

    for i in 0..prices.len() {
        let age = now - timestamps[i];
        if age >= 0 && age <= window_seconds {
            sum += prices[i] as i128;
            count += 1;
        }
    }

    if count == 0 {
        return None;
    }

    // Integer division with rounding to nearest
    let mean = (sum + count / 2) / count;
    Some(mean as i64)
}

/// Compute the median of an array of prices.
///
/// Median is more robust to outliers than mean, making it ideal for
/// combining multiple oracle sources. Returns `None` for empty input.
pub fn median_oracle_price(prices: &[i64]) -> Option<i64> {
    if prices.is_empty() {
        return None;
    }

    let mut sorted = prices.to_vec();
    sorted.sort_unstable();

    let len = sorted.len();
    if len % 2 == 0 {
        // Even number of elements: average of two middle values
        let mid_high = sorted[len / 2] as i128;
        let mid_low = sorted[len / 2 - 1] as i128;
        Some(((mid_high + mid_low + 1) / 2) as i64) // +1 for rounding
    } else {
        Some(sorted[len / 2])
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_moon_wins() {
        assert!(moon_wins(1_000_000, 1_100_000));
        assert!(!moon_wins(1_000_000, 900_000));
        assert!(!moon_wins(1_000_000, 1_000_000)); // same price → jeet
    }

    #[test]
    fn test_calc_payout_proportional() {
        // User bet 0.5 SOL on winning side (1 SOL winning pool),
        // total payout pool = 1.8 SOL (total 2 SOL minus 10% fee)
        let payout = calc_payout(500_000_000, 1_000_000_000, 1_800_000_000).unwrap();
        assert_eq!(payout, 900_000_000); // gets back 0.9 SOL
    }

    #[test]
    fn test_calc_payout_all_on_one_side() {
        // User is the only bettor; gets the full payout pool
        let payout = calc_payout(1_000_000_000, 1_000_000_000, 1_960_000_000).unwrap();
        assert_eq!(payout, 1_960_000_000);
    }

    #[test]
    fn test_calc_platform_fee() {
        // 2% of 2 SOL = 0.04 SOL
        let fee = calc_platform_fee(2_000_000_000, 200).unwrap();
        assert_eq!(fee, 40_000_000);
    }

    #[test]
    fn test_validate_price_zero_fails() {
        assert!(validate_price(0).is_err());
        assert!(validate_price(-1).is_err());
        assert!(validate_price(42).is_ok());
    }

    // ─── Phase 3.2: EMA tests ─────────────────────────────────────────────

    #[test]
    fn test_ema_empty_samples() {
        // If no samples, EMA returns initial_value
        let result = compute_ema(1_000_000, &[], 2, 3);
        assert_eq!(result, 1_000_000);
    }

    #[test]
    fn test_ema_single_sample() {
        // ema = (sample * 2 + initial * (3-2)) / 3
        //     = (2_000_000 * 2 + 1_000_000 * 1) / 3
        //     = (4_000_000 + 1_000_000) / 3
        //     = 5_000_000 / 3
        //     = 1_666_666
        let result = compute_ema(1_000_000, &[2_000_000], 2, 3);
        assert_eq!(result, 1_666_666);
    }

    #[test]
    fn test_ema_multiple_samples() {
        // alpha = 2/3 (heavily weighted toward new data)
        // ema_1 = (10 * 2 + 1 * 1) / 3 = 7
        // ema_2 = (5 * 2 + 7 * 1) / 3 = 17/3 = 5
        let result = compute_ema(1, &[10, 5], 2, 3);
        assert_eq!(result, 5);
    }

    #[test]
    fn test_ema_alpha_one() {
        // alpha_num = 1, alpha_den = 1 → 100% weight on latest sample
        // Each step: ema = sample — effectively tracks last value
        let result = compute_ema(100, &[10, 20, 30], 1, 1);
        assert_eq!(result, 30); // just the last sample
    }

    #[test]
    fn test_ema_no_weight() {
        // alpha_num = 0 → no weight on samples, EMA never changes
        let result = compute_ema(1_000_000, &[2_000_000, 3_000_000], 0, 1);
        assert_eq!(result, 1_000_000); // stuck at initial
    }

    // ─── Phase 3.2: TWAP tests ────────────────────────────────────────────

    #[test]
    fn test_twap_all_within_window() {
        let prices = [1_000_000, 1_100_000, 1_200_000];
        let timestamps = [1000, 1001, 1002];
        let now = 1005;
        let window = 10;

        let result = twap_smooth(&prices, &timestamps, now, window);
        // mean = (1_000_000 + 1_100_000 + 1_200_000) / 3 = 1_100_000
        assert_eq!(result.unwrap(), 1_100_000);
    }

    #[test]
    fn test_twap_filters_stale_samples() {
        let prices = [1_000_000, 1_100_000, 1_200_000];
        let timestamps = [1000, 1001, 1002];
        let now = 1015; // 13 seconds after t=1002, but window=10
        let window = 10;

        let result = twap_smooth(&prices, &timestamps, now, window);
        // Only samples within [1005, 1015] — none if window=10
        // Actually: age = now - ts = 15 - 0 = 15, 15 - 1 = 14, 15 - 2 = 13
        // All > 10 → empty → None
        assert!(result.is_none());
    }

    #[test]
    fn test_twap_partial_window() {
        let prices = [1_000_000, 1_100_000, 1_200_000];
        let timestamps = [1, 5, 10];
        let now = 12;
        let window = 9; // includes ts=5 (age=7) and ts=10 (age=2), excludes ts=1 (age=11)

        let result = twap_smooth(&prices, &timestamps, now, window);
        // mean = (1_100_000 + 1_200_000) / 2 = 1_150_000
        assert_eq!(result.unwrap(), 1_150_000);
    }

    #[test]
    fn test_twap_future_timestamp() {
        let prices = [1_000_000];
        let timestamps = [100]; // in the future relative to now=50
        let now = 50;
        let window = 10;

        let result = twap_smooth(&prices, &timestamps, now, window);
        assert!(result.is_none()); // age = -50 → excluded
    }

    #[test]
    fn test_twap_single_sample() {
        let result = twap_smooth(&[500_000], &[100], 105, 10);
        assert_eq!(result.unwrap(), 500_000);
    }

    // ─── Phase 3.1: Median oracle tests ───────────────────────────────────

    #[test]
    fn test_median_empty() {
        assert!(median_oracle_price(&[]).is_none());
    }

    #[test]
    fn test_median_single() {
        assert_eq!(median_oracle_price(&[42]), Some(42));
    }

    #[test]
    fn test_median_odd_count() {
        // sorted: [1, 3, 5] → middle = 3
        assert_eq!(median_oracle_price(&[3, 5, 1]), Some(3));
    }

    #[test]
    fn test_median_even_count() {
        // sorted: [1, 4, 6, 10] → avg(4, 6) = 5
        assert_eq!(median_oracle_price(&[6, 1, 10, 4]), Some(5));
    }

    #[test]
    fn test_median_with_duplicates() {
        // sorted: [5, 5, 5, 10, 10] → middle = 5
        assert_eq!(median_oracle_price(&[10, 5, 10, 5, 5]), Some(5));
    }

    #[test]
    fn test_median_large_values() {
        // Prices near the upper limit of i64
        let prices: [i64; 3] = [i64::MAX - 2, i64::MAX, i64::MAX - 1];
        // sorted: [MAX-2, MAX-1, MAX] → middle = MAX-1
        assert_eq!(median_oracle_price(&prices), Some(i64::MAX - 1));
    }

    #[test]
    fn test_median_all_same() {
        assert_eq!(median_oracle_price(&[777_000, 777_000, 777_000]), Some(777_000));
    }
}
