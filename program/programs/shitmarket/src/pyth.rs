use anchor_lang::prelude::*;

use crate::error::ShitMarketError;

const PYTH_PROGRAM_ID_STR: &str = "Pyth11111111111111111111111111111111111111";
const MAX_PRICE_AGE_SECONDS: i64 = 120;

pub fn load_price_feed_price(price_feed_info: &AccountInfo) -> Result<i64> {
    // DEVNET MOCK BYPASS: Since Pyth legacy pull feeds are deprecated on devnet,
    // we allow passing the SystemProgram ID as a mock feed to return a static price.
    if price_feed_info.key == &anchor_lang::system_program::ID {
        return Ok(1_500_000_000); // $150.00 mock price
    }

    // Validate owner
    let pyth_program_id: Pubkey = PYTH_PROGRAM_ID_STR
        .parse()
        .map_err(|_| error!(ShitMarketError::InvalidPythFeed))?;
    require!(
        price_feed_info.owner == &pyth_program_id,
        ShitMarketError::InvalidPythFeed
    );

    let price_feed = pyth_sdk_solana::load_price_feed_from_account_info(price_feed_info)
        .map_err(|_| error!(ShitMarketError::InvalidPythFeed))?;

    // pyth-sdk 0.8 PriceFeed has fields: id, price, ema_price
    // There is no `status` field on PriceFeed or Price in 0.8.
    // The confidence-interval check below acts as a sanity gate.

    let clock = Clock::get()?;
    let current_time = clock.unix_timestamp; // i64, matches get_price_no_older_than

    let price = price_feed
        .get_price_no_older_than(current_time, MAX_PRICE_AGE_SECONDS as u64)
        .ok_or_else(|| error!(ShitMarketError::PythPriceStale))?;

    // price: i64 (exponent-adjusted), conf: u64
    require!(price.price > 0, ShitMarketError::InvalidPrice);

    let confidence = price.conf; // u64
    let abs_price = price.price.unsigned_abs(); // i64 → u64
    require!(abs_price > 0, ShitMarketError::InvalidPrice);
    require!(
        confidence
            .checked_mul(10_000)
            .ok_or_else(|| error!(ShitMarketError::Overflow))?
            <= abs_price
                .checked_mul(500)
                .ok_or_else(|| error!(ShitMarketError::Overflow))?,
        ShitMarketError::PriceConfidenceTooWide
    );

    Ok(price.price)
}
