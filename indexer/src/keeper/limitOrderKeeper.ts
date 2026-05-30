/**
 * limitOrderKeeper.ts
 *
 * Background keeper daemon that polls pending on-chain LimitOrder PDAs,
 * queries live prices, and triggers the execute_limit_order instruction
 * autonomously signed by the keeper relayer wallet.
 */

import * as anchor from '@coral-xyz/anchor';
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from '@solana/web3.js';
import cron from 'node-cron';
import bs58 from 'bs58';

import { config } from '../config';
import { logger } from '../logger';
import { prisma } from '../db';
import { acquireRoomLock, releaseLock } from './keeperLock';

// ─── Relayer wallet loader ──────────────────────────────────────────────────

function loadRelayerKeypair(): Keypair {
  const raw = config.solana.relayerPrivateKey || config.solana.keeperPrivateKey;
  try {
    if (raw.startsWith('[')) {
      const arr: number[] = JSON.parse(raw);
      return Keypair.fromSecretKey(Uint8Array.from(arr));
    }
    return Keypair.fromSecretKey(bs58.decode(raw));
  } catch (err) {
    throw new Error(`Invalid RELAYER_PRIVATE_KEY format: ${err}`);
  }
}

// ─── PDA Derivations ─────────────────────────────────────────────────────────

function deriveEscrowPda(room: PublicKey, programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), room.toBuffer()],
    programId
  );
  return pda;
}

function deriveBetPda(room: PublicKey, user: PublicKey, side: 'moon' | 'jeet', programId: PublicKey): PublicKey {
  const sideIndex = side === 'moon' ? 0 : 1;
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), room.toBuffer(), user.toBuffer(), Buffer.from([sideIndex])],
    programId
  );
  return pda;
}

function deriveConfigPda(programId: PublicKey): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    programId
  );
  return pda;
}

// ─── Live Token Price Polling ────────────────────────────────────────────────

async function fetchLiveTokenPrice(mint: string): Promise<number | null> {
  try {
    const url = `https://api.dexscreener.com/latest/dex/tokens/${mint}`;
    const res = await fetch(url);
    if (res.ok) {
      const json = await res.json() as any;
      const pairs = json?.pairs || [];
      if (pairs.length > 0) {
        const sorted = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const bestPair = sorted[0];
        const price = parseFloat(bestPair.priceUsd);
        if (isFinite(price) && price > 0) {
          return price;
        }
      }
    }
  } catch (err) {
    logger.warn(`Failed to fetch live price for relayer of mint ${mint}: ${err}`);
  }
  return null;
}

// ─── Execution Logic ──────────────────────────────────────────────────────────

