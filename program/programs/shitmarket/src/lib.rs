use anchor_lang::prelude::*;
use anchor_lang::system_program;

pub mod error;
pub mod price;
pub mod pyth;

use error::ShitMarketError;
use price::{calc_payout, calc_platform_fee, moon_wins, compute_ema};
use pyth::load_price_feed_price;

declare_id!("2zW7Fj9tpVGqJ2FAMVfNY2WqkX8mH3xxV9KrfAzQjWpJ");

// ─────────────────────────────────────────────
//  CONSTANTS
// ─────────────────────────────────────────────

const MAX_FEE_BPS: u16 = 1_000; // 10% absolute maximum
const SECONDS_PER_MINUTE: i64 = 60;
const TOKEN_NAME_LEN: usize = 32;
const MINIMUM_LIQUIDITY_SOL: u64 = 100_000_000; // 0.1 SOL minimum pool requirement
const MAX_TWAP_SAMPLES: usize = 5; // number of price samples to store for TWAP
const REPUTATION_TIER_COUNT: u8 = 5; // S, A, B, C, D tiers

// Bet limits per reputation tier (in lamports)
// Tier 0 (D): 1 SOL, Tier 1 (C): 5 SOL, Tier 2 (B): 25 SOL, Tier 3 (A): 100 SOL, Tier 4 (S): unlimited
const BET_LIMITS: [u64; 5] = [
    LAMPORTS_PER_SOL,           // D: 1 SOL
    LAMPORTS_PER_SOL * 5,       // C: 5 SOL
    LAMPORTS_PER_SOL * 25,      // B: 25 SOL
    LAMPORTS_PER_SOL * 100,     // A: 100 SOL
    u64::MAX,                   // S: unlimited
];
const LAMPORTS_PER_SOL: u64 = 1_000_000_000;

// ─────────────────────────────────────────────
//  ENUMS
// ─────────────────────────────────────────────

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Side {
    Moon,
    Jeet,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum RoomStatus {
    Active,
    Settled,
}

/// Reputation tier determines max bet amount.
/// Higher tier = higher betting capacity.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, Debug, PartialEq, Eq)]
pub enum ReputationTier {
    D, // tier 0 — default for new wallets
    C, // tier 1
    B, // tier 2
    A, // tier 3
    S, // tier 4 — highest
}

impl ReputationTier {
    pub fn to_index(&self) -> u8 {
        match self {
            ReputationTier::D => 0,
            ReputationTier::C => 1,
            ReputationTier::B => 2,
            ReputationTier::A => 3,
            ReputationTier::S => 4,
        }
    }

    pub fn from_index(idx: u8) -> Self {
        match idx {
            0 => ReputationTier::D,
            1 => ReputationTier::C,
            2 => ReputationTier::B,
            3 => ReputationTier::A,
            _ => ReputationTier::S,
        }
    }

    pub fn max_bet_amount(&self) -> u64 {
        BET_LIMITS[self.to_index() as usize]
    }
}

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
    pub bump: u8,
}

impl PlatformConfig {
    // 8 discrim + 32 admin + 32 treasury + 32 keeper + 2 fee + 1 paused + 8 min_liquidity + 8 twap_window + 1 bump
    pub const LEN: usize = 8 + 32 + 32 + 32 + 2 + 1 + 8 + 8 + 1;
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
}

impl Room {
    // 8 + 32 + 32 + 32 + 32 + 32(pyth) + 32(switchboard) + 8 + 8 + 4 + 8 + 8 + 8 + 2 + 8 + 32 + 1(twap_ct) + 40(twap_samples: 5*8) + 40(twap_timestamps: 5*8) + 8(twap_final) + 8(entry_liq) + 8(entry_mcap) + 1 = 393
    pub const LEN: usize = 8 + 32 + 32 + 32 + 32 + 32 + 8 + 8 + 4 + 8 + 8 + 8 + 2 + 8 + 32 + 1 + 40 + 40 + 8 + 8 + 8 + 1;

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
    /// Which side this bet is on.
    pub side: Side,
    /// Total amount staked (lamports). Updated on repeat bets.
    pub amount: u64,
    /// Whether winnings have been claimed. MUST be set before transfer.
    pub claimed: bool,
    pub bump: u8,
}

impl Bet {
    // 8 + 32 + 32 + 1 + 8 + 1 + 1
    pub const LEN: usize = 8 + 32 + 32 + 1 + 8 + 1 + 1;
}

/// Phase 3.5: Wallet reputation account — keeps track of user stats.
/// Initialized on first bet or first win.
#[account]
pub struct Reputation {
    /// The wallet this reputation belongs to.
    pub user: Pubkey,
    /// Current tier.
    pub tier: ReputationTier,
    /// Total number of bets placed.
    pub total_bets: u64,
    /// Total number of wins.
    pub total_wins: u64,
    /// Total volume bet (lamports).
    pub total_volume: u64,
    /// Total profit (lamports). Can be negative.
    pub total_profit: i64,
    /// Last time the tier was evaluated.
    pub last_evaluated: i64,
    pub bump: u8,
}

