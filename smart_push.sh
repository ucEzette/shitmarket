#!/bin/bash

set -e

echo "=== ShitMarket Smart Push Script ==="
echo "Pushing up to 3 files per commit, with 3-4 min delays between batches."
echo ""

cd "$(git rev-parse --show-toplevel)"

git fetch origin

# --- BATCH 1: State management & order book resilience ---
echo ""
echo "--- BATCH 1: State management & order book resilience ---"
git add src/store/useAppState.ts
git commit -m "fix(state): harden order book fetch with try/catch fallback and dispatch activity on trade

- Wrap indexer order book fetch in try/catch; fall back to pure AMM on network error
- Fix verifyingContract fallback from '0x0' to zero-padded address
- Dispatch 'win' activity notification locally after successful market order"

echo "Pushing batch 1..."
git push origin main

# --- Wait 3-4 minutes ---
SLEEP_1=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_1}s before next batch..."
sleep $SLEEP_1

# --- BATCH 2: Wallet provider overhaul ---
echo ""
echo "--- BATCH 2: Wallet provider & embedded wallet detection ---"
git add src/components/WalletProvider.tsx
git commit -m "fix(wallet): simplify wallet type detection logic and always create embedded wallets on login

- Rework savedType priority: prefer embedded over external on login
- Remove auto-detect heuristic; rely on explicit localStorage wallet type
- Set createOnLogin to 'all-users' for both Solana and Ethereum embedded wallets
- Fix effectivePrivyWallet selection to respect walletType (embedded vs external)
- Remove redundant activeEvmWallet fallback in getEthereumProvider"

echo "Pushing batch 2..."
git push origin main

# --- Wait 3-4 minutes ---
SLEEP_2=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_2}s before next batch..."
sleep $SLEEP_2

# --- BATCH 3: Footer cleanup ---
echo ""
echo "--- BATCH 3: Footer UI cleanup ---"
git add src/components/Footer.tsx
git commit -m "chore(ui): remove deprecated status badges and recruit channel labels from Footer

- Remove Settlement Engine status badge (animated pulse indicator)
- Remove 'RECRUIT CHANNELS' label and 'MOBILE CLIENT: COMING SOON' badge
- Simplify footer layout to core social links only"

echo "Pushing batch 3..."
git push origin main

# --- Wait 3-4 minutes ---
SLEEP_3=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_3}s before next batch..."
sleep $SLEEP_3

# --- BATCH 4: Portfolio wallets & page theming ---
echo ""
echo "--- BATCH 4: Portfolio wallet management & light mode theming ---"
git add src/app/portfolio/PortfolioWallets.tsx src/app/portfolio/page.tsx src/app/rooms/page.tsx
git commit -m "feat(portfolio): add per-wallet Activate button and apply dual light/dark theming

- Add 'Activate' button per wallet row to switch active wallet without page reload
- Apply light-mode-safe color tokens (slate-*) across PortfolioWallets table
- Add suppressHydrationWarning to date/time nodes in PNL chart tooltip and bet list
- Fix portfolio tab inactive state text color for light mode
- Fix rooms page: cast room.category to string before equality check to prevent TS mismatch"

echo "Pushing batch 4..."
git push origin main

# --- Wait 3-4 minutes ---
SLEEP_4=$(( 180 + RANDOM % 61 ))
echo "Waiting ${SLEEP_4}s before next batch..."
sleep $SLEEP_4

# --- BATCH 5: Create room + layout ---
echo ""
echo "--- BATCH 5: Create room UI refresh & layout update ---"
git add src/app/create-room/page.tsx src/app/layout.tsx
git commit -m "refactor(create-room): migrate dark-only styles to dual light/dark theme tokens

- Replace hardcoded dark bg/border/text values with slate-* light/dark variants
- Update order summary card, seed amount input, back/submit buttons to use semantic colors
- Replace neon-moon accent with emerald-500 for broader theme compatibility
- Add seed side description hint text (bullish/bearish) below YES/NO toggle
- Minor layout: inherit USDC label styling update"

echo "Pushing batch 5..."
git push origin main

# --- BATCH 6: Room page ---
echo ""
echo "--- BATCH 6: Room page changes ---"

# Check if room page has changes
if git diff HEAD -- src/app/room/[id]/page.tsx | grep -q .; then
  git add "src/app/room/[id]/page.tsx"
  git commit -m "refactor(room): apply light/dark theme tokens and UI polish to room detail page

- Replace dark-only hardcoded colors with dual light/dark slate-* tokens
- Align room page styling with the updated design system
- General cleanup and component consistency improvements"
  echo "Pushing batch 6..."
  git push origin main
else
  echo "No changes in room page, skipping batch 6."
fi

echo ""
echo "=== All batches pushed successfully! ==="
