import express from 'express';
import { Connection, PublicKey, Keypair, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import nacl from 'tweetnacl';
import { prisma, prismaRead } from '../../db';
import { logger } from '../../logger';
import { config } from '../../config';
import idl from '../../utils/idl.json';

export const adminRouter = express.Router();

const PROGRAM_ID = new PublicKey(config.solana.programId);
const PLATFORM_CONFIG_SEED = 'platform_config';
const ESCROW_SEED = 'escrow';

// Helper: load admin/keeper keypair for signing sweeps/configs
function loadAdminKeypair(): Keypair {
  const raw = process.env.ADMIN_PRIVATE_KEY || config.solana.keeperPrivateKey;
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
  }
  return Keypair.fromSecretKey(new Uint8Array(bs58.decode(raw)));
}

// Helper: build anchor Program instance
function getAnchorProgram(connection: Connection, signerKeypair: Keypair): anchor.Program {
  const wallet = new anchor.Wallet(signerKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });
  
  // Normalization logic just like main index.ts
  const idlWithAddress = { ...idl, address: PROGRAM_ID.toBase58() };
  function normalizeIdl(obj: any): void {
    if (Array.isArray(obj)) {
      obj.forEach(normalizeIdl);
    } else if (obj !== null && typeof obj === 'object') {
      for (const key in obj) {
        if (key === 'defined' && typeof obj[key] === 'string') {
          obj[key] = { name: obj[key] };
        } else {
          normalizeIdl(obj[key]);
        }
      }
    }
  }
  normalizeIdl(idlWithAddress);
  
  return new anchor.Program(idlWithAddress as anchor.Idl, provider);
}

// Helper: get on-chain config
async function fetchOnChainConfig(connection: Connection): Promise<any> {
  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from(PLATFORM_CONFIG_SEED)],
    PROGRAM_ID
  );
  
  const tempKeypair = Keypair.generate();
  const program = getAnchorProgram(connection, tempKeypair);
  const accountInfo = await connection.getAccountInfo(configPda);
  if (!accountInfo) {
    throw new Error('PlatformConfig account not found');
  }
  let data = accountInfo.data;
  const expectedLen = 162;
  if (data.length < expectedLen) {
    const padded = Buffer.alloc(expectedLen);
    data.copy(padded);
    data = padded;
  }
  return program.coder.accounts.decode('platformConfig', data);
}

// Middleware: Verify that the request is signed by the admin or keeper
async function requireAdminAuth(req: express.Request, res: express.Response, next: express.NextFunction) {
  try {
    // Dev bypass for convenience in automated local dev/testing if set
    if (process.env.NODE_ENV === 'development' && req.headers['x-admin-bypass'] === 'true') {
      return next();
    }

    const authHeader = req.headers.authorization;
    if (!authHeader) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Missing Auth header' });
    }

    const [adminPubkey, signature, timestamp] = authHeader.split(':');
    if (!adminPubkey || !signature || !timestamp) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid Auth format (expected pubkey:signature:timestamp)' });
    }

    // Verify timestamp to prevent replay attacks (allow 10 minutes drift)
    const txTime = parseInt(timestamp, 10);
    const now = Date.now();
    if (isNaN(txTime) || Math.abs(now - txTime) > 10 * 60 * 1000) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Request timestamp expired or invalid' });
    }

    // Verify signature
    const message = `ShitMarket Admin Verification: ${timestamp}`;
    const messageBytes = Buffer.from(message);
    const signatureBytes = bs58.decode(signature);
    const pubkeyBytes = bs58.decode(adminPubkey);

    const verified = nacl.sign.detached.verify(messageBytes, signatureBytes, pubkeyBytes);
    if (!verified) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Invalid signature' });
    }

    // Verify the public key is the designated on-chain admin or keeper
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');
    const configState = await fetchOnChainConfig(connection);
    
    const onChainAdmin = configState.admin.toBase58();
    const onChainKeeper = configState.keeper.toBase58();

    if (adminPubkey !== onChainAdmin && adminPubkey !== onChainKeeper) {
      return res.status(403).json({ success: false, error: 'Forbidden: Requester is not an authorized administrator' });
    }

    next();
  } catch (err: any) {
    logger.error({ msg: 'Admin authorization middleware error', err: err.message });
    return res.status(500).json({ success: false, error: 'Internal verification error' });
  }
}

