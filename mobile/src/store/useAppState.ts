import { create } from 'zustand';
import { PublicKey, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import { INDEXER_URL, WS_URL } from '../utils/config';
import {
  getAnchorProgram,
  connection,
  getRoomPda,
  getEscrowPda,
  getBetPda,
  getPlatformConfigPda,
  getReferralStatePda,
  getUserReferralPda,
  getVaultPda,
} from '../utils/solanaClient';

export const formatCashtag = (sym: string) => {
  if (!sym) return '';
  return sym.startsWith('$') ? sym : `$${sym}`;
};

export function formatPrice(price: number | string | undefined | null): string {
  if (price === undefined || price === null) return 'N/A';
  const num = typeof price === 'number' ? price : parseFloat(price);
  if (isNaN(num)) return 'N/A';
  if (num === 0) return '0.00';
  
  if (num >= 1.0) {
    let str = num.toFixed(4).replace(/0+$/, '');
    if (str.endsWith('.')) {
      str = str.slice(0, -1);
    }
    const parts = str.split('.');
    if (!parts[1]) {
      return parts[0] + '.00';
    }
    if (parts[1].length < 2) {
      return parts[0] + '.' + parts[1].padEnd(2, '0');
    }
    return str;
  }
  
  const str20 = num.toFixed(20);
  const match = str20.match(/^0\.(0*)/);
  if (!match) return num.toString();
  
  const leadingZerosCount = match[1].length;
  const precision = Math.min(leadingZerosCount + 4, 14);
  
  let formatted = num.toFixed(precision).replace(/0+$/, '');
  if (formatted.endsWith('.')) {
    formatted = formatted.slice(0, -1);
  }
  return formatted;
}

// Helper to extract clean error message
function extractErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  const msg = err.message || String(err);
  if (msg.includes('User rejected')) return 'Transaction signature rejected.';
  if (msg.includes('0x1770') || msg.includes('RoomNotExpired')) return 'Cannot settle: room active.';
  if (msg.includes('0x1771') || msg.includes('RoomExpired')) return 'Battlefield is already closed.';
  if (msg.includes('0x1772') || msg.includes('RoomAlreadySettled')) return 'Rewards already recovered.';
  if (msg.includes('0x1773') || msg.includes('RoomNotSettled')) return 'Trench is not yet settled.';
  if (msg.includes('0x1774') || msg.includes('NoWinningsToClaim')) return 'No winnings to claim for your alliance.';
  if (msg.includes('0x1775') || msg.includes('AlreadyClaimed')) return 'Winnings already claimed.';
  if (msg.includes('0x1776') || msg.includes('PlatformPaused')) return 'System is currently paused for upgrades.';
  return msg;
}

// Timeout helper
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

function withTimeout<T>(promise: Promise<T>, timeoutMs = 3000, errorMsg = 'Operation timed out'): Promise<T> {
  promise.catch(() => {});
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      const timer = setTimeout(() => reject(new Error(errorMsg)), timeoutMs);
      promise.finally(() => clearTimeout(timer));
    })
  ]);
}

export interface Bet {
  id: string;
  roomId: string;
  user: string;
  side: 'moon' | 'jeet';
  amount: number;
  claimed: boolean;
  timestamp: number;
  txSig?: string | null;
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
    icon: string;
    liquidity?: number;
    marketCap?: number;
    chainId?: string;
    pairAddress?: string;
  };
  creator: string;
  moonPool: number;
  jeetPool: number;
  expiry: number;
  status: 'active' | 'settled' | 'cancelled' | 'pending';
  winner?: 'moon' | 'jeet' | 'draw';
  createdAt: number;
  duration: number;
  openingPrice?: number;
  finalTWAP?: number;
  finalPrice?: number;
  twapFinalPrice?: number;
  lastSyncedAt?: number;
}

export interface UserProfile {
  wallet: string | null;
  balance: number;
  bets: Bet[];
  achievements: string[];
  stats: {
    totalBets: number;
    wins: number;
    losses: number;
    profit: number;
    winStreak: number;
    longestWinStreak: number;
    biggestBet: number;
  };
  trenchScore: 'S' | 'A' | 'B' | 'C' | 'D';
  username: string | null;
  avatarUrl: string | null;
  referredBy: string | null;
  referralCode: string | null;
  referralsCount: number;
  referralEarnings: string;
  referralPayouts: any[];
  unclaimedReferralRewards: number;
}

export interface ChatMessage {
  roomId: string;
  side: 'moon' | 'jeet' | 'all';
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
  wins?: number;
  losses?: number;
  totalBets?: number;
  trenchScore?: string;
  alignment?: 'moon' | 'jeet';
}

export interface Toast {
  id: string;
  type: 'loading' | 'success' | 'error' | 'info';
  message: string;
  description?: string;
  txSig?: string | null;
}

