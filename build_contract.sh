#!/bin/bash
set -e
echo "================================================="
echo "STARTING SOLANA CLI INSTALLATION & ANCHOR BUILD..."
echo "================================================="
cd /Users/adam/Documents/shitmarket

# 1. Download Solana CLI for x86_64
if [ ! -d "solana-release" ]; then
  echo "[1/3] Downloading Solana CLI v1.18.15..."
  curl -L https://github.com/anza-xyz/agave/releases/download/v1.18.15/solana-release-x86_64-apple-darwin.tar.bz2 -o solana.tar.bz2
  echo "[2/3] Extracting Solana CLI..."
  tar jxf solana.tar.bz2
  rm solana.tar.bz2
  echo "Solana CLI installed successfully in local workspace!"
else
  echo "Solana CLI already downloaded. Skipping download."
fi

export PATH="/Users/adam/Documents/shitmarket/solana-release/bin:$PATH"
echo "Verifying Solana CLI installation..."
solana --version

# 2. Build program
echo "[3/3] Building Anchor program..."
cd program
anchor build --no-idl

# 3. Deploy program
echo "Deploying Anchor program to Devnet..."
anchor deploy --provider.cluster devnet
echo "================================================="
echo "CONTRACT DEPLOY SUCCESSFUL!"
echo "================================================="