// ── GET /api/admin/stats ──────────────────────────────────────────────────────
adminRouter.get('/stats', async (_req, res) => {
  try {
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');

    // 1. Database stats
    const totalActiveRooms = await prismaRead.room.count({ where: { status: 'active' } });
    const totalSettledRooms = await prismaRead.room.count({ where: { status: 'settled' } });
    const totalBetsCount = await prismaRead.bet.count();
    
    // Aggregates
    const betAgg = await prismaRead.bet.aggregate({
      _sum: { amount: true }
    });
    const totalVolumeLamports = betAgg._sum.amount ? Number(betAgg._sum.amount) : 0;

    const feeAgg = await prismaRead.room.aggregate({
      _sum: { platformFee: true }
    });
    const totalFeesLamports = feeAgg._sum.platformFee ? Number(feeAgg._sum.platformFee) : 0;

    const unclaimedAgg = await prismaRead.payout.aggregate({
      where: { claimedAt: null },
      _sum: { amount: true }
    });
    const unclaimedPayoutsLamports = unclaimedAgg._sum.amount ? Number(unclaimedAgg._sum.amount) : 0;
    
    const unclaimedPayoutsCount = await prismaRead.payout.count({
      where: { claimedAt: null }
    });

    // 2. Fetch on-chain solvency info
    const activeRooms = await prismaRead.room.findMany({
      where: { status: 'active' },
      select: { roomPubkey: true }
    });
    const settledRooms = await prismaRead.room.findMany({
      where: { status: 'settled' },
      select: { roomPubkey: true }
    });
    const allRoomPubkeys = [...activeRooms, ...settledRooms].map((r) => r.roomPubkey);

    let totalOnChainLamports = 0n;
    for (const roomPubkey of allRoomPubkeys) {
      try {
        const roomPk = new PublicKey(roomPubkey);
        const [escrowPda] = PublicKey.findProgramAddressSync(
          [Buffer.from(ESCROW_SEED), roomPk.toBuffer()],
          PROGRAM_ID
        );
        const balance = await connection.getBalance(escrowPda);
        totalOnChainLamports += BigInt(balance);
      } catch (err) {
        // Silent catch for individual accounts
      }
    }

    // Platform config treasury balance
    let platformConfigBalance = 0n;
    try {
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(PLATFORM_CONFIG_SEED)],
        PROGRAM_ID
      );
      const balance = await connection.getBalance(configPda);
      platformConfigBalance = BigInt(balance);
      totalOnChainLamports += platformConfigBalance;
    } catch {}

    const totalAssetsLamports = Number(totalOnChainLamports);
    
    // Solvency Ratio
    const solvencyRatio = unclaimedPayoutsLamports > 0 
      ? totalAssetsLamports / unclaimedPayoutsLamports 
      : totalAssetsLamports > 0 ? 999.99 : 0;

    // Fetch config
    let onChainConfig: any = null;
    try {
      const configState = await fetchOnChainConfig(connection);
      onChainConfig = {
        admin: configState.admin.toBase58(),
        treasury: configState.treasury.toBase58(),
        keeper: configState.keeper.toBase58(),
        platformFeeBps: configState.platformFeeBps,
        paused: configState.paused,
        minimumLiquidity: configState.minimumLiquidity.toString(),
        twapWindowSeconds: configState.twapWindowSeconds.toNumber(),
        coolingOffSeconds: configState.coolingOffSeconds?.toNumber?.() ?? (14 * 24 * 3600),
      };
    } catch (err: any) {
      logger.warn({ msg: 'Failed to fetch onchain config in stats', err: err.message });
    }

    return res.json({
      success: true,
      data: {
        timestamp: new Date().toISOString(),
        rooms: {
          active: totalActiveRooms,
          settled: totalSettledRooms,
          total: totalActiveRooms + totalSettledRooms,
        },
        bets: {
          count: totalBetsCount,
          volumeLamports: totalVolumeLamports,
          volumeSOL: totalVolumeLamports / LAMPORTS_PER_SOL,
        },
        revenue: {
          platformFeesLamports: totalFeesLamports,
          platformFeesSOL: totalFeesLamports / LAMPORTS_PER_SOL,
        },
        unclaimed: {
          count: unclaimedPayoutsCount,
          amountLamports: unclaimedPayoutsLamports,
          amountSOL: unclaimedPayoutsLamports / LAMPORTS_PER_SOL,
        },
        solvency: {
          assetsLamports: totalAssetsLamports,
          assetsSOL: totalAssetsLamports / LAMPORTS_PER_SOL,
          ratio: solvencyRatio,
          status: solvencyRatio >= 1.0 ? 'solvent' : 'insolvent',
        },
        config: onChainConfig,
      }
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/admin/stats error', err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to retrieve stats' });
  }
});

