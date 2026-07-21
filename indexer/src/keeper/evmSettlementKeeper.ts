/**
 * evmSettlementKeeper.ts
 *
 * Settle expired rooms on the Avalanche C-Chain.
 * Periodically searches for active rooms that have passed their expiry timestamp,
 * queries the price aggregator to fetch the TWAP and median spot prices,
 * and submits the `settleRoom` EVM transaction signed by the keeper's private key.
 */

import { createPublicClient, createWalletClient, http, Hash } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { avalancheFuji } from 'viem/chains';
import { config } from '../config';
import { logger } from '../logger';
import { prisma } from '../db';
import { aggregatePrice, PriceSample } from '../feeds/priceAggregator';
import { roomsSettledTotal } from '../metrics/prometheus';

// ─── Minimal ABI for settlement ──────────────────────────────────────────────
const SHITMARKET_CORE_ABI = [
  {
    name: 'settleRoom',
    type: 'function',
    stateMutability: 'nonpayable',
    inputs: [
      { name: '_roomId', type: 'bytes32' },
      { name: '_finalPriceParam', type: 'int64' }
    ],
    outputs: []
  }
] as const;

let isProcessing = false;
let checkInterval: NodeJS.Timeout | null = null;

// Initialize Viem Clients
const publicClient = createPublicClient({
  chain: avalancheFuji,
  transport: http(config.evm.rpcUrl),
});

// Setup Keeper Account (with private key verification)
function getKeeperAccount() {
  const pk = config.evm.keeperPrivateKey;
  if (!pk || pk === '') {
    throw new Error('EVM_KEEPER_PRIVATE_KEY is not configured in environment');
  }
  const formattedPk = pk.startsWith('0x') ? pk : `0x${pk}`;
  return privateKeyToAccount(formattedPk as `0x${string}`);
}

/**
 * Perform price aggregation and submit settlement transaction to Avalanche
 */
async function settleRoomOnChain(roomPubkey: string, tokenMint: string) {
  try {
    const TWAP_WINDOW_SECONDS = 300; // default 5 minutes

    // 1. Retrieve TWAP observations from PostgreSQL for this token
    const dbSamples = await prisma.priceSample.findMany({
      where: {
        tokenMint,
        createdAt: {
          gte: new Date(Date.now() - TWAP_WINDOW_SECONDS * 1000),
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    const samples: PriceSample[] = dbSamples.map((s) => ({
      price: Number(s.price),
      timestamp: Math.floor(s.createdAt.getTime() / 1000),
    }));

    // 2. Fetch aggregated price
    const aggregated = await aggregatePrice(tokenMint, undefined, samples, TWAP_WINDOW_SECONDS);
    if (!aggregated) {
      logger.error({ msg: 'Price aggregation failed for settlement', room: roomPubkey });
      return;
    }

    const finalPrice = aggregated.priceI64;

    logger.info({
      msg: 'Submitting EVM settleRoom',
      room: roomPubkey,
      finalPrice: finalPrice.toString(),
      priceUsd: aggregated.priceUsd,
    });

    // 3. Construct and sign transaction
    const account = getKeeperAccount();
    const walletClient = createWalletClient({
      account,
      chain: avalancheFuji,
      transport: http(config.evm.rpcUrl),
    });

    const contractAddress = config.evm.contractAddress as `0x${string}`;

    const { request } = await publicClient.simulateContract({
      address: contractAddress,
      abi: SHITMARKET_CORE_ABI,
      functionName: 'settleRoom',
      args: [roomPubkey as `0x${string}`, BigInt(finalPrice)],
      account,
    });

    const txHash = await walletClient.writeContract(request);
    logger.info({ msg: 'EVM SettleRoom transaction submitted', room: roomPubkey, txHash });

    // Wait for transaction receipt confirmation (optional/non-blocking)
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash, timeout: 15000 });
    logger.info({
      msg: 'EVM SettleRoom transaction confirmed',
      room: roomPubkey,
      txHash,
      status: receipt.status,
    });

    roomsSettledTotal.inc();
  } catch (err: any) {
    logger.error({
      msg: 'Failed to settle room on-chain',
      room: roomPubkey,
      err: err?.message || String(err),
    });
  }
}

/**
 * Scan database for expired active rooms and settle them
 */
async function processExpiredRooms() {
  if (isProcessing) return;
  isProcessing = true;

  try {
    const expiredRooms = await prisma.room.findMany({
      where: {
        status: 'active',
        expiry: {
          lte: new Date(),
        },
      },
      orderBy: { expiry: 'asc' },
    });

    if (expiredRooms.length === 0) {
      isProcessing = false;
      return;
    }

    logger.info({ msg: `Found ${expiredRooms.length} expired active rooms needing settlement.` });

    for (const room of expiredRooms) {
      // Atomic claim to prevent multi-instance race conditions
      const updated = await prisma.room.updateMany({
        where: {
          id: room.id,
          status: 'active',
        },
        data: {
          status: 'settling',
        },
      });

      if (updated.count === 0) {
        logger.info({ msg: 'Room already claimed by another keeper instance', room: room.roomPubkey });
        continue;
      }

      logger.info({ msg: 'Initiating EVM room settlement', room: room.roomPubkey });
      await settleRoomOnChain(room.roomPubkey, room.tokenMint);
    }
  } catch (err: any) {
    logger.error({ msg: 'Error in expired rooms scan loop', err: err?.message });
  } finally {
    isProcessing = false;
  }
}

// ─── Public Control API ───────────────────────────────────────────────────────

export function startEvmKeeper(): void {
  if (checkInterval) return;
  logger.info({ msg: 'EVM Settlement Keeper starting...', checkIntervalSec: 10 });
  
  // Run scan immediately on start, then repeat every 10 seconds
  processExpiredRooms();
  checkInterval = setInterval(processExpiredRooms, 10000);
}

export function stopEvmKeeper(): void {
  if (!checkInterval) return;
  clearInterval(checkInterval);
  checkInterval = null;
  logger.info({ msg: 'EVM Settlement Keeper stopped' });
}
