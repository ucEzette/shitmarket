#!/bin/bash

set -e

echo "=== ShitMarket Smart Push Script ==="
echo "Pushing up to 3 files per commit, 3–4 min delays between batches."
echo ""

cd "$(git rev-parse --show-toplevel)"

git fetch origin

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 1: State store — createRoom initial snipe (Pump.fun anti-frontrun)
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 1: useAppState — createRoom Pump.fun-style initial snipe/dev buy ---"
git add src/store/useAppState.ts
git commit -m "feat(state): add optional initialSnipe param to createRoom for Pump.fun-style anti-frontrun first buy

- Extend createRoom signature with optional initialSnipe: { side: 'moon' | 'jeet', amount: number }
- EVM path: after addLiquidity completes, execute buyShares(outcomeIdx, amountScaled) on the pool atomically
- Record userBet locally and fire-and-forget POST to /api/bets indexer with txSignature
- Toast progression: shows 'SECURING FIRST BUY POSITION' during snipe; non-fatal on failure (room still created)
- Solana path: after room creation and fetchRooms, call placeBet(roomPda, side, amount) if initialSnipe set
- Fix optimistic moonSeed/jeetSeed to include snipe bonus so room preview shows accurate opening reserves
- Remove duplicate currentUser declaration (now hoisted earlier in EVM flow)"

echo "Pushing batch 1..."
git push origin main

SLEEP_1=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_1}s before next batch..."
sleep $SLEEP_1

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 2: Create-room UI — First Buy toggle + strike price config panel
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 2: Create-room UI — First Buy toggle and Entry/Strike Price panel ---"
git add src/app/create-room/page.tsx
git commit -m "feat(create-room): add First Buy (dev snipe) toggle and Entry/Strike Price configuration panel

- Add enableFirstBuy, snipeSide, snipeAmount state fields (Pump.fun-style optional initial position)
- Compute totalRequiredUsdc = creation fee (3 USDC EVM / 0 Solana) + seedAmount + actualSnipeAmount for balance gate
- Replace seedSide directional seed with neutral 50/50 seeding; snipe bonus added on top per side
- Pass initialSnipe to createRoom when enableFirstBuy is toggled on and snipeAmount > 0
- Remove old placeBet(seedSide) post-room call (now handled in state via initialSnipe)
- Include moonLabel/jeetLabel in newRoom object so custom outcome labels are persisted from creation
- Add 'Entry & Strike Price Configuration' panel: Live Market Spot (default) vs Custom Strike Price selector
  - Live mode displays current DexScreener price badge with moon/jeet label hints
  - Custom mode enables a target price input with quick-preset multipliers (+5%, +10%, +25%, +50%, ×2, -10%)"

echo "Pushing batch 2..."
git push origin main

SLEEP_2=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_2}s before next batch..."
sleep $SLEEP_2

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 3: design.md + diagnostics_channel_mock.js
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 3: design.md room lifecycle section + diagnostics channel mock fix ---"
git add design.md diagnostics_channel_mock.js
git commit -m "docs + fix: document room creation lifecycle in design.md and fix diagnostics_channel mock

- design.md: add section 4.4 'Room Creation & Seeding Lifecycle'
  - Entry & Strike Price modes: Live Spot Baseline vs Custom Target/Strike Price (preset multipliers)
  - Neutral 50/50 seeding: equal MOON + JEET reserves minted, creator receives all LP tokens
  - Pump.fun-style anti-frontrun Dev Snipe: atomic buyShares after addLiquidity, MOON (Side 0) or JEET (Side 1)
- diagnostics_channel_mock.js: rewrite to properly bridge native Node.js diagnostics_channel (dc.channel, dc.subscribe, etc.)
  - Replace stub tracingChannel with createTracingChannel using real dc.channel per event type
  - Delegate subscribe, unsubscribe, hasSubscribers to native dc equivalents with fallbacks
  - Correctly export all aliases (tracingChannel, channel, hasSubscribers)"

echo "Pushing batch 3..."
git push origin main

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 4: smart_push.sh — updated script
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 4: smart_push.sh — updated with current batch plan ---"
git add smart_push.sh
git commit -m "chore(scripts): update smart_push.sh with current release cycle batch plan"

echo "Pushing batch 4..."
git push origin main

echo ""
echo "=== All batches pushed successfully! ==="
