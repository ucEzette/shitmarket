/**
 * integration.test.ts
 *
 * Integration tests for the ShitMarket indexer against a local Solana
 * test validator (started by `anchor test` or manually via
 * `solana-test-validator`).
 *
 * Prerequisites:
 *   - `anchor build` completed (IDL at program/target/idl/shitmarket.json)
 *   - Local Postgres + Redis running (docker-compose up postgres redis -d)
 *   - `.env` configured with SOLANA_RPC_URL=http://127.0.0.1:8899
 *
 * Run: npm test
 */

import 'dotenv/config';
import { Connection, Keypair, PublicKey, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import axios from 'axios';
import { WebSocket } from 'ws';
import bs58 from 'bs58';
import fs from 'fs';
import os from 'os';
import { prisma, connectDb, disconnectDb } from '../src/db';
import { connectRedis, disconnectRedis, getCachedRoom } from '../src/redis';
import { createApiServer, startApiServer } from '../src/api/server';
import { startWsServer } from '../src/websocket/wsServer';
import { startEventListener, stopEventListener } from '../src/listener/eventListener';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RPC = process.env.SOLANA_RPC_URL ?? 'http://127.0.0.1:8899';
const PROGRAM_ID = process.env.PROGRAM_ID ?? 'SHiTmKtX1234567890abcdefghijklmnopqrstuvwxyz';
const REST_PORT = process.env.REST_API_PORT ?? '3001';
const WS_PORT_ENV = process.env.WS_PORT ?? '3002';
const API_BASE = `http://localhost:${REST_PORT}/api`;
const WS_URL = `ws://localhost:${WS_PORT_ENV}`;

let deployer: Keypair | null = null;
try {
  const secretKeyPath = os.homedir() + '/.config/solana/id.json';
  if (fs.existsSync(secretKeyPath)) {
    const secretKeyString = fs.readFileSync(secretKeyPath, 'utf8');
    const secretKeyArray = JSON.parse(secretKeyString);
    deployer = Keypair.fromSecretKey(Uint8Array.from(secretKeyArray));
  }
} catch (err) {
  console.warn('Could not load deployer keypair, falling back to faucet airdrops...', err);
}

async function airdrop(connection: Connection, pubkey: PublicKey, sol: number): Promise<void> {
  if (deployer) {
    const tx = new anchor.web3.Transaction().add(
      SystemProgram.transfer({
        fromPubkey: deployer.publicKey,
        toPubkey: pubkey,
        lamports: sol * LAMPORTS_PER_SOL,
      })
    );
    await anchor.web3.sendAndConfirmTransaction(connection, tx, [deployer], { commitment: 'confirmed' });
  } else {
    const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, 'confirmed');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Setup ────────────────────────────────────────────────────────────────────

let connection: Connection;
let program: anchor.Program;
let eventParser: anchor.EventParser;
let admin: Keypair;
let treasury: Keypair;
let keeper: Keypair;
let creator: Keypair;
let bettor: Keypair;
let wsClient: WebSocket;

beforeAll(async () => {
  // Connect infra
  await connectDb();
  await connectRedis();

  // Clean DB for test isolation
  await prisma.payout.deleteMany();
  await prisma.bet.deleteMany();
  await prisma.room.deleteMany();
  await prisma.userProfile.deleteMany();
  await prisma.processedTx.deleteMany();

  // Solana connection
  connection = new Connection(RPC, { commitment: 'confirmed' });

  // Load IDL
  let idl: anchor.Idl;
  try {
    idl = require('../../program/target/idl/shitmarket.json') as anchor.Idl;
  } catch {
    try {
      idl = require('../../src/utils/idl.json') as anchor.Idl;
    } catch {
      throw new Error('Run `anchor build` before integration tests');
    }
  }

  // Generate wallets
  admin = Keypair.generate();
  treasury = Keypair.generate();
  keeper = Keypair.generate();
  creator = Keypair.generate();
  bettor = Keypair.generate();

  const airdrops: Promise<void>[] = [
    airdrop(connection, admin.publicKey, 10),
    airdrop(connection, treasury.publicKey, 1),
    airdrop(connection, keeper.publicKey, 5),
    airdrop(connection, creator.publicKey, 5),
    airdrop(connection, bettor.publicKey, 5),
  ];

  const envKeeperRaw = process.env.KEEPER_PRIVATE_KEY;
  if (envKeeperRaw) {
    try {
      let envKeeperKp: Keypair;
      if (envKeeperRaw.startsWith('[')) {
        const arr = JSON.parse(envKeeperRaw);
        envKeeperKp = Keypair.fromSecretKey(Uint8Array.from(arr));
      } else {
        envKeeperKp = Keypair.fromSecretKey(bs58.decode(envKeeperRaw));
      }
      airdrops.push(airdrop(connection, envKeeperKp.publicKey, 5));
      console.log(`Airdropping 5 SOL to environment keeper wallet: ${envKeeperKp.publicKey.toBase58()}`);
    } catch (err) {
      console.error('Failed to parse or airdrop to process.env.KEEPER_PRIVATE_KEY:', err);
    }
  }

  await Promise.all(airdrops);

  // Build Anchor program (v0.30 API: new Program(idl, provider))
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const programId = new PublicKey(PROGRAM_ID);
  const idlWithAddress = { ...idl, address: programId.toBase58() };
  program = new anchor.Program(idlWithAddress as anchor.Idl, provider);
  eventParser = new anchor.EventParser(programId, new anchor.BorshCoder(idl));

  // Start services
  const app = createApiServer();
  startApiServer(app);
  startWsServer();
  startEventListener(connection, eventParser);
  await sleep(1000); // Give listener time to subscribe
}, 60_000);

afterAll(async () => {
  wsClient?.close();
  await stopEventListener(connection);
  await disconnectDb();
  await disconnectRedis();
}, 30_000);

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('Platform Initialization', () => {
  it('initializes the platform config on-chain', async () => {
    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform_config')],
      program.programId
    );

    await program.methods
      .initialize(125)
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        treasury: treasury.publicKey,
        keeper: keeper.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    // Update keeper on-chain since initialize default is admin
    await program.methods
      .updateConfig(null, null, keeper.publicKey, null, null)
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        newTreasury: null as any,
      })
      .signers([admin])
      .rpc();

    const configAccount = await (program.account as any).platformConfig.fetch(configPda);
    expect(configAccount.platformFeeBps).toBe(125);
    expect(configAccount.keeper.toBase58()).toBe(keeper.publicKey.toBase58());
  }, 30_000);
});

