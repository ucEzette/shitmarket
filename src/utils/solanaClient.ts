import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idlJson from './idl.json';

// Automatically target local validator in development, fallback to Devnet or environment overrides
export const PROGRAM_ID = new PublicKey(idlJson.address);
export const RPC_ENDPOINT = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || 
  (process.env.NODE_ENV === 'development' ? 'http://127.0.0.1:8899' : 'https://api.devnet.solana.com');

export const connection = new Connection(RPC_ENDPOINT, 'confirmed');

// Derivation seeds matching exactly Rust anchor constraints
export const getPlatformConfigPda = (): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('platform_config')],
    PROGRAM_ID
  );
  return pda;
};

export const getRoomPda = (tokenMint: PublicKey, creator: PublicKey, nonce: number): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('room'), tokenMint.toBuffer(), creator.toBuffer(), Buffer.from([nonce])],
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

export const getBetPda = (room: PublicKey, user: PublicKey, side: 'moon' | 'jeet'): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('bet'), 
      room.toBuffer(), 
      user.toBuffer(),
      Buffer.from([side === 'moon' ? 0 : 1])
    ],
    PROGRAM_ID
  );
  return pda;
};


export const getAnchorProgram = (walletAdapter: any): anchor.Program<any> => {
  // Construct a fallback read-only wallet if walletAdapter is null or lacks publicKey
  let wallet = walletAdapter;
  if (!wallet || !wallet.publicKey) {
    wallet = {
      publicKey: PublicKey.default,
      signTransaction: async (tx: any) => tx,
      signAllTransactions: async (txs: any[]) => txs,
    };
  }

  // Construct Anchor provider adaptor matching v0.30/v0.32 specification
  const provider = new anchor.AnchorProvider(
    connection,
    wallet,
    {
      preflightCommitment: 'confirmed',
      commitment: 'confirmed',
    }
  );
  
  return new anchor.Program(idlJson as any, provider);
};