// ── GET /api/admin/unclaimed ──────────────────────────────────────────────────
adminRouter.get('/unclaimed', async (_req, res) => {
  try {
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');

    // Fetch cooling-off from chain
    let coolingOffSeconds = 14 * 24 * 3600;
    try {
      const configState = await fetchOnChainConfig(connection);
      coolingOffSeconds = configState.coolingOffSeconds?.toNumber?.() ?? coolingOffSeconds;
    } catch {}

    const now = new Date();

    // Fetch settled rooms with unclaimed payouts
    const settledRooms = await prismaRead.room.findMany({
      where: { status: 'settled' },
      include: {
        payouts: {
          where: { claimedAt: null }
        }
      },
      orderBy: { expiry: 'desc' }
    });

    const roomDetails = [];

    for (const room of settledRooms) {
      if (room.payouts.length === 0) continue;

      const roomPubkey = new PublicKey(room.roomPubkey);
      const [escrowPda] = PublicKey.findProgramAddressSync(
        [Buffer.from(ESCROW_SEED), roomPubkey.toBuffer()],
        PROGRAM_ID
      );

      // On-chain escrow balance
      let escrowBalance = 0;
      try {
        escrowBalance = await connection.getBalance(escrowPda);
      } catch {}

      const expiryDate = new Date(room.expiry);
      const coolingOffEnds = new Date(expiryDate.getTime() + coolingOffSeconds * 1000);
      const isEligible = now >= coolingOffEnds;

      const totalUnclaimedLamports = room.payouts.reduce((sum, p) => sum + BigInt(p.amount.toString()), 0n);

      roomDetails.push({
        roomPubkey: room.roomPubkey,
        tokenMint: room.tokenMint,
        tokenName: room.tokenName,
        tokenSymbol: room.tokenSymbol,
        tokenImageUrl: room.tokenImageUrl,
        expiry: room.expiry.toISOString(),
        escrowPda: escrowPda.toBase58(),
        escrowBalanceSOL: escrowBalance / LAMPORTS_PER_SOL,
        escrowBalanceLamports: escrowBalance,
        totalUnclaimedSOL: Number(totalUnclaimedLamports) / LAMPORTS_PER_SOL,
        totalUnclaimedLamports: totalUnclaimedLamports.toString(),
        coolingOffEnds: coolingOffEnds.toISOString(),
        isEligibleForSweep: isEligible && escrowBalance > 0,
        unclaimedPayouts: room.payouts.map(p => ({
          wallet: p.userPubkey,
          amountSOL: Number(p.amount) / LAMPORTS_PER_SOL,
          amountLamports: p.amount.toString(),
        }))
      });
    }

    return res.json({
      success: true,
      data: roomDetails
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/admin/unclaimed error', err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to retrieve unclaimed ledgers' });
  }
});

// ── GET /api/admin/config ─────────────────────────────────────────────────────
adminRouter.get('/config', async (_req, res) => {
  try {
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');
    const configState = await fetchOnChainConfig(connection);

    return res.json({
      success: true,
      data: {
        admin: configState.admin.toBase58(),
        treasury: configState.treasury.toBase58(),
        keeper: configState.keeper.toBase58(),
        platformFeeBps: configState.platformFeeBps,
        paused: configState.paused,
        minimumLiquidity: configState.minimumLiquidity.toString(),
        twapWindowSeconds: configState.twapWindowSeconds.toNumber(),
        coolingOffSeconds: configState.coolingOffSeconds?.toNumber?.() ?? (14 * 24 * 3600),
      }
    });
  } catch (err: any) {
    logger.error({ msg: 'GET /api/admin/config error', err: err.message });
    return res.status(500).json({ success: false, error: 'Failed to fetch platform config' });
  }
});

// ── POST /api/admin/config/update ─────────────────────────────────────────────
adminRouter.post('/config/update', requireAdminAuth, async (req, res) => {
  try {
    const { feeBps, treasury, keeper, minLiquidity, twapWindow, coolingOffSeconds } = req.body;

    const connection = new Connection(config.solana.rpcUrl, 'confirmed');
    const admin = loadAdminKeypair();
    const program = getAnchorProgram(connection, admin);

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(PLATFORM_CONFIG_SEED)],
      PROGRAM_ID
    );

    // Call updateConfig
    const tx = await program.methods
      .updateConfig(
        feeBps !== undefined && feeBps !== null ? feeBps : null,
        treasury ? new PublicKey(treasury) : null,
        keeper ? new PublicKey(keeper) : null,
        minLiquidity ? new anchor.BN(minLiquidity) : null,
        twapWindow ? new anchor.BN(twapWindow) : null,
        coolingOffSeconds !== undefined && coolingOffSeconds !== null ? new anchor.BN(coolingOffSeconds) : null
      )
      .accounts({
        config: configPda,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    logger.info({ msg: 'On-chain config updated via API', tx, updater: admin.publicKey.toBase58() });
    
    return res.json({ success: true, tx });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/config/update error', err: err.message });
    return res.status(500).json({ success: false, error: err.message || 'Config update failed' });
  }
});