describe('Room Creation', () => {
  const tokenMint = Keypair.generate().publicKey;
  let roomPubkey: string;

  it('creates a room on-chain and indexes it in DB + Redis', async () => {
    const [roomPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('room'), tokenMint.toBuffer(), creator.publicKey.toBuffer(), Buffer.from([0])],
      program.programId
    );
    roomPubkey = roomPda.toBase58();

    const [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), roomPda.toBuffer()],
      program.programId
    );

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform_config')],
      program.programId
    );

    await program.methods
      .createRoom(tokenMint, 'TESTTOKEN', 5, null, new anchor.BN(1_000_000), 0)
      .accounts({
        room: roomPda,
        escrow: escrowPda,
        creator: creator.publicKey,
        priceFeed: SystemProgram.programId,
        switchboardFeed: SystemProgram.programId,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Wait for event listener to process
    await sleep(3000);

    // Verify DB
    const room = await prisma.room.findUnique({ where: { roomPubkey } });
    expect(room).not.toBeNull();
    expect(room?.status).toBe('active');
    expect(room?.openingPrice.toString()).toBe('1000000');

    // Verify Redis
    const cached = await getCachedRoom(roomPubkey);
    expect(cached?.status).toBe('active');
  }, 30_000);
});

describe('REST API', () => {
  it('GET /api/rooms returns active rooms', async () => {
    const res = await axios.get(`${API_BASE}/rooms`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
    expect(Array.isArray(res.data.data)).toBe(true);
  });

  it('GET /api/leaderboard returns leaderboard', async () => {
    const res = await axios.get(`${API_BASE}/leaderboard`);
    expect(res.status).toBe(200);
    expect(res.data.success).toBe(true);
  });

  it('GET /api/profile/:wallet returns empty profile for new wallet', async () => {
    const res = await axios.get(`${API_BASE}/profile/${bettor.publicKey.toBase58()}`);
    expect(res.status).toBe(200);
    expect(res.data.data.totalBets).toBe(0);
  });

  it('GET /health returns ok', async () => {
    const res = await axios.get(`http://localhost:${REST_PORT}/health`);
    expect(res.status).toBe(200);
    expect(res.data.status).toBe('ok');
  });
});

describe('WebSocket', () => {
  it('connects and subscribes to global feed', (done) => {
    wsClient = new WebSocket(WS_URL);
    wsClient.on('open', () => {
      wsClient.send(JSON.stringify({ type: 'subscribe_global' }));
    });
    wsClient.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'subscribed' && msg.room === 'global') {
        done();
      }
    });
    wsClient.on('error', done);
  }, 10_000);

  it('responds to ping with pong', (done) => {
    if (!wsClient || wsClient.readyState !== WebSocket.OPEN) {
      wsClient = new WebSocket(WS_URL);
      wsClient.on('open', () => wsClient.send(JSON.stringify({ type: 'ping' })));
    } else {
      wsClient.send(JSON.stringify({ type: 'ping' }));
    }
    wsClient.on('message', (raw) => {
      const msg = JSON.parse(raw.toString());
      if (msg.type === 'pong') done();
    });
  }, 10_000);
});

