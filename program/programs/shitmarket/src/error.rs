use anchor_lang::prelude::*;

#[error_code]
pub enum ShitMarketError {
    // Room lifecycle
    #[msg("Room is not in an active state")]
    RoomNotActive,
    #[msg("Room has not expired yet")]
    RoomNotExpired,
    #[msg("Room has already been settled")]
    RoomAlreadySettled,
    #[msg("Room has expired and is no longer accepting bets")]
    RoomExpired,

    // Bet & claim
    #[msg("Bet amount must be greater than zero")]
    ZeroBetAmount,
    #[msg("Bet has already been claimed")]
    AlreadyClaimed,
    #[msg("User did not bet on the winning side")]
    NotAWinner,
    #[msg("Room has not been settled yet")]
    RoomNotSettled,
    #[msg("Winning pool is empty — no bets on winning side")]
    EmptyWinningPool,

    // Price / oracle
    #[msg("Final price must be non-zero")]
    InvalidPrice,
    #[msg("Invalid Pyth price feed account")]
    InvalidPythFeed,
    #[msg("Pyth price feed data is stale")]
    PythPriceStale,
    #[msg("Pyth price feed is not currently trading")]
    PythPriceNotTrading,
    #[msg("Pyth price confidence interval is too wide")]
    PriceConfidenceTooWide,
    #[msg("Provided keeper does not match platform config")]
    UnauthorizedKeeper,
    #[msg("Invalid Switchboard price feed account")]
    InvalidSwitchboardFeed,
    #[msg("Switchboard price is stale or not trading")]
    SwitchboardPriceStale,

    // Config & admin
    #[msg("Caller is not authorized")]
    Unauthorized,
    #[msg("Bet side does not match existing bet")]
    SideMismatch,
    #[msg("Platform fee exceeds maximum allowed (10%)")]
    FeeTooHigh,
    #[msg("Duration must be between 1 and 525,600 minutes")]
    InvalidDuration,

    // Phase 3: Circuit breaker & liquidity
    #[msg("Platform is paused by admin — no new bets or rooms")]
    Paused,
    #[msg("Room does not meet the minimum liquidity requirement")]
    InsufficientLiquidity,



    // Arithmetic
    #[msg("Arithmetic overflow")]
    Overflow,
    #[msg("Arithmetic underflow")]
    Underflow,
    #[msg("Division by zero")]
    DivisionByZero,

    // Phase 4: Limit Orders
    #[msg("Limit order is not in a pending state")]
    OrderNotPending,
    #[msg("Provided room does not match the limit order target")]
    InvalidRoom,
    #[msg("Limit target price condition is not met yet")]
    TriggerConditionNotMet,
    #[msg("Max slippage limit exceeded")]
    SlippageExceeded,
    #[msg("Cooling off period is still active — cannot sweep yet")]
    CoolingOffActive,
    #[msg("No referral rewards available to claim")]
    NoRewardsToClaim,
    #[msg("Invalid PDA derivation or seeds mismatch")]
    InvalidPDA,
}
