/**
 * initialize-program.cjs
 * Calls the `initialize` instruction on the newly deployed ShitMarket program.
 * Run from indexer dir: node ../scripts/initialize-program.cjs
 */
'use strict';
const anchor = require('@coral-xyz/anchor');
const { Connection, Keypair, PublicKey, SystemProgram } = require('@solana/web3.js');
const bs58 = require('bs58');
const { readFileSync } = require('fs');
const path = require('path');

const RPC_URL = 'https://devnet.helius-rpc.com/?api-key=cce2e7d9-5846-4ac4-9a83-0252eb8e8b71';
const KEEPER_PRIVATE_KEY = '5ibz12AKj51yW5RTdc2DFhY68DEQi7AmqiofhP1P91AreZBYnZM5EQavqaA7D2MRqkDyYZS1QV34jz1humWd2gqf';
const TREASURY_PUBKEY = '32ZAF6jferKQoyZ2Cy7eqNhuZjBBwekdT2qaVU1ftdys';
const PLATFORM_FEE_BPS = 100;

// IDL is one level up from indexer dir
const idlPath = path.resolve(__dirname, '../src/utils/idl.json');
const idl = JSON.parse(readFileSync(idlPath, 'utf-8'));
const PROGRAM_ID = new PublicKey(idl.address);

console.log('Program ID:', PROGRAM_ID.toBase58());

const decode = bs58.default ? bs58.default.decode.bind(bs58.default) : bs58.decode.bind(bs58);
const secretKey = decode(KEEPER_PRIVATE_KEY);
const wallet = Keypair.fromSecretKey(secretKey);
console.log('Admin wallet:', wallet.publicKey.toBase58());

const connection = new Connection(RPC_URL, 'confirmed');
const provider = new anchor.AnchorProvider(
  connection,
  new anchor.Wallet(wallet),
  { commitment: 'confirmed', preflightCommitment: 'confirmed' }
);
anchor.setProvider(provider);

const program = new anchor.Program(idl, provider);

const [configPda] = PublicKey.findProgramAddressSync(
  [Buffer.from('platform_config')],
  PROGRAM_ID
);
console.log('platformConfig PDA:', configPda.toBase58());

async function main() {
  const existing = await connection.getAccountInfo(configPda);
  if (existing) {
    console.log('✅ platformConfig already exists — no action needed.');
    process.exit(0);
  }

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
  console.log('  platformConfig:', configPda.toBase58());
  console.log('  Program ID:    ', PROGRAM_ID.toBase58());
}

main().catch(err => {
  console.error('❌ Failed:', err);
  process.exit(1);
});
