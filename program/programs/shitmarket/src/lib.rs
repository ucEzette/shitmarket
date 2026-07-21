use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub mod error;
pub mod price;
pub mod pyth;

use error::ShitMarketError;
use price::{calc_payout, calc_platform_fee, compute_ema};
use pyth::load_price_feed_price;

declare_id!("ByNq6kkYAPWPkHSimJPL6nhkeP7xFKHkstZRQcdLLH1B");

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────

const MAX_FEE_BPS: u16 = 1_000; // 10% absolute maximum
const SECONDS_PER_MINUTE: i64 = 60;
const TOKEN_NAME_LEN: usize = 32;
const MINIMUM_LIQUIDITY_SOL: u64 = 100_000_000; // 0.1 SOL minimum pool requirement
const MAX_TWAP_SAMPLES: usize = 5; // number of price samples to store for TWAP
const SECONDARY_FEE_BPS: u16 = 50; // 0.5% fee for secondary market trades
const CHALLENGE_WINDOW_SECONDS: i64 = 1800; // 30 minutes challenge period



// ─────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum Side {
    Moon,
    Jeet,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum RoomStatus {
    Active,
    Settled,
    Pending,
    Disputed,
}

// Reputation enum scrapped

// ─────────────────────────────────────────────
//  STATE ACCOUNTS
// ─────────────────────────────────────────────

/// Singleton platform configuration. Created once by admin.
#[account]
pub struct PlatformConfig {
    /// The admin wallet — can update config. NOT a runtime privilege escalation path.
    pub admin: Pubkey,
    /// Treasury that receives the platform fee.
    pub treasury: Pubkey,
    /// The keeper wallet authorised to settle rooms.
    pub keeper: Pubkey,
    /// Fee in basis points (e.g. 125 = 1.25%). Maximum 1000 (10%).
    pub platform_fee_bps: u16,
    /// Phase 3.3: Circuit breaker — if true, no new rooms, bets, or settlements.
    pub paused: bool,
    /// Minimum SOL pool (lamports) required for a room to be created.
    pub minimum_liquidity: u64,
    /// Time window (seconds) for TWAP sampling at settlement.
    pub twap_window_seconds: i64,
    /// Cooling-off period (seconds) after room expiry before escrow can be swept.
    /// Default: 14 days (1_209_600 seconds).
    pub cooling_off_seconds: i64,
    pub bump: u8,
}

impl PlatformConfig {
    // 8 discrim + 32 admin + 32 treasury + 32 keeper + 2 fee + 1 paused + 8 min_liquidity + 8 twap_window + 8 cooling_off + 1 bump
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1 + 8 + 8 + 8 + 1;
}

/// One prediction room per token per game.
#[account]
pub struct Room {
    /// SPL token mint this room is about.
    pub token_mint: Pubkey,
    /// Human-readable name, UTF-8, padded to 32 bytes.
    pub token_name: [u8; TOKEN_NAME_LEN],
    /// Primary oracle feed account (Pyth) used for settlement.
    pub price_feed: Pubkey,
    /// Optional secondary oracle feed (Switchboard) for multi-oracle fallback.
    pub switchboard_feed: Pubkey,
    /// Price at room creation time (USD × 1_000_000 as i64).
    pub opening_price: i64,
    /// Unix timestamp of room creation.
    pub opening_timestamp: i64,
    /// Battle duration (up to 1 year in minutes).
    pub duration_minutes: u32,
    /// Unix timestamp when the room expires.
    pub expiry_timestamp: i64,
    /// Total SOL (lamports) staked on Moon.
    pub moon_pool: u64,
    /// Total SOL (lamports) staked on Jeet.
    pub jeet_pool: u64,
    /// Current status of the room.
    pub status: RoomStatus,
    /// Winning side after settlement. None while active or if settled as Draw.
    pub winner: Option<Side>,
    /// Price at settlement (USD × 1_000_000 as i64).
    pub final_price: i64,
    /// Creator of the room.
    pub creator: Pubkey,
    /// Phase 3.2: TWAP price observations (circular buffer).
    pub twap_samples_ct: u8,
    pub twap_samples: [i64; MAX_TWAP_SAMPLES],
    pub twap_sample_timestamps: [i64; MAX_TWAP_SAMPLES],
    /// The final TWAP-smoothed price used for settlement.
    pub twap_final_price: i64,
    pub bump: u8,

    // NEW FIELDS FOR PERMISSIONLESS DISAGREEMENT LAYER
    pub oracle: Pubkey,
    pub oracle_fee_lamports: u64,
    pub settlement_timestamp: i64,
    pub dispute_status: u8, // 0 = None, 1 = Overturned
    pub resolution_criteria: [u8; 64],
}

impl Room {
    // 393 base + 32 (oracle) + 8 (fee) + 8 (settle_ts) + 1 (status) + 64 (criteria) = 506
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 2 + 8 + 32 + 1 + 40 + 40 + 8 + 8 + 8 + 1 + 32 + 8 + 8 + 1 + 64;

    pub fn total_pool(&self) -> Result<u64> {
        self.moon_pool
            .checked_add(self.jeet_pool)
            .ok_or_else(|| error!(ShitMarketError::Overflow))
    }

    pub fn is_expired(&self, now: i64) -> bool {
        now >= self.expiry_timestamp
    }

    /// Returns the token name as a trimmed UTF-8 string.
    pub fn token_name_str(&self) -> &str {
        let end = self.token_name.iter().position(|&b| b == 0).unwrap_or(TOKEN_NAME_LEN);
        std::str::from_utf8(&self.token_name[..end]).unwrap_or("UNKNOWN")
    }

    /// Record a TWAP price observation at settlement time.
    pub fn record_twap_sample(&mut self, price: i64, timestamp: i64) {
        let idx = self.twap_samples_ct as usize % MAX_TWAP_SAMPLES;
        self.twap_samples[idx] = price;
        self.twap_sample_timestamps[idx] = timestamp;
        self.twap_samples_ct = self.twap_samples_ct.saturating_add(1);
    }

    /// Compute the TWAP-smoothed final price using EMA over stored samples.
    pub fn compute_twap_final(&self, now: i64, twap_window: i64) -> i64 {
        let count = (self.twap_samples_ct as usize).min(MAX_TWAP_SAMPLES);
        if count == 0 {
            return self.final_price;
        }

        // Filter samples within the TWAP window
        let mut valid_samples: Vec<i64> = Vec::with_capacity(count);
        for i in 0..count {
            let ts = self.twap_sample_timestamps[i];
            if now - ts <= twap_window {
                valid_samples.push(self.twap_samples[i]);
            }
        }

        if valid_samples.is_empty() {
            return self.final_price;
        }

        // Use the opening price as the initial EMA value, then smooth
        let alpha_num = 2u64; // EMA smoothing factor numerator (2/(N+1))
        let alpha_den = (valid_samples.len() + 1) as u64;
        compute_ema(self.opening_price, &valid_samples, alpha_num, alpha_den)
    }
}

/// One bet per (room, user, side). Additional bets on same side increase amount.
#[account]
pub struct Bet {
    /// The room this bet belongs to.
    pub room: Pubkey,
    /// The bettor's wallet.
    pub user: Pubkey,
    /// Current owner of the ticket (may differ after transfer).
    pub current_owner: Pubkey,
    /// Which side this bet is on.
    pub side: Side,
    /// Total amount staked (lamports). Updated on repeat bets.
    pub amount: u64,
    /// Whether winnings have been claimed. MUST be set before transfer.
    pub claimed: bool,
    pub bump: u8,
}

// ─────────────────────────────────────────────
//  LISTING PDA FOR SECONDARY MARKET
// ─────────────────────────────────────────────

