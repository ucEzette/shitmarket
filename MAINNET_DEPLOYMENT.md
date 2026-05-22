# ShitMarket Mainnet Deployment Guide

## Prerequisites

### 1. Install Solana CLI (Required for cargo-build-sbf)

Since Homebrew and curl are unavailable, download and install manually:

#### Option A: Download Binary (Fastest)
```bash
# Download v1.18.18 for macOS
cd ~
wget https://github.com/solana-labs/solana/releases/download/v1.18.18/solana-release-x86_64-unknown-linux-gnu.tar.bz2

# Extract and run installer
tar jxf solana-release-x86_64-unknown-linux-gnu.tar.bz2
cd solana-release/
./install/install.sh

# Add to PATH
export PATH="/root/.local/share/solana/install/active_release/bin:$PATH"
source ~/.bashrc
```

#### Option B: Build from Source
```bash
# Clone repo
git clone https://github.com/solana-labs/solana.git
cd solana
git checkout v1.18.18

# Build (requires Rust + Cargo already installed)
cargo build --release --bin solana

# Install
cargo install --path cli
```

#### Verify Installation
```bash
solana --version
cargo build-sbf --version
```

### 2. Set Up Keypairs

```bash
# Create or use existing deployer keypair
solana-keygen new --outfile ~/deployer-keypair.json

# Create or use existing keeper keypair
solana-keygen new --outfile ~/keeper-keypair.json

# Create or use existing treasury pubkey
solana-keygen new --outfile ~/treasury-keypair.json

# Show public keys
solana-keygen pubkey ~/deployer-keypair.json
solana-keygen pubkey ~/keeper-keypair.json
solana-keygen pubkey ~/treasury-keypair.json
```

### 3. Configure Solana CLI for Mainnet

```bash
# Set cluster to mainnet-beta
solana config set --url https://api.mainnet-beta.solana.com

# Verify configuration
solana config get

# Check your balance (deployer needs ≥ 0.5 SOL for deployment fees)
solana balance ~/deployer-keypair.json --url mainnet-beta
```

---

## Deployment Steps

### Step 1: Build the Program

```bash
cd /Users/adam/Documents/shitmarket/program

# Clean previous builds
cargo clean

# Build for mainnet
anchor build --provider.cluster mainnet
```

This generates:
- `target/deploy/shitmarket.so` — deployable program binary
- `target/idl/shitmarket.json` — IDL for indexer

### Step 2: Deploy to Mainnet

```bash
cd /Users/adam/Documents/shitmarket/program

# Deploy program
anchor deploy \
  --provider.cluster mainnet \
  --provider.wallet ~/deployer-keypair.json
```

Output will show:
```
Deploying workspace: http://localhost:8899
Upgrade authority: <YOUR_PUBLIC_KEY>
Deploy signature: <TRANSACTION_SIGNATURE>
```

**Save the Program ID** — you'll need it for the indexer configuration.

### Step 3: Initialize PlatformConfig On-Chain

Create a script to call the `initialize` instruction with your admin, treasury, and keeper addresses:

```bash
solana program call <PROGRAM_ID> \
  --data initialize \
  --fee-payer ~/deployer-keypair.json \
  --url mainnet-beta
```

Or use a TypeScript script (create `deploy.ts`):

```typescript
import * as anchor from "@coral-xyz/anchor";
import { PublicKey, Keypair } from "@solana/web3.js";
import fs from "fs";

const PROGRAM_ID = new PublicKey("YOUR_PROGRAM_ID_HERE");
const connection = new anchor.web3.Connection("https://api.mainnet-beta.solana.com");

async function initialize() {
  const deployer = Keypair.fromSecretKey(
    new Uint8Array(JSON.parse(fs.readFileSync(process.env.HOME + "/deployer-keypair.json", "utf-8")))
  );

  const adminPubkey = deployer.publicKey;
  const treasuryPubkey = new PublicKey("YOUR_TREASURY_PUBKEY");
  const platformFeeBps = 200; // 2%

  const provider = new anchor.AnchorProvider(
    connection,
    new anchor.Wallet(deployer),
    { commitment: "confirmed" }
  );

  const idl = JSON.parse(fs.readFileSync("target/idl/shitmarket.json", "utf-8"));
  const program = new anchor.Program(idl, PROGRAM_ID, provider);

  const configPda = anchor.web3.PublicKey.findProgramAddressSync(
    [Buffer.from("platform_config")],
    PROGRAM_ID
  )[0];

  const tx = await program.methods
    .initialize(platformFeeBps)
    .accounts({
      config: configPda,
      admin: adminPubkey,
      treasury: treasuryPubkey,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .signers([deployer])
    .rpc({ commitment: "confirmed" });

  console.log("Initialize TX:", tx);
}

initialize().catch(console.error);
```

Run it:
```bash
cd /Users/adam/Documents/shitmarket/program
ts-node deploy.ts
```

### Step 4: Configure Indexer for Mainnet

Update `indexer/.env`:

```env
# ─── Solana (Mainnet) ─────────────────────────────────────────
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
SOLANA_WS_URL=wss://api.mainnet-beta.solana.com
PROGRAM_ID=<YOUR_DEPLOYED_PROGRAM_ID>

# Keeper wallet — base58-encoded private key
KEEPER_PRIVATE_KEY=[1, 2, 3, ..., 64]  # or JSON array from keeper-keypair.json

# ─── Database (Production) ────────────────────────────────────
DATABASE_URL=postgresql://user:password@host:5432/shitmarket_mainnet

# ─── Redis (Production) ───────────────────────────────────────
REDIS_URL=redis://username:password@host:6379

# ─── Pyth Feed Mapping ───────────────────────────────────────
PYTH_FEED_MAPPING={"<TOKEN_MINT>": "<PYTH_FEED_PUBKEY>"}

# ─── API Configuration ───────────────────────────────────────
REST_API_PORT=3001
WS_PORT=3002

# ─── External APIs ────────────────────────────────────────────
BIRDEYE_API_KEY=your_birdeye_key
DEXSCREENER_API_URL=https://api.dexscreener.com/latest/dex
PYTH_REST_URL=https://hermes.pyth.network

# ─── Logging ──────────────────────────────────────────────────
LOG_LEVEL=info
NODE_ENV=production
```

### Step 5: Start Indexer on Mainnet

```bash
cd /Users/adam/Documents/shitmarket/indexer

# Install dependencies
npm install

# Generate Prisma client
npm run db:generate

# Run migrations on production database
npm run db:migrate

# Start indexer
npm run dev
```

---

## Mainnet Wallet Setup

### Fund Deployer Wallet
```bash
# Send SOL to deployer public key
# You can transfer from:
# - Your exchange wallet
# - An existing Solana wallet
# - Through a faucet (for devnet only)

solana balance ~/deployer-keypair.json --url mainnet-beta

# Need at least:
# - 0.1 SOL for deployment fee
# - 0.5 SOL for buffer
```

### Fund Keeper Wallet
```bash
# Keeper needs enough SOL for transaction fees (~5000 lamports per settlement)
# For production, keep at least 1 SOL in keeper wallet

# Send SOL to keeper public key shown above
solana balance $(solana-keygen pubkey ~/keeper-keypair.json) --url mainnet-beta
```

### Verify Treasury Wallet
```bash
# Check treasury account exists
solana balance $(solana-keygen pubkey ~/treasury-keypair.json) --url mainnet-beta

# Or check a specific treasury address
solana account <TREASURY_PUBKEY> --url mainnet-beta
```

---

## Post-Deployment Checklist

- [ ] Program deployed to mainnet-beta
- [ ] Platform initialized with correct admin, treasury, and fee
- [ ] Keeper wallet funded (≥1 SOL)
- [ ] Database configured and migrated
- [ ] Redis configured
- [ ] Indexer running and syncing events
- [ ] API responding on `/health`
- [ ] WebSocket accepting connections
- [ ] Metrics available on `/metrics`
- [ ] Frontend updated with Program ID and mainnet RPC
- [ ] Pyth feed mapping configured for supported tokens

---

## Monitoring

### Check Indexer Health
```bash
curl http://localhost:3001/health
```

### View Metrics
```bash
curl http://localhost:3001/metrics
```

### Check Solana Account State
```bash
solana account <ACCOUNT_PUBKEY> --url mainnet-beta
```

### View Program Events
```bash
solana logs <PROGRAM_ID> --url mainnet-beta
```

---

## Troubleshooting

### Deploy fails with "insufficient funds"
```bash
# Check deployer balance
solana balance ~/deployer-keypair.json --url mainnet-beta

# Need at least 0.5 SOL for safe deployment
```

### Indexer can't connect to mainnet RPC
```bash
# Test RPC connection
solana ping --url https://api.mainnet-beta.solana.com

# Use a dedicated RPC if main RPC is slow:
# - Helius: https://mainnet.helius.rpc.com/?api-key=YOUR_KEY
# - Triton: https://orca.rpcpool.com
# - QuickNode: https://your-endpoint.solana-rpc.com
```

### Keeper not settling rooms
```bash
# Check keeper balance
solana balance $(solana-keygen pubkey ~/keeper-keypair.json) --url mainnet-beta

# Check indexer logs
docker logs <indexer_container_id>
```

---

## Security Notes

⚠️ **CRITICAL:**
- Never commit `id.json` files to git
- Store keypairs in secure vaults (HashiCorp Vault, AWS Secrets Manager, etc.)
- Use environment variables for sensitive keys, NOT plain text
- Run keeper behind a firewall
- Monitor treasury wallet for unauthorized transactions
- Use RPC rate limiting to prevent DDoS

---

## Rollback Plan

If deployment fails or bugs are discovered:

1. Deploy a patched version of the program
2. Ensure backward compatibility with existing accounts
3. Users' funds remain in escrow accounts until settlement
4. No user funds are lost in program migration

---

## Support

For Solana CLI issues: https://docs.solana.com/cli
For Anchor issues: https://www.anchor-lang.com/docs
