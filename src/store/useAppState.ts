import { create } from 'zustand';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import {
  getAnchorProgram,
  connection,
  getRoomPda,
  getEscrowPda,
  getBetPda,
  getPlatformConfigPda,
  getReputationPda,
} from '@/utils/solanaClient';
import pythFeedMap from '@/utils/pythFeedMap.json';

export interface Bet {
  id: string;
  roomId: string;
  user: string; // wallet address
  side: 'moon' | 'jeet';
  amount: number; // SOL
  claimed: boolean;
  timestamp: number;
}

export interface Activity {
  id: string;
  type: 'bet' | 'win' | 'settlement';
  title: string;
  message: string;
  timestamp: number;
  read: boolean;
  link?: string;
}

export interface Room {
  id: string;
  token: {
    address: string;
    name: string;
    symbol: string;
    icon: string; // emoji or symbol name
    liquidity?: number;
    marketCap?: number;
    age?: number; // minutes
    chainId?: string;
    pairAddress?: string;
  };
  creator: string;
  moonPool: number;
  jeetPool: number;
  expiry: number; // unix timestamp in ms
  status: 'active' | 'settled' | 'cancelled';
  winner?: 'moon' | 'jeet' | 'draw';
  createdAt: number;
  duration: 5 | 15 | 60; // minutes
  openingPrice?: number;
  finalTWAP?: number;
}

export interface UserProfile {
  wallet: string | null;
  balance: number; // SOL
  bets: Bet[];
  achievements: string[]; // ids
  stats: {
    totalBets: number;
    wins: number;
    losses: number;
    profit: number; // SOL
    winStreak: number;
    longestWinStreak: number;
    biggestBet: number; // SOL
  };
  trenchScore: 'S' | 'A' | 'B' | 'C' | 'D';
}

export interface ChatMessage {
  roomId: string;
  side: 'moon' | 'jeet';
  user: string;
  message: string;
  timestamp: number;
}

interface LeaderboardEntry {
  address: string;
  name: string;
  profit: number;
  winRate: number;
  elo?: number;
}

export interface AppState {
  isPaused: boolean;
  rooms: Room[];
  user: UserProfile | null;
  leaderboard: {
    moon: LeaderboardEntry[];
    jeet: LeaderboardEntry[];
  };
  chatMessages: ChatMessage[];
  activityLog: Activity[];
  fullDegenMode: boolean;
  
  // Transactional & Web3 states
  wallet: any | null;
  isTransactionLoading: boolean;
  transactionError: string | null;

  // actions
  createRoom: (room: Room) => Promise<any>;
  placeBet: (roomId: string, side: 'moon' | 'jeet', amount: number) => Promise<any>;
  claimWinnings: (roomId: string) => Promise<any>;
  connectWallet: () => void;
  disconnectWallet: () => void;
  setWallet: (wallet: any) => void;
  setWalletAddress: (address: string | null) => void;
  addMessage: (msg: ChatMessage) => void;
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp' | 'read'>) => void;
  markActivitiesRead: () => void;
  settleRoom: (roomId: string, winner: 'moon' | 'jeet' | 'draw') => void;
  updateUserStats: (betResult: 'win' | 'loss', amount: number, wonAmount?: number) => void;
  tickTimers: () => void;
  setFullDegenMode: (val: boolean) => void;
  getUserBetForRoom: (roomId: string) => Bet | undefined;
  updateLeaderboard: () => void;
  recalcTrenchScore: () => void;
  parlayBet: (legs: any[], amount: number) => void;
  
  // Web3 state actions
  setTransactionLoading: (loading: boolean) => void;
  setTransactionError: (error: string | null) => void;
  fetchRooms: () => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  
  // Real-time synchronization actions
  addRoom: (room: Room) => void;
  updateRoomPools: (roomId: string, moonPool: number, jeetPool: number) => void;
  markBetClaimed: (roomId: string, userAddress: string) => void;
  addUserBet: (bet: Bet) => void;
}

// ── Solana Base58 address generator (mock) ─────────────────────
const BASE58_CHARS = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function generateBase58String(length: number): string {
  let result = '';
  for (let i = 0; i < length; i++) {
    result += BASE58_CHARS[Math.floor(Math.random() * BASE58_CHARS.length)];
  }
  return result;
}

function generateSolanaAddress(): string {
  return generateBase58String(44);
}