// ── POST /api/admin/sweep ─────────────────────────────────────────────────────
adminRouter.post('/sweep', requireAdminAuth, async (req, res) => {
  try {
    const { roomPubkey } = req.body;
    if (!roomPubkey) {
      return res.status(400).json({ success: false, error: 'roomPubkey is required' });
    }

    const connection = new Connection(config.solana.rpcUrl, 'confirmed');
    const admin = loadAdminKeypair();
    const program = getAnchorProgram(connection, admin);

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(PLATFORM_CONFIG_SEED)],
      PROGRAM_ID
    );

    const roomPk = new PublicKey(roomPubkey);
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(ESCROW_SEED), roomPk.toBuffer()],
      PROGRAM_ID
    );

    // Fetch config state to get receiver/treasury pubkey
    const configState = await fetchOnChainConfig(connection);
    const receiverPubkey = configState.treasury;

    // Check balance on-chain first
    const balance = await connection.getBalance(escrowPda);
    if (balance === 0) {
      return res.status(400).json({ success: false, error: 'Escrow account is empty or does not exist' });
    }

    // Execute sweepEscrow on-chain
    const tx = await program.methods
      .sweepEscrow()
      .accounts({
        room: roomPk,
        config: configPda,
        escrow: escrowPda,
        receiver: receiverPubkey,
        admin: admin.publicKey,
        systemProgram: anchor.web3.SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    logger.info({ msg: 'Escrow swept via API', roomPubkey, tx });

    return res.json({ success: true, tx, balanceSweptSOL: balance / LAMPORTS_PER_SOL });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/sweep error', err: err.message });
    return res.status(500).json({ success: false, error: err.message || 'Sweep execution failed' });
  }
});

// ── POST /api/admin/sweep-all ─────────────────────────────────────────────────
adminRouter.post('/sweep-all', requireAdminAuth, async (_req, res) => {
  try {
    const connection = new Connection(config.solana.rpcUrl, 'confirmed');
    const admin = loadAdminKeypair();
    const program = getAnchorProgram(connection, admin);

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from(PLATFORM_CONFIG_SEED)],
      PROGRAM_ID
    );

    const configState = await fetchOnChainConfig(connection);
    const receiverPubkey = configState.treasury;
    const coolingOffSeconds = configState.coolingOffSeconds?.toNumber?.() ?? (14 * 24 * 3600);

    const settledRooms = await prisma.room.findMany({
      where: { status: 'settled' },
      select: { roomPubkey: true, expiry: true, tokenSymbol: true, tokenName: true }
    });

    const now = new Date();
    const results = [];
    let sweptCount = 0;
    let totalSweptLamports = 0;

    for (const room of settledRooms) {
      try {
        const roomPk = new PublicKey(room.roomPubkey);
        const [escrowPda] = PublicKey.findProgramAddressSync(
          [Buffer.from(ESCROW_SEED), roomPk.toBuffer()],
          PROGRAM_ID
        );

        const balance = await connection.getBalance(escrowPda);
        if (balance === 0) continue;

        // Verify cooling-off expiry
        const expiryDate = new Date(room.expiry);
        const coolingOffEnds = new Date(expiryDate.getTime() + coolingOffSeconds * 1000);

        if (now < coolingOffEnds) {
          results.push({
            roomPubkey: room.roomPubkey,
            token: room.tokenSymbol || room.tokenName || 'Unknown',
            status: 'skipped',
            reason: 'cooling_off_active',
            timeLeftSeconds: Math.ceil((coolingOffEnds.getTime() - now.getTime()) / 1000)
          });
          continue;
        }

        // Execute sweep
        const tx = await program.methods
          .sweepEscrow()
          .accounts({
            room: roomPk,
            config: configPda,
            escrow: escrowPda,
            receiver: receiverPubkey,
            admin: admin.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .signers([admin])
          .rpc();

        results.push({
          roomPubkey: room.roomPubkey,
          token: room.tokenSymbol || room.tokenName || 'Unknown',
          status: 'swept',
          tx,
          amountSOL: balance / LAMPORTS_PER_SOL
        });

        sweptCount++;
        totalSweptLamports += balance;
      } catch (err: any) {
        results.push({
          roomPubkey: room.roomPubkey,
          token: room.tokenSymbol || room.tokenName || 'Unknown',
          status: 'failed',
          error: err.message
        });
      }
    }

    logger.info({ msg: 'Bulk sweep executed via API', sweptCount, totalSOL: totalSweptLamports / LAMPORTS_PER_SOL });

    return res.json({
      success: true,
      sweptCount,
      totalSOLSwept: totalSweptLamports / LAMPORTS_PER_SOL,
      results
    });
  } catch (err: any) {
    logger.error({ msg: 'POST /api/admin/sweep-all error', err: err.message });
    return res.status(500).json({ success: false, error: err.message || 'Bulk sweep failed' });
  }
});
