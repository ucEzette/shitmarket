# ShitMarket — Permissionless Prediction Protocol

ShitMarket is a state-of-the-art, chain-agnostic prediction market platform built to bring high-adrenaline, permissionless wagering to meme coins, trending topics, and real-world arguments. Deployed on the high-performance **Avalanche C-Chain** and powered by gasless smart accounts, ShitMarket makes predictive speculation fast, cheap, and accessible to anyone, anywhere.

---

## What is ShitMarket?

At its core, ShitMarket allows anyone to create or trade binary prediction pools ("sectors") based on whether an asset's price will end above a target threshold, or whether a specific real-world event will resolve in a certain way. Traders choose their side:
* **🚀 MOON**: Bullish / YES outcome
* **💀 JEET**: Bearish / NO outcome

Unlike traditional order-book prediction platforms that suffer from low liquidity and slow execution, ShitMarket introduces on-chain **Two-Sided Constant Product Market Maker (CPMM)** pools. This ensures instant liquidity, zero wait times for counterparties, and dynamic probability pricing ($0.01 to $0.99) driven entirely by market demand.

---

## Why ShitMarket Stands Out

### 1. Zero Friction User Experience (Web2-to-Web3 Seamless)
* **Social Login & Instant Wallets**: Users can sign in using Google, Twitter, Farcaster, Discord, or Email via Privy. No seed phrases, browser extensions, or upfront Web3 knowledge required.
* **Gasless Trades**: Platform paymasters sponsor transaction fees. Users sign trade executions without spending AVAX or handling gas calculations.
* **Universal Multi-Chain Deposits**: Through native **Circle CCTP** integration and Relay Protocol, players can deposit funds directly from Ethereum, Base, Arbitrum, Optimism, or Solana. The funds are bridged and converted into USDC on Avalanche automatically.

### 2. Deep, Instant Liquidity (CPMM Architecture)
* **Two-Sided AMM Seeding**: Room creators seed markets with USDC, which is automatically split into 1:1 backed outcome tokens (1 MOON + 1 JEET per USDC).
* **Fair Price Discovery**: Every market starts at an intuitive 50/50 probability ($0.50 starting price per share), allowing immediate trading on both sides.
* **Early Exits**: Traders do not need to wait for market expiry. They can sell outcome tokens back to the AMM pool at any time to take profit or cut losses.

### 3. Yield for Market Creators & Liquidity Providers
* **0.10% Total AMM Swap Fee**: Every swap incurs an ultra-low 0.10% fee. **0.07% (70%)** is accrued directly to Liquidity Providers and creators in USDC, and **0.03% (30%)** is routed to the platform treasury.
* **On-Demand Fee Claiming**: LPs harvest accrued USDC swap fees anytime via `AMPool.claimFees()` without withdrawing or burning underlying LP tokens.
* **$3 Permissionless Room Creation**: Low anti-spam fee of **$3 USDC** to create any custom prediction room.

### 4. Rug-Free, Tamper-Proof Settlement
* **Multi-Oracle TWAP Aggregator**: Settlement prices are verified by aggregating and averaging data across DexScreener, Birdeye, Chainlink, and Pyth Network. A 20% outlier shield automatically filters out abnormal price spikes or flash loans.
* **Arbitration & Dispute Window**: Once a market resolves, a 30-minute public dispute window opens. Anyone can challenge the settlement by posting a dispute bond, sending disputed events to admin arbitration for final verification.
* **Locked Funds**: The smart contract locks pool capital until settlement. There are no admin-claim or cancel backdoors on active pools.

---

## Deployed & Verified Smart Contracts (Avalanche Fuji Testnet)

All smart contracts are compiled with Solidity `0.8.24` (Cancun EVM, 200 Optimizer runs, `viaIR: true`), deployed on **Avalanche Fuji (Chain ID: 43113)**, and **fully verified on Snowscan / Routescan / Snowtrace**:

| Contract Name | Fuji Address | Explorer & Verification Link | Description |
| :--- | :--- | :--- | :--- |
| **`AMPoolFactory`** | `0x8634a6e6346Ba056c6Bd11DeB00C99f68Aa0DE5d` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x8634a6e6346Ba056c6Bd11DeB00C99f68Aa0DE5d#code) | Deploys CPMM outcome pools with 0.10% fee split & `claimFees()` accumulator. |
| **`MarketFactory`** | `0x139E2Bd8A802f6fb37C8f1eE1ff798271f623167` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x139E2Bd8A802f6fb37C8f1eE1ff798271f623167#code) | Factory for creating prediction rooms ($3 USDC creation fee). |
| **`ConditionalTokens`** | `0x3DBa9D7EF6B71610149daeF07bd8fcc6f5297A2A` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x3DBa9D7EF6B71610149daeF07bd8fcc6f5297A2A#code) | ERC-1155 prediction outcome tokens & collateral settlement. |
| **`OracleRegistry`** | `0xD9Ea73D3c157528A133Bc610E02A6C972a62095F` | [View on Snowtrace](https://testnet.snowtrace.io/address/0xD9Ea73D3c157528A133Bc610E02A6C972a62095F#code) | Multi-oracle resolution adapter & EOA custom resolver registry. |
| **`PredictionRouter`** | `0x8059fDbeC0521F2b6bdCA1F99D5f978Aa9958524` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x8059fDbeC0521F2b6bdCA1F99D5f978Aa9958524#code) | Hybrid aggregator routing between CLOB order books and AMM pools. |
| **`ShitMarketCore`** | `0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x803E97FDffE050bfd781c26ba8a65DF069ae9cC6#code) | Core prediction market controller & escrow vault. |
| **`MockUSDC`** | `0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2` | [View on Snowtrace](https://testnet.snowtrace.io/address/0x17c48E0670548B798dcC3E56a18eb2f5B158AAB2#code) | 6-decimal testnet USDC collateral token with permissionless minting. |

---

## Benefits for Users

* **Meme Creators & Communities**: Create custom prediction rooms for your community's native tokens and capture trade volume fees.
* **Day Traders**: Speculate on highly volatile micro-cap tokens with leveraged payout profiles based on outcome probability.
* **Arbitrageurs**: Capitalize on discrepancies between the implied prediction probability and real-time external data feeds.
* **Affiliates**: Generate lifetime passive yield through ShitMarket's on-chain referral program. Earn a percentage of all wagers placed by players referred to the platform.

---
---

## Technical Architecture & Specifications

### Repository Layout
```
shitmarket/
├── contracts/              # Solidity Smart Contracts (Avalanche C-Chain)
│   └── ShitMarketCore.sol  # Main protocol controller, room state, and claim logic
├── indexer/                # TypeScript Node.js Services (Listener, API, WS, Keeper)
│   ├── src/
│   │   ├── api/            # Express REST endpoint handlers
│   │   ├── listener/       # Avalanche EVM chain event subscriber
│   │   ├── keeper/         # Price aggregator and auto-settlement keeper (cron)
│   │   ├── relayer/        # Circle CCTP deposit relayer
│   │   └── websocket/      # Real-time WebSocket room updates
│   └── prisma/             # PostgreSQL database schemas and migrations
└── src/                    # Next.js 14 Web Application Frontend
    ├── app/                # Next.js App Router views
    ├── components/         # Tailwind CSS & Framer Motion UI Components
    └── store/
        └── useAppState.ts  # Global Zustand client state and Viem Web3 interfaces
```

### Protocol Mechanics
* **Collateral Asset**: USDC (6 decimals)
* **Outcome Shares**: 1:1 fully collateralized ERC-1155 tokens
* **Price Scale**: Scaled as integer `int64` with 6 decimal places ($1.00 USDC = `1_000_000`)
* **Room Creation Fee**: **$3.00 USDC** anti-spam fee
* **AMM Swap Fee**: **0.10%** (0.07% claimable LP yield + 0.03% treasury)
* **Settlement Fee**: **1.25%** platform fee deducted from the total losing pool on final claim execution

---

## Developer Quick Start

### 1. Build and Test Smart Contracts
Requirements: [Node.js 20+](https://nodejs.org/), [Docker](https://www.docker.com/)

```bash
# Compile contracts and run Hardhat tests
cd evm
npm install
npx hardhat test
```

### 2. Run Indexer & Databases Locally
The indexer monitors the contracts, runs the settlement keeper, and provides the API/WebSocket feeds.

```bash
cd indexer
cp .env.example .env
# Edit .env and supply your EVM_KEEPER_PRIVATE_KEY, database, and RPC configurations

# Start PostgreSQL and Redis containers
docker-compose up postgres redis -d

# Generate Prisma Client & run migrations
npm install
npm run db:generate
npm run db:migrate

# Start the indexer service
npm run dev
```

### 3. Launch the Frontend
```bash
# In the project root folder
cp .env.example .env.local
# Set NEXT_PUBLIC_CORE_CHAIN=avalanche
# Set NEXT_PUBLIC_CORE_CONTRACT_ADDRESS=0xYourDeployedContractAddress
# Set NEXT_PUBLIC_INDEXER_API_URL=http://localhost:3001
# Set NEXT_PUBLIC_WS_URL=ws://localhost:3002

npm install
npm run dev
```
The application will run locally at `http://localhost:3000`.

---

## API & WebSocket Reference

### REST API
* `GET /api/rooms` — Query active or settled prediction rooms (supports filter by ending, biggest, latest)
* `GET /api/rooms/:id` — Retrieve detailed statistics, order books, and bet history for a specific room
* `GET /api/leaderboard` — Returns the season's top traders ranked by ELO, profit, and accuracy
* `GET /api/profile/:wallet` — Returns stats, trade logs, and referral records for a user wallet address

### WebSocket Gateway
Connect to `ws://localhost:3002` to subscribe to real-time events:
* `{ "type": "subscribe", "room": "<roomId>" }` — Subscribe to instant pool size changes, chat messages, and trade activities
* `{ "type": "subscribe_global" }` — Subscribe to a feed of new rooms created on-chain