function generateShortAddress(): string {
  // Generate a shorter Solana-style address for display (truncated form)
  const full = generateBase58String(44);
  return `${full.slice(0, 6)}...${full.slice(-4)}`;
}

// ── Seed mock chats ────────────────────────────────────────────
const seedChats = (): ChatMessage[] => {
  return [
    { roomId: '1', side: 'moon', user: 'DegenChad', message: 'LFG $WIFEY TO THE MOON! 🚀🚀', timestamp: 1716000000000 },
    { roomId: '1', side: 'jeet', user: 'WojakBear', message: 'Liquidity is thin, this is dumping hard. Jeets, assemble!', timestamp: 1716000005000 },
    { roomId: '1', side: 'moon', user: 'SolMaxi', message: 'Pushed another 0.5 SOL in. Easiest pump of my life.', timestamp: 1716000015000 },
    { roomId: '1', side: 'jeet', user: 'RamenDeity', message: 'Get rekt moonboys, Dev already dumped his bag.', timestamp: 1716000025000 },
  ];
};

// ── Fetch with Timeout helper to prevent offline backend hangs ───
async function fetchWithTimeout(resource: string, options: RequestInit = {}, timeoutMs = 3000): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(resource, {
      ...options,
      signal: controller.signal
    });
    clearTimeout(id);
    return response;
  } catch (error) {
    clearTimeout(id);
    throw error;
  }
}

// ── Promise Timeout helper to prevent infinite on-chain hangs ───
function withTimeout<T>(promise: Promise<T>, timeoutMs = 3000, errorMsg = 'Operation timed out'): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
      promise.finally(() => clearTimeout(timer));
    })
  ]);
}

// ── Map API Room to Store Room ────────────────────────────────
export const mapApiRoom = (apiRoom: any): Room => {
  return {
    id: apiRoom.roomPubkey,
    token: {
      address: apiRoom.originalAddress || apiRoom.tokenMint,
      name: apiRoom.tokenName || 'Unknown Token',
      symbol: apiRoom.tokenSymbol || 'UNKNWN',
      icon: apiRoom.tokenImageUrl || '💰',
      chainId: apiRoom.chainId || 'solana',
    },
    creator: 'Unknown',
    moonPool: Number(apiRoom.moonPool || 0) / 1e9,
    jeetPool: Number(apiRoom.jeetPool || 0) / 1e9,
    expiry: new Date(apiRoom.expiry).getTime(),
    status: apiRoom.status as 'active' | 'settled' | 'cancelled',
    winner: apiRoom.winner || undefined,
    createdAt: new Date(apiRoom.createdAt).getTime(),
    duration: apiRoom.duration as 5 | 15 | 60,
    openingPrice: apiRoom.openingPrice ? Number(apiRoom.openingPrice) / 1e8 : undefined,
    finalTWAP: apiRoom.finalPrice ? Number(apiRoom.finalPrice) / 1e8 : undefined,
  };
};

