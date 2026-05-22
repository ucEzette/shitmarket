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
import { prisma, connectDb, disconnectDb } from '../src/db';
import { connectRedis, disconnectRedis, getCachedRoom } from '../src/redis';
import { createApiServer, startApiServer } from '../src/api/server';
import { startWsServer } from '../src/websocket/wsServer';
import { startEventListener, stopEventListener } from '../src/listener/eventListener';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const RPC = process.env.SOLANA_RPC_URL ?? 'http://127.0.0.1:8899';
const PROGRAM_ID = process.env.PROGRAM_ID ?? 'SHiTmKtX1234567890abcdefghijklmnopqrstuvwxyz';
const API_BASE = 'http://localhost:3001/api';
const WS_URL = 'ws://localhost:3002';

async function airdrop(connection: Connection, pubkey: PublicKey, sol: number): Promise<void> {
  const sig = await connection.requestAirdrop(pubkey, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, 'confirmed');
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
    throw new Error('Run `anchor build` before integration tests');
  }

  // Generate wallets
  admin = Keypair.generate();
  treasury = Keypair.generate();
  keeper = Keypair.generate();
  creator = Keypair.generate();
  bettor = Keypair.generate();

  await Promise.all([
    airdrop(connection, admin.publicKey, 10),
    airdrop(connection, treasury.publicKey, 1),
    airdrop(connection, keeper.publicKey, 5),
    airdrop(connection, creator.publicKey, 5),
    airdrop(connection, bettor.publicKey, 5),
  ]);

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
      .initialize(200)
      .accounts({
        config: configPda,
        admin: admin.publicKey,
        treasury: treasury.publicKey,
        keeper: keeper.publicKey,
        systemProgram: SystemProgram.programId,
      })
      .signers([admin])
      .rpc();

    const configAccount = await (program.account as any).platformConfig.fetch(configPda);
    expect(configAccount.platformFeeBps).toBe(200);
    expect(configAccount.keeper.toBase58()).toBe(keeper.publicKey.toBase58());
  }, 30_000);
});

describe('Room Creation', () => {
  const tokenMint = Keypair.generate().publicKey;
  let roomPubkey: string;

  it('creates a room on-chain and indexes it in DB + Redis', async () => {
    const [roomPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('room'), tokenMint.toBuffer(), creator.publicKey.toBuffer()],
      program.programId
    );
    roomPubkey = roomPda.toBase58();

    const [configPda] = PublicKey.findProgramAddressSync(
      [Buffer.from('platform_config')],
      program.programId
    );

    await program.methods
      .createRoom(tokenMint, 'TESTTOKEN', 5, new anchor.BN(1_000_000))
      .accounts({
        room: roomPda,
        creator: creator.publicKey,
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
    const res = await axios.get('http://localhost:3001/health');
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
