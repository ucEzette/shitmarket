# ShitMarket — Backend

PvP meme coin prediction market on Solana. This repo contains:

| Directory | Description |
|---|---|
| `program/` | Anchor/Rust Solana program |
| `indexer/` | TypeScript event indexer, settlement keeper, REST API, WebSocket server |
| `src/` | Next.js frontend (existing) |

---

## Architecture

```
┌─────────────────────────────────────────────────┐
│             Solana Blockchain                   │
│  ShitMarket Program (Anchor)                    │
│  • initialize / create_room / place_bet         │
│  • settle_room (keeper-signed)                  │
│  • claim_winnings                               │
└───────────────────┬─────────────────────────────┘
                    │ logsSubscribe (WebSocket)
                    ▼
┌─────────────────────────────────────────────────┐
│           Event Listener (TypeScript)           │
│  Decode Anchor events → fan out to:             │
│    PostgreSQL (durable storage)                 │
│    Redis (live cache + Pub/Sub)                 │
└──────────┬────────────────┬────────────────────┘
           │                │
           ▼                ▼
  ┌────────────────┐  ┌────────────────────┐
  │  Settlement    │  │  WebSocket Server  │
  │  Keeper (cron) │  │  (room broadcasts) │
  └────────────────┘  └────────────────────┘
           │                │
           ▼                ▼
  ┌─────────────────────────────────────────┐
  │           REST API (Express)            │
  │  GET /api/rooms   /api/profile          │
  │  GET /api/leaderboard  /metrics /health │
  └─────────────────────────────────────────┘
```

**Settlement model:** Keeper wallet aggregates prices from DexScreener + Birdeye (median TWAP), then submits `settle_room` signed with the keeper keypair. The on-chain program verifies the keeper's signature — no Pyth dependency, works for ANY meme coin.

---

## Quick Start — Local Development

### Prerequisites

- [Rust + Solana CLI](https://docs.solana.com/cli/install-solana-cli-tools) (1.18+)
- [Anchor CLI](https://www.anchor-lang.com/docs/installation) (0.30+)
- Node.js 20+
- Docker + Docker Compose

### 1. Build the Solana Program

```bash
cd program
anchor build
```

This generates:
- `target/deploy/shitmarket.so` — deployable BPF binary
- `target/idl/shitmarket.json` — IDL used by the indexer

### 2. Start Local Validator & Run Tests

```bash
cd program
anchor test
```

> **Note:** Time-dependent tests (settlement after expiry) require waiting for the 5-minute room to expire. Pass `--timeout 400000` to mocha. For faster iteration, use `solana-test-validator --warp-slot` or modify the room duration to 1 minute in tests.

### 3. Deploy to Devnet

```bash
# Fund your deployer wallet
solana airdrop 2 --url devnet

cd program
anchor deploy --provider.cluster devnet
```

Copy the deployed Program ID into `program/Anchor.toml` and `indexer/.env`.

### 4. Start Indexer Services

```bash
cd indexer
cp .env.example .env
# Edit .env — set PROGRAM_ID, KEEPER_PRIVATE_KEY, SOLANA_RPC_URL

# Start Postgres + Redis
docker-compose up postgres redis -d

# Install dependencies & generate Prisma client
npm install
npm run db:generate
npm run db:migrate

# Run in development mode
npm run dev
```

Services available:
| Service | URL |
|---|---|
| REST API | http://localhost:3001/api |
| WebSocket | ws://localhost:3002 |
| Health | http://localhost:3001/health |
| Prometheus | http://localhost:3001/metrics |

### 5. Run Integration Tests

```bash
cd indexer
# Ensure localnet is running and .env is configured
npm test
```

---

## Docker Production Deployment

```bash
cd indexer
cp .env.example .env
# Fill in production values

docker-compose up -d
```

All services (PostgreSQL, Redis, indexer) are containerised. The indexer runs migrations automatically on startup.

---

## Mainnet Deployment Checklist

1. **Deploy program to mainnet-beta:**
   ```bash
   anchor deploy --provider.cluster mainnet
   ```

2. **Call `initialize`** to create `PlatformConfig` with your admin, treasury, and keeper wallets.

3. **Set environment variables:**
   - `SOLANA_RPC_URL` — Use a dedicated RPC (Helius, Triton) for reliability
   - `KEEPER_PRIVATE_KEY` — Keeper wallet with ≥0.1 SOL for transaction fees
   - `BIRDEYE_API_KEY` — For price aggregation quality
   - `DATABASE_URL` — Managed Postgres (e.g., Supabase, Railway, Neon)
   - `REDIS_URL` — Managed Redis (e.g., Upstash)

4. **Fund the keeper wallet** — each settlement costs ~5000 lamports in fees.

5. **Scale:** The keeper can be run by multiple parties simultaneously; the on-chain contract handles the race condition gracefully (already-settled error is caught).

---

## API Reference

### `GET /api/rooms`
Query params: `filter` (ending|biggest|latest), `status` (active|settled), `limit` (max 100)

### `GET /api/rooms/:pubkey`
Full room details with bets and computed payouts.

### `GET /api/leaderboard`
Query params: `sortBy` (profit|wins|winRate), `limit`

### `GET /api/profile/:wallet`
User stats, win rate, and last 20 bets.

### `GET /api/rooms/config/pyth-feeds`
Returns the token mint → Pyth feed pubkey mapping (for UI use).

---

## WebSocket Protocol

```js
const ws = new WebSocket('ws://localhost:3002');

// Subscribe to a room
ws.send(JSON.stringify({ type: 'subscribe', room: '<roomPubkey>' }));

// Subscribe to global new-room feed
ws.send(JSON.stringify({ type: 'subscribe_global' }));

// Receive updates
ws.onmessage = (e) => {
  const { type, roomPubkey, ...data } = JSON.parse(e.data);
  // type: 'room_update' | 'new_room' | 'subscribed' | 'pong' | 'error'
};
```

---

## Price Encoding

All prices stored as `i64` with 6 decimal places:
```
$0.000042 USD → 42
$1.00 USD     → 1_000_000
$100.00 USD   → 100_000_000
```

Winner: `final_price > opening_price` → Moon wins. Otherwise Jeet wins.

---

## Security Model

| Threat | Mitigation |
|---|---|
| Reentrancy on claim | `claimed = true` set before lamport transfer |
| Duplicate settlement | `RoomStatus::Active` checked before settlement |
| Rogue keeper | Keeper pubkey stored in `PlatformConfig`; only admin can change it |
| Admin rug | No `cancel_room` instruction exists; funds locked until settlement |
| Arithmetic overflow | All math uses `checked_add/sub/mul/div` with explicit error |
| Stale prices | Keeper aggregates from 2+ sources; mock returns ±5% of opening in dev |
| Double-processing events | Transaction signatures cached in Redis (48h TTL) |