#[account]
pub struct Listing {
    /// The room this listing belongs to.
    pub room: Pubkey,
    /// The bet this listing refers to.
    pub bet: Pubkey,
    /// The seller (current owner of the bet at listing time).
    pub seller: Pubkey,
    /// Price (lamports) the seller wants for the position.
    pub price: u64,
    /// Bump for PDA seeds.
    pub bump: u8,
}

impl Listing {
    // 8 discriminator + 32 room + 32 bet + 32 seller + 8 price + 1 bump
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 1;
}

impl Bet {
    // 8 + 32 + 32 + 1 + 8 + 1 + 1
    pub const LEN: usize = 8 + 32 + 32 + 32 + 1 + 8 + 1 + 1; // added current_owner Pubkey
}




#[account]
pub struct UserReferral {
    pub user: Pubkey,
    pub referrer: Pubkey,
    pub bump: u8,
}

#[account]
pub struct ReferralState {
    pub referrer: Pubkey,
    pub unclaimed_rewards: u64,
    pub claimed_rewards: u64,
    pub bump: u8,
}

// ─────────────────────────────────────────────
//  EVENTS
// ─────────────────────────────────────────────

#[event]
pub struct RoomCreated {
    pub room: Pubkey,
    pub creator: Pubkey,
    pub token_mint: Pubkey,
    pub token_name: String,
    pub price_feed: Pubkey,
    pub opening_price: i64,
    pub duration_minutes: u32,
    pub expiry_timestamp: i64,
    pub oracle: Pubkey,
    pub oracle_fee_lamports: u64,
    pub resolution_criteria: [u8; 64],
}

#[event]
pub struct RoomDisputed {
    pub room: Pubkey,
    pub challenger: Pubkey,
    pub dispute_bond: u64,
}

#[event]
pub struct DisputeResolved {
    pub room: Pubkey,
    pub winner: u8, // 0 = Moon, 1 = Jeet, 2 = Draw
    pub refund_challenger: bool,
}




#[event]
pub struct BetPlaced {
    pub room: Pubkey,
    pub user: Pubkey,
    pub side: u8, // 0 = Moon, 1 = Jeet
    pub amount: u64,
    pub moon_pool: u64,
    pub jeet_pool: u64,
}

#[event]
pub struct RoomSettled {
    pub room: Pubkey,
    pub winner: u8, // 0 = Moon, 1 = Jeet
    pub opening_price: i64,
    pub final_price: i64,
    pub twap_final_price: i64,
    pub total_pool: u64,
    pub platform_fee: u64,
}

#[event]
pub struct WinningsClaimed {
    pub room: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}

#[event]
pub struct PositionListed {
    pub room: Pubkey,
    pub bet: Pubkey,
    pub seller: Pubkey,
    pub price: u64,
}

#[event]
pub struct PositionPurchased {
    pub room: Pubkey,
    pub bet: Pubkey,
    pub seller: Pubkey,
    pub buyer: Pubkey,
    pub price: u64,
}

#[event]
pub struct ListingCancelled {
    pub room: Pubkey,
    pub bet: Pubkey,
    pub seller: Pubkey,
}

/// Emitted when a room is voided (one-sided — no opposing bets).
/// All participants receive full refunds, no platform fee taken.
#[event]
pub struct RoomVoided {
    pub room: Pubkey,
    pub total_refund_pool: u64,
    pub reason: String,
}

#[event]
pub struct PlatformPaused {
    pub paused: bool,
}

#[event]
pub struct EscrowSwept {
    pub room: Pubkey,
    pub receiver: Pubkey,
    pub amount: u64,
}

#[event]
pub struct ReferralRegistered {
    pub user: Pubkey,
    pub referrer: Pubkey,
}

#[event]
pub struct ReferralRewardAccrued {
    pub referrer: Pubkey,
    pub invitee: Pubkey,
    pub room: Pubkey,
    pub reward_amount: u64,
}

#[event]
pub struct ReferralRewardsClaimed {
    pub referrer: Pubkey,
    pub amount: u64,
}

// ─────────────────────────────────────────────
//  INSTRUCTION ACCOUNTS
// ─────────────────────────────────────────────

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = admin,
        space = PlatformConfig::LEN,
        seeds = [b"platform_config"],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    /// CHECK: Treasury is just a receive-only wallet; we only transfer SOL to it.
    pub treasury: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(
    token_mint: Pubkey,
    token_name: String,
    duration_minutes: u32,
    switchboard_feed: Option<Pubkey>,
    opening_price_param: Option<i64>,
    nonce: u8
)]
pub struct CreateRoom<'info> {
    #[account(
        init,
        payer = creator,
        space = Room::LEN,
        seeds = [b"room", token_mint.as_ref(), creator.key().as_ref(), &[nonce]],
        bump
    )]
    pub room: Account<'info, Room>,

    #[account(
        init,
        payer = creator,
        space = 0,
        seeds = [b"escrow", room.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,

    #[account(mut)]
    pub creator: Signer<'info>,

    /// CHECK: Primary price feed (Pyth). Validated by Pyth helper.
    pub price_feed: UncheckedAccount<'info>,

    /// CHECK: Optional secondary price feed (Switchboard). If Pubkey::default(), not used.
    pub switchboard_feed: UncheckedAccount<'info>,

    #[account(seeds = [b"platform_config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(side: Side)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        constraint = room.status == RoomStatus::Active @ ShitMarketError::RoomNotActive
    )]
    pub room: Account<'info, Room>,

    /// The escrow PDA that holds all lamports for this room.
    /// CHECK: Validated by seeds; this PDA owns the lamports.
    #[account(
        mut,
        seeds = [b"escrow", room.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,

    #[account(
        init_if_needed,
        payer = user,
        space = Bet::LEN,
        seeds = [
            b"bet", 
            room.key().as_ref(), 
            user.key().as_ref(),
            &[match side { Side::Moon => 0, Side::Jeet => 1 }]
        ],
        bump
    )]
    pub bet: Account<'info, Bet>,

    #[account(mut)]
    pub user: Signer<'info>,



    #[account(seeds = [b"platform_config"], bump)]
    pub config: Account<'info, PlatformConfig>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SettleRoom<'info> {
    #[account(
        mut,
        constraint = room.status == RoomStatus::Active @ ShitMarketError::RoomNotActive
    )]
    pub room: Account<'info, Room>,

    /// CHECK: Escrow PDA; validated by seeds.
    #[account(
        mut,
        seeds = [b"escrow", room.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,

    /// CHECK: Vault PDA holding platform fees.
    /// The vault is created automatically on first settlement if it does not exist.
    #[account(
        seeds = [b"vault"],
        bump,
        init_if_needed,
        payer = keeper,
        space = 0
    )]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: Primary price feed (Pyth). Validated by Pyth helper.
    pub price_feed: UncheckedAccount<'info>,

    /// CHECK: Optional secondary price feed (Switchboard).
    pub switchboard_feed: UncheckedAccount<'info>,

    #[account(seeds = [b"platform_config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        constraint = keeper.key() == room.oracle @ ShitMarketError::UnauthorizedOracle
    )]
    pub keeper: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SweepEscrow<'info> {
    #[account(
        constraint = room.status == RoomStatus::Settled @ ShitMarketError::RoomNotSettled
    )]
    pub room: Account<'info, Room>,

    #[account(
        seeds = [b"platform_config"],
        bump = config.bump,
        constraint = admin.key() == config.admin @ ShitMarketError::Unauthorized
    )]
    pub config: Account<'info, PlatformConfig>,

    /// CHECK: Escrow PDA; validated by seeds.
    #[account(
        mut,
        seeds = [b"escrow", room.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,

    /// CHECK: Recipient of the swept funds
    #[account(mut)]
    pub receiver: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimWinnings<'info> {
    #[account(
        constraint = room.status == RoomStatus::Settled @ ShitMarketError::RoomNotSettled
    )]
    pub room: Account<'info, Room>,

    #[account(
        seeds = [b"platform_config"],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,

    /// CHECK: Escrow PDA; validated by seeds.
    #[account(
        mut,
        seeds = [b"escrow", room.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,

    #[account(
        mut,
        realloc = Bet::LEN,
        realloc::payer = payer,
        realloc::zero = false,
        seeds = [
            b"bet", 
            room.key().as_ref(), 
            original_bettor.key().as_ref(),
            &[match bet.side { Side::Moon => 0, Side::Jeet => 1 }]
        ],
        bump = bet.bump,
        constraint = bet.current_owner == user.key() @ ShitMarketError::Unauthorized,
        constraint = !bet.claimed @ ShitMarketError::AlreadyClaimed,
        constraint = room.winner.is_none() || Some(bet.side) == room.winner @ ShitMarketError::SideMismatch
    )]
    pub bet: Account<'info, Bet>,

    /// CHECK: Original bettor used for seed derivation
    pub original_bettor: AccountInfo<'info>,

    /// CHECK: Recipient of the payout
    #[account(mut)]
    pub user: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct UpdateConfig<'info> {
    #[account(
        mut,
        seeds = [b"platform_config"],
        bump = config.bump,
        constraint = admin.key() == config.admin @ ShitMarketError::Unauthorized
    )]
    pub config: Account<'info, PlatformConfig>,

    pub admin: Signer<'info>,

    /// CHECK: Optional new treasury; just storing the pubkey.
    pub new_treasury: Option<UncheckedAccount<'info>>,
}

