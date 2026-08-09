# ShitMarket — Comprehensive Design Document

> **Last updated:** 2026-08-04  
> **Scope:** Full-stack technical reference for engineers, AI tools, and contributors.

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [High-Level Architecture](#2-high-level-architecture)
3. [Repository Structure](#3-repository-structure)
4. [Smart Contracts Layer](#4-smart-contracts-layer)
   - 4.1 [Solana Anchor Program (`program/`)](#41-solana-anchor-program-program)
   - 4.2 [Avalanche Solidity Contracts (`contracts/`)](#42-avalanche-solidity-contracts-contracts)
   - 4.3 [AMM Contract System](#43-amm-contract-system)
5. [Indexer / Backend Layer (`indexer/`)](#5-indexer--backend-layer-indexer)
   - 5.1 [Event Listener](#51-event-listener)
   - 5.2 [Settlement Keeper](#52-settlement-keeper)
   - 5.3 [CCTP Relayer](#53-cctp-relayer)
   - 5.4 [REST API](#54-rest-api)
   - 5.5 [WebSocket Server](#55-websocket-server)
   - 5.6 [Database (PostgreSQL + Prisma)](#56-database-postgresql--prisma)
   - 5.7 [Redis Caching Layer](#57-redis-caching-layer)
   - 5.8 [Prometheus Metrics & Grafana](#58-prometheus-metrics--grafana)
   - 5.9 [ELO Rating System](#59-elo-rating-system)
6. [Frontend Layer (`src/`)](#6-frontend-layer-src)
   - 6.1 [Framework & Toolchain](#61-framework--toolchain)
   - 6.2 [Design System & Theming](#62-design-system--theming)
   - 6.3 [Routing & Pages](#63-routing--pages)
   - 6.4 [Global State (`useAppState`)](#64-global-state-useappstate)
   - 6.5 [Web3 Integration](#65-web3-integration)
   - 6.6 [Components Reference](#66-components-reference)
7. [Core Domain Models](#7-core-domain-models)
   - 7.1 [Room](#71-room)
   - 7.2 [Bet](#72-bet)
   - 7.3 [Listing (Secondary Market)](#73-listing-secondary-market)
   - 7.4 [UserProfile](#74-userprofile)
   - 7.5 [LimitOrder](#75-limitorder)
8. [Market Mechanics](#8-market-mechanics)
   - 8.1 [Room Lifecycle](#81-room-lifecycle)
   - 8.2 [Two-Sided AMM (CPMM)](#82-two-sided-amm-cpmm)
   - 8.3 [Price Encoding](#83-price-encoding)
   - 8.4 [Oracle & Settlement](#84-oracle--settlement)
   - 8.5 [Payout Calculation](#85-payout-calculation)
   - 8.6 [Dispute & Arbitration Window](#86-dispute--arbitration-window)
9. [Cross-Chain Architecture (Avalanche Hub + Solana Spokes)](#9-cross-chain-architecture-avalanche-hub--solana-spokes)
10. [Market Categories](#10-market-categories)
11. [Parlays](#11-parlays)
12. [Secondary Market (P2P Bet Listings)](#12-secondary-market-p2p-bet-listings)
13. [Referral System](#13-referral-system)
14. [Authentication & Wallet Flow](#14-authentication--wallet-flow)
15. [API Reference](#15-api-reference)
16. [WebSocket Protocol](#16-websocket-protocol)
17. [Environment Variables](#17-environment-variables)
18. [Security Model](#18-security-model)
19. [Deployment Architecture](#19-deployment-architecture)
20. [Local Development Setup](#20-local-development-setup)

---

## 1. Product Overview

**ShitMarket** is a permissionless prediction market platform targeting the memecoin and crypto-native audience. It allows any user to:

- **Create** a prediction room around any token price or any verifiable real-world argument.
- **Bet** on one of two binary outcomes: **MOON** (bullish/YES) or **JEET** (bearish/NO).
- **Trade** outcome shares via an on-chain AMM, with market and limit order support.
- **Claim** winnings automatically when a room settles.
- **List** bets on a secondary P2P marketplace.
- **Combine** multiple rooms into a Parlays bet for amplified payout.

The platform is styled around a "trench warfare" meme aesthetic — every UI concept maps to wartime language (rooms = "sectors", bets = "ammo", leaderboard = "season conquest rankings", etc.).

**Primary chains:**
| Chain | Role |
|---|---|
| **Avalanche C-Chain** | Core state engine (hub); USDC wagering via `ShitMarketCore.sol` |
| **Solana (Mainnet/Devnet)** | Legacy prediction program; deposit spoke via Anchor |
| **Base, Ethereum, Arbitrum** | Deposit spokes via Circle CCTP |

**Key numbers:**
- Platform fee: **1.25%** of the total pot on settlement.
- Swap fee (AMM): **0.30% – 1.00%** per trade, accruing to the LP (room creator).
- Price resolution: median TWAP from ≥4 sources (DexScreener, Birdeye, Jupiter, Chainlink/Pyth).
- Post-settlement dispute window: **30 minutes**.

---

## 2. High-Level Architecture

```
┌────────────────────────────────────────────────────────┐
│                  User Browsers / Mobile                │
│           Next.js 14 App (src/)                        │
│   Privy Auth → EVM/Solana Wallet → Viem / Anchor SDK   │
└─────────────────────┬──────────────────────────────────┘
                      │ REST + WebSocket
                      ▼
┌────────────────────────────────────────────────────────┐
│              Indexer Services (indexer/)               │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────┐  │
│  │  REST    │  │   WS     │  │ Keeper   │  │ CCTP  │  │
│  │  API     │  │  Server  │  │ (cron)   │  │Relayer│  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───┬───┘  │
│       └─────────────┴─────────────┴─────────────┘      │
│                     │                                   │
│            ┌────────┴─────────┐                        │
│            │  PostgreSQL DB   │  Redis (cache+pub/sub)  │
│            │  (via Prisma)    │                         │
│            └────────┬─────────┘                        │
└─────────────────────┼──────────────────────────────────┘
                      │ logsSubscribe / JSON-RPC
          ┌───────────┴───────────────┐
          │                           │
┌─────────▼─────────┐     ┌──────────▼──────────────────┐
│  Solana Blockchain │     │     Avalanche C-Chain        │
│  Anchor Program    │     │  ShitMarketCore.sol          │
│  (shitmarket.so)  │     │  + AMPool.sol                │
└────────────────────┘     └──────────────────────────────┘
```

**Data flow summary:**
1. User creates/places bet via the Next.js frontend.
2. Transaction signed client-side (Privy embedded wallet or injected wallet) and submitted to the chain.
3. The **Event Listener** receives chain events, decodes them, and fans out to PostgreSQL and Redis.
4. The **WebSocket Server** pushes real-time room updates to all subscribed browser sessions.
5. The **Keeper** (cron) polls for expired rooms, fetches aggregated TWAP prices, and submits `settle_room` transactions.
6. The **REST API** serves room lists, leaderboard, and profile data to the frontend on first load and periodic refresh.

---

## 3. Repository Structure

```
shitmarket/
├── contracts/                   # Solidity contracts (Avalanche C-Chain)
│   └── ShitMarketCore.sol       # Core prediction market contract
├── evm/                         # Hardhat deployment scripts & config
├── indexer/                     # TypeScript backend services
│   ├── src/
│   │   ├── api/                 # Express REST route handlers
│   │   ├── keeper/              # Settlement cron jobs
│   │   ├── listener/            # Chain event listener
│   │   ├── relayer/             # Circle CCTP cross-chain relayer
│   │   ├── websocket/           # WebSocket broadcast server
│   │   ├── feeds/               # Price aggregator feed adapters
│   │   ├── metrics/             # Prometheus metrics exposition
│   │   ├── notifications/       # Push notification service
│   │   ├── solana/              # Solana-specific helpers
│   │   ├── utils/               # Shared utilities
│   │   ├── db.ts                # Prisma client singleton
│   │   ├── redis.ts             # Redis client + pub/sub helpers
│   │   ├── elo.ts               # ELO rating computation
│   │   ├── config.ts            # Environment config loader
│   │   └── index.ts             # Service entry point
│   ├── prisma/                  # Prisma schema & migrations
│   ├── grafana/                 # Grafana dashboard definitions
│   ├── docker-compose.yml       # Local dev stack (postgres, redis, indexer)
│   └── Dockerfile               # Indexer Docker image
├── program/                     # Solana Anchor program (legacy spoke)
│   ├── programs/shitmarket/     # Rust source
│   └── tests/                   # Mocha integration tests
├── mobile/                      # Mobile app (React Native, WIP)
├── k8s/                         # Kubernetes manifests (production)
├── src/                         # Next.js 14 frontend
│   ├── app/                     # App Router pages
│   │   ├── page.tsx             # Homepage
│   │   ├── layout.tsx           # Root layout
│   │   ├── rooms/               # All Rooms listing page
│   │   ├── room/[id]/           # Individual Room detail
│   │   ├── create-room/         # Room creation flow
│   │   ├── leaderboard/         # Season leaderboard
│   │   ├── parlays/             # Multi-leg parlay simulator
│   │   ├── portfolio/           # User portfolio
│   │   ├── profile/             # User profile editor
│   │   ├── admin/               # Admin panel (protected)
│   │   ├── rules/               # Platform rules page
│   │   └── api/                 # Next.js API routes (proxies)
│   ├── components/              # React components
│   ├── store/
│   │   └── useAppState.ts       # Zustand global state (4900 lines)
│   ├── types/                   # TypeScript declaration files
│   └── utils/                   # Solana client helpers, config, IDL
├── tailwind.config.ts           # Tailwind extended theme
├── next.config.mjs              # Next.js configuration
├── package.json                 # Frontend dependencies
├── tsconfig.json
└── .env.example                 # Environment variable template
```

---

## 4. Smart Contracts Layer

### 4.1 Solana Anchor Program (`program/`)

The Anchor program is the **legacy Solana spoke**. It exposes the following instructions:

| Instruction | Description |
|---|---|
| `initialize` | Creates the `PlatformConfig` PDA storing admin, treasury, and keeper wallet addresses. |
| `create_room` | Creates a `Room` PDA with token, duration, opening price, oracle configuration. |
| `place_bet` | Creates/increments a `Bet` PDA for the signer on a given side (moon/jeet). |
| `settle_room` | Keeper-signed; transitions room to `Settled`, records the final TWAP price, and determines the winner. |
| `claim_winnings` | Winner calls to transfer their proportional share of the pot minus the platform fee. |
| `list_position` | Creates a `Listing` PDA allowing sale of a bet position on the secondary market. |
| `cancel_listing` | Removes an active listing. |
| `buy_position` | Atomically transfers a listed bet position from seller to buyer. |
| `claim_referral_rewards` | Claims accumulated referral SOL rewards on-chain. |

**PDAs (Program Derived Addresses):**

| PDA | Seeds | Purpose |
|---|---|---|
| `PlatformConfig` | `[b"platform_config"]` | Global admin/treasury/keeper config |
| `Room` | `[b"room", token_mint, creator, nonce]` | Individual prediction room state |
| `Escrow` | `[b"escrow", room_pubkey]` | SOL vault holding the room's pot |
| `Bet` | `[b"bet", room_pubkey, user_pubkey, side]` | Single user's bet in a room |
| `Listing` | `[b"listing", bet_pubkey]` | Secondary market listing |
| `UserReferral` | `[b"user_referral", wallet]` | User's referral data |
| `ReferralState` | `[b"referral_state", referrer, referree]` | Link between referrer/referee |
| `Vault` | `[b"vault", room_pubkey]` | Token vault for SPL token pools |

**Anchor IDL** is located at `src/utils/idl.json` (mirrored as `shitmarket_idl.json`).

### 4.2 Avalanche Solidity Contracts (`contracts/`)

**`ShitMarketCore.sol`** is the Avalanche C-Chain hub contract. It manages the complete lifecycle of prediction rooms using USDC (6 decimal places).

**Key structs:**

```solidity
struct Room {
    bytes32 roomId;          // keccak256 hash ID
    bytes32 tokenMint;       // bytes32-encoded token mint address
    bytes32 tokenName;       // bytes32-encoded token name
    string  chainId;         // "solana", "avalanche", "base", etc.
    int64   openingPrice;    // Price at room creation (scaled x1e6)
    uint256 openingTimestamp;
    uint256 expiryTimestamp;
    uint256 settlementTimestamp;
    uint256 durationMinutes;
    uint256 moonPool;        // Total USDC on MOON side (6 decimals)
    uint256 jeetPool;        // Total USDC on JEET side (6 decimals)
    int64   finalPrice;
    int64   twapFinalPrice;  // 10-sample TWAP (6 decimals)
    uint8   winner;          // 0=none, 1=moon, 2=jeet, 3=draw
    uint8   status;          // 0=pending, 1=active, 2=settled, 3=cancelled, 4=disputed
    address creator;
    address oracle;          // Custom oracle address (zero = keeper)
    uint256 oracleFeeAmount;
    uint8   twapSampleCount;
    int64[10] twapSamples;         // Circular TWAP buffer
    uint256[10] twapSampleTimestamps;
    uint8   disputeStatus;          // 0=none, 1=pending, 2=resolved
    address disputeChallenger;
    uint256 disputeBond;
}
```

**Core functions exposed via ABI (in `useAppState.ts`):**

| Function | Parameters | Description |
|---|---|---|
| `createRoom` | `tokenMint, tokenName, chainId, durationMinutes, openingPrice, oracle, oracleFeeAmount` | Creates a room and returns its `bytes32` roomId |
| `placeBet` | `roomId, side (0=moon, 1=jeet), amount` | Places a USDC bet |
| `claimWinnings` | `roomId, side` | Claims winning share after settlement |
| `getRoom` | `roomId` | View function returning full Room struct |

**Events:**

| Event | Indexed Fields |
|---|---|
| `RoomCreated` | `roomId`, `creator` |
| `BetPlaced` | `roomId`, `bettor`, `side` |
| `RoomSettled` | `roomId`, `winner` |
| `WinningsClaimed` | `roomId`, `claimer` |

### 4.3 AMM Contract System & Deployed Verified Addresses

ShitMarket uses a Gnosis Conditional Tokens Framework (CTF)-inspired AMM stack, fully verified on **Snowscan / Routescan / Snowtrace (Chain ID: 43113)**:

| Contract | ABI Export | Fuji Address | Purpose |
|---|---|---|---|
| `AMPoolFactory` | `AM_POOL_FACTORY_ABI` | `0x8634a6e6346Ba056c6Bd11DeB00C99f68Aa0DE5d` | Deploys a `AMPool` per conditionId with 0.10% total fee & LP claim accumulator |
| `MarketFactory` | `MARKET_FACTORY_ABI` | `0x139E2Bd8A802f6fb37C8f1eE1ff798271f623167` | Creates Gnosis-style conditional markets ($3.00 USDC creation fee) |
| `ConditionalTokens` | `CONDITIONAL_TOKENS_ABI` | `0x3DBa9D7EF6B71610149daeF07bd8fcc6f5297A2A` | ERC-1155 outcome share tokens; split/merge & redemption post-settlement |
| `OracleRegistry` | `ORACLE_REGISTRY_ABI` | `0xD9Ea73D3c157528A133Bc610E02A6C972a62095F` | Multi-oracle resolution adapter & custom resolver registry |
| `PredictionRouter` | `PREDICTION_ROUTER_ABI` | `0x8059fDbeC0521F2b6bdCA1F99D5f978Aa9958524` | Hybrid router: fills against the AMM pool and/or signed limit order book |
| `ShitMarketCore` | `SHITMARKET_CORE_ABI` | `0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6` | Main protocol controller, room state, escrow vault |
| `MockUSDC` | `IERC20` | `0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2` | 6-decimal collateral currency token |

**AMM fee distribution & pricing formula (Constant Product Market Maker):**

```
Total AMM Fee: 0.10% (10 BPS)
  ├── Liquidity Providers (LPs): 0.07% (7 BPS) -> Accrued in USDC, claimable via claimFees()
  └── Protocol Treasury:        0.03% (3 BPS) -> Transferred immediately to treasury

k = moonReserves × jeetReserves   (constant)

Buy MOON shares:
  newJeetReserves = k / (moonReserves - sharesToBuy)
  grossCost = newJeetReserves - jeetReserves
  totalCost = grossCost × 10000 / 9990    // 0.10% total fee

Sell MOON shares:
  newMoonReserves = moonReserves + sharesToSell
  newJeetReserves = k / newMoonReserves
  grossReceived = jeetReserves - newJeetReserves
  netReceived = grossReceived × (1 - 0.0010)
```

All pool reserves are denominated in USDC with **6 decimal places** on Avalanche.

### 4.4 Room Creation & Seeding Lifecycle

1. **Entry & Strike Price Modes**:
   - **⚡ Live Market Spot Baseline**: Evaluates market outcome against the real-time spot price at room creation (fetched via DexScreener/Pyth). Resolves MOON if expiry price > entry price, JEET if lower.
   - **🎯 Custom Target / Strike Price**: Room creator can define an exact USD target price threshold (with quick preset multipliers: +5%, +10%, +25%, +50%, +100% 2x target, or -10% short target). Resolves MOON if price hits/exceeds strike price.

2. **Neutral 50/50 Liquidity Seeding**:
   - Creators seed initial liquidity without choosing a biased side. Depositing $X USDC mints equal $X MOON + $X JEET outcome reserves into the CPMM pool (starting at fair $0.50 per share odds).
   - Creator receives 100% of initial LP tokens and accrues 0.07% claimable swap fees on all future volume.

3. **Pump.fun Style Anti-Frontrun First Buy (Dev Snipe)**:
   - To prevent sniper bots or front-running on market launch, creators can optionally specify an initial **First Buy / Dev Snipe**:
     - **Stance**: MOON / YES (Side 0) or JEET / NO (Side 1)
     - **Amount**: $Y USDC
   - Executed atomically in the same creation workflow immediately after pool deployment and liquidity seeding via `buyShares(outcomeIndex, amount)`.

---

## 5. Indexer / Backend Layer (`indexer/`)

Node.js (TypeScript) microservice that bridges the blockchain to the frontend. All sub-services run in a single process (`indexer/src/index.ts`) but are modularly separated.

### 5.1 Event Listener

- Connects to the Solana RPC via `logsSubscribe` WebSocket.
- Parses Anchor events from program logs: `RoomCreated`, `BetPlaced`, `RoomSettled`, `WinningsClaimed`.
- On Avalanche mode, polls/subscribes to Ethers.js event streams from `ShitMarketCore`.
- Decoded events → upserted into PostgreSQL via Prisma.
- Room deltas → published to Redis channels for real-time WS fanout.
- Deduplication: each transaction signature/hash is cached in Redis with a **48-hour TTL**.

### 5.2 Settlement Keeper

- Runs as a **cron job** every ~30 seconds.
- Queries all `active` rooms with `expiry < now` from PostgreSQL.
- For each expired room, fetches price from 4+ aggregators concurrently:
  - **DexScreener** (pair price via REST)
  - **Birdeye** (requires `BIRDEYE_API_KEY`)
  - **Jupiter** (price API)
  - **Chainlink / Pyth** (on-chain feed reads if `priceFeedId` configured)
- Applies **20% outlier shield**: removes prices deviating >20% from the median.
- Computes a 10-sample **TWAP** (stored in the Room struct on-chain).
- Compares `twapFinalPrice` to `openingPrice`:
  - `twapFinalPrice > openingPrice` → MOON wins
  - `twapFinalPrice < openingPrice` → JEET wins
  - Within 0.01% tolerance → DRAW
- Submits `settle_room` signed by the **Keeper wallet** (`KEEPER_PRIVATE_KEY` / `EVM_KEEPER_PRIVATE_KEY`).
- On Solana: costs ~5,000 lamports per settlement.
- On Avalanche: gas-paid by keeper EVM wallet.
- Race condition handling: if a room is already settled, the error is caught and silently ignored (idempotent).

### 5.3 CCTP Relayer

- Circle Cross-Chain Transfer Protocol relayer for Solana → Avalanche and back.
- Monitors Solana deposit gateway burn transactions and relays mint messages to Avalanche USDC.
- Environment variables: `CCTP_ATTESTATION_URL`, `SOLANA_CCTP_PROGRAM_ID`, `EVM_CCTP_TOKEN_MESSENGER_ADDRESS`.

### 5.4 REST API

Express.js server (default port **3001**).

| Endpoint | Method | Query Params | Description |
|---|---|---|---|
| `/health` | GET | — | Liveness check; returns `{ status: "ok", uptime }` |
| `/metrics` | GET | — | Prometheus-format metrics scrape endpoint |
| `/api/rooms` | GET | `filter` (ending\|biggest\|latest), `status` (active\|settled), `limit` (max 100) | Paginated room list |
| `/api/rooms/:pubkey` | GET | — | Full room detail with bets and computed payouts |
| `/api/rooms/token-price/:mintAddress` | GET | `pythFeedId` | Aggregated live token price |
| `/api/rooms/config/pyth-feeds` | GET | — | Token mint → Pyth feed ID mapping |
| `/api/leaderboard` | GET | `sortBy` (profit\|wins\|winRate), `limit` | Season leaderboard entries |
| `/api/profile/:wallet` | GET | — | User stats, win rate, last 20 bets |
| `/api/profile/:wallet` | POST | `{ username, avatarUrl, referredBy }` | Update profile metadata |
| `/api/rooms/:pubkey/chat` | GET | — | Chat messages for a room |
| `/api/rooms/:pubkey/chat` | POST | `{ side, user, message }` | Send chat message |

All responses follow `{ success: boolean, data: T, error?: string }` envelope.

### 5.5 WebSocket Server

Socket.IO or raw WebSocket server on default port **3002**.

**Client → Server messages:**

```json
{ "type": "subscribe",        "room": "<roomPubkey>" }
{ "type": "subscribe_global"                         }
{ "type": "unsubscribe",      "room": "<roomPubkey>" }
{ "type": "ping"                                     }
```

**Server → Client messages:**

```json
{ "type": "room_update",   "roomPubkey": "...", ...roomData }
{ "type": "new_room",      ...roomData }
{ "type": "subscribed",    "room": "..." }
{ "type": "pong"           }
{ "type": "error",         "message": "..." }
```

Rooms are broadcast when a new bet arrives (Redis pub/sub → WS fanout) or when settlement occurs.

### 5.6 Database (PostgreSQL + Prisma)

The Prisma schema (`indexer/prisma/schema.prisma`) defines the following primary tables:

| Table | Key Fields | Description |
|---|---|---|
| `Room` | `roomPubkey (PK)`, `tokenMint`, `tokenName`, `tokenSymbol`, `chainId`, `status`, `winner`, `moonPool`, `jeetPool`, `openingPrice`, `expiry`, `createdAt`, `settledAt`, `duration` | Canonical room record |
| `Bet` | `id (PK)`, `roomPubkey (FK)`, `userPubkey`, `side`, `amount`, `claimed`, `txSig`, `createdAt` | Bet records |
| `UserProfile` | `wallet (PK)`, `username`, `avatarUrl`, `referredBy`, `referralCode`, `elo`, `totalBets`, `wins`, `losses`, `profit` | User stats and metadata |
| `Listing` | `pubkey (PK)`, `room`, `bet`, `seller`, `price`, `side`, `amount`, `createdAt` | Secondary market P2P listings |
| `ChatMessage` | `id (PK)`, `roomId`, `side`, `user`, `message`, `timestamp` | In-room chat messages |

All `amount` and pool values are stored as **BigInt** (raw lamports or raw 6-decimal USDC units) and converted to human-readable units only at the API serialization layer.

### 5.7 Redis Caching Layer

Redis is used for:

| Key Pattern | Type | TTL | Purpose |
|---|---|---|---|
| `tx:<txSig>` | String | 48h | Deduplication lock for processed events |
| `room:<pubkey>` | Hash | 60s | Hot room data cache |
| `leaderboard:moon` | Sorted Set | 5min | Moon side leaderboard scores |
| `leaderboard:jeet` | Sorted Set | 5min | Jeet side leaderboard scores |
| `channel:room:<pubkey>` | Pub/Sub | — | Real-time room delta channel |
| `channel:global` | Pub/Sub | — | Global new room broadcast channel |

### 5.8 Prometheus Metrics & Grafana

Exposed at `GET /metrics`. Key metrics:

- `shitmarket_rooms_total{status}` — Counter of rooms by status
- `shitmarket_bets_total{side}` — Counter of bets placed by side
- `shitmarket_settlement_duration_seconds` — Histogram of keeper settlement latency
- `shitmarket_ws_connections` — Gauge of active WebSocket connections
- `shitmarket_api_request_duration_seconds{route,method}` — API latency histogram

Grafana dashboard JSON in `indexer/grafana/`.

### 5.9 ELO Rating System

Implemented in `indexer/src/elo.ts`. Uses a standard ELO formula adapted for binary prediction:

- Base rating: **1,200**
- K-factor: dynamic based on number of games played
- A win increases rating proportional to the odds implied by pool sizes.
- Ratings update atomically on each `RoomSettled` event.
- Rating classes displayed in the frontend leaderboard:

| ELO Range | Class | Label |
|---|---|---|
| ≥ 1800 | S | LEGENDARY |
| 1600–1799 | A | ELITE |
| 1400–1599 | B | VETERAN |
| 1200–1399 | C | REGULAR |
| < 1200 | D | ROOKIE |

---

## 6. Frontend Layer (`src/`)

### 6.1 Framework & Toolchain

| Tool | Version | Role |
|---|---|---|
| Next.js | 14.2.35 | App Router, SSR/SSG, API routes |
| React | 18 | UI rendering |
| TypeScript | 5 | Type safety |
| TailwindCSS | 3.4 | Utility-first styling with custom theme |
| Framer Motion | 12 | Page/component animations |
| Zustand | 5 | Global client-side state |
| Viem | 2.55 | EVM wallet client (Avalanche) |
| `@coral-xyz/anchor` | 0.32 | Solana program interaction |
| `@solana/web3.js` | 1.98 | Solana RPC calls |
| `@privy-io/react-auth` | 3.29 | Multi-chain embedded wallet auth |
| Radix UI | various | Accessible headless UI primitives |
| Lucide React | 1.16 | Icon library |

**Build & run:**
```bash
npm run dev     # Local dev server (hot reload)
npm run build   # Production build
npm run start   # Serve production build
```

### 6.2 Design System & Theming

**Fonts (Google Fonts, loaded in `layout.tsx`):**
- `Staatliches` — All major headings and CTA buttons (all-caps condensed display font)
- `JetBrains Mono` — Data values, addresses, terminal/console UI, monospace labels
- `Permanent Marker` — Decorative propaganda/meme captions

**Color Palette (Tailwind custom tokens in `tailwind.config.ts`):**

| Token | Value | Usage |
|---|---|---|
| `neon-moon` | `#39ff14` | MOON/bullish accent, glows in dark mode |
| `jeet-red` | `#ff073a` | JEET/bearish accent, glows in dark mode |
| `moon-gold` | `#FFD700` | Trophy, leaderboard, gold highlights |
| `trench-black` | `#070c04` | Primary dark background |
| `trench-mud` | `#1a1a0e` | Secondary dark surface |
| `trench-sandbag` | `#5C5244` | Border / divider color in dark mode |
| `trench-gasmask` | `#8B8B7A` | Muted text / secondary labels |
| `portal-glow` | radial gradient | Hero section glow effect |

**Light mode:**
- Background: `#A8EEFF` (hero) / white
- MOON accent: `#00796B` (teal)
- JEET accent: `#C62828` (dark red)
- Text: `#0A1A2A` (near-black)

**Dark mode:**
- Activated via `ThemeProvider` toggling a `dark` class on `<html>`.
- Stored in `localStorage`.

**Utility classes of note:**
- `.retro-panel` — Pixel-art style bordered panel
- `.retro-btn-moon` — Green gradient button
- `.retro-btn-jeet` — Red gradient button
- `.premium-glass-card` — Glassmorphism card with backdrop-blur
- `.scanlines` — CSS scanline overlay for CRT aesthetic in dark mode
- `.glow-moon` / `.glow-jeet` / `.glow-gold` — CSS text-shadow glows
- `.animate-marquee` — Infinite scrolling ticker animation

**Responsive breakpoints:** Standard Tailwind (`sm: 640px`, `md: 768px`, `lg: 1024px`, `xl: 1280px`).

### 6.3 Routing & Pages

All routes use Next.js 14 App Router (`src/app/`). All pages are `'use client'` components.

| Route | File | Description |
|---|---|---|
| `/` | `app/page.tsx` | Homepage: hero banner, trending carousel, market tabs (latest/biggest/expiring), propaganda gallery, mobile app teaser |
| `/rooms` | `app/rooms/page.tsx` | Full market listing with category filters, sort, and search |
| `/room/[id]` | `app/room/[id]/page.tsx` | Individual room: price chart, bet panel, AMM trade panel, chat, holders, positions, dispute UI |
| `/create-room` | `app/create-room/page.tsx` | Room creation wizard: token selection, duration, oracle, seed liquidity |
| `/leaderboard` | `app/leaderboard/page.tsx` | Season 1 podium + ranked table (Moon/Jeet sides) |
| `/parlays` | `app/parlays/page.tsx` | Multi-leg parlay builder (simulated) |
| `/portfolio` | `app/portfolio/page.tsx` | User's active bets, history, claimable winnings |
| `/profile` | `app/profile/page.tsx` | Profile editor (username, avatar, stats, referral link) |
| `/admin` | `app/admin/page.tsx` | Protected admin panel (dispute resolution, room management) |
| `/rules` | `app/rules/page.tsx` | Platform rules and how-to guide |
| `*` | `app/not-found.tsx` | 404 page with "TRENCH RUGGED" meme styling |

### 6.4 Global State (`useAppState`)

**File:** `src/store/useAppState.ts` (~4,900 lines)

This is the single Zustand store that acts as the central nervous system of the entire frontend. It is initialized with `create` + `persist` middleware (persists user profile and settings to `localStorage`).

**State shape:**

```typescript
interface AppState {
  // Data
  rooms: Room[];
  roomsLoaded: boolean;
  listings: Listing[];
  user: UserProfile | null;
  leaderboard: { moon: LeaderboardEntry[]; jeet: LeaderboardEntry[] };
  chatMessages: ChatMessage[];
  activityLog: Activity[];

  // UI state
  isPaused: boolean;
  fullDegenMode: boolean;
  shareCardData: ShareCardData | null;
  isRelayDepositOpen: boolean;
  relayInitialOriginChainId?: number;
  customAlert: AlertData | null;
  toasts: Toast[];

  // Web3 / transaction state
  wallet: any | null;
  isEvm: boolean;
  isTransactionLoading: boolean;
  transactionError: string | null;
  sendTransaction: ((tx: any) => Promise<string>) | null;

  // Settings (persisted to localStorage)
  settings: {
    priorityFeeType: 'low' | 'medium' | 'high' | 'turbo' | 'custom';
    customPriorityFee: number;   // micro-lamports
    slippage: number;            // percentage
  };
}
```

**Key action groups:**

| Category | Actions |
|---|---|
| **Room data** | `fetchRooms()`, `fetchSingleRoom(id)`, `addRoom(room)`, `updateRoomPools(id, moon, jeet)`, `settleRoom(id, winner)` |
| **Betting (Solana)** | `createRoom(room)`, `placeBet(roomId, side, amount)`, `claimWinnings(roomId)` |
| **Betting (Avalanche EVM)** | `placeEvmBet(roomId, side, amount)`, `claimEvmWinnings(roomId)` |
| **AMM Trading** | `executeImmediateTrade(roomId, side, amount, action)`, `placeLimitOrder(...)`, `executeEvmMarketTrade(...)` |
| **Secondary Market** | `fetchRoomListings(roomId)`, `listPosition(...)`, `cancelListing(...)`, `buyPosition(...)` |
| **User / Profile** | `fetchBalance()`, `updateProfile(...)`, `refreshProfile()`, `setWalletAddress(address)` |
| **Leaderboard** | `fetchLeaderboard()`, `updateLeaderboard()`, `recalcTrenchScore()` |
| **Chat** | `fetchRoomChats(roomId)`, `sendRoomChat(...)`, `addMessage(msg)` |
| **Referrals** | `claimReferralRewardsOnChain()` |
| **Disputes** | `disputeRoom(roomId)`, `resolveDispute(roomId, winner, overturned)` |
| **Cross-chain** | `mintTestnetUsdc(amount)`, `openRelayDepositModal()`, `closeRelayDepositModal()` |
| **UI** | `addToast(...)`, `removeToast(id)`, `updateToast(id, updates)`, `showAlert(...)`, `hideAlert()` |
| **Wallet** | `connectWallet()`, `disconnectWallet()`, `setWallet(wallet)`, `setSendTransaction(fn)` |

**Local persistence:**
- Rooms are persisted to `localStorage` under key `shitmarket_persisted_rooms_v2` (up to 250 rooms) so the UI renders immediately on next visit before the API resolves.
- Settings (`priorityFeeType`, `slippage`, etc.) are persisted via the `zustand/persist` middleware.

**EVM helpers baked into the store:**
- `publicClient` — Viem `PublicClient` connected to Avalanche Fuji (or mainnet via `NEXT_PUBLIC_AVALANCHE_RPC_URL`).
- `SHITMARKET_CORE_ABI`, `MARKET_FACTORY_ABI`, `AM_POOL_ABI`, `AM_POOL_FACTORY_ABI`, `CONDITIONAL_TOKENS_ABI`, `PREDICTION_ROUTER_ABI` — All contract ABIs are exported from this file for use across the app.

**Utility functions exported from `useAppState.ts`:**

| Function | Signature | Purpose |
|---|---|---|
| `formatPrice` | `(price: number \| string) => string` | Smart price formatting: handles prices from $0.000000001 to $100,000+ with correct significant digits |
| `formatCashtag` | `(sym: string) => string` | Ensures symbol starts with `$` |
| `mapApiRoom` | `(apiRoom: any) => Room` | Transforms raw API response to `Room` store shape; handles both Solana (1e9) and Avalanche (1e6) unit scaling |
| `detectCategory` | `(name?, symbol?, desc?) => MarketCategory` | Regex-based market categorisation |
| `parseBytes32Name` | `(hex: string) => string` | Decodes bytes32-encoded token names from EVM contracts |
| `loadPersistedRooms` | `() => Room[]` | Reads optimistic room cache from localStorage |
| `savePersistedRooms` | `(rooms: Room[]) => void` | Writes up to 250 rooms to localStorage |

### 6.5 Web3 Integration

**Authentication:** Privy (`@privy-io/react-auth`) provides:
- Email/social login (Google, Twitter, Discord, Farcaster)
- Embedded wallet creation (EVM)
- Native Solana wallet adapter bridge

**Solana wallet flow:**
1. `SolanaWalletProvider` (`components/WalletProvider.tsx`) wraps the app with `@solana/wallet-adapter-react`.
2. Multiple wallets supported: Phantom, Solflare, Backpack, Ledger, Torus, Mobile Wallet Adapter.
3. `WalletAdapterBridge.tsx` syncs the adapter state into `useAppState`.
4. Transactions are submitted via `useAppState.sendTransaction` callback which is set by `ClientWrapper` after adapter initialization.

**EVM wallet flow (Avalanche):**
1. Privy provisions an EVM embedded smart account for any logged-in user (including Solana users).
2. Gasless transactions sponsored by a platform **Paymaster**.
3. Viem `WalletClient` is constructed from the Privy EVM provider using `custom(provider)` transport.
4. `useAppState.isEvm` is `true` when the active wallet is EVM-based.

**Priority fee settings (Solana):**
- Users can select Low / Medium / High / Turbo / Custom in the header settings.
- Live fee estimates are fetched via `connection.getRecentPrioritizationFees()`.
- `ComputeBudgetProgram.setComputeUnitPrice` prepended to all Solana transactions.

### 6.6 Components Reference

| Component | File | Description |
|---|---|---|
| `Header` | `Header.tsx` | Sticky top nav with logo, nav links, wallet connect button, ammo display, settings dropdown, theme toggle. Contains `HeaderSettings` (priority fee + slippage config) and `ThemeToggle`. |
| `Footer` | `Footer.tsx` | Site links, socials, legal disclaimer |
| `ClientWrapper` | `ClientWrapper.tsx` | Client boundary wrapper: initializes WebSocket connection, global event listeners, sound synth, Privy auth state sync, intro screen orchestration |
| `WalletProvider` | `WalletProvider.tsx` | Context providing `walletType`, `activeWalletAddress`, `balance`, `connect`, `disconnect` across EVM and Solana adapters |
| `WalletPanel` | `WalletPanel.tsx` | Dropdown panel showing wallet balance, network status, recent transactions, deposit button |
| `WalletSelectionModal` | `WalletSelectionModal.tsx` | Modal for choosing between supported wallets |
| `IntroScreen` | `IntroScreen.tsx` | Animated intro/splash screen shown to first-time visitors |
| `OrderBook` | `OrderBook.tsx` | Visual order book display for limit orders in a room |
| `RelayDepositModal` | `RelayDepositModal.tsx` | Relay Protocol cross-chain deposit flow modal |
| `ShareCardModal` | `ShareCardModal.tsx` | Generates shareable image cards for bets and rooms |
| `PublicProfileModal` | `PublicProfileModal.tsx` | Displays another user's public profile on click |
| `NotificationBell` | `NotificationBell.tsx` | Activity notification bell with unread count |
| `ComplianceModal` | `ComplianceModal.tsx` | Geographic compliance / ToS acceptance modal |
| `CustomAlertModal` | `CustomAlertModal.tsx` | Anchored tooltip-style alert system replacing browser `alert()` |
| `ErrorBoundary` | `ErrorBoundary.tsx` | React error boundary catching unhandled render errors |
| `ThemeProvider` | `ThemeProvider.tsx` | Context providing `theme` and `toggleTheme` using localStorage |
| `FloatingCoins` | `FloatingCoins.tsx` | Ambient floating coin animation on the homepage hero |
| `FloatingPepe` | `FloatingPepe.tsx` | Floating Pepe meme animation |
| `MemeAssets` | `MemeAssets.tsx` | `PEPE_ASSETS` map, `PepePortrait`, `WarPropaganda`, `DegenQuoteBanner`, `MOON_PEPES`, `JEET_PEPES` |
| `PixelArt` | `PixelArt.tsx` | Pure CSS pixel-art components: `PixelGasMask`, `PixelPepe`, `PixelCrackedHelmet`, `PixelBarbedWire` |
| `SoundSynth` | `SoundSynth.ts` | Web Audio API sound synthesizer; exposes `window.playDAppSound(type)` for 'bet', 'explosion', 'whistle', 'victory', 'defeat', 'degen' sound effects |

---

## 7. Core Domain Models

### 7.1 Room

```typescript
interface Room {
  id: string;                        // Solana pubkey OR EVM bytes32 hex (0x…)
  category?: MarketCategory;         // Auto-detected or creator-set
  token: {
    address: string;                 // Token mint / contract address
    name: string;                    // Full token name
    symbol: string;                  // Ticker symbol (e.g. "BONK")
    icon: string;                    // URL or emoji
    liquidity?: number;
    marketCap?: number;
    age?: number;                    // Token age in minutes
    chainId?: string;                // "solana" | "avalanche" | "base" | …
    pairAddress?: string;            // DEX pair address for DexScreener embed
  };
  creator: string;                   // Wallet address of room creator
  moonPool: number;                  // USDC / SOL in moon side (human units)
  jeetPool: number;                  // USDC / SOL in jeet side (human units)
  expiry: number;                    // Unix timestamp in milliseconds
  status: 'active' | 'settled' | 'cancelled' | 'pending' | 'disputed';
  winner?: 'moon' | 'jeet' | 'draw';
  createdAt: number;                 // Unix timestamp in milliseconds
  duration: number;                  // Room duration in minutes
  openingPrice?: number;             // Token price at room creation
  priceFeedId?: string;              // Pyth network feed ID (optional)
  finalTWAP?: number;
  finalPrice?: number;
  twapFinalPrice?: number;
  lastSyncedAt?: number;

  // Oracle / dispute fields
  oracleAddress?: string;
  oracleFeeLamports?: number;
  settlementTimestamp?: number;
  disputeStatus?: number;            // 0=none, 1=pending, 2=resolved
  resolutionCriteria?: string;       // Freetext for non-price markets
  disputedAt?: number;
  disputeChallenger?: string;
  disputeBond?: number;
  oracleLogs?: string;
}
```

**Detecting debate/prediction markets (non-price rooms):**  
A room is classified as a "debate market" (non-price) when:
- `category === 'debate'` or `category === 'prediction'`, OR
- `resolutionCriteria` is non-empty AND `pairAddress` is empty, OR
- `token.address === creator` (sentinel for freetext markets)

### 7.2 Bet

```typescript
interface Bet {
  id: string;
  roomId: string;
  user: string;                // Original bettor wallet address
  currentOwner?: string;       // Current owner (may differ if listed/bought)
  side: 'moon' | 'jeet';
  amount: number;              // SOL (Solana) or USDC (Avalanche), human units
  claimed: boolean;
  timestamp: number;
  txSig?: string | null;
  shares?: number;             // Outcome shares (AMM mode)
  pricePaid?: number;          // Price per share (0.01 – 0.99)
}
```

### 7.3 Listing (Secondary Market)

```typescript
interface Listing {
  pubkey: string;
  room: string;
  bet: string;
  seller: string;
  price: number;               // Ask price in SOL / USDC
  side?: 'moon' | 'jeet';
  amount?: number;             // Original bet size
}
```

### 7.4 UserProfile

```typescript
interface UserProfile {
  wallet: string | null;
  balance: number;             // Current SOL/USDC balance
  bets: Bet[];
  achievements: string[];
  stats: {
    totalBets: number;
    wins: number;
    losses: number;
    profit: number;
    winStreak: number;
    longestWinStreak: number;
    biggestBet: number;
  };
  trenchScore: 'S' | 'A' | 'B' | 'C' | 'D';
  username: string | null;
  avatarUrl: string | null;
  referredBy: string | null;
  referralCode: string | null;
  referralsCount: number;
  referralEarnings: string;
  referralPayouts: any[];
  unclaimedReferralRewards: number;
}
```

### 7.5 LimitOrder

```typescript
interface LimitOrder {
  id: string;
  roomId: string;
  user: string;
  side: 'moon' | 'jeet';
  price: number;               // Per share (0.01 to 0.99)
  amount: number;              // Total shares ordered
  filled: number;              // Matched shares so far
  timestamp: number;
  type: 'buy' | 'sell';
}
```

---

## 8. Market Mechanics

### 8.1 Room Lifecycle

```
PENDING → ACTIVE → SETTLED
               └──→ DISPUTED → RESOLVED (overturned or confirmed)
               └──→ CANCELLED
```

| Status | Trigger | Duration |
|---|---|---|
| `pending` | Room created but keeper hasn't triggered start | Until keeper processes |
| `active` | Opening price recorded; betting open | `duration` minutes |
| `settled` | Keeper submits `settle_room` after expiry | Permanent |
| `disputed` | Any user posts a dispute bond within 30min post-settlement | Up to 72h |
| `cancelled` | Admin action or no bets placed before expiry | Permanent |

### 8.2 Two-Sided AMM (CPMM)

When a room is seeded with liquidity:
1. Room creator deposits `N` USDC.
2. Contract mints `N` MOON shares + `N` JEET shares into the AMM pool reserves.
3. Starting price: **$0.50 per share** on each side (50/50 probability).
4. Every buy/sell adjusts reserves according to the CPMM formula.
5. Room creator receives **LP tokens** proportional to their seed.
6. Swap fees (0.30%–1.00%) accrue to LP holders per swap.
7. LP holders can remove liquidity at any time before settlement.

**Share price interpretation:**  
If MOON shares trade at $0.70, the market implies a **70% probability** MOON will win.  
MOON price = `moonReserves / (moonReserves + jeetReserves)` (simplified).

### 8.3 Price Encoding

All prices stored as `i64` with **6 decimal places** (on Avalanche/USDC) or **12 decimal places** (legacy Solana on-chain).

```
$0.000042 USD  →  42           (6 decimal encoding)
$1.00 USD      →  1_000_000
$100.00 USD    →  100_000_000
```

In the frontend `mapApiRoom()`:  
```typescript
const rawOP = apiRoom.openingPrice ? Number(apiRoom.openingPrice) : 0;
const openingPriceNum = rawOP > 0 ? rawOP / 1e12 : undefined;  // Solana: 12 decimals
```

Pool amounts:
```typescript
moonPool = Number(apiRoom.moonPool) / (isEvm ? 1e6 : 1e9)
```

### 8.4 Oracle & Settlement

**Default settlement (Keeper oracle):**
- Keeper aggregates prices from DexScreener, Birdeye, Jupiter, Chainlink/Pyth.
- Outlier filter: remove sources >20% from median.
- Compute 10-sample TWAP.
- Submit signed `settle_room` transaction.

**Custom oracle:**
- Room creator can specify an `oracleAddress` (Chainlink feed, custom resolver, or zero for keeper).
- `oracleFeeAmount` paid to oracle contract on settlement.

**Non-price debate markets:**
- `resolutionCriteria` field contains freetext settlement criteria.
- Admin/arbitrator manually resolves via the admin panel.

### 8.5 Payout Calculation

```typescript
// Platform fee: 1.25%
const netPot = (moonPool + jeetPool) * 0.9875;
const shareRatio = userStakeAmount / (winnerPool + userStakeAmount);
const payout = shareRatio * netPot;
```

**Multiplier:**
```typescript
const multiplier = (moonPool + jeetPool) / sidePool;
// e.g. if moonPool = 10, jeetPool = 30: moon multiplier = 40/10 = 4x
```

### 8.6 Dispute & Arbitration Window

- After settlement, a **30-minute dispute window** opens.
- Any user can dispute by posting a `disputeBond` (configurable, e.g. 0.1 USDC/SOL).
- During dispute: room status becomes `'disputed'`.
- Admin resolves via `resolveDispute(roomId, winner, overturned)`.
- If overturned: original settlement is reversed; winning side changes; bond returned to challenger.
- If confirmed: bond forfeited; original settlement stands.
- Countdown displayed in the room UI via `disputeCountdown` state.

---

## 9. Cross-Chain Architecture (Avalanche Hub + Solana Spokes)

```
Solana User            Ethereum/Base User
     │                        │
     │ burn USDC (CCTP)        │ bridge USDC (CCTP)
     ▼                        ▼
Circle CCTP ──────────────────────────────────
                               │
                               ▼ mint USDC on Avalanche
                    ┌──────────────────────┐
                    │   ShitMarketCore.sol │
                    │   (Avalanche C-Chain) │
                    └──────────────────────┘
                               │
                    ┌──────────────────────┐
                    │  Indexer CCTP Relayer │
                    │  (monitors & relays) │
                    └──────────────────────┘
```

**User UX:**
- User logs in via Privy (email/social/Solana wallet).
- Privy provisions an EVM embedded wallet automatically.
- Gasless EVM transactions sponsored by platform Paymaster.
- `RelayDepositModal` component allows bridging USDC from Base, Arbitrum, Ethereum, or Solana into Avalanche.

**Configuration flags:**
```bash
NEXT_PUBLIC_CORE_CHAIN=avalanche          # or "solana" for legacy mode
NEXT_PUBLIC_CORE_CONTRACT_ADDRESS=0x…    # ShitMarketCore address
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://…  # Fuji testnet or Avalanche mainnet
```

---

## 10. Market Categories

Auto-detected via regex in `detectCategory()` and stored in the `Room.category` field.

| `MarketCategory` | Icon | Detection Keywords |
|---|---|---|
| `crypto` | 🪙 | Default (no other match) |
| `sports` | ⚽ | nba, fifa, premier, ufc, f1, nfl, tennis, football, soccer, champions, boxing, derby, stadium, trophy, real madrid, etc. |
| `politics` | 🏛️ | election, trump, biden, kamala, senate, congress, president, politic, government, house, vote, law, parliament, minister |
| `ai_tech` | 🤖 | openai, gpt, sam altman, claude, gemini, nvidia, apple, tesla, robot, ai, tech, spacex, chip |
| `pop_culture` | 🎬 | oscar, grammy, drake, kendrick, movie, netflix, youtube, twitch, hollywood, music, album, tiktok, game |
| `macro` | 📈 | fed, rate, cpi, inflation, s&p, stock, nasdaq, gold, oil, tariff, economy, treasury, gdp, interest, yield, bank |

---

## 11. Parlays

**Page:** `/parlays`  
**Status:** Simulated (does not execute on-chain transactions)

A parlay is a multi-leg prediction bet where the user must win **all legs** to collect the combined multiplier payout.

**Mechanics:**
- User picks up to N active rooms, choosing MOON or JEET on each.
- Multiplier = product of all individual room odds: `∏(totalPool / sidePool)`.
- Payout = `multiplier × stakeAmount`.
- If any single leg settles against the chosen side, the entire stake is lost.

**Live odds calculation:**
```typescript
const getLiveOdds = (room: Room, side: 'moon' | 'jeet'): number => {
  const total = room.moonPool + room.jeetPool;
  const odds = side === 'moon' ? total / room.moonPool : total / room.jeetPool;
  return Math.max(1.01, Number(odds.toFixed(2)));
};
```

Odds stay in sync with live pool updates from the Zustand store.

---

## 12. Secondary Market (P2P Bet Listings)

Users can sell their active bet positions before a room settles.

**On-chain flow (Solana):**
1. Seller calls `list_position(roomPubkey, betPubkey, priceSOL)` → creates `Listing` PDA.
2. Buyer calls `buy_position(roomPubkey, listingPubkey, betPubkey, seller, originalBettor)` → atomically transfers the `Bet` PDA's `currentOwner` to the buyer and transfers SOL to seller.
3. Seller can call `cancel_listing(listingPubkey, betPubkey)` to remove the listing.

**Frontend flow:**
- `fetchRoomListings(roomId)` loads all active listings for a room from the API.
- Listings displayed in the Room detail page under the "Positions" tab.
- `listPosition()`, `buyPosition()`, `cancelListing()` dispatch the corresponding Anchor instructions.
- `selectedBetToList` and `askPriceInput` local state control the listing creation form.

---

## 13. Referral System

- Each user is assigned a unique `referralCode` (stored in `UserProfile`).
- New users can provide a `referredBy` wallet on their first profile save.
- The `UserReferral` PDA tracks referral relationships on-chain.
- Referral rewards accrue as a percentage of referees' bets.
- `claimReferralRewardsOnChain()` dispatches the `claim_referral_rewards` instruction.
- `unclaimedReferralRewards` displayed in the Portfolio/Profile UI.

---

## 14. Authentication & Wallet Flow

```
User visits ShitMarket
         │
         ▼
  ComplianceModal (geo-check / ToS)
         │
         ▼
  IntroScreen (one-time animated intro)
         │
         ▼
  Header: "SIGN IN / SIGN UP" button
         │
    ┌────┴────┐
    │  Privy  │  (email, Google, Twitter, Discord, Farcaster)
    └────┬────┘
         │
    ┌────┴──────────────────────────────────┐
    │                                       │
 Embedded EVM Wallet              Injected Wallet (Phantom,
 (auto-provisioned)               Solflare, Backpack, etc.)
    │                                       │
    └────────────────┬──────────────────────┘
                     │
              useWalletContext
              { walletType, activeWalletAddress, balance }
                     │
              useAppState.setWalletAddress(address)
              → fetchBalance()
              → refreshProfile()
```

**`WalletProvider.tsx`** exports `useWalletContext()` providing:
- `walletType`: `'privy' | 'injected' | null`
- `activeWalletAddress`: string | null
- `balance`: number (SOL or USDC)
- `setIsModalOpen(bool)`: opens the wallet selection modal
- `isImportedWalletLocked`: boolean
- `disconnect()`: Promise<void>

---

## 15. API Reference

Base URL (production): `https://api.shitmarket.com`  
Base URL (development): `http://localhost:3001`  
Configured via: `NEXT_PUBLIC_INDEXER_API_URL`

### GET /api/rooms

```
Query: filter=ending|biggest|latest  status=active|settled  limit=<1-100>
Response: { success: true, data: Room[] }
```

### GET /api/rooms/:pubkey

```
Response: {
  success: true,
  data: {
    ...room,
    bets: Bet[],
    computedPayouts: { moon: number, jeet: number }
  }
}
```

### GET /api/rooms/token-price/:mintAddress

```
Query: pythFeedId=<optional>
Response: { success: true, priceUsd: number, source: string }
```

### GET /api/leaderboard

```
Query: sortBy=profit|wins|winRate  limit=<number>
Response: {
  success: true,
  data: {
    moon: LeaderboardEntry[],
    jeet: LeaderboardEntry[]
  }
}
```

### GET /api/profile/:wallet

```
Response: {
  success: true,
  data: UserProfile
}
```

### POST /api/profile/:wallet

```
Body: { username: string|null, avatarUrl: string|null, referredBy: string|null }
Response: { success: true }
```

### GET /api/rooms/:pubkey/chat

```
Response: { success: true, data: ChatMessage[] }
```

### POST /api/rooms/:pubkey/chat

```
Body: { side: 'moon'|'jeet'|'all', user: string, message: string }
Response: { success: true }
```

---

## 16. WebSocket Protocol

**Endpoint:** `ws://localhost:3002` (or `NEXT_PUBLIC_WS_URL`)

### Client → Server

```json
// Subscribe to a specific room's real-time updates
{ "type": "subscribe", "room": "<roomPubkey>" }

// Subscribe to global new-room feed
{ "type": "subscribe_global" }

// Unsubscribe from a room
{ "type": "unsubscribe", "room": "<roomPubkey>" }

// Keepalive ping
{ "type": "ping" }
```

### Server → Client

```json
// Room update (new bet, pool change, settlement)
{
  "type": "room_update",
  "roomPubkey": "...",
  "moonPool": 45.2,
  "jeetPool": 32.1,
  "status": "active",
  "winner": null
}

// New room created globally
{ "type": "new_room", ...roomData }

// Subscription acknowledgement
{ "type": "subscribed", "room": "<roomPubkey>" }

// Pong response
{ "type": "pong" }

// Error
{ "type": "error", "message": "Room not found" }
```

**Client implementation in `ClientWrapper.tsx`:**
- WebSocket is initialized once on mount.
- `subscribe_global` sent immediately on connect.
- On `room_update`: dispatches `useAppState.updateRoomPools(...)` or `settleRoom(...)`.
- On `new_room`: dispatches `useAppState.addRoom(...)`.
- Reconnects automatically on disconnect with exponential backoff.
- When navigating to a room page, sends `subscribe` for that room's pubkey.

---

## 17. Environment Variables

### Frontend (`src/` / `.env.local`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `NEXT_PUBLIC_SOLANA_RPC_URL` | Yes | `https://api.devnet.solana.com` | Solana RPC endpoint |
| `NEXT_PUBLIC_INDEXER_API_URL` | Yes | `http://localhost:3001` | Indexer REST API base URL |
| `NEXT_PUBLIC_WS_URL` | Yes | `ws://localhost:3002` | Indexer WebSocket URL |
| `NEXT_PUBLIC_SITE_URL` | Yes | `https://shitmarket.lol` | Canonical site URL for SEO |
| `NEXT_PUBLIC_CORE_CHAIN` | No | `solana` | Set to `avalanche` for EVM mode |
| `NEXT_PUBLIC_CORE_CONTRACT_ADDRESS` | No | — | Avalanche ShitMarketCore contract address |
| `NEXT_PUBLIC_AVALANCHE_RPC_URL` | No | Public Fuji RPC | Avalanche C-Chain RPC URL |
| `NEXT_PUBLIC_PRIVY_APP_ID` | Yes | — | Privy application ID |

### Indexer (`indexer/.env`)

| Variable | Required | Description |
|---|---|---|
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `REDIS_URL` | Yes | Redis connection string |
| `SOLANA_RPC_URL` | Yes | Solana RPC (recommend Helius/Triton in production) |
| `PROGRAM_ID` | Yes | Deployed Anchor program ID |
| `KEEPER_PRIVATE_KEY` | Yes | Base58 Solana keeper wallet private key |
| `BIRDEYE_API_KEY` | Recommended | Birdeye price API key |
| `CORE_CHAIN` | No | `avalanche` to enable EVM keeper mode |
| `AVALANCHE_RPC_URL` | If EVM | Avalanche RPC URL |
| `CORE_CONTRACT_ADDRESS` | If EVM | ShitMarketCore contract address |
| `EVM_KEEPER_PRIVATE_KEY` | If EVM | Hex EVM keeper private key (`0x…`) |
| `CCTP_ATTESTATION_URL` | If CCTP | Circle attestation service URL |
| `SENTRY_DSN` | No | Sentry error tracking DSN |
| `PORT` | No | REST API port (default 3001) |
| `WS_PORT` | No | WebSocket port (default 3002) |

---

## 18. Security Model

| Threat Vector | Mitigation |
|---|---|
| **Reentrancy on claim** | `claimed = true` flag set atomically before SOL/token transfer in both Anchor and Solidity |
| **Duplicate settlement** | `RoomStatus::Active` checked before settlement; already-settled error caught and ignored |
| **Rogue keeper** | Keeper address stored in `PlatformConfig` on-chain; only admin can update it |
| **Admin rug** | No `cancel_room` or admin-claim instructions exist during active pools; all funds locked until settlement |
| **Arithmetic overflow** | Anchor uses safe checked math; Solidity 0.8+ has native overflow protection |
| **Stale price data** | Keeper aggregates from 4+ independent sources; 20% outlier shield discards manipulated feeds |
| **Sandwich attack on bets** | Configurable slippage tolerance on Solana transactions (user-controlled, shown in header settings) |
| **Double-processing events** | Transaction signatures/hashes cached in Redis with 48-hour TTL |
| **Low-priority fee frontrun** | User-selectable priority fees (Low/Medium/High/Turbo/Custom) with live network congestion display |
| **Unauthorized dispute resolution** | Only admin wallet can call `resolveDispute` (admin panel is wallet-gated) |
| **CCTP replay attacks** | Circle CCTP protocol includes nonce-based message deduplication |

---

## 19. Deployment Architecture

### Production Stack

```
┌───────────────────────────────────────────────┐
│                  Vercel                        │
│   Next.js Frontend (src/)                      │
│   Edge CDN, Serverless API routes              │
└───────────────────────────────────────────────┘
                      │
┌───────────────────────────────────────────────┐
│           Cloud VPS / Kubernetes (k8s/)        │
│  ┌─────────────┐  ┌────────────┐               │
│  │  Indexer    │  │  Postgres  │               │
│  │  Container  │  │  (managed) │               │
│  └─────────────┘  └────────────┘               │
│  ┌─────────────┐  ┌────────────┐               │
│  │   Redis     │  │  Grafana   │               │
│  │  (managed)  │  │ /Prometheus│               │
│  └─────────────┘  └────────────┘               │
└───────────────────────────────────────────────┘
```

**Recommended managed services:**
- PostgreSQL: Supabase, Neon, or Railway
- Redis: Upstash
- Solana RPC: Helius or Triton (high-throughput, event subscription support)

### Kubernetes (`k8s/`)

Kubernetes manifests for deploying the indexer at scale. Supports horizontal pod autoscaling for the REST API workers while keeping a single keeper replica to avoid double-settlement races.

### Docker (`indexer/docker-compose.yml`)

For local development:
```bash
cd indexer
docker-compose up postgres redis -d   # Start dependencies
npm run db:migrate                     # Apply Prisma migrations
npm run dev                           # Run indexer in watch mode
```

Services:
- `postgres` on port 5432
- `redis` on port 6379
- `indexer` on ports 3001 (REST) and 3002 (WS)
- `grafana` on port 3005
- `prometheus` on port 9090

---

## 20. Local Development Setup

### Prerequisites

- Node.js ≥ 20
- Rust + Solana CLI ≥ 1.18
- Anchor CLI ≥ 0.30
- Docker + Docker Compose

### Step 1: Build & deploy the Anchor program

```bash
cd program
anchor build
anchor test            # Spins up local validator and runs tests
anchor deploy --provider.cluster devnet
```

Copy the deployed Program ID into `program/Anchor.toml` and `indexer/.env`.

### Step 2: Start indexer services

```bash
cd indexer
cp .env.example .env
# Fill in: PROGRAM_ID, KEEPER_PRIVATE_KEY, SOLANA_RPC_URL, DATABASE_URL, REDIS_URL

docker-compose up postgres redis -d
npm install
npm run db:generate    # Generate Prisma client
npm run db:migrate     # Apply schema migrations
npm run dev            # Start indexer (REST + WS + Keeper + Listener)
```

### Step 3: Start the frontend

```bash
# In the project root
cp .env.example .env.local
# Set NEXT_PUBLIC_INDEXER_API_URL=http://localhost:3001
# Set NEXT_PUBLIC_WS_URL=ws://localhost:3002
# Set NEXT_PUBLIC_SOLANA_RPC_URL=http://127.0.0.1:8899 (or devnet URL)
# Set NEXT_PUBLIC_PRIVY_APP_ID=<your privy app id>

npm install
npm run dev   # Frontend at http://localhost:3000
```

### Avalanche / EVM mode

```bash
# In indexer/.env
CORE_CHAIN=avalanche
AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
CORE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
EVM_KEEPER_PRIVATE_KEY=0xYourEVMKeeperPrivateKey

# In .env.local (frontend)
NEXT_PUBLIC_CORE_CHAIN=avalanche
NEXT_PUBLIC_CORE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
NEXT_PUBLIC_AVALANCHE_RPC_URL=https://api.avax-test.network/ext/bc/C/rpc
```

### Useful test scripts (project root)

| Script | Purpose |
|---|---|
| `node test.js` | Basic connectivity test |
| `node test_pda_query.js` | Test PDA derivation and on-chain queries |
| `node update_fees.js` | Update platform fee parameters |
| `./build_contract.sh` | Rebuild and re-deploy Solidity contract |
| `./auto_push.sh` | Git auto-push helper |

---

*This document describes the system as it exists in the codebase at time of writing. Cross-reference with the actual source files for the most up-to-date implementation details.*