export const mapApiRoom = (apiRoom: any): Room => {
  return {
    id: apiRoom.roomPubkey,
    token: {
      address: apiRoom.originalAddress || apiRoom.tokenMint,
      name: apiRoom.tokenName || 'Unknown Token',
      symbol: apiRoom.tokenSymbol || 'UNKNWN',
      icon: apiRoom.tokenImageUrl || '💰',
      chainId: apiRoom.chainId || 'solana',
      pairAddress: apiRoom.pairAddress || undefined,
      liquidity: apiRoom.liquidityUsd ? parseFloat(apiRoom.liquidityUsd) : undefined,
      marketCap: apiRoom.fdvUsd ? parseFloat(apiRoom.fdvUsd) : undefined,
    },
    creator: apiRoom.creator || 'AnonCommander',
    moonPool: Number(apiRoom.moonPool || 0) / 1e9,
    jeetPool: Number(apiRoom.jeetPool || 0) / 1e9,
    expiry: Number(apiRoom.expiryTimestamp || 0) * 1000,
    status: apiRoom.status?.toLowerCase() === 'settled' ? 'settled' : 'active',
    winner: apiRoom.winner?.toLowerCase() as any || undefined,
    createdAt: Number(apiRoom.openingTimestamp || 0) * 1000,
    duration: apiRoom.durationMinutes || 30,
    openingPrice: apiRoom.openingPrice ? Number(apiRoom.openingPrice) / 1e12 : undefined,
    finalPrice: apiRoom.finalPrice ? Number(apiRoom.finalPrice) / 1e12 : undefined,
    twapFinalPrice: apiRoom.twapFinalPrice ? Number(apiRoom.twapFinalPrice) / 1e12 : undefined,
  };
};

function getPriorityFeePrice(settings: AppState['settings']): number {
  switch (settings.priorityFeeType) {
    case 'low': return 5000;
    case 'medium': return 50000;
    case 'high': return 250000;
    case 'turbo': return 1000000;
    case 'custom': return settings.customPriorityFee;
    default: return 50000;
  }
}

interface AppState {
  isPaused: boolean;
  rooms: Room[];
  roomsLoaded: boolean;
  user: UserProfile | null;
  leaderboard: {
    moon: LeaderboardEntry[];
    jeet: LeaderboardEntry[];
  };
  chatMessages: ChatMessage[];
  activityLog: Activity[];
  
  // Transactional & Web3 states
  wallet: any | null;
  isTransactionLoading: boolean;
  transactionError: string | null;
  sendTransaction: ((tx: any) => Promise<string>) | null;
  setSendTransaction: (fn: (tx: any) => Promise<string>) => void;
  
  // Toasts
  toasts: Toast[];
  addToast: (message: string, type: Toast['type'], description?: string, txSig?: string | null) => string;
  removeToast: (id: string) => void;
  updateToast: (id: string, updates: Partial<Omit<Toast, 'id'>>) => void;
  
  // Settings
  settings: {
    priorityFeeType: 'low' | 'medium' | 'high' | 'turbo' | 'custom';
    customPriorityFee: number; // micro-lamports
    slippage: number; // percentage
  };
  updateSettings: (updates: Partial<AppState['settings']>) => void;

  createRoom: (room: Room, isSetPrice?: boolean) => Promise<any>;
  placeBet: (roomId: string, side: 'moon' | 'jeet', amount: number, isNewRoom?: boolean) => Promise<any>;
  claimWinnings: (roomId: string) => Promise<any>;
  claimReferralRewardsOnChain: () => Promise<any>;
  setWallet: (wallet: any) => void;
  setWalletAddress: (address: string | null) => Promise<void>;
  addMessage: (msg: ChatMessage) => void;
  fetchRoomChats: (roomId: string) => Promise<void>;
  sendRoomChat: (roomId: string, side: 'moon' | 'jeet' | 'all', user: string, message: string) => Promise<void>;
  addActivity: (activity: Omit<Activity, 'id' | 'timestamp' | 'read'>) => void;
  markActivitiesRead: () => void;
  settleRoom: (roomId: string, winner: 'moon' | 'jeet' | 'draw') => void;
  updateUserStats: (betResult: 'win' | 'loss', amount: number, wonAmount?: number) => void;
  tickTimers: () => void;
  getUserBetForRoom: (roomId: string) => Bet | undefined;
  
  // Web3 state actions
  setTransactionLoading: (loading: boolean) => void;
  setTransactionError: (error: string | null) => void;
  fetchRooms: () => Promise<void>;
  fetchSingleRoom: (roomId: string) => Promise<void>;
  fetchLeaderboard: () => Promise<void>;
  fetchBalance: () => Promise<void>;
  updateProfile: (username: string | null, avatarUrl: string | null, referredBy?: string | null) => Promise<{ success: boolean; error?: string }>;
  refreshProfile: () => Promise<void>;
  
