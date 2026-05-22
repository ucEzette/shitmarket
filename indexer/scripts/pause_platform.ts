import 'dotenv/config';
import { Connection, Keypair, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import bs58 from 'bs58';
import { config } from '../src/config';
import idl from '../../src/utils/idl.json';

const PROGRAM_ID = new PublicKey(config.solana.programId);

function loadAdminKeypair(): Keypair {
  const raw = process.env.ADMIN_PRIVATE_KEY || config.solana.keeperPrivateKey;
  if (raw.startsWith('[')) {
    return Keypair.fromSecretKey(Uint8Array.from(JSON.parse(raw)));
  }
  return Keypair.fromSecretKey(bs58.decode(raw));
}

async function main() {
  const connection = new Connection(config.solana.rpcUrl, 'confirmed');
  const admin = loadAdminKeypair();
  
  const wallet = new anchor.Wallet(admin);
  const provider = new anchor.AnchorProvider(connection, wallet, {
    commitment: 'confirmed',
  });

  const idlWithAddress = { ...idl, address: PROGRAM_ID.toBase58() };
  const program = new anchor.Program(idlWithAddress as anchor.Idl, provider);

  const [configPda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    PROGRAM_ID
  );

  console.log(`Admin Wallet: ${admin.publicKey.toBase58()}`);
  console.log(`Config PDA: ${configPda.toBase58()}`);

  try {
    const configState = await (program.account as any).platformConfig.fetch(configPda);
    console.log(`Current paused state: ${configState.paused}`);

    const tx = await program.methods
      .pausePlatform()
      .accounts({
        config: configPda,
        admin: admin.publicKey,
      })
      .signers([admin])
      .rpc();

    console.log(`Successfully toggled platform pause state! TX: ${tx}`);
    
    const newConfigState = await (program.account as any).platformConfig.fetch(configPda);
    console.log(`New paused state: ${newConfigState.paused}`);
  } catch (err: any) {
    console.error(`Failed to pause platform:`, err.message);
  }
}

main().catch(console.error);