describe('End-to-End Betting and Automatic Payouts', () => {
  const tokenMint = Keypair.generate().publicKey;
  let roomPda: PublicKey;
  let escrowPda: PublicKey;
  let betPda: PublicKey;

  it('creates room, bets, and automatically payouts on settlement', async () => {
    // 1. Derive PDAs
    [roomPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('room'), tokenMint.toBuffer(), creator.publicKey.toBuffer(), Buffer.from([0])],
      program.programId
    );
    [escrowPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('escrow'), roomPda.toBuffer()],
      program.programId
    );
    [betPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('bet'), roomPda.toBuffer(), bettor.publicKey.toBuffer(), Buffer.from([0])],
      program.programId
    );

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform_config')],
      program.programId
    );

    // 2. Create the room with 5 minutes duration (which acts as 5 seconds!) so it expires quickly!
    await program.methods
      .createRoom(tokenMint, 'BETTOKEN', 5, null, new anchor.BN(1_000_000), 0)
      .accounts({
        room: roomPda,
        escrow: escrowPda,
        creator: creator.publicKey,
        priceFeed: SystemProgram.programId,
        switchboardFeed: SystemProgram.programId,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([creator])
      .rpc();

    // Give listener time to index room creation
    await sleep(2000);

    // Verify room is indexed as active
    const dbRoom = await prisma.room.findUnique({ where: { roomPubkey: roomPda.toBase58() } });
    expect(dbRoom?.status).toBe('active');

    // 3. Bettor places a bet on Moon
    const betAmount = 1_000_000_000; // 1 SOL
    await program.methods
      .placeBet({ moon: {} }, new anchor.BN(betAmount))
      .accounts({
        room: roomPda,
        escrow: escrowPda,
        bet: betPda,
        user: bettor.publicKey,
        reputation: null as any,
        config: configPda,
        systemProgram: SystemProgram.programId,
      })
      .signers([bettor])
      .rpc();

    // Give listener time to index the bet
    await sleep(2000);

    // Verify bet is indexed
    const dbBet = await prisma.bet.findFirst({
      where: { roomPubkey: roomPda.toBase58(), userPubkey: bettor.publicKey.toBase58() },
    });
    expect(dbBet).not.toBeNull();
    expect(dbBet?.amount.toString()).toBe(betAmount.toString());

    // 4. Wait for room to expire (2 seconds duration + small buffer)
    console.log("Waiting for room to expire...");
    await sleep(3000);

    // Verify room is expired
    const roomAccount = await (program.account as any).room.fetch(roomPda);
    const now = Math.floor(Date.now() / 1000);
    expect(roomAccount.expiryTimestamp.toNumber()).toBeLessThanOrEqual(now);

    // 5. Settle the room.
    // Since oracle is null/sentinel, we pass a final price parameter.
    // Opening price is 1_000_000. Let's pass 2_000_000 (Moon wins).
    const finalPrice = new anchor.BN(2_000_000);
    await program.methods
      .settleRoom(finalPrice)
      .accounts({
        room: roomPda,
        escrow: escrowPda,
        treasury: treasury.publicKey,
        priceFeed: SystemProgram.programId, // Sentinel
        switchboardFeed: PublicKey.default,
        config: configPda,
        keeper: keeper.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([keeper])
      .rpc();

    // 6. Give event listener time to process RoomSettled and trigger automatic claim winnings
    console.log("Waiting for event listener to process settlement and automatic payouts...");
    await sleep(5000);

    // 7. Verify the winner's bet is marked as claimed in the DB
    const dbBetAfter = await prisma.bet.findFirst({
      where: { roomPubkey: roomPda.toBase58(), userPubkey: bettor.publicKey.toBase58() },
    });
    expect(dbBetAfter?.claimed).toBe(true);

    // 8. Verify the payout record is marked as claimed (amount > 0 and exists)
    const dbPayout = await prisma.payout.findFirst({
      where: { roomPubkey: roomPda.toBase58(), userPubkey: bettor.publicKey.toBase58() },
    });
    expect(dbPayout).not.toBeNull();
    expect(dbPayout?.amount).toBeGreaterThan(BigInt(0));

    // 9. Verify the on-chain Bet PDA is marked as claimed
    const betAccountAfter = await (program.account as any).bet.fetch(betPda);
    expect(betAccountAfter.claimed).toBe(true);

    console.log("💎 Automatic payout successfully distributed directly to winner's wallet! Test passed!");
  }, 45_000);
});
