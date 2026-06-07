import 'dotenv/config';
import { Connection, Keypair, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { PrismaClient } from '@prisma/client';
import { config } from '../src/config';
import idl from '../src/utils/idl.json';
import * as fs from 'fs';
import * as path from 'path';

const PROGRAM_ID = new PublicKey(config.solana.programId);
const prisma = new PrismaClient();

// ── Helpers ─────────────────────────────────────────────────────────────────

function loadAdminKeypair(): Keypair {
  const raw = process.env.ADMIN_PRIVATE_KEY || config.solana.keeperPrivateKey;
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(new Uint8Array(JSON.parse(raw)));
  }
  return Keypair.fromSecretKey(new Uint8Array(bs58.decode(raw)));
}

function formatSOL(lamports: bigint | number): string {
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(9);
}

// ── Types ───────────────────────────────────────────────────────────────────

interface UnclaimedRecord {
  roomPubkey: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  userPubkey: string;
  amountLamports: string;
  amountSOL: string;
  roomExpiry: string;
  coolingOffEnds: string;
  isEligibleForSweep: boolean;
  settledAt: string;
}

interface RoomSweepSummary {
  roomPubkey: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  escrowBalanceLamports: number;
  escrowBalanceSOL: string;
  unclaimedWallets: number;
  totalUnclaimedLamports: string;
  totalUnclaimedSOL: string;
  roomExpiry: string;
  coolingOffEnds: string;
  isEligibleForSweep: boolean;
}

// ── VIEW Command ────────────────────────────────────────────────────────────

