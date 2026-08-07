#!/bin/bash

set -e

echo "=== ShitMarket Smart Push Script ==="
echo "Pushing up to 3 files per commit, 3–4 min delays between batches."
echo ""

cd "$(git rev-parse --show-toplevel)"

git fetch origin

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 1: Contract addresses config + contract dual-copy ERC-1155 upgrade
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 1: Config utility + ERC-1155 upgrade in both contract copies ---"
git add src/utils/config.ts contracts/ShitMarketCore.sol evm/contracts/ShitMarketCore.sol
git commit -m "feat(contracts): upgrade ShitMarketCore to ERC-1155 outcome tokens; centralise contract addresses

- Inherit ERC1155 in ShitMarketCore; pass empty URI to constructor
- Add getOutcomeTokenId(roomId, side) pure helper to derive deterministic token IDs
- Mint ERC-1155 outcome tokens to bettor on placeBet; amount = USDC wagered
- Refactor claimWinnings to use balanceOf() instead of Bet.claimed flag; burn tokens on claim
- Handle Draw path (return 100% of token balance) and conditional bet.claimed backfill
- Add CONTRACT_ADDRESSES const map to src/utils/config.ts (USDC, ORACLE_REGISTRY, MARKET_FACTORY, CONDITIONAL_TOKENS, AM_POOL_FACTORY, PREDICTION_ROUTER, CORE_CONTRACT)
- Sync changes across both contracts/ and evm/contracts/ copies"

echo "Pushing batch 1..."
git push origin main

SLEEP_1=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_1}s before next batch..."
sleep $SLEEP_1

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 2: App state — ABI extensions + replace inline address fallbacks
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 2: useAppState — ABI additions + CONTRACT_ADDRESSES refactor ---"
git add src/store/useAppState.ts
git commit -m "refactor(state): centralise contract address resolution and extend ABIs

- Replace all inline process.env fallback address strings with CONTRACT_ADDRESSES from config.ts
- Add resolveMarket, conditionToMarketId, and markets ABI entries to MARKET_FACTORY_ABI
- Add isResolved and outcomeCounts view ABI entries to CONDITIONAL_TOKENS_ABI
- Declare addAmmLiquidity and removeAmmLiquidity method signatures on AppState interface"

echo "Pushing batch 2..."
git push origin main

SLEEP_2=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_2}s before next batch..."
sleep $SLEEP_2

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 3: Room detail page — Liquidity tab panel
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 3: Room detail — LiquidityTabPanel component ---"
git add "src/app/room/[id]/page.tsx"
git commit -m "feat(room): add LiquidityTabPanel for AMM liquidity add/remove on EVM rooms

- Import publicClient, AM_POOL_ABI, AM_POOL_FACTORY_ABI from state store and CONTRACT_ADDRESSES from config
- Add LiquidityTabPanel component: fetches user SM-LP balance every 10s from pool contract
- Expose ADD USDC LIQUIDITY input (calls addAmmLiquidity) and REMOVE LP RESERVES input (calls removeAmmLiquidity)
- Disabled states and loading flag prevent double-submits; balance gate prevents over-removal"

echo "Pushing batch 3..."
git push origin main

SLEEP_3=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_3}s before next batch..."
sleep $SLEEP_3

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 4: UMA Oracle integration contracts
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 4: New UMA oracle adapter and mock OOv3 contracts ---"
git add evm/contracts/UmaOracleAdapter.sol evm/contracts/MockOptimisticOracleV3.sol
git commit -m "feat(contracts): add UmaOracleAdapter and MockOptimisticOracleV3 for dispute resolution

- UmaOracleAdapter: implements IOracle; wraps UMA Optimistic Oracle v3 assertTruthWithDefaults
  - assertOutcome() submits ANCILLARY_DATA claim to OOv3 and maps assertionId => marketId
  - assertionResolvedCallback() receives settled truth state; records finalOutcomes and resolvedMarkets
  - resolveMarket() callable after resolution to propagate winner to MarketFactory
- MockOptimisticOracleV3: test-only OOv3 shim; stores assertions and allows manual settlement via resolveAssertion()"

echo "Pushing batch 4..."
git push origin main

SLEEP_4=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_4}s before next batch..."
sleep $SLEEP_4

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 5: EVM test suite additions
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 5: EVM test suites — ERC-1155 minting/burning and AMPool LP ---"
git add evm/test/ShitMarketCore.test.js evm/test/AMPool.test.js evm/test/UmaOracleAdapter.test.js
git commit -m "test(evm): add ERC-1155 outcome token tests, AMPool LP tests, and UMA adapter tests

- ShitMarketCore.test.js: assert ERC-1155 tokens minted equal to bet amount on placeBet; assert tokens burned and USDC payout received on claimWinnings (Moon wins scenario)
- AMPool.test.js: full LP lifecycle — deploy MarketFactory + AMPoolFactory, create condition, seed pool, verify LP token minting, swap conditional tokens, redeem via ConditionalTokens after settlement
- UmaOracleAdapter.test.js: deploy MockOOv3 + UmaOracleAdapter, assert outcome through mock oracle, simulate callback resolution, verify finalOutcomes mapping updated"

echo "Pushing batch 5..."
git push origin main

SLEEP_5=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_5}s before next batch..."
sleep $SLEEP_5

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 6: EVM utility scripts + roadmap doc
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 6: EVM debug scripts and world-class market roadmap ---"
git add evm/scripts/get_ct_address.js evm/scripts/simulate_add_lp.js world_class_market_roadmap.md
git commit -m "chore(evm): add pool debug scripts and world-class market feature roadmap

- evm/scripts/get_ct_address.js: reads conditionalTokens address from MarketFactory deployment
- evm/scripts/simulate_add_lp.js: reads pool metadata (USDC, CT, conditionId), mints USDC, approves and addLiquidity against deployed AMPool for local testing
- world_class_market_roadmap.md: documents roadmap gaps and proposed implementations for Gnosis CTF integration, UMA optimistic dispute resolution, and Circle CCTP / Across bridge cross-chain deposits"

echo "Pushing batch 6..."
git push origin main

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 7: Scratch utility + smart_push.sh update
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 7: Scratch debug script + push script update ---"
git add scratch/get_ct_address.js smart_push.sh
git commit -m "chore(scripts): add scratch CT address helper and update smart push script

- scratch/get_ct_address.js: standalone conditional tokens address lookup via ethers RPC (mirrors evm/scripts version, used outside Hardhat context)
- smart_push.sh: updated with current batch plan and accurate commit messages for this release cycle"

echo "Pushing batch 7..."
git push origin main

echo ""
echo "=== All batches pushed successfully! ==="
