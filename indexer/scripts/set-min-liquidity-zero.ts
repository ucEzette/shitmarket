/**
 * set-min-liquidity-zero.ts
 *
 * One-shot admin script: sets minimum_liquidity = 0 on the deployed PlatformConfig.
 * Uses manual transaction construction to bypass IDL deserialization issues.
 *
 * Run: npx ts-node scripts/set-min-liquidity-zero.ts
 */

import * as anchor from '@coral-xyz/anchor';
import { Connection, Keypair, PublicKey, SystemProgram, Transaction } from '@solana/web3.js';
import bs58 from 'bs58';
import * as dotenv from 'dotenv';
import * as path from 'path';
import * as fs from 'fs';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const RPC_URL = process.env.SOLANA_RPC_URL!;
const PROGRAM_ID = new PublicKey(process.env.PROGRAM_ID!);
const KEEPER_KEY = process.env.KEEPER_PRIVATE_KEY!;

function loadKeypair(raw: string): Keypair {
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
  return Keypair.fromSecretKey(new Uint8Array(bs58.decode(raw)));
}

// Load the IDL from program target (more likely to match deployed bytecode)
function loadIdl(): any {
  const candidates = [
    path.resolve(__dirname, '../../program/target/idl/shitmarket.json'),
    path.resolve(__dirname, '../src/utils/idl.json'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      console.log('Using IDL from:', candidate);
      return JSON.parse(fs.readFileSync(candidate, 'utf-8'));
    }
  }
  throw new Error('No IDL found');
}

function normalizeIdl(obj: any): void {
  if (Array.isArray(obj)) { obj.forEach(normalizeIdl); }
  else if (obj !== null && typeof obj === 'object') {
    for (const key in obj) {
      if (key === 'defined' && typeof obj[key] === 'string') obj[key] = { name: obj[key] };
      else normalizeIdl(obj[key]);
    }
  }
}

async function main() {
  const connection = new Connection(RPC_URL, 'confirmed');
  const adminKeypair = loadKeypair(KEEPER_KEY);

  console.log('Admin pubkey:', adminKeypair.publicKey.toBase58());
  console.log('Program ID:', PROGRAM_ID.toBase58());

  const idl = loadIdl();
  const idlWithAddress = { ...idl, address: PROGRAM_ID.toBase58() };
  normalizeIdl(idlWithAddress);

  const wallet = new anchor.Wallet(adminKeypair);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: 'confirmed' });
  const program = new anchor.Program(idlWithAddress as anchor.Idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    PROGRAM_ID
  );
  console.log('Config PDA:', configPda.toBase58());

  // Build update_config call with only newMinimumLiquidity set to 0
  // All other args are null (Option::None) meaning "no change"
  console.log('Calling update_config(newMinimumLiquidity = 0)...');
  try {
    // The updateConfig instruction has 3 accounts:
    // 1. config (writable) - the PlatformConfig PDA
    // 2. admin (signer)
    // 3. newTreasury (optional) - pass SystemProgram as dummy since we're not changing treasury
    const tx = await (program.methods as any)
      .updateConfig(
        null,              // newFeeBps: Option<u16> - no change
        null,              // newTreasury: Option<Pubkey> - no change
        null,              // newKeeper: Option<Pubkey> - no change
        new anchor.BN(0),  // newMinimumLiquidity: Option<u64> = Some(0)
        null,              // newTwapWindow: Option<i64> - no change
        null,              // newCoolingOff: Option<i64> - no change
      )
      .accounts({
        config: configPda,
        admin: adminKeypair.publicKey,
        newTreasury: SystemProgram.programId, // dummy - required by IDL even when null arg
      })
      .signers([adminKeypair])
      .rpc({ commitment: 'confirmed', skipPreflight: false });

    console.log('✅ update_config TX confirmed:', tx);
    console.log('minimum_liquidity is now 0.');
    console.log('One-sided rooms will now settle successfully.');
  } catch (err: any) {
    console.error('update_config failed:', err?.logs ?? err?.message);
    throw err;
  }

}

main().catch(err => {
  console.error('Script failed:', err?.message ?? err);
  process.exit(1);
});