async function viewUnclaimed(connection: Connection, program: anchor.Program, configPda: PublicKey) {
  console.log('\n📊 SCANNING FOR UNCLAIMED PAYOUTS...\n');

  // Fetch on-chain cooling-off period
  let coolingOffSeconds = 14 * 24 * 3600; // default 14 days
  try {
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
    const configState = program.coder.accounts.decode('platformConfig', data);
    coolingOffSeconds = configState.coolingOffSeconds?.toNumber?.() ?? coolingOffSeconds;
    console.log(`On-chain cooling-off period: ${coolingOffSeconds} seconds (${(coolingOffSeconds / 86400).toFixed(1)} days)`);
  } catch (err: any) {
    console.warn('⚠️  Could not fetch PlatformConfig, using default 14-day cooling-off:', err.message);
  }

  const now = new Date();

  // 1. Fetch all settled rooms with their unclaimed payouts
  const settledRooms = await prisma.room.findMany({
    where: { status: 'settled' },
    include: {
      payouts: {
        where: { claimedAt: null }, // Only unclaimed payouts
      },
    },
  });

  const unclaimedRecords: UnclaimedRecord[] = [];
  const roomSummaries: RoomSweepSummary[] = [];

  for (const room of settledRooms) {
    if (room.payouts.length === 0) continue; // All claimed, skip

    const roomPubkey = new PublicKey(room.roomPubkey);
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), roomPubkey.toBuffer()],
      PROGRAM_ID
    );

    // Get on-chain escrow balance
    const escrowBalance = await connection.getBalance(escrowPda);

    const expiryDate = new Date(room.expiry);
    const coolingOffEnds = new Date(expiryDate.getTime() + coolingOffSeconds * 1000);
    const isEligible = now >= coolingOffEnds;

    let totalUnclaimedLamports = BigInt(0);

    for (const payout of room.payouts) {
      totalUnclaimedLamports += payout.amount;

      unclaimedRecords.push({
        roomPubkey: room.roomPubkey,
        tokenName: room.tokenName,
        tokenSymbol: room.tokenSymbol,
        userPubkey: payout.userPubkey,
        amountLamports: payout.amount.toString(),
        amountSOL: formatSOL(payout.amount),
        roomExpiry: expiryDate.toISOString(),
        coolingOffEnds: coolingOffEnds.toISOString(),
        isEligibleForSweep: isEligible,
        settledAt: room.createdAt.toISOString(),
      });
    }

    roomSummaries.push({
      roomPubkey: room.roomPubkey,
      tokenName: room.tokenName,
      tokenSymbol: room.tokenSymbol,
      escrowBalanceLamports: escrowBalance,
      escrowBalanceSOL: formatSOL(escrowBalance),
      unclaimedWallets: room.payouts.length,
      totalUnclaimedLamports: totalUnclaimedLamports.toString(),
      totalUnclaimedSOL: formatSOL(totalUnclaimedLamports),
      roomExpiry: expiryDate.toISOString(),
      coolingOffEnds: coolingOffEnds.toISOString(),
      isEligibleForSweep: isEligible,
    });
  }

  // ── Console Output ──────────────────────────────────────────────────────

  if (roomSummaries.length === 0) {
    console.log('✅ No unclaimed payouts found. All winners have claimed!');
    return;
  }

  console.log(`\nFound ${roomSummaries.length} room(s) with ${unclaimedRecords.length} unclaimed payout(s):\n`);
  console.log('─'.repeat(100));

  for (const summary of roomSummaries) {
    const status = summary.isEligibleForSweep ? '🟢 ELIGIBLE' : '🔴 COOLING OFF';
    console.log(`\n${status} | ${summary.tokenSymbol || summary.tokenName || 'Unknown'}`);
    console.log(`  Room:             ${summary.roomPubkey}`);
    console.log(`  Escrow Balance:   ${summary.escrowBalanceSOL} SOL (${summary.escrowBalanceLamports} lamports)`);
    console.log(`  Unclaimed:        ${summary.totalUnclaimedSOL} SOL across ${summary.unclaimedWallets} wallet(s)`);
    console.log(`  Room Expiry:      ${summary.roomExpiry}`);
    console.log(`  Cooling-Off Ends: ${summary.coolingOffEnds}`);

    // List the individual unclaimed wallets for this room
    const roomUnclaimed = unclaimedRecords.filter(r => r.roomPubkey === summary.roomPubkey);
    for (const record of roomUnclaimed) {
      console.log(`    └─ ${record.userPubkey}: ${record.amountSOL} SOL`);
    }
  }

  console.log('\n' + '─'.repeat(100));

  // ── Export Report ─────────────────────────────────────────────────────

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const reportDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true });
  }

  // JSON report
  const jsonPath = path.join(reportDir, `unclaimed-report-${timestamp}.json`);
  const report = {
    generatedAt: new Date().toISOString(),
    coolingOffSeconds,
    coolingOffDays: coolingOffSeconds / 86400,
    totalUnclaimedWallets: unclaimedRecords.length,
    totalUnclaimedSOL: formatSOL(
      unclaimedRecords.reduce((sum, r) => sum + BigInt(r.amountLamports), BigInt(0))
    ),
    roomSummaries,
    unclaimedRecords,
  };
  fs.writeFileSync(jsonPath, JSON.stringify(report, null, 2));
  console.log(`\n📄 JSON report saved: ${jsonPath}`);

  // CSV report (flat, for easy spreadsheet import)
  const csvPath = path.join(reportDir, `unclaimed-wallets-${timestamp}.csv`);
  const csvHeader = 'room_pubkey,token_symbol,user_pubkey,amount_lamports,amount_sol,room_expiry,cooling_off_ends,eligible_for_sweep';
  const csvRows = unclaimedRecords.map(r =>
    `${r.roomPubkey},${r.tokenSymbol || ''},${r.userPubkey},${r.amountLamports},${r.amountSOL},${r.roomExpiry},${r.coolingOffEnds},${r.isEligibleForSweep}`
  );
  fs.writeFileSync(csvPath, [csvHeader, ...csvRows].join('\n'));
  console.log(`📄 CSV report saved: ${csvPath}`);

  // Summary
  const eligibleCount = roomSummaries.filter(r => r.isEligibleForSweep).length;
  const coolingCount = roomSummaries.filter(r => !r.isEligibleForSweep).length;
  console.log(`\n📈 Summary: ${eligibleCount} room(s) eligible for sweep, ${coolingCount} still cooling off.`);
}

// ── SWEEP Command ───────────────────────────────────────────────────────────

