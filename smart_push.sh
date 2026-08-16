#!/bin/bash

set -e

echo "=== ShitMarket Smart Push Script ==="
echo "Pushing up to 3 files per commit, 3–4 min delays between batches."
echo ""

cd "$(git rev-parse --show-toplevel)"

git fetch origin

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 1: Contract - Multi-outcome AMM support
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 1: evm/contracts/AMPool.sol ---"
git add evm/contracts/AMPool.sol
git commit -m "feat(contracts): upgrade AMPool to support multi-outcome CPMM

- Refactored \`reserves\` from a fixed length array of 2 to a dynamic array of N outcomes
- Added \`outcomeCount\` immutable fetched from ConditionalTokens during initialization
- Updated \`addLiquidity\` and \`removeLiquidity\` to dynamically split and merge across all available outcomes
- Updated \`Swap\` event to emit the full array of reserves"

echo "Pushing batch 1..."
git push origin main

SLEEP_1=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_1}s before next batch..."
sleep $SLEEP_1

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 2: Indexer - Schema and listener updates for multi-outcome
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 2: Indexer schema and evmEventListener.ts updates ---"
git add indexer/prisma/schema.prisma indexer/src/listener/evmEventListener.ts indexer/src/api/routes/rooms.ts
git commit -m "feat(indexer): support N-outcome markets and extended metadata

- schema.prisma: add \`outcomeLabels\`, \`rules\`, and \`context\` optional fields to Room
- evmEventListener.ts: update \`handleSwap\` and liquidity handlers to query \`outcomeCount\` and the full \`reserves\` array dynamically from the pool contract
- Save full \`poolReserves\` string to Redis cache and fallback side formatting based on outcome count
- api/routes/rooms.ts: expose new metadata fields"

echo "Pushing batch 2..."
git push origin main

SLEEP_2=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_2}s before next batch..."
sleep $SLEEP_2

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 3: Frontend - Multi-outcome UI and app state
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 3: Frontend UI and App State updates ---"
git add src/app/create-room/page.tsx "src/app/room/[id]/page.tsx" src/store/useAppState.ts
git commit -m "feat(frontend): multi-outcome market creation and room UI

- create-room/page.tsx: add UI to dynamically add/remove custom outcome labels for debate markets; pass \`rules\`, \`context\`, and \`outcomeLabels\` to createRoom
- useAppState.ts: pipe new metadata fields to the indexer API and handle placing bets with dynamic outcome IDs
- room/[id]/page.tsx: support rendering arbitrary number of outcome pools based on \`outcomeLabels\`"

echo "Pushing batch 3..."
git push origin main

SLEEP_3=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_3}s before next batch..."
sleep $SLEEP_3

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 4: Misc - Docs generator script and smart push
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 4: Python docx generator and push script ---"
git add generate_doc.py smart_push.sh
git commit -m "chore: add generate_doc.py utility and update smart_push.sh

- generate_doc.py: added python script using python-docx to generate customized tables and MS Word documents for project reporting
- smart_push.sh: updated for the multi-outcome support release batches"

echo "Pushing batch 4..."
git push origin main

echo ""
echo "=== All batches pushed successfully! ==="