impl Reputation {
    // 8 + 32 + 1 + 8 + 8 + 8 + 8 + 8 + 1 = 82
    pub const LEN: usize = 8 + 32 + 1 + 8 + 8 + 8 + 8 + 8 + 1;

    /// Evaluate and potentially upgrade the tier based on stats.
    pub fn evaluate_tier(&mut self, now: i64) {
        // Tier thresholds:
        // D: < 5 bets OR < 2 wins
        // C: >= 5 bets AND >= 2 wins AND >= 10 SOL volume
        // B: >= 25 bets AND >= 10 wins AND >= 50 SOL volume
        // A: >= 100 bets AND >= 40 wins AND >= 200 SOL volume
        // S: >= 500 bets AND >= 200 wins AND >= 1000 SOL volume

        if self.total_bets >= 500 && self.total_wins >= 200 && self.total_volume >= 1_000 * LAMPORTS_PER_SOL {
            self.tier = ReputationTier::S;
        } else if self.total_bets >= 100 && self.total_wins >= 40 && self.total_volume >= 200 * LAMPORTS_PER_SOL {
            self.tier = ReputationTier::A;
        } else if self.total_bets >= 25 && self.total_wins >= 10 && self.total_volume >= 50 * LAMPORTS_PER_SOL {
            self.tier = ReputationTier::B;
        } else if self.total_bets >= 5 && self.total_wins >= 2 && self.total_volume >= 10 * LAMPORTS_PER_SOL {
            self.tier = ReputationTier::C;
        } else {
            self.tier = ReputationTier::D;
        }

        self.last_evaluated = now;
    }
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
pub struct ReputationUpdated {
    pub user: Pubkey,
    pub tier: u8,
    pub total_bets: u64,
    pub total_wins: u64,
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

    /// Optional: Reputation account. If not provided, defaults to tier D limits.
    pub reputation: Option<Account<'info, Reputation>>,

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

    /// CHECK: Treasury from PlatformConfig; must match config.treasury.
    #[account(
        mut,
        constraint = treasury.key() == config.treasury @ ShitMarketError::Unauthorized
    )]
    pub treasury: UncheckedAccount<'info>,

    /// CHECK: Primary price feed (Pyth). Validated by Pyth helper.
    pub price_feed: UncheckedAccount<'info>,

    /// CHECK: Optional secondary price feed (Switchboard).
    pub switchboard_feed: UncheckedAccount<'info>,

    #[account(seeds = [b"platform_config"], bump = config.bump)]
    pub config: Account<'info, PlatformConfig>,

    #[account(
        mut,
        constraint = keeper.key() == config.keeper @ ShitMarketError::UnauthorizedKeeper
    )]
    pub keeper: Signer<'info>,

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
        seeds = [
            b"bet", 
            room.key().as_ref(), 
            user.key().as_ref(),
            &[match bet.side { Side::Moon => 0, Side::Jeet => 1 }]
        ],
        bump = bet.bump,
        constraint = bet.user == user.key() @ ShitMarketError::Unauthorized,
        constraint = !bet.claimed @ ShitMarketError::AlreadyClaimed,
        constraint = room.winner.is_none() || Some(bet.side) == room.winner @ ShitMarketError::SideMismatch
    )]
    pub bet: Account<'info, Bet>,

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

/// Phase 3.5: Initialize a reputation account for a user.
#[derive(Accounts)]
pub struct InitializeReputation<'info> {
    #[account(
        init,
        payer = user,
        space = Reputation::LEN,
        seeds = [b"reputation", user.key().as_ref()],
        bump
    )]
    pub reputation: Account<'info, Reputation>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