async function sweepEscrows(connection: Connection, program: anchor.Program, admin: Keypair, configPda: PublicKey) {
  console.log('\n🧹 EXECUTING SWEEP OF ELIGIBLE ESCROWS...\n');

  // Fetch on-chain cooling-off period
  let coolingOffSeconds = 14 * 24 * 3600;
  let receiverPubkey = admin.publicKey;
  try {
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
    const configState = program.coder.accounts.decode('platformConfig', data);
    coolingOffSeconds = configState.coolingOffSeconds?.toNumber?.() ?? coolingOffSeconds;
    if (configState.treasury) {
      receiverPubkey = configState.treasury;
    }
    console.log(`Cooling-off: ${coolingOffSeconds}s | Receiver: ${receiverPubkey.toBase58()}`);
  } catch (err: any) {
    console.warn('⚠️  Could not fetch PlatformConfig:', err.message);
  }

  const now = new Date();

  // Fetch settled rooms
  const settledRooms = await prisma.room.findMany({
    where: { status: 'settled' },
    select: {
      roomPubkey: true,
      tokenSymbol: true,
      tokenName: true,
      expiry: true,
    },
  });

  console.log(`Found ${settledRooms.length} settled rooms in database.`);

  let sweptCount = 0;
  let totalSweptLamports = 0;
  let skippedCoolingOff = 0;

  for (const dbRoom of settledRooms) {
    const roomPubkey = new PublicKey(dbRoom.roomPubkey);
    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), roomPubkey.toBuffer()],
      PROGRAM_ID
    );

    const balance = await connection.getBalance(escrowPda);
    if (balance === 0) continue;

    // Check cooling-off period off-chain first (save failed tx fees)
    const expiryDate = new Date(dbRoom.expiry);
    const coolingOffEnds = new Date(expiryDate.getTime() + coolingOffSeconds * 1000);
    if (now < coolingOffEnds) {
      const daysLeft = ((coolingOffEnds.getTime() - now.getTime()) / 86400000).toFixed(1);
      console.log(`⏳ SKIPPING ${dbRoom.tokenSymbol || dbRoom.tokenName || 'Unknown'} — cooling off (${daysLeft} days remaining)`);
      skippedCoolingOff++;
      continue;
    }

    const solBalance = balance / LAMPORTS_PER_SOL;
    console.log(`\n🔄 Sweeping ${dbRoom.tokenSymbol || dbRoom.tokenName || 'Unknown'} (${dbRoom.roomPubkey})`);
    console.log(`   Escrow: ${escrowPda.toBase58()} | Balance: ${solBalance} SOL`);

    try {
      const tx = await program.methods
        .sweepEscrow()
        .accounts({
          room: roomPubkey,
          config: configPda,
          escrow: escrowPda,
          receiver: receiverPubkey,
          admin: admin.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .signers([admin])
        .rpc();

      console.log(`   ✅ Swept! Tx: ${tx}`);
      sweptCount++;
      totalSweptLamports += balance;
    } catch (err: any) {
      if (err.message?.includes('CoolingOffActive')) {
        console.log(`   ⏳ On-chain cooling-off still active — skipping.`);
        skippedCoolingOff++;
      } else {
        console.error(`   ❌ Failed:`, err.message);
      }
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log('SWEEP COMPLETE');
  console.log(`  Rooms Swept:        ${sweptCount}`);
  console.log(`  Total SOL Recovered: ${(totalSweptLamports / LAMPORTS_PER_SOL).toFixed(9)} SOL`);
  console.log(`  Skipped (Cooling):   ${skippedCoolingOff}`);
  console.log('='.repeat(60));
}

// ── Main ────────────────────────────────────────────────────────────────────

async function main() {
  const command = process.argv[2];
  if (!command || !['view', 'sweep'].includes(command)) {
    console.log(`
╔══════════════════════════════════════════════════════════╗
║  ShitMarket — Unclaimed Funds Management                ║
╠══════════════════════════════════════════════════════════╣
║                                                          ║
║  Usage:                                                  ║
║    npx ts-node scripts/sweep-unclaimed.ts view           ║
║      → Scan unclaimed payouts, export JSON/CSV report    ║
║                                                          ║
║    npx ts-node scripts/sweep-unclaimed.ts sweep          ║
║      → Sweep eligible escrow PDAs (past cooling-off)     ║
║                                                          ║
╚══════════════════════════════════════════════════════════╝
`);
    process.exit(1);
  }

  const connection = new Connection(config.solana.rpcUrl, 'confirmed');
  const admin = loadAdminKeypair();
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });

  const idlWithAddress = { ...idl, address: PROGRAM_ID.toBase58() };
  const program = new anchor.Program(idlWithAddress as anchor.Idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    PROGRAM_ID
  );

  console.log('='.repeat(60));
  console.log(`SHITMARKET UNCLAIMED FUNDS — ${command.toUpperCase()}`);
  console.log('='.repeat(60));
  console.log(`Admin: ${admin.publicKey.toBase58()}`);
  console.log(`Config PDA: ${configPda.toBase58()}`);

  if (command === 'view') {
    await viewUnclaimed(connection, program, configPda);
  } else if (command === 'sweep') {
    await sweepEscrows(connection, program, admin, configPda);
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });
