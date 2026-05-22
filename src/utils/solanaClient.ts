import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idlJson from './idl.json';

// Consistently target Devnet matching the indexer backend setup
export const PROGRAM_ID = new PublicKey(idlJson.address);
export const RPC_ENDPOINT = 'https://api.devnet.solana.com';

export const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Derivation seeds matching exactly Rust anchor constraints
export const getPlatformConfigPda = (): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    PROGRAM_ID
  );
  return pda;
};

export const getRoomPda = (tokenMint: PublicKey, creator: PublicKey): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('room'), tokenMint.toBuffer(), creator.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};

export const getEscrowPda = (room: PublicKey): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('escrow'), room.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};

export const getBetPda = (room: PublicKey, user: PublicKey): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('bet'), room.toBuffer(), user.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};

export const getReputationPda = (user: PublicKey): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('reputation'), user.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};

/**
 * Constructs an Anchor Program instance using a standard Solana Wallet Adapter interface.
 */
export const getAnchorProgram = (walletAdapter: any): anchor.Program<any> => {
  // Construct Anchor provider adaptor matching v0.30/v0.32 specification
  const provider = new anchor.AnchorProvider(
    connection,
    walletAdapter,
    {
      preflightCommitment: 'confirmed',
      commitment: 'confirmed',
    }
  );
  
  return new anchor.Program(idlJson as any, provider);
};

