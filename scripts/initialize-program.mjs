/**
 * initialize-program.mjs
 * Calls the `initialize` instruction on the newly deployed ShitMarket program.
 * Run once: node scripts/initialize-program.mjs
 */
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Config ────────────────────────────────────────────────────────────────────
const RPC_URL = 'https://devnet.helius-rpc.com/?api-key=cce2e7d9-5846-4ac4-9a83-0252eb8e8b71';
const KEEPER_PRIVATE_KEY = '5ibz12AKj51yW5RTdc2DFhY68DEQi7AmqiofhP1P91AreZBYnZM5EQavqaA7D2MRqkDyYZS1QV34jz1humWd2gqf';

// Treasury = same as keeper (admin) for devnet. Change if needed.
const TREASURY_PUBKEY = '32ZAF6jferKQoyZ2Cy7eqNhuZjBBwekdT2qaVU1ftdys';

const PLATFORM_FEE_BPS = 100; // 1%

// ── Load IDL ──────────────────────────────────────────────────────────────────
const idlPath = path.resolve(__dirname, '../src/utils/idl.json');
const idl = JSON.parse(readFileSync(idlPath, 'utf-8'));
const PROGRAM_ID = new PublicKey(idl.address);

console.log('Program ID:', PROGRAM_ID.toBase58());

// ── Wallet ───────────────────────────────────────────────────────────────────
const secretKey = bs58.decode(KEEPER_PRIVATE_KEY);
const wallet = Keypair.fromSecretKey(secretKey);
console.log('Admin wallet:', wallet.publicKey.toBase58());

// ── Provider ──────────────────────────────────────────────────────────────────
const connection = new Connection(RPC_URL, 'confirmed');
const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(wallet),
  { commitment: 'confirmed', preflightCommitment: 'confirmed' }
);
anchor.setProvider(provider);

const program = new anchor.Program(idl, provider);

// ── Derive PDAs ───────────────────────────────────────────────────────────────
const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('platform_config')],
  PROGRAM_ID
);
console.log('platformConfig PDA:', configPda.toBase58());

// ── Check if already initialized ─────────────────────────────────────────────
const existing = await connection.getAccountInfo(configPda);
if (existing) {
  console.log('✅ platformConfig already exists — no action needed.');
  process.exit(0);
}

// ── Call initialize ───────────────────────────────────────────────────────────
console.log('Calling initialize...');
const tx = await program.methods
  .initialize(PLATFORM_FEE_BPS)
  .accounts({
    config: configPda,
    admin: wallet.publicKey,
    treasury: new PublicKey(TREASURY_PUBKEY),
    systemProgram: SystemProgram.programId,
  })
  .signers([wallet])
  .rpc();

console.log('✅ Initialized! Tx:', tx);
console.log(`  platformConfig: ${configPda.toBase58()}`);
console.log(`  Program ID:     ${PROGRAM_ID.toBase58()}`);