/// Phase 3.2: Record TWAP sample.
#[derive(Accounts)]
pub struct RecordTwap<'info> {
    #[account(
        mut,
        constraint = room.status == RoomStatus::Active @ ShitMarketError::RoomNotActive
    )]
    pub room: Account<'info, Room>,

    /// CHECK: Primary price feed (Pyth). Validated by Pyth helper.
    pub price_feed: UncheckedAccount<'info>,

    #[account(
        constraint = keeper.key() == config.keeper @ ShitMarketError::UnauthorizedKeeper
    )]
    pub keeper: Signer<'info>,

    #[account(seeds = [b"platform_config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,
}

/// Phase 3.3: Pause/unpause the platform.
#[derive(Accounts)]
pub struct PausePlatform<'info> {
    #[account(
        mut,
        seeds = [b"platform_config"],
        bump = config.bump,
        constraint = admin.key() == config.admin @ ShitMarketError::Unauthorized
    )]
    pub config: Account<'info, PlatformConfig>,

    pub admin: Signer<'info>,
}

#[derive(Accounts)]
pub struct RegisterReferral<'info> {
    #[account(
        init,
        payer = user,
        space = 8 + 32 + 32 + 1,
        seeds = [b"user_referral", user.key().as_ref()],
        bump
    )]
    pub user_referral: Account<'info, UserReferral>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ClaimReferralRewards<'info> {
    #[account(
        mut,
        seeds = [b"referral_state", referrer.key().as_ref()],
        bump = referral_state.bump,
        constraint = referral_state.referrer == referrer.key() @ ShitMarketError::Unauthorized
    )]
    pub referral_state: Account<'info, ReferralState>,

    /// CHECK: Vault PDA holding the platform fees
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(mut)]
    pub referrer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct WithdrawVaultFees<'info> {
    #[account(
        seeds = [b"platform_config"],
        bump = config.bump,
        constraint = admin.key() == config.admin @ ShitMarketError::Unauthorized
    )]
    pub config: Account<'info, PlatformConfig>,

    /// CHECK: Vault PDA holding the platform fees
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    /// CHECK: Treasury account to receive the fees; must match config.treasury.
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ ShitMarketError::Unauthorized
    )]
    pub treasury: UncheckedAccount<'info>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}



#[derive(Accounts)]
pub struct ListPosition<'info> {
    #[account(
        constraint = room.status == RoomStatus::Active @ ShitMarketError::RoomNotActive,
        constraint = !room.is_expired(Clock::get()?.unix_timestamp) @ ShitMarketError::RoomExpired
    )]
    pub room: Account<'info, Room>,

    #[account(
        mut,
        realloc = Bet::LEN,
        realloc::payer = seller,
        realloc::zero = false,
        seeds = [
            b"bet",
            room.key().as_ref(),
            bet.user.as_ref(),
            &[match bet.side { Side::Moon => 0, Side::Jeet => 1 }]
        ],
        bump = bet.bump,
        constraint = bet.current_owner == seller.key() @ ShitMarketError::Unauthorized,
        constraint = !bet.claimed @ ShitMarketError::AlreadyClaimed,
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        init,
        payer = seller,
        space = Listing::LEN,
        seeds = [b"listing", bet.key().as_ref()],
        bump
    )]
    pub listing: Account<'info, Listing>,

    #[account(
        seeds = [b"platform_config"],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CancelListing<'info> {
    #[account(
        mut,
        realloc = Bet::LEN,
        realloc::payer = seller,
        realloc::zero = false,
        seeds = [
            b"bet",
            listing.room.as_ref(),
            bet.user.as_ref(),
            &[match bet.side { Side::Moon => 0, Side::Jeet => 1 }]
        ],
        bump = bet.bump,
        constraint = bet.current_owner == seller.key() @ ShitMarketError::Unauthorized,
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        mut,
        close = seller,
        seeds = [b"listing", bet.key().as_ref()],
        bump = listing.bump,
        constraint = listing.bet == bet.key() @ ShitMarketError::InvalidPDA,
        constraint = listing.seller == seller.key() @ ShitMarketError::Unauthorized,
    )]
    pub listing: Account<'info, Listing>,

    #[account(mut)]
    pub seller: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct BuyPosition<'info> {
    #[account(
        constraint = room.status == RoomStatus::Active @ ShitMarketError::RoomNotActive,
        constraint = !room.is_expired(Clock::get()?.unix_timestamp) @ ShitMarketError::RoomExpired
    )]
    pub room: Account<'info, Room>,

    #[account(
        mut,
        realloc = Bet::LEN,
        realloc::payer = buyer,
        realloc::zero = false,
        seeds = [
            b"bet",
            room.key().as_ref(),
            bet.user.as_ref(),
            &[match bet.side { Side::Moon => 0, Side::Jeet => 1 }]
        ],
        bump = bet.bump,
        constraint = bet.current_owner == listing.seller @ ShitMarketError::Unauthorized,
        constraint = !bet.claimed @ ShitMarketError::AlreadyClaimed,
    )]
    pub bet: Account<'info, Bet>,

    #[account(
        mut,
        close = seller,
        seeds = [b"listing", bet.key().as_ref()],
        bump = listing.bump,
        constraint = listing.bet == bet.key() @ ShitMarketError::InvalidPDA,
        constraint = listing.seller == seller.key() @ ShitMarketError::Unauthorized,
    )]
    pub listing: Account<'info, Listing>,

    /// CHECK: The seller receiving the payment
    #[account(mut)]
    pub seller: AccountInfo<'info>,

    /// CHECK: Vault PDA collecting the platform trade fee
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(
        seeds = [b"platform_config"],
        bump
    )]
    pub config: Account<'info, PlatformConfig>,

    #[account(mut)]
    pub buyer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

// ─────────────────────────────────────────────
//  PROGRAM
// ─────────────────────────────────────────────

