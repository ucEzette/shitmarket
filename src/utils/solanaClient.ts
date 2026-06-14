import { Connection, PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import idlJson from './idl.json';

const programIdString = process.env.NEXT_PUBLIC_PROGRAM_ID || idlJson.address;
if (process.env.NEXT_PUBLIC_PROGRAM_ID && idlJson.address !== process.env.NEXT_PUBLIC_PROGRAM_ID) {
  (idlJson as any).address = process.env.NEXT_PUBLIC_PROGRAM_ID;
}

// Always use the env-provided RPC. Never fall back to a local validator — it won't be running in prod/dev.
export const PROGRAM_ID = new PublicKey(programIdString);
export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ||
  'https://api.devnet.solana.com';

// Only use env-configured RPC endpoints. Never hardcode API keys here.
const fallbackUrls = [
  RPC_ENDPOINT,
  process.env.NEXT_PUBLIC_SOLANA_BACKUP_RPC_URL || '',
  'https://api.devnet.solana.com',
].filter((url, idx, self) => url && self.indexOf(url) === idx);


let currentIndex = 0;
let currentConnection = new Connection(fallbackUrls[0], 'confirmed');

export const connection = new Proxy(currentConnection, {
  get(target, prop, receiver) {
    if (prop === 'rpcEndpoint') {
      return fallbackUrls[currentIndex];
    }
    const value = Reflect.get(currentConnection, prop);
    if (typeof value === 'function') {
      return function (...args: any[]) {
        const asyncMethods = [
          'getAccountInfo', 'getBalance', 'getLatestBlockhash', 'confirmTransaction',
          'sendRawTransaction', 'sendTransaction', 'simulateTransaction',
          'getMinimumBalanceForRentExemption', 'getSlot', 'getTransaction',
          'getParsedTransaction', 'getProgramAccounts', 'getTokenAccountBalance',
          'getMultipleAccountsInfo', 'getRecentPrioritizationFees',
          'getTokenSupply', 'getTokenLargestAccounts',
        ];
        
        if (!asyncMethods.includes(String(prop))) {
          return value.apply(currentConnection, args);
        }
        
        return (async () => {
          let attempts = 0;
          const maxAttempts = fallbackUrls.length;
          while (attempts < maxAttempts) {
            try {
              const activeFunc = Reflect.get(currentConnection, prop);
              return await activeFunc.apply(currentConnection, args);
            } catch (error: any) {
              attempts++;
              console.warn(`RPC Call [${String(prop)}] to ${fallbackUrls[currentIndex]} failed (attempt ${attempts}/${maxAttempts}):`, error);
              if (attempts >= maxAttempts) {
                throw error;
              }
              currentIndex = (currentIndex + 1) % fallbackUrls.length;
              currentConnection = new Connection(fallbackUrls[currentIndex], 'confirmed');
            }
          }
        })();
      };
    }
    return value;
  }
}) as any as Connection;

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
  
  const idlWithAddress = {
    ...idlJson,
    address: PROGRAM_ID.toBase58(),
  };

  return new anchor.Program(idlWithAddress as any, provider);
};

export const getVaultPda = (): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    PROGRAM_ID
  );
  return pda;
};

export const getUserReferralPda = (user: PublicKey): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('user_referral'), user.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};

export const getReferralStatePda = (referrer: PublicKey): PublicKey => {
  const [pda] = PublicKey.findProgramAddressSync(
    [Buffer.from('referral_state'), referrer.toBuffer()],
    PROGRAM_ID
  );
  return pda;
};


