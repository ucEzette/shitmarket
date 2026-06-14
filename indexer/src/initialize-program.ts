/**
 * initialize-program.ts
 * One-shot script: initializes the PlatformConfig on the new program.
 * Run from indexer/: npx ts-node -e ... or compile first.
 */
import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram } from '@solana/web3.js';
import bs58 from 'bs58';
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const RPC_URL = 'https://devnet.helius-rpc.com/?api-key=cce2e7d9-5846-4ac4-9a83-0252eb8e8b71';
const KEEPER_PRIVATE_KEY = '5ibz12AKj51yW5RTdc2DFhY68DEQi7AmqiofhP1P91AreZBYnZM5EQavqaA7D2MRqkDyYZS1QV34jz1humWd2gqf';
const TREASURY_PUBKEY = '32ZAF6jferKQoyZ2Cy7eqNhuZjBBwekdT2qaVU1ftdys';
const PLATFORM_FEE_BPS = 100;

const idlPath = path.resolve(process.cwd(), '../src/utils/idl.json');
const idl = JSON.parse(readFileSync(idlPath, 'utf-8'));
const PROGRAM_ID = new PublicKey(idl.address);

console.log('Program ID:', PROGRAM_ID.toBase58());

const secretKey = bs58.decode(KEEPER_PRIVATE_KEY);
const kp = Keypair.fromSecretKey(secretKey);
console.log('Admin wallet:', kp.publicKey.toBase58());

const connection = new Connection(RPC_URL, 'confirmed');
const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(kp),
  { commitment: 'confirmed', preflightCommitment: 'confirmed' }
);
anchor.setProvider(provider);
const program = new anchor.Program(idl as anchor.Idl, provider);

const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('platform_config')],
  PROGRAM_ID
);
console.log('platformConfig PDA:', configPda.toBase58());

async function main() {
  const existing = await connection.getAccountInfo(configPda);
  if (existing) {
    console.log('✅ platformConfig already exists — no action needed.');
    return;
  }

  console.log('Calling initialize...');
  const tx = await program.methods
    .initialize(PLATFORM_FEE_BPS)
    .accounts({
      config: configPda,
      admin: kp.publicKey,
      treasury: new PublicKey(TREASURY_PUBKEY),
      systemProgram: SystemProgram.programId,
    })
    .signers([kp])
    .rpc();

  console.log('✅ Initialized! Tx:', tx);
  console.log('  platformConfig:', configPda.toBase58());
  console.log('  Program ID:    ', PROGRAM_ID.toBase58());
}

main().catch(err => {
  console.error('❌ Failed:', err.message ?? err);
  process.exit(1);
});