#[program]
pub mod shitmarket {
    use super::*;

    // ── initialize ──────────────────────────────────────────────────────

    /// Create the singleton PlatformConfig. Must be called once by admin.
    pub fn initialize(
        ctx: Context<Initialize>,
        platform_fee_bps: u16,
    ) -> Result<()> {
        require!(
            platform_fee_bps <= MAX_FEE_BPS,
            ShitMarketError::FeeTooHigh
        );

        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.treasury = ctx.accounts.treasury.key();
        config.keeper = ctx.accounts.admin.key(); // default keeper = admin
        config.platform_fee_bps = platform_fee_bps;
        config.paused = false;
        config.minimum_liquidity = MINIMUM_LIQUIDITY_SOL;
        config.twap_window_seconds = 300; // 5 minutes default TWAP window
        config.cooling_off_seconds = 14 * 24 * 3600; // 14 days default cooling-off
        config.bump = ctx.bumps.config;

        msg!(
            "ShitMarket initialized. Admin={}, Treasury={}, FeeBps={}",
            config.admin,
            config.treasury,
            platform_fee_bps
        );
        Ok(())
    }

    // ── create_room ─────────────────────────────────────────────────────

    /// Create a new prediction room. Snapshot opening price from Pyth.
    /// Requires config.paused == false.
    pub fn create_room(
        ctx: Context<CreateRoom>,
        token_mint: Pubkey,
        token_name: String,
        duration_minutes: u32,
        switchboard_feed: Option<Pubkey>,
        opening_price_param: Option<i64>,
        oracle: Option<Pubkey>,
        oracle_fee_lamports: Option<u64>,
        resolution_criteria: Option<[u8; 64]>,
        _nonce: u8,
    ) -> Result<()> {
        // Circuit breaker: platform must not be paused
        require!(!ctx.accounts.config.paused, ShitMarketError::Paused);

        // Validate duration: between 1 and 525,600 minutes (1 year)
        require!(
            duration_minutes <= 525600,
            ShitMarketError::InvalidDuration
        );

        // Validate Pyth price feed and snapshot the opening price.
        let opening_price = if let Some(custom_price) = opening_price_param {
            custom_price
        } else {
            load_price_feed_price(&ctx.accounts.price_feed.to_account_info())?
        };

        // Truncate/pad token_name to 32 bytes
        let mut name_bytes = [0u8; TOKEN_NAME_LEN];
        let name_src = token_name.as_bytes();
        let copy_len = name_src.len().min(TOKEN_NAME_LEN);
        name_bytes[..copy_len].copy_from_slice(&name_src[..copy_len]);

        let now = Clock::get()?.unix_timestamp;
        let expiry = now
            .checked_add((duration_minutes as i64).checked_mul(SECONDS_PER_MINUTE).ok_or(ShitMarketError::Overflow)?)
            .ok_or(ShitMarketError::Overflow)?;

        let room_key = ctx.accounts.room.key();
        let creator_key = ctx.accounts.creator.key();
        let price_feed_key = ctx.accounts.price_feed.key();

        let room = &mut ctx.accounts.room;
        room.token_mint = token_mint;
        room.token_name = name_bytes;
        room.price_feed = ctx.accounts.price_feed.key();
        room.switchboard_feed = switchboard_feed.unwrap_or(Pubkey::default());
        room.opening_price = opening_price;
        room.opening_timestamp = now;
        room.duration_minutes = duration_minutes;
        room.moon_pool = 0;
        room.jeet_pool = 0;
        room.winner = None;
        room.final_price = 0;
        room.creator = ctx.accounts.creator.key();
        room.twap_samples_ct = 0;
        room.twap_samples = [0i64; MAX_TWAP_SAMPLES];
        room.twap_sample_timestamps = [0i64; MAX_TWAP_SAMPLES];
        room.twap_final_price = 0;
        room.bump = ctx.bumps.room;

        // Custom oracle fields
        room.oracle = oracle.unwrap_or(ctx.accounts.config.keeper);
        room.oracle_fee_lamports = oracle_fee_lamports.unwrap_or(0);
        room.settlement_timestamp = 0;
        room.dispute_status = 0;
        room.resolution_criteria = resolution_criteria.unwrap_or([0u8; 64]);

        room.status = RoomStatus::Active;
        room.expiry_timestamp = expiry;

        emit!(RoomCreated {
            room: room_key,
            creator: creator_key,
            token_mint,
            token_name: token_name.chars().take(32).collect(),
            price_feed: price_feed_key,
            opening_price: room.opening_price,
            duration_minutes,
            expiry_timestamp: room.expiry_timestamp,
            oracle: room.oracle,
            oracle_fee_lamports: room.oracle_fee_lamports,
            resolution_criteria: room.resolution_criteria,
        });

        msg!("Room created: {} ({})", room.token_name_str(), room.token_mint);
        Ok(())
    }

    // ── place_bet ───────────────────────────────────────────────────────

    /// Stake SOL on Moon or Jeet. Can be called multiple times to increase
    /// a bet on the same side. Respects reputation-based bet limits.
    pub fn place_bet(
        ctx: Context<PlaceBet>,
        side: Side,
        amount: u64,
    ) -> Result<()> {
        // Circuit breaker: platform must not be paused
        let config = &ctx.accounts.config;
        require!(!config.paused, ShitMarketError::Paused);

        require!(amount > 0, ShitMarketError::ZeroBetAmount);

        let room_key = ctx.accounts.room.key();
        let room = &mut ctx.accounts.room;
        let now = Clock::get()?.unix_timestamp;
        require!(!room.is_expired(now) || room.duration_minutes == 0, ShitMarketError::RoomExpired);
        require!(room.status == RoomStatus::Active, ShitMarketError::RoomNotActive);



        // Transfer SOL from user → escrow via system_program CPI
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.user.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, amount)?;

        // Update room pool totals
        match side {
            Side::Moon => {
                room.moon_pool = room.moon_pool
                    .checked_add(amount)
                    .ok_or(ShitMarketError::Overflow)?;
            }
            Side::Jeet => {
                room.jeet_pool = room.jeet_pool
                    .checked_add(amount)
                    .ok_or(ShitMarketError::Overflow)?;
            }
        }

        // Update or initialise Bet PDA
        let bet = &mut ctx.accounts.bet;
        if bet.amount == 0 && bet.room == Pubkey::default() {
            // First bet — initialise
            bet.room = room_key;
            bet.user = ctx.accounts.user.key();
            bet.current_owner = ctx.accounts.user.key();
            bet.side = side;
            bet.claimed = false;
            bet.bump = ctx.bumps.bet;
        }
        // If existing bet, verify same side
        if bet.amount > 0 {
            require!(bet.side == side, ShitMarketError::SideMismatch);
        }
        bet.amount = bet.amount
            .checked_add(amount)
            .ok_or(ShitMarketError::Overflow)?;

        emit!(BetPlaced {
            room: room_key,
            user: ctx.accounts.user.key(),
            side: if side == Side::Moon { 0 } else { 1 },
            amount,
            moon_pool: room.moon_pool,
            jeet_pool: room.jeet_pool,
        });