  // Real-time synchronization actions
  addRoom: (room: Room) => void;
  updateRoomPools: (roomId: string, moonPool: number, jeetPool: number) => void;
  markBetClaimed: (roomId: string, userAddress: string) => void;
  addUserBet: (bet: Bet) => void;
}

export const useAppState = create<AppState>((set, get) => ({
  isPaused: false,
  rooms: [],
  roomsLoaded: false,
  user: null,
  leaderboard: { moon: [], jeet: [] },
  chatMessages: [],
  activityLog: [],
  
  wallet: null,
  isTransactionLoading: false,
  transactionError: null,
  sendTransaction: null,
  setSendTransaction: (fn) => set({ sendTransaction: fn }),
  
  toasts: [],
  addToast: (message, type, description, txSig) => {
    const id = Math.random().toString();
    set((state) => ({
      toasts: [...state.toasts, { id, type, message, description, txSig }]
    }));
    // Auto remove non-loading toasts after 5 seconds
    if (type !== 'loading') {
      setTimeout(() => get().removeToast(id), 5000);
    }
    return id;
  },
  removeToast: (id) => set((state) => ({ toasts: state.toasts.filter((t) => t.id !== id) })),
  updateToast: (id, updates) => set((state) => ({
    toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t))
  })),
  
  settings: {
    priorityFeeType: 'medium',
    customPriorityFee: 50000,
    slippage: 1.0,
  },
  updateSettings: (updates) => set((state) => ({ settings: { ...state.settings, ...updates } })),

  setWallet: (wallet) => set({ wallet }),
  
  setWalletAddress: async (address) => {
    if (!address) {
      set({ user: null });
      return;
    }

    // Initialize baseline user profile
    const emptyProfile: UserProfile = {
      wallet: address,
      balance: 0,
      bets: [],
      achievements: [],
      stats: { totalBets: 0, wins: 0, losses: 0, profit: 0, winStreak: 0, longestWinStreak: 0, biggestBet: 0 },
      trenchScore: 'D',
      username: null,
      avatarUrl: null,
      referredBy: null,
      referralCode: null,
      referralsCount: 0,
      referralEarnings: '0',
      referralPayouts: [],
      unclaimedReferralRewards: 0,
    };
    
    set({ user: emptyProfile });
    
    // Trigger background syncs
    get().fetchBalance();
    get().refreshProfile();
    
    // Register referral on-chain if stored locally
    const program = getAnchorProgram(get().wallet);
    if (program && get().wallet?.publicKey) {
      try {
        const storedRef = null; // can check AsyncStorage later
        const userReferralPda = getUserReferralPda(get().wallet.publicKey);
        const referralAccInfo = await connection.getAccountInfo(userReferralPda);
        if (!referralAccInfo && storedRef) {
          try {
            const referrerPubkey = new PublicKey(storedRef);
            const referralStatePda = getReferralStatePda(referrerPubkey);
            const regTx = await (program.methods as any)
              .registerReferral(referrerPubkey)
              .accounts({
                userReferral: userReferralPda,
                referralState: referralStatePda,
                user: get().wallet.publicKey,
                systemProgram: SystemProgram.programId,
              })
              .rpc();
            console.log("On-chain referral registered! Tx:", regTx);
          } catch (regErr) {
            console.warn("On-chain referral auto-registration failed:", regErr);
          }
        }
      } catch (e) {
        console.warn("Failed to check referral registration status:", e);
      }
    }
  },

  addMessage: (msg) => set((state) => {
    // Keep chat messages capped to avoid rendering lag
    const filtered = state.chatMessages.filter(
      (m) => !(m.roomId === msg.roomId && m.user === msg.user && m.message === msg.message && Math.abs(m.timestamp - msg.timestamp) < 500)
    );
    const newMsgs = [...filtered, msg].sort((a, b) => a.timestamp - b.timestamp);
    if (newMsgs.length > 500) newMsgs.shift();
    return { chatMessages: newMsgs };
  }),

  fetchRoomChats: async (roomId) => {
    try {
      const res = await fetchWithTimeout(`${INDEXER_URL}/api/rooms/${roomId}/chats`, {}, 3000);
      const json = await res.json();
      if (json.success && Array.isArray(json.data)) {
        json.data.forEach((c: any) => {
          get().addMessage({
            roomId,
            side: c.side || 'all',
            user: c.userPubkey,
            message: c.message,
            timestamp: new Date(c.createdAt).getTime(),
          });
        });
      }
    } catch (err) {
      console.warn("Failed to fetch chats for room", roomId, err);
    }
  },

  sendRoomChat: async (roomId, side, user, message) => {
    try {
      await fetch(`${INDEXER_URL}/api/rooms/${roomId}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPubkey: user, side, message }),
      });
    } catch (err) {
      console.error("Failed to send chat message:", err);
      get().addToast("COMMUNICATION LINE JAMMED", "error", "Failed to transmit voice log.");
    }
  },

  addActivity: (act) => set((state) => {
    const newAct: Activity = {
      ...act,
      id: Math.random().toString(),
      timestamp: Date.now(),
      read: false,
    };
    return { activityLog: [newAct, ...state.activityLog].slice(0, 100) };
  }),

  markActivitiesRead: () => set((state) => ({
    activityLog: state.activityLog.map((a) => ({ ...a, read: true }))
  })),

  settleRoom: (roomId, winner) => set((state) => ({
    rooms: state.rooms.map((r) => r.id === roomId ? { ...r, status: 'settled', winner } : r)
  })),

  updateUserStats: (betResult, amount, wonAmount) => set((state) => {
    if (!state.user) return {};
    const stats = { ...state.user.stats };
    stats.totalBets += 1;
    if (betResult === 'win') {
      stats.wins += 1;
      stats.winStreak += 1;
      stats.longestWinStreak = Math.max(stats.winStreak, stats.longestWinStreak);
      stats.profit += (wonAmount || 0) - amount;
    } else {
      stats.losses += 1;
      stats.winStreak = 0;
      stats.profit -= amount;
    }
    stats.biggestBet = Math.max(amount, stats.biggestBet);
    return {
      user: { ...state.user, stats }
    };
  }),

  tickTimers: () => {
    // Ticks countdowns and updates status of expired rooms
    const now = Date.now();
    let changed = false;
    const ticked = get().rooms.map((room) => {
      if (room.status === 'active' && room.expiry <= now) {
        changed = true;
        return { ...room, status: 'pending' as const };
      }
      return room;
    });
    if (changed) {
      set({ rooms: ticked });
    }
  },

  getUserBetForRoom: (roomId) => {
    const { user } = get();
    if (!user) return undefined;
    return user.bets.find((b) => b.roomId === roomId);
  },

  setTransactionLoading: (loading) => set({ isTransactionLoading: loading }),
  setTransactionError: (error) => set({ transactionError: error }),

  fetchRooms: async () => {
    try {
      const res = await fetchWithTimeout(`${INDEXER_URL}/api/rooms?status=all&limit=50`, {}, 3000);
      const json = await res.json();
      if (json.success && json.data) {
        const mapped = json.data.map(mapApiRoom);
        const currentRooms = get().rooms;
        
        // Merging logic
        const mergedRooms = mapped.map((newRoom: Room) => {
          const current = currentRooms.find((r) => r.id === newRoom.id);
          if (!current) return newRoom;
          // Merge price boundaries and pools safely
          return {
            ...current,
            ...newRoom,
            moonPool: Math.max(current.moonPool, newRoom.moonPool),
            jeetPool: Math.max(current.jeetPool, newRoom.jeetPool),
          };
        });
        
        const missingRooms = currentRooms.filter((cr) => !mapped.some((mr: Room) => mr.id === cr.id));
        set({ rooms: [...mergedRooms, ...missingRooms], roomsLoaded: true });

        // Hydrate active rooms on-chain in the background
        (async () => {
          try {
            const activeRooms = mapped.filter((r: Room) => r.status === 'active');
            if (activeRooms.length === 0) return;

            const program = getAnchorProgram(null as any);
            const pubkeys = activeRooms.map((r: Room) => new PublicKey(r.id));
            const onChainRooms = await withTimeout(
              (program.account as any).room.fetchMultiple(pubkeys),
              3500,
              'On-chain room fetch timed out'
            ) as any[];

            const hydrated = get().rooms.map((room: Room) => {
              const idx = activeRooms.findIndex((ar: Room) => ar.id === room.id);
              if (idx === -1 || !onChainRooms[idx]) return room;
              const onChain = onChainRooms[idx];
              const statusStr = Object.keys(onChain.status)[0].toLowerCase() as 'active' | 'settled';
              let winnerStr: 'moon' | 'jeet' | 'draw' | undefined = undefined;
              if (onChain.winner) {
                const wKey = Object.keys(onChain.winner)[0].toLowerCase();
                if (wKey === 'moon' || wKey === 'jeet' || wKey === 'draw') {
                  winnerStr = wKey;
                }
              }
              return {
                ...room,
                moonPool: onChain.moonPool.toNumber() / 1e9,
                jeetPool: onChain.jeetPool.toNumber() / 1e9,
                status: statusStr,
                winner: winnerStr,
                expiry: onChain.expiryTimestamp.toNumber() * 1000,
                duration: onChain.durationMinutes,
                lastSyncedAt: Date.now(),
              };
            });
            set({ rooms: hydrated });
          } catch (e) {
            console.warn('Could not hydrate on-chain room state in background', e);
          }
        })();
      }
    } catch (err) {
      console.error('Failed to fetch rooms from indexer:', err);
    }

    // Fetch platform configurations to check pauses
    try {
      const program = getAnchorProgram(null as any);
      const configPda = getPlatformConfigPda();
      const config: any = await (program.account as any).platformConfig.fetch(configPda);
      if (config) {
        set({ isPaused: !!config.isPaused });
      }
    } catch (e) {
      // Config pda account not loaded
    }
  },

  fetchSingleRoom: async (roomId) => {
    try {
      const res = await fetchWithTimeout(`${INDEXER_URL}/api/rooms/${roomId}`, {}, 3000);
      const json = await res.json();
      if (json.success && json.data) {
        const roomObj = mapApiRoom(json.data);
        set((state) => ({
          rooms: state.rooms.map((r) => r.id === roomId ? roomObj : r)
        }));
      }
    } catch (err) {
      console.warn("Failed to fetch details for single room", roomId, err);
    }
  },

  fetchLeaderboard: async () => {
    try {
      const res = await fetchWithTimeout(`${INDEXER_URL}/api/leaderboard?sortBy=profit&limit=50`, {}, 3000);
      const json = await res.json();
      if (json.success && json.data) {
        const mapped = json.data.map((u: any) => ({
          address: u.userPubkey,
          name: u.username || `CMD_${u.userPubkey.slice(0, 4).toUpperCase()}`,
          profit: Number(u.profit || 0) / 1e9,
          winRate: u.winRate || 0,
          elo: u.elo || 1200,
          wins: u.wins || 0,
          losses: u.losses || 0,
          totalBets: u.totalBets || 0,
          trenchScore: u.trenchScore || 'D',
          alignment: u.alignment || 'moon',
        }));
        
        const moon = mapped.filter((u: any) => u.alignment === 'moon');
        const jeet = mapped.filter((u: any) => u.alignment === 'jeet');
        set({ leaderboard: { moon, jeet } });
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
        set({ user: { ...user, balance: solBalance } });
      }
    } catch (err) {
      console.error('Failed to fetch wallet SOL balance:', err);
    }
  },

  updateProfile: async (username, avatarUrl, referredBy) => {
    const { user } = get();
    if (!user || !user.wallet) return { success: false, error: 'No active profile connected' };
    try {
      const indexerApi = INDEXER_URL;
      const res = await fetch(`${indexerApi}/api/profile/${user.wallet}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, avatarUrl, referredBy }),
      });
      const json = await res.json();
      if (!json.success) {
        return { success: false, error: json.error || 'Server rejected changes' };
      }
      await get().refreshProfile();
      return { success: true };
    } catch (err: any) {
      console.error('Failed to update profile:', err);
      return { success: false, error: err.message || 'Internal server error' };
    }
  },

  refreshProfile: async () => {
    const { user } = get();
    if (!user || !user.wallet) return;
    const address = user.wallet;

    let unclaimedReferralRewards = 0;
    try {
      const program = getAnchorProgram(null as any);
      const referralStatePda = getReferralStatePda(new PublicKey(address));
      const account = await (program.account as any).referralState.fetch(referralStatePda);
      if (account) {
        const unclaimed = (account.unclaimedRewards as any).toNumber();
        const claimed = (account.claimedRewards as any).toNumber();
        unclaimedReferralRewards = Math.max(0, (unclaimed - claimed) / 1e9);
      }
    } catch (e) {
      // Account not initialized
    }

    try {
      const indexerApi = INDEXER_URL;
      const res = await fetchWithTimeout(`${indexerApi}/api/profile/${address}`, {}, 3000);
      const json = await res.json();
      if (json.success && json.data) {
        const stats = {
          totalBets: json.data.totalBets || 0,
          wins: json.data.wins || 0,
          losses: json.data.losses || 0,
          profit: Number(json.data.profit || 0) / 1e9,
          winStreak: json.data.winStreak || 0,
          longestWinStreak: json.data.longestWinStreak || 0,
          biggestBet: Number(json.data.biggestBet || 0) / 1e9,
        };
        const bets = (json.data.bets || []).map((b: any) => ({
          id: b.id,
          roomId: b.roomPubkey,
          user: b.userPubkey,
          side: b.side,
          amount: Number(b.amount) / 1e9,
          claimed: b.claimed,
          timestamp: new Date(b.createdAt).getTime(),
          txSig: b.txSig || null,
        }));
        
        set({
          user: {
            ...user,
            bets,
            stats,
            trenchScore: json.data.trenchScore || 'D',
            username: json.data.username || null,
            avatarUrl: json.data.avatarUrl || null,
            referredBy: json.data.referredBy || null,
            referralCode: json.data.referralCode || null,
            referralsCount: json.data.referralsCount || 0,
            referralEarnings: json.data.referralEarnings || '0',
            referralPayouts: json.data.referralPayouts || [],
            unclaimedReferralRewards,
          }
        });
      }
    } catch (err) {
      console.warn('Failed to refresh profile from indexer:', err);
    }
  },

  createRoom: async (room, isSetPrice) => {
    const { wallet, setTransactionLoading, setTransactionError, sendTransaction } = get();
    if (!wallet || !wallet.publicKey) {
      get().addToast("WALLET NOT ENLISTED", "error", "Please enlist your wallet command helmet first!");
      return;
    }
    
    setTransactionLoading(true);
    setTransactionError(null);
    
    const toastId = get().addToast(
      'DEPLOYING ARENA',
      'loading',
      `Staging battlefield room for ${room.token.symbol}...`
    );
    
    try {
      const tokenMintStr = room.token.address;
      let onChainPubkeyStr = tokenMintStr;
      let livePriceUsd: string | undefined = room.openingPrice ? String(room.openingPrice) : undefined;
      
      const indexerApi = INDEXER_URL;
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
          if (!isSetPrice) {
            livePriceUsd = valData.priceUsd;
          }
        }
      } catch (validationErr: any) {
        if (validationErr.message && validationErr.message.includes('Validation Failed')) {
          throw validationErr;
        }
        console.warn('Validation API failed, proceeding with fallback parsing...', validationErr);
      }

      const program = getAnchorProgram(wallet);
      const tokenMintPubkey = new PublicKey(onChainPubkeyStr);
      
      let roomPda: PublicKey | null = null;
      let chosenNonce = 0;
      let alreadyExists = false;

      for (let n = 0; n < 256; n++) {
        const currentPda = getRoomPda(tokenMintPubkey, wallet.publicKey, n);
        const accountInfo = await connection.getAccountInfo(currentPda);

        if (accountInfo === null) {
          roomPda = currentPda;
          chosenNonce = n;
          break;
        }

        try {
          const roomData: any = await (program.account as any).room.fetch(currentPda);
          const now = Math.floor(Date.now() / 1000);
          const isExpired = now >= roomData.expiryTimestamp.toNumber();

          if (!isExpired && roomData.status.active !== undefined) {
            continue;
          }
        } catch (fetchErr) {
          console.warn(`Failed to fetch room account at nonce ${n}, assuming expired/unusable:`, fetchErr);
        }
      }

      if (!roomPda) {
        throw new Error("Unable to resolve a clean room PDA (maximum nonces exhausted).");
      }

      const escrowPda = getEscrowPda(roomPda);
      const configPda = getPlatformConfigPda();
      const priceFeed = SystemProgram.programId;

      let openingPriceParam = null;
      if (livePriceUsd) {
        const priceVal = parseFloat(livePriceUsd);
        if (isFinite(priceVal) && priceVal > 0) {
          openingPriceParam = new BN(Math.round(priceVal * 1e12));
        }
      }

      const priorityFeeValue = getPriorityFeePrice(get().settings);

      try {
        await fetch(`${INDEXER_URL}/api/rooms/cache-meta`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            mint: room.token.address,
            name: room.token.name,
            symbol: room.token.symbol,
            imageUrl: room.token.icon,
            chainId: room.token.chainId,
            priceUsd: livePriceUsd
          })
        });
      } catch (err) {
        console.warn("Failed to cache token meta before creation", err);
      }

      const txObj = await (program.methods as any)
        .createRoom(
          tokenMintPubkey,
          room.token.name || 'Unknown Token',
          room.duration,
          null,
          openingPriceParam,
          chosenNonce
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
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 250_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeValue })
        ])
        .transaction();
        
      if (!sendTransaction) {
        throw new Error("No transaction sender registered. Connect your wallet command helmet first.");
      }
      const tx = await sendTransaction(txObj);
      console.log("Room created successfully on-chain! Tx:", tx);
      
      let onChainExpiry = room.expiry;
      let onChainCreatedAt = room.createdAt;
      let onChainOpeningPrice = room.openingPrice;
      try {
        const onChain = await (program.account as any).room.fetch(roomPda);
        if (onChain) {
          onChainExpiry = onChain.expiryTimestamp.toNumber() * 1000;
          onChainCreatedAt = onChain.openingTimestamp.toNumber() * 1000;
          onChainOpeningPrice = onChain.openingPrice.toNumber() === 0 ? undefined : onChain.openingPrice.toNumber() / 1e12;
        }
      } catch (fetchErr) {
        if (livePriceUsd) {
          onChainOpeningPrice = parseFloat(livePriceUsd);
        }
      }

      const optimisticRoom = { 
        ...room, 
        id: roomPda.toBase58(),
        expiry: onChainExpiry,
        createdAt: onChainCreatedAt,
        openingPrice: onChainOpeningPrice,
        status: 'active' as const,
      };
      set((state) => ({ rooms: [optimisticRoom, ...state.rooms] }));
      get().fetchRooms();

      get().updateToast(toastId, {
        type: 'success',
        message: 'ARENA STAGED SUCCESSFULLY',
        description: `Battlefield room deployed for ${room.token.symbol}.`,
        txSig: tx
      });

      return {
        tx,
        roomPda: roomPda.toBase58(),
        alreadyExists: false
      };
    } catch (err: any) {
      console.error("Failed to create room on-chain:", err);
      setTransactionError(err.message || String(err));
      const cleanErr = extractErrorMessage(err);
      get().updateToast(toastId, {
        type: 'error',
        message: 'DEPLOY MISSION FAILED',
        description: cleanErr
      });
      throw err;
    } finally {
      setTransactionLoading(false);
    }
  },

  placeBet: async (roomId, side, amount, isNewRoom) => {
    const { wallet, setTransactionLoading, setTransactionError, sendTransaction } = get();
    if (!wallet || !wallet.publicKey) {
      get().addToast("WALLET NOT ENLISTED", "error", "Please enlist your wallet command helmet first!");
      return;
    }
    
    setTransactionLoading(true);
    setTransactionError(null);
    
    const roomObj = get().rooms.find((r) => r.id === roomId);
    const assetSym = roomObj?.token?.symbol || 'UNKNOWN';

    const toastId = get().addToast(
      'CHARGING ENEMY LINES',
      'loading',
      `Deploying ${amount} SOL on ${side.toUpperCase()} for ${assetSym}...`
    );

    try {
      const program = getAnchorProgram(wallet);
      const roomPda = new PublicKey(roomId);
      const escrowPda = getEscrowPda(roomPda);
      const betPda = getBetPda(roomPda, wallet.publicKey, side);
      const configPda = getPlatformConfigPda();
      
      const priorityFeeValue = getPriorityFeePrice(get().settings);

      const txObj = await (program.methods as any)
        .placeBet(
          side === 'moon' ? { moon: {} } : { jeet: {} },
          new BN(amount * 1e9)
        )
        .accounts({
          room: roomPda,
          escrow: escrowPda,
          bet: betPda,
          user: wallet.publicKey,
          config: configPda,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeValue })
        ])
        .transaction();
        
      if (!sendTransaction) {
        throw new Error("No transaction sender registered. Connect your wallet command helmet first.");
      }
      const tx = await sendTransaction(txObj);
      console.log("Bet placed successfully on-chain! Tx:", tx);
      
      const currentUser = get().user;
      if (currentUser && wallet.publicKey) {
        get().addUserBet({
          id: 'opt-' + Date.now() + Math.random(),
          roomId: roomId,
          user: wallet.publicKey.toBase58(),
          side: side,
          amount: amount,
          claimed: false,
          timestamp: Date.now(),
          txSig: tx
        });
      }
      
      get().addActivity({
        type: 'bet',
        title: `DEPLOYED ${amount} SOL ON ${side.toUpperCase()}`,
        message: `You stacked ${amount} SOL on ${side.toUpperCase()} in room ${roomId}.`,
        link: roomId
      });

      await get().fetchBalance();
      
      get().updateToast(toastId, {
        type: 'success',
        message: 'BATTLE POSITION SECURED',
        description: `Staked ${amount} SOL on ${side.toUpperCase()}.`,
        txSig: tx
      });

      return tx;
    } catch (err: any) {
      console.error("Failed to place bet on-chain:", err);
      setTransactionError(err.message || String(err));
      const cleanErr = extractErrorMessage(err);
      get().updateToast(toastId, {
        type: 'error',
        message: 'BATTLE ORDER FLUNKED',
        description: cleanErr
      });
      throw err;
    } finally {
      setTransactionLoading(false);
    }
  },

  claimWinnings: async (roomId) => {
    const { wallet, setTransactionLoading, setTransactionError, sendTransaction } = get();
    if (!wallet || !wallet.publicKey) {
      get().addToast("WALLET NOT ENLISTED", "error", "Please enlist your wallet command helmet first!");
      return;
    }
    
    setTransactionLoading(true);
    setTransactionError(null);
    
    const toastId = get().addToast(
      'RECOVERING SPOILS',
      'loading',
      `Claiming winnings for room ${roomId}...`
    );

    try {
      const roomPda = new PublicKey(roomId);
      const escrowPda = getEscrowPda(roomPda);
      const configPda = getPlatformConfigPda();
      
      const room = get().rooms.find((r) => r.id === roomId);
      if (!room || !room.winner) {
        throw new Error("Target prediction room is not settled or resolved.");
      }
      
      const betPda = getBetPda(roomPda, wallet.publicKey, room.winner as 'moon' | 'jeet');
      const program = getAnchorProgram(wallet);
      const priorityFeeValue = getPriorityFeePrice(get().settings);

      const txObj = await (program.methods as any)
        .claimWinnings()
        .accounts({
          room: roomPda,
          config: configPda,
          escrow: escrowPda,
          bet: betPda,
          user: wallet.publicKey,
          payer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeValue })
        ])
        .transaction();

      if (!sendTransaction) {
        throw new Error("No transaction sender registered.");
      }
      const tx = await sendTransaction(txObj);
      console.log("Winnings claimed successfully! Tx:", tx);
      
      get().markBetClaimed(roomId, wallet.publicKey.toBase58());
      get().addActivity({
        type: 'win',
        title: 'SPOILS RECOVERED SUCCESSFULLY',
        message: `Claimed winnings for room ${roomId}.`,
        link: roomId
      });

      await get().fetchBalance();
      await get().refreshProfile();

      get().updateToast(toastId, {
        type: 'success',
        message: 'RECOVERY MISSION ACCOMPLISHED',
        description: 'Your wallet has secured the spoils.',
        txSig: tx
      });

      return tx;
    } catch (err: any) {
      console.error("Failed to claim winnings on-chain:", err);
      setTransactionError(err.message || String(err));
      const cleanErr = extractErrorMessage(err);
      get().updateToast(toastId, {
        type: 'error',
        message: 'RECOVERY MISSION BLOWN',
        description: cleanErr
      });
      throw err;
    } finally {
      setTransactionLoading(false);
    }
  },

  claimReferralRewardsOnChain: async () => {
    const { wallet, setTransactionLoading, setTransactionError, sendTransaction } = get();
    if (!wallet || !wallet.publicKey) {
      get().addToast("WALLET NOT ENLISTED", "error", "Please enlist your wallet command helmet first!");
      return;
    }
    
    setTransactionLoading(true);
    setTransactionError(null);
    
    const toastId = get().addToast(
      'CLAIMING REFERRAL REWARDS',
      'loading',
      'Retrieving commission spoils from referral vault...'
    );

    try {
      const referralStatePda = getReferralStatePda(wallet.publicKey);
      const vaultPda = getVaultPda();
      const program = getAnchorProgram(wallet);
      const priorityFeeValue = getPriorityFeePrice(get().settings);

      const txObj = await (program.methods as any)
        .claimReferralRewards()
        .accounts({
          referralState: referralStatePda,
          vault: vaultPda,
          referrer: wallet.publicKey,
          systemProgram: SystemProgram.programId,
        })
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 150_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeValue })
        ])
        .transaction();

      if (!sendTransaction) {
        throw new Error("No transaction sender registered.");
      }
      const tx = await sendTransaction(txObj);
      console.log("Referral rewards claimed successfully! Tx:", tx);
      
      get().addActivity({
        type: 'win',
        title: `REFERRAL REWARDS CLAIMED`,
        message: `Successfully recovered referral commission spoils.`,
      });

      await get().fetchBalance();
      await get().refreshProfile();

      get().updateToast(toastId, {
        type: 'success',
        message: 'COMMISSION SECURED',
        description: 'Referral commission spoils successfully transferred.',
        txSig: tx
      });

      return tx;
    } catch (err: any) {
      console.error("Failed to claim referral rewards on-chain:", err);
      setTransactionError(err.message || String(err));
      const cleanErr = extractErrorMessage(err);
      get().updateToast(toastId, {
        type: 'error',
        message: 'COMMISSION RETRIEVAL FAILED',
        description: cleanErr
      });
      throw err;
    } finally {
      setTransactionLoading(false);
    }
  },

  addRoom: (room) => set((state) => {
    const exists = state.rooms.some((r) => r.id === room.id);
    if (exists) {
      return {
        rooms: state.rooms.map((r) => r.id === room.id ? { ...r, ...room } : r)
      };
    }
    return { rooms: [room, ...state.rooms] };
  }),

  updateRoomPools: (roomId, moonPool, jeetPool) => set((state) => ({
    rooms: state.rooms.map((r) => r.id === roomId ? { ...r, moonPool, jeetPool } : r)
  })),

  markBetClaimed: (roomId, userAddress) => set((state) => {
    if (!state.user) return {};
    const updatedBets = state.user.bets.map((b) =>
      b.roomId === roomId && b.user === userAddress ? { ...b, claimed: true } : b
    );
    return {
      user: { ...state.user, bets: updatedBets }
    };
  }),

  addUserBet: (bet) => set((state) => {
    if (!state.user) return {};
    const exists = state.user.bets.some((b) => b.id === bet.id || (b.roomId === bet.roomId && b.side === bet.side && b.amount === bet.amount && Math.abs(b.timestamp - bet.timestamp) < 5000));
    if (exists) return {};
    return {
      user: {
        ...state.user,
        bets: [bet, ...state.user.bets]
      }
    };
  }),
}));