async function processLimitOrder(
  program: anchor.Program,
  connection: Connection,
  relayer: Keypair,
  order: {
    pubkey: PublicKey;
    user: PublicKey;
    room: PublicKey;
    side: 'moon' | 'jeet';
    amount: number;
    limitPrice: number;
    triggerDirection: 'below' | 'above';
    nonce: number;
    status: number;
  }
) {
  const roomPubkeyStr = order.room.toBase58();
  const orderPubkeyStr = order.pubkey.toBase58();

  // Acquire distributed Redis lock to prevent multi-relayer concurrency race
  const lockValue = await acquireRoomLock(`limit_${orderPubkeyStr}`);
  if (!lockValue) return;

  try {
    // 1. Fetch Room record from database to find token details & price feed
    const roomRecord = await prisma.room.findUnique({
      where: { roomPubkey: roomPubkeyStr },
      select: {
        tokenMint: true,
        priceFeed: true,
        status: true,
      },
    });

    if (!roomRecord || (roomRecord.status !== 'active' && roomRecord.status !== 'pending')) {
      logger.info(`Limit order targets inactive or missing room: ${roomPubkeyStr}`);
      return;
    }

    // 2. Fetch live price of the target mint
    const currentPrice = await fetchLiveTokenPrice(roomRecord.tokenMint);
    if (currentPrice === null) return;

    // 3. Evaluate trigger condition
    let isTriggered = false;
    if (order.triggerDirection === 'below') {
      isTriggered = currentPrice <= order.limitPrice;
    } else {
      isTriggered = currentPrice >= order.limitPrice;
    }

    if (!isTriggered) return;

    logger.info({
      msg: '🚀 LIMIT ORDER TARGET BREACHED! DETONATING...',
      order: orderPubkeyStr,
      limitPrice: order.limitPrice,
      currentPrice,
      side: order.side,
    });

    // 4. Resolve on-chain accounts
    const programId = program.programId;
    const configPda = deriveConfigPda(programId);
    const escrowPda = deriveEscrowPda(order.room, programId);
    const betPda = deriveBetPda(order.room, order.user, order.side, programId);
    const priceFeedPubkey = roomRecord.priceFeed
      ? new PublicKey(roomRecord.priceFeed)
      : SystemProgram.programId;

    // 5. Draft Anchor instruction
    const tx = await program.methods
      .executeLimitOrder()
      .accounts({
        limitOrder: order.pubkey,
        room: order.room,
        escrow: escrowPda,
        bet: betPda,
        priceFeed: priceFeedPubkey,
        relayer: relayer.publicKey,
        config: configPda,
        user: order.user,
        systemProgram: SystemProgram.programId,
      })
      .transaction();

    // Priority Fees setup for fast landing
    const modifyComputeBudget = anchor.web3.ComputeBudgetProgram.setComputeUnitLimit({ 
      units: 150000 
    });
    const addPriorityFee = anchor.web3.ComputeBudgetProgram.setComputeUnitPrice({ 
      microLamports: 100000 
    });
    
    tx.add(modifyComputeBudget);
    tx.add(addPriorityFee);

    // 6. Broadcast transaction to network
    const txSig = await anchor.web3.sendAndConfirmTransaction(
      connection,
      tx,
      [relayer],
      { commitment: 'confirmed', skipPreflight: false }
    );

    logger.info({
      msg: '🎯 LIMIT ORDER ON-CHAIN EXECUTION SUCCESS!',
      order: orderPubkeyStr,
      txSig,
    });

  } catch (err: any) {
    logger.error({
      msg: '⚠️ Limit Order execution transaction failed',
      order: orderPubkeyStr,
      err: err?.message || String(err),
    });
  } finally {
    await releaseLock(`limit_${orderPubkeyStr}`, lockValue);
  }
}

// ─── Keeper Job Controller ────────────────────────────────────────────────────

export function startLimitOrderKeeper(
  connection: Connection,
  program: anchor.Program
): cron.ScheduledTask {
  let relayer: Keypair;
  try {
    relayer = loadRelayerKeypair();
    logger.info({ msg: 'Limit Order relayer wallet loaded', pubkey: relayer.publicKey.toBase58() });
  } catch (err: any) {
    logger.error({ msg: 'Cannot start Limit Order relayer — invalid wallet', err: err?.message });
    process.exit(1);
  }

  // Poll active limit orders on-chain every 5 seconds
  const task = cron.schedule('*/5 * * * * *', async () => {
    try {
      const programId = program.programId;
      
      // Query Solana RPC for active pending LimitOrder accounts (data size 95, status at 91 = 0)
      const pendingAccounts = await connection.getProgramAccounts(programId, {
        filters: [
          { dataSize: 95 },
          {
            memcmp: {
              offset: 91, // status index
              bytes: bs58.encode([0]), // status: 0 (Pending)
            },
          },
        ],
      });

      if (pendingAccounts.length === 0) return;

      // Decode bytes
      const activeOrders = pendingAccounts.map((account) => {
        const data = account.account.data;
        const user = new PublicKey(data.subarray(8, 40));
        const room = new PublicKey(data.subarray(40, 72));
        const side = data[72] === 0 ? 'moon' as const : 'jeet' as const;
        
        const amount = Number(data.readBigUInt64LE(73)) / 1e9;
        const limitPrice = Number(data.readBigInt64LE(81)) / 1e8;
        const triggerDirection = data[89] === 0 ? 'below' as const : 'above' as const;
        const nonce = data[90];
        const status = data[91];

        return {
          pubkey: account.pubkey,
          user,
          room,
          side,
          amount,
          limitPrice,
          triggerDirection,
          nonce,
          status,
        };
      });

      // Process orders concurrently but bounded
      await Promise.allSettled(
        activeOrders.map((order) => processLimitOrder(program, connection, relayer, order))
      );

    } catch (err: any) {
      logger.error({ msg: 'Limit Order Relayer polling failed', err: err?.message });
    }
  });

  logger.info('Limit Order watchdog Relayer started — monitoring on-chain PDAs every 5 seconds');
  return task;
}