        msg!(
            "Bet placed: {} lamports on {} | MoonPool={} JeetPool={}",
            amount,
            if side == Side::Moon { "MOON" } else { "JEET" },
            room.moon_pool,
            room.jeet_pool
        );
        Ok(())
    }

    // ── record_twap ──────────────────────────────────────────────────────

    /// Phase 3.2: Keeper records a TWAP price sample for an active room.
    pub fn record_twap(
        ctx: Context<RecordTwap>,
    ) -> Result<()> {
        let room = &mut ctx.accounts.room;
        let now = Clock::get()?.unix_timestamp;

        // Circuit breaker: platform must not be paused
        require!(!ctx.accounts.config.paused, ShitMarketError::Paused);
        require!(room.status == RoomStatus::Active, ShitMarketError::RoomNotActive);
        require!(!room.is_expired(now), ShitMarketError::RoomExpired);
        require!(room.price_feed == ctx.accounts.price_feed.key(), ShitMarketError::Unauthorized);

        let current_price = load_price_feed_price(&ctx.accounts.price_feed.to_account_info())?;
        
        room.record_twap_sample(current_price, now);

        msg!("TWAP sample recorded: {} at ts {}", current_price, now);
        Ok(())
    }

    // ── settle_room ─────────────────────────────────────────────────────

    /// Settle the room after expiry. The keeper submits the final price.
    /// Supports multi-oracle via primary Pyth feed + optional Switchboard.
    /// Applies TWAP smoothing using recorded price observations.
    pub fn settle_room(
        ctx: Context<SettleRoom>,
        final_price_param: Option<i64>,
    ) -> Result<()> {
        let room_key = ctx.accounts.room.key();
        let room = &mut ctx.accounts.room;
        let now = Clock::get()?.unix_timestamp;

        // Circuit breaker: platform must not be paused
        require!(!ctx.accounts.config.paused, ShitMarketError::Paused);

        // Guard: room must be active and expired
        require!(room.status == RoomStatus::Active, ShitMarketError::RoomAlreadySettled);
        require!(room.is_expired(now), ShitMarketError::RoomNotExpired);

        // ── ONE-SIDED ROOM VOID: if nobody bet the opposing side, void the room.
        //    All bettors get full refunds — no price oracle needed, no platform fee.
        //    This check MUST come before the minimum liquidity check so that
        //    one-sided rooms (even with tiny pools) always settle correctly.
        let is_one_sided = room.moon_pool == 0 || room.jeet_pool == 0;
        if is_one_sided {
            room.status = RoomStatus::Settled;
            room.winner = None; // Draw path → each bettor claims full stake via claim_winnings
            room.final_price = room.opening_price; // unchanged — no actual contest
            room.twap_final_price = room.opening_price;

            let total_pool = room.total_pool()?;
            emit!(RoomVoided {
                room: room_key,
                total_refund_pool: total_pool,
                reason: "One-sided room: no opposing bets placed. Full refund.".to_string(),
            });

            msg!(
                "Room VOIDED (one-sided): moon_pool={} jeet_pool={}. Full refunds available.",
                room.moon_pool,
                room.jeet_pool
            );
            return Ok(());
        }

        // Phase 3.4: Minimum liquidity check — only applies to two-sided rooms
        let total_pool = room.total_pool()?;
        require!(
            total_pool >= ctx.accounts.config.minimum_liquidity,
            ShitMarketError::InsufficientLiquidity
        );

        // Phase 3.1: Multi-oracle — validate Pyth feed
        require!(ctx.accounts.price_feed.key() == room.price_feed, ShitMarketError::InvalidPythFeed);

        let is_sentinel = ctx.accounts.price_feed.key() == anchor_lang::system_program::ID 
            || ctx.accounts.price_feed.owner == &anchor_lang::system_program::ID 
            || ctx.accounts.price_feed.data_is_empty();

        let final_price = if is_sentinel && final_price_param.is_some() {
            final_price_param.unwrap()
        } else {
            let pyth_price = load_price_feed_price(&ctx.accounts.price_feed.to_account_info())?;
            if room.switchboard_feed != Pubkey::default()
                && ctx.accounts.switchboard_feed.key() == room.switchboard_feed
            {
                pyth_price
            } else {
                pyth_price
            }
        };

        // Determine winner: Moon if price goes up, Jeet if it goes down, None if it remains the same (Draw)
        let winner = if final_price > room.opening_price {
            Some(Side::Moon)
        } else if final_price < room.opening_price {
            Some(Side::Jeet)
        } else {
            None
        };

        // Phase 3.2: Record TWAP sample
        room.record_twap_sample(final_price, now);

        // Compute TWAP-smoothed final price
        let twap_window = ctx.accounts.config.twap_window_seconds;
        let twap_final = room.compute_twap_final(now, twap_window);
        room.twap_final_price = twap_final;
        // Calculate and transfer platform fee to treasury
        let fee_bps = ctx.accounts.config.platform_fee_bps;
        let platform_fee = calc_platform_fee(total_pool, fee_bps)?;

        if platform_fee > 0 && total_pool > 0 {
            let escrow_info = ctx.accounts.escrow.to_account_info();
            let vault_info = ctx.accounts.vault.to_account_info();

            **escrow_info.lamports.borrow_mut() = escrow_info
                .lamports()
                .checked_sub(platform_fee)
                .ok_or(ShitMarketError::Underflow)?;
            **vault_info.lamports.borrow_mut() = vault_info
                .lamports()
                .checked_add(platform_fee)
                .ok_or(ShitMarketError::Overflow)?;
        }

        // Transfer oracle fee to the resolver
        let oracle_fee = room.oracle_fee_lamports;
        if oracle_fee > 0 && total_pool > 0 {
            let escrow_info = ctx.accounts.escrow.to_account_info();
            let keeper_info = ctx.accounts.keeper.to_account_info();

            **escrow_info.lamports.borrow_mut() = escrow_info
                .lamports()
                .checked_sub(oracle_fee)
                .ok_or(ShitMarketError::Underflow)?;
            **keeper_info.lamports.borrow_mut() = keeper_info
                .lamports()
                .checked_add(oracle_fee)
                .ok_or(ShitMarketError::Overflow)?;
        }

        // Mark room settled
        room.settlement_timestamp = now;
        room.status = RoomStatus::Settled;
        room.winner = winner;
        room.final_price = final_price;

        emit!(RoomSettled {
            room: room_key,
            winner: if let Some(w) = winner {
                if w == Side::Moon { 0 } else { 1 }
            } else {
                2 // 2 represents Draw
            },
            opening_price: room.opening_price,
            final_price,
            twap_final_price: twap_final,
            total_pool,
            platform_fee,
        });

        msg!(
            "Room settled: winner={} opening={} final={} twap_final={} fee={}",
            if let Some(w) = winner {
                if w == Side::Moon { "MOON" } else { "JEET" }
            } else {
                "DRAW"
            },
            room.opening_price,
            final_price,
            twap_final,
            platform_fee
        );
        Ok(())
    }

    // ── sweep_escrow ────────────────────────────────────────────────────

    /// Admin-only: sweeps all remaining/unclaimed funds from a settled room's escrow PDA.
    /// Enforces a cooling-off period after room expiry before sweep is permitted.
    pub fn sweep_escrow(ctx: Context<SweepEscrow>) -> Result<()> {
        let room = &ctx.accounts.room;
        let config = &ctx.accounts.config;
        require!(room.status == RoomStatus::Settled, ShitMarketError::RoomNotSettled);

        // Enforce cooling-off: now >= expiry + cooling_off_seconds
        let now = Clock::get()?.unix_timestamp;
        let sweep_eligible_at = room.expiry_timestamp
            .checked_add(config.cooling_off_seconds)
            .ok_or(ShitMarketError::Overflow)?;
        require!(now >= sweep_eligible_at, ShitMarketError::CoolingOffActive);

        let escrow_info = ctx.accounts.escrow.to_account_info();
        let receiver_info = ctx.accounts.receiver.to_account_info();

        let sweep_amount = escrow_info.lamports();

        if sweep_amount > 0 {
            **escrow_info.lamports.borrow_mut() = escrow_info
                .lamports()
                .checked_sub(sweep_amount)
                .ok_or(ShitMarketError::Underflow)?;
            **receiver_info.lamports.borrow_mut() = receiver_info
                .lamports()
                .checked_add(sweep_amount)
                .ok_or(ShitMarketError::Overflow)?;

            emit!(EscrowSwept {
                room: room.key(),
                receiver: receiver_info.key(),
                amount: sweep_amount,
            });

            msg!(
                "Swept {} lamports from room {} escrow to receiver {}",
                sweep_amount,
                room.key(),
                receiver_info.key()
            );
        }

        Ok(())
    }

    // ── claim_winnings ──────────────────────────────────────────────────

    /// Winners claim their proportional share of the pot after settlement.
    /// CRITICAL: claimed flag is set BEFORE lamport transfer to prevent reentrancy.
    pub fn claim_winnings<'a, 'b, 'c, 'info>(ctx: Context<'a, 'b, 'c, 'info, ClaimWinnings<'info>>) -> Result<()> {
        let room = &ctx.accounts.room;
        let bet = &mut ctx.accounts.bet;
        let config = &ctx.accounts.config;

        require!(room.status == RoomStatus::Settled, ShitMarketError::RoomNotSettled);

        let total_pool = room.total_pool()?;
        let is_one_sided = room.moon_pool == 0 || room.jeet_pool == 0;
        let platform_fee = if is_one_sided {
            0
        } else {
            calc_platform_fee(total_pool, config.platform_fee_bps)?
        };
        let oracle_fee = if is_one_sided { 0 } else { room.oracle_fee_lamports };
        let total_payout_pool = total_pool
            .checked_sub(platform_fee).ok_or(ShitMarketError::Underflow)?
            .checked_sub(oracle_fee).ok_or(ShitMarketError::Underflow)?;

        let payout = if let Some(winner) = room.winner {
            require!(bet.side == winner, ShitMarketError::NotAWinner);
            let winning_pool = if winner == Side::Moon {
                room.moon_pool
            } else {
                room.jeet_pool
            };
            calc_payout(bet.amount, winning_pool, total_payout_pool)?
        } else {
            // It's a draw! Both sides claim proportionally from the remaining escrow
            calc_payout(bet.amount, total_pool, total_payout_pool)?
        };

        // ── REENTRANCY GUARD: set claimed BEFORE transfer ──────────────
        bet.claimed = true;

        // ── REFERRAL COMMISSIONS (0.1% reward to referrer) ────────────
        if ctx.remaining_accounts.len() >= 2 {
            let user_referral_info = &ctx.remaining_accounts[0];
            let referral_state_info = &ctx.remaining_accounts[1];

            let user_key = bet.current_owner;
            let (expected_user_referral_pda, _) = Pubkey::find_program_address(
                &[b"user_referral", user_key.as_ref()],
                ctx.program_id
            );

            if user_referral_info.key() == expected_user_referral_pda && !user_referral_info.data_is_empty() {
                let user_referral: UserReferral = AccountDeserialize::try_deserialize(&mut &user_referral_info.try_borrow_data()?[..])?;
                
                let (expected_referral_state_pda, bump) = Pubkey::find_program_address(
                    &[b"referral_state", user_referral.referrer.as_ref()],
                    ctx.program_id
                );

                if referral_state_info.key() == expected_referral_state_pda {
                    if referral_state_info.data_is_empty() {
                        let rent = Rent::get()?;
                        let space = 8 + 32 + 8 + 8 + 1;
                        let lamports = rent.minimum_balance(space);

                        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
                            ctx.accounts.payer.key,
                            referral_state_info.key,
                            lamports,
                        );
                        anchor_lang::solana_program::program::invoke(
                            &transfer_ix,
                            &[
                                ctx.accounts.payer.to_account_info(),
                                referral_state_info.clone(),
                                ctx.accounts.system_program.to_account_info(),
                            ],
                        )?;

                        let signer_seeds: &[&[u8]] = &[
                            b"referral_state",
                            user_referral.referrer.as_ref(),
                            &[bump],
                        ];
                        anchor_lang::solana_program::program::invoke_signed(
                            &anchor_lang::solana_program::system_instruction::allocate(
                                referral_state_info.key,
                                space as u64,
                            ),
                            &[referral_state_info.to_account_info()],
                            &[signer_seeds],
                        )?;
                        anchor_lang::solana_program::program::invoke_signed(
                            &anchor_lang::solana_program::system_instruction::assign(
                                referral_state_info.key,
                                ctx.program_id,
                            ),
                            &[referral_state_info.to_account_info()],
                            &[signer_seeds],
                        )?;

                        let new_state = ReferralState {
                            referrer: user_referral.referrer,
                            unclaimed_rewards: 0,
                            claimed_rewards: 0,
                            bump,
                        };
                        let mut data = referral_state_info.try_borrow_mut_data()?;
                        new_state.try_serialize(&mut &mut data[..])?;
                    }

                    let mut referral_state: ReferralState = AccountDeserialize::try_deserialize(&mut &referral_state_info.try_borrow_data()?[..])?;
                    
                    let winning_pool = if let Some(winner) = room.winner {
                        if winner == Side::Moon { room.moon_pool } else { room.jeet_pool }
                    } else {
                        total_pool
                    };
                    
                    if winning_pool > 0 {
                        let user_total_share = (bet.amount as u128)
                            .checked_mul(total_pool as u128).ok_or(ShitMarketError::Overflow)?
                            .checked_div(winning_pool as u128).ok_or(ShitMarketError::DivisionByZero)? as u64;

                        let referrer_reward = user_total_share.checked_div(1000).unwrap_or(0);

                        if referrer_reward > 0 {
                            referral_state.unclaimed_rewards = referral_state.unclaimed_rewards.checked_add(referrer_reward).ok_or(ShitMarketError::Overflow)?;
                            
                            let mut data = referral_state_info.try_borrow_mut_data()?;
                            referral_state.try_serialize(&mut &mut data[..])?;

                            emit!(ReferralRewardAccrued {
                                referrer: user_referral.referrer,
                                invitee: user_key,
                                room: room.key(),
                                reward_amount: referrer_reward,
                            });

                            msg!("Referral reward accrued: {} lamports → {}", referrer_reward, user_referral.referrer);
                        }
                    }
                }
            }
        }

        // Transfer lamports from escrow → user
        let escrow_info = ctx.accounts.escrow.to_account_info();
        let user_info = ctx.accounts.user.to_account_info();

        **escrow_info.lamports.borrow_mut() = escrow_info
            .lamports()
            .checked_sub(payout)
            .ok_or(ShitMarketError::Underflow)?;
        **user_info.lamports.borrow_mut() = user_info
            .lamports()
            .checked_add(payout)
            .ok_or(ShitMarketError::Overflow)?;

        emit!(WinningsClaimed {
            room: ctx.accounts.room.key(),
            user: bet.current_owner,
            amount: payout,
        });

        msg!("Winnings claimed: {} lamports → {}", payout, bet.current_owner);
        Ok(())
    }

    // ── update_config ───────────────────────────────────────────────────

    /// Admin-only: update platform fee, treasury, keeper, minimum liquidity,
    /// TWAP window, and cooling-off period.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_fee_bps: Option<u16>,
        new_treasury: Option<Pubkey>,
        new_keeper: Option<Pubkey>,
        new_minimum_liquidity: Option<u64>,
        new_twap_window: Option<i64>,
        new_cooling_off: Option<i64>,
    ) -> Result<()> {
        let config = &mut ctx.accounts.config;

        if let Some(fee) = new_fee_bps {
            require!(fee <= MAX_FEE_BPS, ShitMarketError::FeeTooHigh);
            config.platform_fee_bps = fee;
        }

        if let Some(treasury) = new_treasury {
            config.treasury = treasury;
        }

        if let Some(keeper) = new_keeper {
            config.keeper = keeper;
        }

        if let Some(min_liquidity) = new_minimum_liquidity {
            config.minimum_liquidity = min_liquidity;
        }

        if let Some(twap_window) = new_twap_window {
            require!(twap_window > 0, ShitMarketError::InvalidPrice);
            config.twap_window_seconds = twap_window;
        }

        if let Some(cooling_off) = new_cooling_off {
            require!(cooling_off >= 0, ShitMarketError::InvalidDuration);
            config.cooling_off_seconds = cooling_off;
        }

        msg!(
            "Config updated: fee_bps={} treasury={} keeper={} min_liquidity={} twap_window={} cooling_off={}",
            config.platform_fee_bps,
            config.treasury,
            config.keeper,
            config.minimum_liquidity,
            config.twap_window_seconds,
            config.cooling_off_seconds
        );
        Ok(())
    }

    // ── pause / unpause ─────────────────────────────────────────────────

    /// Pause the platform. No new rooms, bets, or settlements while paused.
    pub fn pause(ctx: Context<PausePlatform>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = true;

        emit!(PlatformPaused { paused: true });

        msg!("Platform paused by admin {}", config.admin);
        Ok(())
    }

    /// Unpause the platform. Resumes normal operation.
    pub fn unpause(ctx: Context<PausePlatform>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.paused = false;

        emit!(PlatformPaused { paused: false });

        msg!("Platform unpaused by admin {}", config.admin);
        Ok(())
    }

    /// Register a user's referrer on-chain
    pub fn register_referral(ctx: Context<RegisterReferral>, referrer: Pubkey) -> Result<()> {
        let user_referral = &mut ctx.accounts.user_referral;
        user_referral.user = ctx.accounts.user.key();
        user_referral.referrer = referrer;
        user_referral.bump = ctx.bumps.user_referral;

        emit!(ReferralRegistered {
            user: ctx.accounts.user.key(),
            referrer,
        });

        msg!("Referral registered: user={} referrer={}", ctx.accounts.user.key(), referrer);
        Ok(())
    }

    /// Claim accrued referral rewards from the vault PDA
    pub fn claim_referral_rewards(ctx: Context<ClaimReferralRewards>) -> Result<()> {
        let referral_state = &mut ctx.accounts.referral_state;
        let amount = referral_state.unclaimed_rewards.checked_sub(referral_state.claimed_rewards).ok_or(ShitMarketError::Underflow)?;
        require!(amount > 0, ShitMarketError::NoRewardsToClaim);

        referral_state.claimed_rewards = referral_state.unclaimed_rewards;

        let vault_info = ctx.accounts.vault.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();

        let vault_bump = ctx.bumps.vault;
        let signer_seeds: &[&[u8]] = &[
            b"vault",
            &[vault_bump],
        ];

        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            vault_info.key,
            ctx.accounts.referrer.key,
            amount,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &transfer_ix,
            &[
                vault_info,
                ctx.accounts.referrer.to_account_info(),
                system_program_info,
            ],
            &[signer_seeds],
        )?;

        emit!(ReferralRewardsClaimed {
            referrer: ctx.accounts.referrer.key(),
            amount,
        });

        msg!("Referral rewards claimed: {} lamports → {}", amount, ctx.accounts.referrer.key());
        Ok(())
    }

    /// Admin-only: Withdraw platform fees from the vault PDA to treasury wallet
    pub fn withdraw_vault_fees(ctx: Context<WithdrawVaultFees>, amount: u64) -> Result<()> {
        let vault_info = ctx.accounts.vault.to_account_info();
        let treasury_info = ctx.accounts.treasury.to_account_info();
        let system_program_info = ctx.accounts.system_program.to_account_info();

        let vault_bump = ctx.bumps.vault;
        let signer_seeds: &[&[u8]] = &[
            b"vault",
            &[vault_bump],
        ];

        let transfer_ix = anchor_lang::solana_program::system_instruction::transfer(
            vault_info.key,
            treasury_info.key,
            amount,
        );
        anchor_lang::solana_program::program::invoke_signed(
            &transfer_ix,
            &[
                vault_info,
                treasury_info,
                system_program_info,
            ],
            &[signer_seeds],
        )?;

        msg!("Withdrew {} platform fee lamports to treasury", amount);
        Ok(())
    }

    // ── secondary market ──────────────────────────────────────────────────

    /// List a position for sale on the secondary market.
    pub fn list_position(ctx: Context<ListPosition>, price: u64) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.paused, ShitMarketError::Paused);
        require!(price > 0, ShitMarketError::ZeroBetAmount);

        let listing = &mut ctx.accounts.listing;
        listing.room = ctx.accounts.room.key();
        listing.bet = ctx.accounts.bet.key();
        listing.seller = ctx.accounts.seller.key();
        listing.price = price;
        listing.bump = ctx.bumps.listing;

        emit!(PositionListed {
            room: ctx.accounts.room.key(),
            bet: ctx.accounts.bet.key(),
            seller: ctx.accounts.seller.key(),
            price,
        });

        msg!(
            "Position listed: room={} bet={} seller={} price={}",
            ctx.accounts.room.key(),
            ctx.accounts.bet.key(),
            ctx.accounts.seller.key(),
            price
        );

        Ok(())
    }

    /// Cancel an active position listing.
    pub fn cancel_listing(ctx: Context<CancelListing>) -> Result<()> {
        emit!(ListingCancelled {
            room: ctx.accounts.listing.room,
            bet: ctx.accounts.bet.key(),
            seller: ctx.accounts.seller.key(),
        });

        msg!(
            "Listing cancelled: room={} bet={} seller={}",
            ctx.accounts.listing.room,
            ctx.accounts.bet.key(),
            ctx.accounts.seller.key()
        );

        Ok(())
    }

    /// Purchase a listed position.
    pub fn buy_position(ctx: Context<BuyPosition>) -> Result<()> {
        let config = &ctx.accounts.config;
        require!(!config.paused, ShitMarketError::Paused);

        let price = ctx.accounts.listing.price;
        let fee = price
            .checked_mul(SECONDARY_FEE_BPS as u64)
            .ok_or(ShitMarketError::Overflow)?
            .checked_div(10000)
            .ok_or(ShitMarketError::DivisionByZero)?;
        
        let seller_amount = price.checked_sub(fee).ok_or(ShitMarketError::Underflow)?;

        // Transfer payment to seller
        if seller_amount > 0 {
            let transfer_to_seller_ix = anchor_lang::solana_program::system_instruction::transfer(
                ctx.accounts.buyer.key,
                ctx.accounts.seller.key,
                seller_amount,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_to_seller_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.seller.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // Transfer fee to vault
        if fee > 0 {
            let transfer_to_vault_ix = anchor_lang::solana_program::system_instruction::transfer(
                ctx.accounts.buyer.key,
                ctx.accounts.vault.key,
                fee,
            );
            anchor_lang::solana_program::program::invoke(
                &transfer_to_vault_ix,
                &[
                    ctx.accounts.buyer.to_account_info(),
                    ctx.accounts.vault.to_account_info(),
                    ctx.accounts.system_program.to_account_info(),
                ],
            )?;
        }

        // Update bet owner
        let bet = &mut ctx.accounts.bet;
        let old_owner = bet.current_owner;
        bet.current_owner = ctx.accounts.buyer.key();

        emit!(PositionPurchased {
            room: ctx.accounts.room.key(),
            bet: bet.key(),
            seller: old_owner,
            buyer: ctx.accounts.buyer.key(),
            price,
        });

        msg!(
            "Position purchased: room={} bet={} old_owner={} new_owner={} price={}",
            ctx.accounts.room.key(),
            bet.key(),
            old_owner,
            bet.current_owner,
            price
        );

        Ok(())
    }

    /// Migrate an old 83-byte Bet PDA to the new 115-byte format (adding current_owner).
    pub fn migrate_bet(ctx: Context<MigrateBet>, side: Side) -> Result<()> {
        let bet_info = &ctx.accounts.bet;
        let user = &ctx.accounts.user;
        let system_program = &ctx.accounts.system_program;
        
        let old_len = bet_info.data_len();
        if old_len == 83 {
            msg!("Migrating bet PDA from 83 to 115 bytes...");
            
            // Rent calculation
            let new_len = 115;
            let rent = Rent::get()?;
            let new_rent = rent.minimum_balance(new_len);
            let old_rent = bet_info.lamports();
            
            if new_rent > old_rent {
                let rent_diff = new_rent - old_rent;
                // Transfer rent difference from user to bet account
                let cpi_ctx = CpiContext::new(
                    system_program.to_account_info(),
                    system_program::Transfer {
                        from: user.to_account_info(),
                        to: bet_info.clone(),
                    },
                );
                system_program::transfer(cpi_ctx, rent_diff)?;
            }
            
            // Reallocate the account data size to 115 bytes
            bet_info.realloc(new_len, false)?;
            
            // Read and shift the data
            let mut data = bet_info.try_borrow_mut_data()?;
            
            // Shift the 11 trailing bytes (side, amount, claimed, bump) to make room for current_owner (32 bytes)
            let mut trailing = [0u8; 11];
            trailing.copy_from_slice(&data[72..83]);
            
            // Initialize current_owner as the original user's pubkey (offset 40 to 72)
            let mut user_pubkey = [0u8; 32];
            user_pubkey.copy_from_slice(&data[40..72]);
            
            // Write current_owner at offset 72
            data[72..104].copy_from_slice(&user_pubkey);
            
            // Write the trailing 11 bytes at offset 104
            data[104..115].copy_from_slice(&trailing);
            
            msg!("Migration complete!");
        } else {
            msg!("Bet PDA already migrated or uninitialized (size={})", old_len);
        }
        
        Ok(())
    }

    /// Dispute / challenge a settled prediction room within the challenge window
    pub fn dispute_room(ctx: Context<DisputeRoom>) -> Result<()> {
        let room = &mut ctx.accounts.room;
        let now = Clock::get()?.unix_timestamp;

        require!(room.status == RoomStatus::Settled, ShitMarketError::RoomNotSettled);
        require!(
            now <= room.settlement_timestamp + CHALLENGE_WINDOW_SECONDS,
            ShitMarketError::ChallengePeriodExpired
        );

        // Lock dispute bond (0.1 SOL) from challenger -> escrow
        let bond_amount = 100_000_000u64; // 0.1 SOL
        let cpi_ctx = CpiContext::new(
            ctx.accounts.system_program.to_account_info(),
            system_program::Transfer {
                from: ctx.accounts.challenger.to_account_info(),
                to: ctx.accounts.escrow.to_account_info(),
            },
        );
        system_program::transfer(cpi_ctx, bond_amount)?;

        // Set status to Disputed
        room.status = RoomStatus::Disputed;

        emit!(RoomDisputed {
            room: room.key(),
            challenger: ctx.accounts.challenger.key(),
            dispute_bond: bond_amount,
        });

        msg!("Room disputed: {} by challenger {}", room.key(), ctx.accounts.challenger.key());
        Ok(())
    }

    /// Resolve an active dispute. Overturn or confirm verdict, slash or refund bond.
    pub fn resolve_dispute(
        ctx: Context<ResolveDispute>,
        winner: Option<Side>,
        overturned: bool,
    ) -> Result<()> {
        let room = &mut ctx.accounts.room;
        let bond_amount = 100_000_000u64; // 0.1 SOL

        if overturned {
            // Overturned! Refund the challenger their bond from the escrow
            let escrow_info = ctx.accounts.escrow.to_account_info();
            let challenger_info = ctx.accounts.challenger.to_account_info();

            **escrow_info.lamports.borrow_mut() = escrow_info
                .lamports()
                .checked_sub(bond_amount)
                .ok_or(ShitMarketError::Underflow)?;
            **challenger_info.lamports.borrow_mut() = challenger_info
                .lamports()
                .checked_add(bond_amount)
                .ok_or(ShitMarketError::Overflow)?;

            room.dispute_status = 1; // Overturned
        } else {
            // Dispute dismissed. Slash bond: transfer from escrow -> vault
            let escrow_info = ctx.accounts.escrow.to_account_info();
            let vault_info = ctx.accounts.vault.to_account_info();

            **escrow_info.lamports.borrow_mut() = escrow_info
                .lamports()
                .checked_sub(bond_amount)
                .ok_or(ShitMarketError::Underflow)?;
            **vault_info.lamports.borrow_mut() = vault_info
                .lamports()
                .checked_add(bond_amount)
                .ok_or(ShitMarketError::Overflow)?;

            room.dispute_status = 0; // Dismissed/None
        }

        // Set the final winner and restore settled status
        room.winner = winner;
        room.status = RoomStatus::Settled;

        emit!(DisputeResolved {
            room: room.key(),
            winner: if let Some(w) = winner {
                if w == Side::Moon { 0 } else { 1 }
            } else {
                2 // Draw
            },
            refund_challenger: overturned,
        });

        msg!(
            "Dispute resolved for room {}: winner={:?}, overturned={}",
            room.key(),
            winner,
            overturned
        );
        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(side: Side)]
pub struct MigrateBet<'info> {
    #[account(
        mut,
        seeds = [
            b"bet",
            room.key().as_ref(),
            user.key().as_ref(),
            &[match side { Side::Moon => 0, Side::Jeet => 1 }]
        ],
        bump
    )]
    /// CHECK: Manual reallocation / checks
    pub bet: AccountInfo<'info>,

    pub room: Account<'info, Room>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct DisputeRoom<'info> {
    #[account(
        mut,
        constraint = room.status == RoomStatus::Settled @ ShitMarketError::RoomNotSettled
    )]
    pub room: Account<'info, Room>,

    /// CHECK: Escrow PDA; validated by seeds.
    #[account(
        mut,
        seeds = [b"escrow", room.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,

    #[account(
        seeds = [b"platform_config"],
        bump = config.bump
    )]
    pub config: Account<'info, PlatformConfig>,

    #[account(mut)]
    pub challenger: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct ResolveDispute<'info> {
    #[account(
        mut,
        constraint = room.status == RoomStatus::Disputed @ ShitMarketError::DisputeNotActive
    )]
    pub room: Account<'info, Room>,

    /// CHECK: Escrow PDA; validated by seeds.
    #[account(
        mut,
        seeds = [b"escrow", room.key().as_ref()],
        bump
    )]
    pub escrow: UncheckedAccount<'info>,

    /// CHECK: Challenger to receive refund if dispute is successful.
    #[account(mut)]
    pub challenger: AccountInfo<'info>,

    /// CHECK: Vault PDA to collect slashed dispute bonds.
    #[account(
        mut,
        seeds = [b"vault"],
        bump
    )]
    pub vault: UncheckedAccount<'info>,

    #[account(
        seeds = [b"platform_config"],
        bump = config.bump,
        constraint = admin.key() == config.admin @ ShitMarketError::UnauthorizedDisputeResolver
    )]
    pub config: Account<'info, PlatformConfig>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}