export const useAppState = create<AppState>((set, get) => ({
  rooms: [
    {
      id: '1',
      token: {
        address: '7GCihgDB8fe6KNjn2MYtkzNc8oV1VfF7L4y3L5gF7VxL',
        name: 'Wife Husband Meme Coin',
        symbol: 'WIFEY',
        icon: '👰',
        chainId: 'solana',
        pairAddress: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263'
      },
      creator: 'G5C3A21...XyB3',
      moonPool: 4.85,
      jeetPool: 6.20,
      expiry: 1716000180000, // Fixed time
      status: 'active',
      createdAt: 1716000000000,
      duration: 5
    },
    {
      id: '2',
      token: {
        address: '6E9f28c89b7b92f75a7db0f3a6cf67f082e69888',
        name: 'Pepe 5.0 Retro Classic',
        symbol: 'PEPE5.0',
        icon: '🐸',
        chainId: 'solana',
        pairAddress: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbAbdFsSAgwX'
      },
      creator: 'A3A2512...GzA1',
      moonPool: 18.25,
      jeetPool: 14.10,
      expiry: 1716000480000, // Fixed time
      status: 'active',
      createdAt: 1716000000000,
      duration: 15
    },
    {
      id: '3',
      token: {
        address: '992451f28b7e283fb7ea0d2f3a61c3f282e69777',
        name: 'Jeet Slayer Terminator',
        symbol: 'JEETSLAYER',
        icon: '🗡️',
        chainId: 'solana',
        pairAddress: '7GCihgDB8fe6KNjn2MYtkzNc8oV1VfF7L4y3L5gF7VxL'
      },
      creator: 'B9B2200...ZwF2',
      moonPool: 1.2,
      jeetPool: 0.8,
      expiry: 1716003600000,
      status: 'active',
      createdAt: 1716000000000,
      duration: 60
    },
    {
      id: '4',
      token: {
        address: '12928c89b7b92f75a7db0f3a6cf67f082e69111',
        name: 'Safe Rug Inu',
        symbol: 'SAFERUG',
        icon: '🦮',
        chainId: 'solana',
        pairAddress: '7X2WpM6z1u5q8v3JFLXq9YbG9fLkYq6Qp9SDFjKL'
      },
      creator: 'C8A1100...HyD2',
      moonPool: 45.1,
      jeetPool: 2.2,
      expiry: 1716000000000 - 10000,
      status: 'settled',
      winner: 'moon',
      createdAt: 1716000000000 - 360000,
      duration: 5
    },
    {
      id: '5',
      token: {
        address: '9f928c89b7b92f75a7db0f3a6cf67f082e691234',
        name: 'Wojak Sad Cry Club',
        symbol: 'WOJAK',
        icon: '😭',
        chainId: 'solana',
        pairAddress: '88e6a0c2ddd26feeb64f039a2c41296fcb3f5640'
      },
      creator: 'D4D0010...JxE3',
      moonPool: 11.4,
      jeetPool: 23.5,
      expiry: 1716000000000 - 5000,
      status: 'settled',
      winner: 'jeet',
      createdAt: 1716000000000 - 305000,
      duration: 5
    }
  ],
  isPaused: false,
  user: null,
  leaderboard: {
    moon: [
      { address: '45bf...2d3a', name: 'MoonChad_69', profit: 142.55, winRate: 82.4 },
      { address: '77c2...fa91', name: 'BullRunBeliever', profit: 94.20, winRate: 75.0 },
      { address: '89ee...4c10', name: 'PumpFiend', profit: 78.90, winRate: 68.2 },
      { address: '32ab...df88', name: 'WhaleShaker', profit: 54.12, winRate: 61.5 },
      { address: 'ba24...cc51', name: 'HODL_Commander', profit: 32.88, winRate: 59.8 }
    ],
    jeet: [
      { address: '90ff...8a12', name: 'JeetSniperPro', profit: 120.40, winRate: 79.1 },
      { address: '22c9...bc77', name: 'BearPlague', profit: 89.60, winRate: 71.3 },
      { address: 'ee92...99ff', name: 'DumpGod', profit: 64.50, winRate: 65.0 },
      { address: 'ab67...cc88', name: 'FudSoldier', profit: 45.10, winRate: 62.1 },
      { address: '6e9f...ff33', name: 'LiquidationStation', profit: 21.05, winRate: 55.4 }
    ]
  },
  chatMessages: seedChats(),
  activityLog: [],
  fullDegenMode: false,

  wallet: null,
  isTransactionLoading: false,
  transactionError: null,

  addActivity: (activity) => {
    set((state) => ({
      activityLog: [
        { ...activity, id: Date.now().toString() + Math.random(), timestamp: Date.now(), read: false },
        ...state.activityLog
      ]
    }));
  },

  markActivitiesRead: () => {
    set((state) => ({
      activityLog: state.activityLog.map(a => ({ ...a, read: true }))
    }));
  },

  setWallet: (wallet: any) => {
    set({ wallet });
  },

  setTransactionLoading: (loading: boolean) => set({ isTransactionLoading: loading }),
  setTransactionError: (error: string | null) => set({ transactionError: error }),

  fetchRooms: async () => {
    try {
      const res = await fetchWithTimeout('http://localhost:3001/api/rooms?status=all&limit=50', {}, 3000);
      const json = await res.json();
      if (json.success && json.data) {
        let mapped = json.data.map(mapApiRoom);

        // HYDRATE ON-CHAIN STATE
        try {
          const program = getAnchorProgram(null as any);
          const pubkeys = mapped.map((r: Room) => new PublicKey(r.id));
          const onChainRooms = await withTimeout(
            program.account.room.fetchMultiple(pubkeys),
            3000,
            'On-chain room fetch timed out'
          );

          mapped = mapped.map((room: Room, index: number) => {
            const onChain = onChainRooms[index];
            if (onChain) {
              const statusStr = Object.keys(onChain.status)[0].toLowerCase() as 'active' | 'settled';
              let winnerStr = undefined;
              if (onChain.winner) {
                winnerStr = Object.keys(onChain.winner)[0].toLowerCase();
              }
              return {
                ...room,
                moonPool: onChain.moonPool.toNumber() / 1e9,
                jeetPool: onChain.jeetPool.toNumber() / 1e9,
                status: statusStr,
                winner: winnerStr,
                expiry: onChain.expiryTimestamp.toNumber() * 1000,
                token: {
                  ...room.token,
                }
              };
            }
            return room;
          });
        } catch (e) {
          console.warn('Could not hydrate on-chain room state', e);
        }

        set({ rooms: mapped });
      }

      // Fetch PlatformConfig to see if paused
      try {
        const program = getAnchorProgram(null as any); // using read-only provider
        const configPda = getPlatformConfigPda();
        const configAccount = await withTimeout(
          (program.account as any).platformConfig.fetch(configPda),
          3000,
          'PlatformConfig fetch timed out'
        );
        set({ isPaused: (configAccount as any).paused });
      } catch (e) {
        console.warn('Could not fetch PlatformConfig for paused state', e);
      }

    } catch (err) {
      console.error('Failed to fetch rooms from indexer REST API:', err);
    }
  },

  fetchLeaderboard: async () => {
    try {
      const res = await fetchWithTimeout('http://localhost:3001/api/leaderboard?sortBy=profit&limit=50', {}, 3000);
      const json = await res.json();
      if (json.success && json.data) {
        const mapped = json.data.map((u: any) => ({
          address: u.userPubkey,
          name: `CMD_${u.userPubkey.slice(0, 4).toUpperCase()}`,
          profit: Number(u.profit) / 1e9,
          winRate: u.winRate,
        }));
        
        // Deterministically split top users into Moon and Jeet tabs for front-end visual compatibility
        const moon = mapped.filter((_: any, idx: number) => idx % 2 === 0);
        const jeet = mapped.filter((_: any, idx: number) => idx % 2 === 1);
        
        set({
          leaderboard: { moon, jeet }
        });
      }
    } catch (err) {
      console.error('Failed to fetch leaderboard from indexer:', err);
    }
  },

  fetchBalance: async () => {
    const { user, wallet } = get();
    if (!wallet || !wallet.publicKey) return;
    try {
      const balance = await withTimeout(
        connection.getBalance(wallet.publicKey),
        3000,
        'Solana balance fetch timed out'
      );
      const solBalance = balance / 1e9;
      if (user) {
        set({
          user: {
            ...user,
            balance: solBalance,
          }
        });
      }
    } catch (err) {
      console.error('Failed to fetch wallet SOL balance:', err);
    }
  },

  createRoom: async (room: Room) => {
    const { wallet, setTransactionLoading, setTransactionError } = get();
    if (!wallet || !wallet.publicKey) {
      alert("PLEASE ENLIST YOUR WALLET TO THE PLATFORM CONFIG!");
      return;
    }
    
    setTransactionLoading(true);
    setTransactionError(null);
    
    try {
      const tokenMintStr = room.token.address;
      let onChainPubkeyStr = tokenMintStr;
      let livePriceUsd: string | undefined = undefined;
      
      // Phase 3.4: Validate minimum liquidity & age via indexer
      const indexerApi = process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:3001';
      try {
        const valRes = await fetchWithTimeout(`${indexerApi}/api/rooms/validate?mint=${tokenMintStr}`, {}, 3000);
        if (valRes.ok) {
          const valData = await valRes.json();
          if (!valData.valid) {
            throw new Error(`Validation Failed: ${valData.reason}`);
          }
          if (valData.pubkeyStr) {
            onChainPubkeyStr = valData.pubkeyStr;
          }
          livePriceUsd = valData.priceUsd;
        } else {
          throw new Error(`Non-ok response from validation API: ${valRes.status}`);
        }
      } catch (validationErr: any) {
        if (validationErr.message && validationErr.message.includes('Validation Failed')) {
          throw validationErr;
        }
        console.warn('Validation API failed, proceeding with fallback parsing...', validationErr);
        // Fallback compute for EVM addresses if API fails (unlikely, but safe)
        try {
          new PublicKey(tokenMintStr);
        } catch {
          let hex = tokenMintStr.replace('0x', '');
          if (hex.length % 2 !== 0) hex = '0' + hex;
          const buffer = Buffer.alloc(32);
          Buffer.from(hex, 'hex').copy(buffer, 0);
          onChainPubkeyStr = new PublicKey(buffer).toBase58();
        }
      }

      const program = getAnchorProgram(wallet);
      const tokenMintPubkey = new PublicKey(onChainPubkeyStr);
      
      let roomPda: PublicKey | null = null;
      let chosenNonce = 0;
      let alreadyExists = false;

      // Scan sequentially for the next available/active nonce
      for (let n = 0; n < 256; n++) {
        const currentPda = getRoomPda(tokenMintPubkey, wallet.publicKey, n);
        const accountInfo = await connection.getAccountInfo(currentPda);

        if (accountInfo === null) {
          // This nonce is unused and completely clean!
          roomPda = currentPda;
          chosenNonce = n;
          break;
        }

        // The room exists on-chain, check if it's currently active and unexpired
        try {
          const roomData: any = await program.account.room.fetch(currentPda);
          const now = Math.floor(Date.now() / 1000);
          const isExpired = now >= roomData.expiryTimestamp.toNumber();

          if (!isExpired && roomData.status.active !== undefined) {
            // There is still a valid active room running for this token. Block duplicate creation.
            roomPda = currentPda;
            chosenNonce = n;
            alreadyExists = true;
            break;
          }
        } catch (fetchErr) {
          console.warn(`Failed to fetch room account at nonce ${n}, assuming expired/unusable:`, fetchErr);
        }
      }

      if (!roomPda) {
        throw new Error("Unable to resolve a clean room PDA (maximum nonces exhausted).");
      }

      if (alreadyExists) {
        console.log("Room already exists and is active on-chain! Syncing with indexer and proceeding...");
        
        // Trigger self-healing sync on indexer
        try {
          const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:3001';
          await fetch(`${indexerUrl}/api/rooms/${roomPda.toBase58()}`);
        } catch (syncErr) {
          console.warn("Failed to trigger self-healing sync on indexer:", syncErr);
        }

        // Force refreshing the rooms list in the background
        await get().fetchRooms();
        
        return {
          tx: null,
          roomPda: roomPda.toBase58(),
          alreadyExists: true
        };
      }

      const escrowPda = getEscrowPda(roomPda);
      const configPda = getPlatformConfigPda();
      
      // Use SystemProgram.programId as the priceFeed sentinel. This bypasses Pyth
      // legacy pull feeds on-chain, allowing us to leverage high-fidelity DexScreener off-chain.
      const priceFeed = SystemProgram.programId;

      // Scale opening price override to 1e8
      let openingPriceParam = null;
      if (livePriceUsd) {
        const priceVal = parseFloat(livePriceUsd);
        if (isFinite(priceVal) && priceVal > 0) {
          openingPriceParam = new BN(Math.round(priceVal * 1e8));
        }
      }

      const tx = await (program.methods as any)
        .createRoom(
          tokenMintPubkey,
          room.token.name || 'Unknown Token',
          room.duration,
          null, // switchboardFeed Option<Pubkey>
          openingPriceParam, // openingPriceParam Option<i64>
          chosenNonce // new nonce parameter
        )
        .accounts({
          room: roomPda,
          escrow: escrowPda,
          creator: wallet.publicKey,
          priceFeed: priceFeed,
          switchboardFeed: SystemProgram.programId,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
        
      console.log("Room created successfully on-chain! Tx:", tx);
      
      // Force refreshing the rooms list in the background
      await get().fetchRooms();
      return {
        tx,
        roomPda: roomPda.toBase58(),
        alreadyExists: false
      };
    } catch (err: any) {
      console.error("Failed to create room on-chain:", err);
      setTransactionError(err.message || String(err));
      alert(`DEPLOY MISSION REJECTED BY COMMAND HQ: ${err.message || err}`);
      throw err;
    } finally {
      setTransactionLoading(false);
    }
  },

  placeBet: async (roomId: string, side: 'moon' | 'jeet', amount: number) => {
    const { wallet, setTransactionLoading, setTransactionError } = get();
    if (!wallet || !wallet.publicKey) {
      alert("PLEASE ENLIST YOUR WALLET TO CHARGE ENEMY LINES!");
      return;
    }
    
    setTransactionLoading(true);
    setTransactionError(null);
    
    try {
      const program = getAnchorProgram(wallet);
      const roomPda = new PublicKey(roomId);
      const escrowPda = getEscrowPda(roomPda);
      const betPda = getBetPda(roomPda, wallet.publicKey, side);
      const configPda = getPlatformConfigPda();
      
      // Optional account resolution for reputation Pda:
      const reputationPda = getReputationPda(wallet.publicKey);
      const repAccountInfo = await connection.getAccountInfo(reputationPda);
      const reputationAccount = repAccountInfo ? reputationPda : program.programId;
      
      const tx = await (program.methods as any)
        .placeBet(
          side === 'moon' ? { moon: {} } : { jeet: {} },
          new BN(amount * 1e9) // convert SOL to lamports
        )
        .accounts({
          room: roomPda,
          escrow: escrowPda,
          bet: betPda,
          user: wallet.publicKey,
          reputation: reputationAccount,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
        
      console.log("Bet placed successfully on-chain! Tx:", tx);
      
      // Broadcast handled via WebSocket (ClientWrapper) from the indexer
      // Add to personal activity log
      get().addActivity({
        type: 'bet',
        title: `DEPLOYED ${amount} SOL ON ${side.toUpperCase()}`,
        message: `You stacked ${amount} SOL on ${side.toUpperCase()} in room ${roomId}.`,
        link: `/room/${roomId}`
      });

      // Refresh user balance immediately
      await get().fetchBalance();
      
      return tx;
    } catch (err: any) {
      console.error("Failed to place bet on-chain:", err);
      setTransactionError(err.message || String(err));
      alert(`BATTLE ORDER FAILED: ${err.message || err}`);
      throw err;
    } finally {
      setTransactionLoading(false);
    }
  },

  claimWinnings: async (roomId: string) => {
    const { wallet, setTransactionLoading, setTransactionError } = get();
    if (!wallet || !wallet.publicKey) return;
    
    setTransactionLoading(true);
    setTransactionError(null);
    
    try {
      const rooms = get().rooms;
      const room = rooms.find((r) => r.id === roomId);
      
      if (room && room.status === 'active' && room.expiry <= Date.now()) {
        console.log(`Room is active but expired. Triggering on-demand settlement first for room ${roomId}...`);
        const indexerUrl = process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:3001';
        const settleRes = await fetch(`${indexerUrl}/api/rooms/${roomId}/settle`, {
          method: 'POST',
        });
        if (!settleRes.ok) {
          const errData = await settleRes.json().catch(() => ({}));
          throw new Error(errData.error || `Settlement request failed with status ${settleRes.status}`);
        }
        const settleJson = await settleRes.json();
        console.log(`On-demand settlement completed! txSig: ${settleJson.txSig}`);
        
        // Wait a small moment (500ms) for the event listener to catch up and DB to update.
        await new Promise((resolve) => setTimeout(resolve, 500));
        
        // Refresh rooms to update frontend state
        await get().fetchRooms();
      }

      const program = getAnchorProgram(wallet);
      const roomPda = new PublicKey(roomId);
      const escrowPda = getEscrowPda(roomPda);
      
      const winningSide = room?.winner === 'moon' ? 'moon' : 'jeet';
      const betPda = getBetPda(roomPda, wallet.publicKey, winningSide);
      
      const tx = await (program.methods as any)
        .claimWinnings()
        .accounts({
          room: roomPda,
          escrow: escrowPda,
          bet: betPda,
          user: wallet.publicKey,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .rpc();
        
      console.log("Winnings claimed successfully! Tx:", tx);
      
      // Add to personal activity log
      get().addActivity({
        type: 'win',
        title: `BOOTY CLAIMED IN ROOM ${roomId.substring(0, 4)}`,
        message: `Successfully recovered spoils from ${winningSide.toUpperCase()} victory.`,
        link: `/room/${roomId}`
      });

      // Reload balance and user stats
      await get().fetchBalance();
      
      return tx;
    } catch (err: any) {
      console.error("Failed to claim winnings on-chain:", err);
      setTransactionError(err.message || String(err));
      alert(`WAR BOOTY CLAIM REJECTED: ${err.message || err}`);
      throw err;
    } finally {
      setTransactionLoading(false);
    }
  },

  connectWallet: () => {
    // Left as a mock visual helper for sandbox mode, though standard Solana wallets connect via adapter components
    console.log("Connect wallet action invoked");
  },

  disconnectWallet: () => {
    set(() => ({
      user: null,
      wallet: null
    }));
  },

  setWalletAddress: async (address: string | null) => {
    const { fetchBalance } = get();
    if (address) {
      // First get their current SOL balance directly from RPC
      let balance = 0;
      try {
        const pubkey = new PublicKey(address);
        const lamports = await connection.getBalance(pubkey);
        balance = lamports / 1e9;
      } catch (err) {
        console.error('Failed to get balance on wallet connection:', err);
      }
      
      // Query the user's profile and bet history from the indexer API
      let trenchScore: 'S' | 'A' | 'B' | 'C' | 'D' = 'D';
      let stats = {
        totalBets: 0,
        wins: 0,
        losses: 0,
        profit: 0,
        winStreak: 0,
        longestWinStreak: 0,
        biggestBet: 0,
      };
      let achievements: string[] = [];
      let bets: Bet[] = [];
      
      try {
        const res = await fetchWithTimeout(`http://localhost:3001/api/profile/${address}`, {}, 3000);
        const json = await res.json();
        if (json.success && json.data) {
          trenchScore = json.data.trenchScore || 'D';
          stats = {
            totalBets: json.data.totalBets || 0,
            wins: json.data.wins || 0,
            losses: json.data.losses || 0,
            profit: Number(json.data.profit || 0) / 1e9,
            winStreak: 0,
            longestWinStreak: 0,
            biggestBet: 0,
          };
          bets = (json.data.bets || []).map((b: any) => ({
            id: b.id,
            roomId: b.roomPubkey,
            user: b.userPubkey,
            side: b.side,
            amount: Number(b.amount) / 1e9,
            claimed: b.claimedAt ? true : false,
            timestamp: new Date(b.createdAt).getTime(),
          }));
        }
      } catch (err) {
        console.error('Failed to fetch profile from indexer:', err);
      }
      
      set({
        user: {
          wallet: address,
          balance,
          bets,
          achievements,
          stats,
          trenchScore,
        }
      });
    } else {
      set({
        user: null,
        wallet: null,
      });
    }
  },

  addMessage: (msg: ChatMessage) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, msg].slice(-100)
    }));
  },

  settleRoom: (roomId: string, winner: 'moon' | 'jeet' | 'draw') => {
    console.log(`Keeper event settleRoom triggered for room ${roomId} with winner ${winner}`);
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, status: 'settled', winner } : r
      ),
    }));
  },

  addRoom: (room: Room) => {
    set((state) => {
      if (state.rooms.some((r) => r.id === room.id)) return {};
      return { rooms: [room, ...state.rooms] };
    });
  },

  updateRoomPools: (roomId: string, moonPool: number, jeetPool: number) => {
    set((state) => ({
      rooms: state.rooms.map((r) =>
        r.id === roomId ? { ...r, moonPool, jeetPool } : r
      ),
    }));
  },

  markBetClaimed: (roomId: string, userAddress: string) => {
    set((state) => {
      if (!state.user) return {};
      const updatedBets = state.user.bets.map((b) =>
        b.roomId === roomId && b.user === userAddress ? { ...b, claimed: true } : b
      );
      return {
        user: {
          ...state.user,
          bets: updatedBets,
        },
      };
    });
  },

  addUserBet: (bet: Bet) => {
    set((state) => {
      if (!state.user) return {};
      const exists = state.user.bets.find((b) => b.id === bet.id || (b.roomId === bet.roomId && b.side === bet.side && b.timestamp === bet.timestamp));
      if (exists) return {};
      return {
        user: {
          ...state.user,
          bets: [bet, ...state.user.bets],
        },
      };
    });
  },

  updateUserStats: (betResult: 'win' | 'loss', amount: number, wonAmount = 0) => {
    // Stats are computed and stored by the indexer, and fetched dynamically.
    console.log(`Stats update logged: result ${betResult}, amount ${amount}`);
  },

  tickTimers: () => {
    // Rooms are settled on-chain by the Keeper. 
    // Timer ticks are purely visual for local client count-downs.
  },

  setFullDegenMode: (val: boolean) => {
    set({ fullDegenMode: val });
  },

  getUserBetForRoom: (roomId: string) => {
    return get().user?.bets.find((b) => b.roomId === roomId);
  },

  updateLeaderboard: () => {
    get().fetchLeaderboard();
  },

  recalcTrenchScore: () => {
    // Managed and verified dynamically by the indexer on-chain events
  },

  parlayBet: (legs: any[], amount: number) => {
    console.log("Parlay bet processed:", legs, amount);
  }
}));