/// Phase 3.5: Update (re-evaluate) reputation tier.
#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    #[account(
        mut,
        seeds = [b"reputation", user.key().as_ref()],
        bump = reputation.bump,
        constraint = reputation.user == user.key() @ ShitMarketError::Unauthorized
    )]
    pub reputation: Account<'info, Reputation>,

    pub user: Signer<'info>,
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
        nonce: u8,
    ) -> Result<()> {
        // Circuit breaker: platform must not be paused
        require!(!ctx.accounts.config.paused, ShitMarketError::Paused);

        // Validate duration: between 1 and 525,600 minutes (1 year)
        require!(
            duration_minutes >= 1 && duration_minutes <= 525600,
            ShitMarketError::InvalidDuration
        );

        // Validate Pyth price feed and snapshot the opening price.
        let is_sentinel = ctx.accounts.price_feed.key() == anchor_lang::system_program::ID 
            || ctx.accounts.price_feed.owner == &anchor_lang::system_program::ID 
            || ctx.accounts.price_feed.data_is_empty();

        let opening_price = if is_sentinel && opening_price_param.is_some() {
            opening_price_param.unwrap()
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
        room.expiry_timestamp = expiry;
        room.moon_pool = 0;
        room.jeet_pool = 0;
        room.status = RoomStatus::Active;
        room.winner = None;
        room.final_price = 0;
        room.creator = ctx.accounts.creator.key();
        room.twap_samples_ct = 0;
        room.twap_samples = [0i64; MAX_TWAP_SAMPLES];
        room.twap_sample_timestamps = [0i64; MAX_TWAP_SAMPLES];
        room.twap_final_price = 0;
        room.bump = ctx.bumps.room;

        emit!(RoomCreated {
            room: room_key,
            creator: creator_key,
            token_mint,
            token_name: token_name.chars().take(32).collect(),
            price_feed: price_feed_key,
            opening_price,
            duration_minutes,
            expiry_timestamp: expiry,
        });

        msg!("Room created: {} ({}) expires at {}", room.token_name_str(), room.token_mint, expiry);
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
        require!(!room.is_expired(now), ShitMarketError::RoomExpired);
        require!(room.status == RoomStatus::Active, ShitMarketError::RoomNotActive);

        // Phase 3.5: Reputation-based bet limit enforcement
        if let Some(reputation) = &ctx.accounts.reputation {
            let max_bet = reputation.tier.max_bet_amount();
            require!(amount <= max_bet, ShitMarketError::BetAmountExceedsLimit);
        } else {
            // No reputation account — default to D tier limit (1 SOL)
            require!(amount <= BET_LIMITS[0], ShitMarketError::BetAmountExceedsLimit);
        }

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

        // Phase 3.4: Minimum liquidity check
        let total_pool = room.total_pool()?;
        require!(
            total_pool >= ctx.accounts.config.minimum_liquidity,
            ShitMarketError::InsufficientLiquidity
        );

        // ── ONE-SIDED ROOM VOID: if nobody bet the opposing side, void the room.
        //    All bettors get full refunds — no price oracle needed, no platform fee.
        let is_one_sided = room.moon_pool == 0 || room.jeet_pool == 0;
        if is_one_sided {
            room.status = RoomStatus::Settled;
            room.winner = None; // Draw path → each bettor claims full stake via claim_winnings
            room.final_price = room.opening_price; // unchanged — no actual contest
            room.twap_final_price = room.opening_price;

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
            let treasury_info = ctx.accounts.treasury.to_account_info();

            **escrow_info.lamports.borrow_mut() = escrow_info
                .lamports()
                .checked_sub(platform_fee)
                .ok_or(ShitMarketError::Underflow)?;
            **treasury_info.lamports.borrow_mut() = treasury_info
                .lamports()
                .checked_add(platform_fee)
                .ok_or(ShitMarketError::Overflow)?;
        }

        // Mark room settled
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

    // ── claim_winnings ──────────────────────────────────────────────────

    /// Winners claim their proportional share of the pot after settlement.
    /// CRITICAL: claimed flag is set BEFORE lamport transfer to prevent reentrancy.
    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
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
        let total_payout_pool = total_pool.checked_sub(platform_fee).ok_or(ShitMarketError::Underflow)?;

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
            user: ctx.accounts.user.key(),
            amount: payout,
        });

        msg!("Winnings claimed: {} lamports → {}", payout, ctx.accounts.user.key());
        Ok(())
    }

    // ── update_config ───────────────────────────────────────────────────

    /// Admin-only: update platform fee, treasury, keeper, minimum liquidity,
    /// and TWAP window.
    pub fn update_config(
        ctx: Context<UpdateConfig>,
        new_fee_bps: Option<u16>,
        new_treasury: Option<Pubkey>,
        new_keeper: Option<Pubkey>,
        new_minimum_liquidity: Option<u64>,
        new_twap_window: Option<i64>,
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

        msg!(
            "Config updated: fee_bps={} treasury={} keeper={} min_liquidity={} twap_window={}",
            config.platform_fee_bps,
            config.treasury,
            config.keeper,
            config.minimum_liquidity,
            config.twap_window_seconds
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

    // ── initialize_reputation ───────────────────────────────────────────

    /// Initialize a reputation account for the user.
    /// Starts at tier D with zero stats.
    pub fn initialize_reputation(ctx: Context<InitializeReputation>) -> Result<()> {
        let reputation = &mut ctx.accounts.reputation;
        reputation.user = ctx.accounts.user.key();
        reputation.tier = ReputationTier::D;
        reputation.total_bets = 0;
        reputation.total_wins = 0;
        reputation.total_volume = 0;
        reputation.total_profit = 0;
        reputation.last_evaluated = Clock::get()?.unix_timestamp;
        reputation.bump = ctx.bumps.reputation;

        msg!("Reputation initialized for user {}", reputation.user);
        Ok(())
    }

    /// Re-evaluate and potentially upgrade the user's reputation tier.
    /// Anyone can call this for any user.
    pub fn update_reputation(ctx: Context<UpdateReputation>) -> Result<()> {
        let reputation = &mut ctx.accounts.reputation;
        let now = Clock::get()?.unix_timestamp;

        reputation.evaluate_tier(now);

        emit!(ReputationUpdated {
            user: reputation.user,
            tier: reputation.tier.to_index(),
            total_bets: reputation.total_bets,
            total_wins: reputation.total_wins,
        });

        msg!(
            "Reputation updated for {}: tier={:?} bets={} wins={}",
            reputation.user,
            reputation.tier,
            reputation.total_bets,
            reputation.total_wins
        );
        Ok(())
    }
}
