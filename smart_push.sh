#!/bin/bash

set -e

echo "=== ShitMarket Smart Push Script ==="
echo "Pushing up to 3 files per commit, 3–4 min delays between batches."
echo ""

cd "$(git rev-parse --show-toplevel)"

git fetch origin

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 1: Indexer tradesCount tracking
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 1: Indexer listeners and rooms API tradesCount ---"
git add indexer/src/api/routes/rooms.ts indexer/src/listener/eventListener.ts indexer/src/listener/evmEventListener.ts
git commit -m "feat(indexer): add real-time tradesCount tracking to rooms API and listeners

- Queries prisma.bet.count() on every bet and swap event
- Saves tradesCount to Redis cache and exposes it through the /rooms API payload
- Emits tradesCount down the websockets for real-time frontend updates"

echo "Pushing batch 1..."
git push origin main

SLEEP_1=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_1}s before next batch..."
sleep $SLEEP_1

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 2: App state tradesCount piping
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 2: Frontend useAppState and ClientWrapper tradesCount ---"
git add src/store/useAppState.ts src/components/ClientWrapper.tsx
git commit -m "feat(frontend): pipe tradesCount from websocket and API to app state

- ClientWrapper.tsx: passes tradesCount from websocket BetPlaced payload into updateRoomPools dispatcher
- useAppState.ts: maps tradesCount from API and updates room object in the zustand store"

echo "Pushing batch 2..."
git push origin main

SLEEP_2=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_2}s before next batch..."
sleep $SLEEP_2

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 3: Component Extraction - MarketGridCard 1/2
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 3: MarketGridCard component extraction ---"
git add src/components/MarketGridCard.tsx src/app/page.tsx
git commit -m "refactor(ui): extract MarketGridCard component and implement on homepage

- Abstracted the complex room card UI from the homepage into a reusable src/components/MarketGridCard.tsx component
- Ensures consistent styling, multi-outcome support, and behavior across different pages
- page.tsx: removed inline HomepageRoomCard and replaced with imported MarketGridCard"

echo "Pushing batch 3..."
git push origin main

SLEEP_3=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_3}s before next batch..."
sleep $SLEEP_3

# ─────────────────────────────────────────────────────────────────────────────
# BATCH 4: Component Extraction - MarketGridCard 2/2 + Script
# ─────────────────────────────────────────────────────────────────────────────
echo ""
echo "--- BATCH 4: Apply MarketGridCard to rooms page and update push script ---"
git add src/app/rooms/page.tsx smart_push.sh
git commit -m "refactor(ui): implement MarketGridCard on rooms index and update push script

- rooms/page.tsx: use the new unified MarketGridCard component instead of maintaining separate card UI code
- smart_push.sh: update for tradesCount and MarketGridCard release batches"

echo "Pushing batch 4..."
git push origin main

echo ""
echo "=== All batches pushed successfully! ==="
