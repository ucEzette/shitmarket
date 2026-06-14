import { INDEXER_URL } from "../utils/config";
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { PublicKey, SystemProgram, ComputeBudgetProgram } from '@solana/web3.js';
import { BN } from '@coral-xyz/anchor';
import {
  getAnchorProgram,
  connection,
  getRoomPda,
  getEscrowPda,
  getBetPda,
  getPlatformConfigPda,
  getVaultPda,
  getUserReferralPda,
  getReferralStatePda,
} from '@/utils/solanaClient';
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

export interface Bet {
  id: string;
  roomId: string;
  user: string; // wallet address
  side: 'moon' | 'jeet';
  amount: number; // SOL
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
  status: 'active' | 'settled' | 'cancelled' | 'pending';
  winner?: 'moon' | 'jeet' | 'draw';
  createdAt: number;
  duration: number; // minutes
  openingPrice?: number;
  finalTWAP?: number;
  finalPrice?: number;
  twapFinalPrice?: number;
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
  username: string | null;
  avatarUrl: string | null;
  referredBy: string | null;
  referralCode: string | null;
  referralsCount: number;
  referralEarnings: string;
  referralPayouts: any[];
  unclaimedReferralRewards: number; // SOL
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

export interface AlertData {
  message: string;
  type?: 'error' | 'success' | 'warning' | 'info';
  title?: string;
  onConfirm?: () => void;
  anchorRect?: { top: number; left: number; width: number; height: number };
}

export interface AppState {
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
  fullDegenMode: boolean;
  shareCardData: {
    roomId: string;
    side: 'moon' | 'jeet';
    tokenSymbol: string;
    duration: number;
    amount: number;
    isNewRoom?: boolean;
    onCloseRedirectUrl?: string;
    expiry?: number;
    openingPrice?: number;
  } | null;
  setShareCardData: (data: any) => void;
  
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
  
  // Custom Alerts
  customAlert: AlertData | null;
  showAlert: (message: string, type?: AlertData['type'], title?: string, onConfirm?: () => void, anchorRect?: AlertData['anchorRect']) => void;
  hideAlert: () => void;
  
  // Settings
  settings: {
    priorityFeeType: 'low' | 'medium' | 'high' | 'turbo' | 'custom';
    customPriorityFee: number; // micro-lamports
    slippage: number; // percentage
  };
  updateSettings: (updates: Partial<AppState['settings']>) => void;

  createRoom: (room: Room, isSetPrice?: boolean) => Promise<any>;
  placeBet: (roomId: string, side: 'moon' | 'jeet', amount: number, isNewRoom?: boolean, onCloseRedirectUrl?: string) => Promise<any>;
  claimWinnings: (roomId: string) => Promise<any>;
  claimReferralRewardsOnChain: () => Promise<any>;
  connectWallet: () => void;
  disconnectWallet: () => void;
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
  setFullDegenMode: (val: boolean) => void;
  getUserBetForRoom: (roomId: string) => Bet | undefined;
  updateLeaderboard: () => void;
  recalcTrenchScore: () => void;
  parlayBet: (legs: any[], amount: number) => void;
  
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
  // Prevent unhandled promise rejection if the promise rejects after the timeout
  promise.catch(() => {});
  
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
      pairAddress: apiRoom.pairAddress || '',
    },
    creator: apiRoom.creator || 'Unknown',
    moonPool: Number(apiRoom.moonPool || 0) / 1e9,
    jeetPool: Number(apiRoom.jeetPool || 0) / 1e9,
    expiry: new Date(apiRoom.expiry).getTime(),
    status: apiRoom.status as 'active' | 'settled' | 'cancelled' | 'pending',
    winner: apiRoom.winner || undefined,
    createdAt: new Date(apiRoom.createdAt).getTime(),
    duration: Number(apiRoom.duration || 30),
    openingPrice: (apiRoom.openingPrice && Number(apiRoom.openingPrice) !== 0) ? Number(apiRoom.openingPrice) / 1e12 : undefined,
    finalTWAP: apiRoom.finalPrice ? Number(apiRoom.finalPrice) / 1e12 : undefined,
    finalPrice: apiRoom.finalPrice ? Number(apiRoom.finalPrice) / 1e12 : undefined,
    twapFinalPrice: apiRoom.twapFinalPrice ? Number(apiRoom.twapFinalPrice) / 1e12 : undefined,
  };
};

function isRoomEqual(a: Room, b: Room): boolean {
  if (a.id !== b.id) return false;
  if (a.status !== b.status) return false;
  if (a.winner !== b.winner) return false;
  if (a.moonPool !== b.moonPool) return false;
  if (a.jeetPool !== b.jeetPool) return false;
  if (a.expiry !== b.expiry) return false;
  if (a.openingPrice !== b.openingPrice) return false;
  if (a.finalPrice !== b.finalPrice) return false;
  if (a.twapFinalPrice !== b.twapFinalPrice) return false;
  if (a.token.address !== b.token.address) return false;
  if (a.token.name !== b.token.name) return false;
  if (a.token.symbol !== b.token.symbol) return false;
  if (a.token.pairAddress !== b.token.pairAddress) return false;
  if (a.token.chainId !== b.token.chainId) return false;
  if (a.token.icon !== b.token.icon) return false;
  return true;
}

function mergeRooms(currentRoom: Room | undefined, indexerRoom: Room | null, onChainRoom: Room | null): Room | null {
  if (!indexerRoom && !onChainRoom) return currentRoom || null;
  
  const primary = onChainRoom || indexerRoom!;
  const secondary = onChainRoom ? indexerRoom : null;
  const base = currentRoom || primary;

  const token = {
    address: base.token.address || primary.token.address || secondary?.token?.address || '',
    name: base.token.name && base.token.name !== 'Unknown Token' ? base.token.name : (primary.token.name !== 'Unknown Token' ? primary.token.name : secondary?.token?.name || 'Unknown Token'),
    symbol: base.token.symbol && base.token.symbol !== 'UNKNWN' ? base.token.symbol : (primary.token.symbol !== 'UNKNWN' ? primary.token.symbol : secondary?.token?.symbol || 'UNKNWN'),
    icon: base.token.icon && base.token.icon !== '💰' ? base.token.icon : (primary.token.icon !== '💰' ? primary.token.icon : secondary?.token?.icon || '💰'),
    chainId: primary.token.chainId || secondary?.token?.chainId || base.token.chainId || 'solana',
    pairAddress: primary.token.pairAddress || secondary?.token?.pairAddress || base.token.pairAddress || '',
  };

  let status = base.status;
  if (onChainRoom) {
    status = onChainRoom.status;
  } else if (indexerRoom) {
    status = indexerRoom.status;
  }
  
  if (base.status === 'settled' || currentRoom?.status === 'settled') {
    status = 'settled';
  }

  let winner = base.winner;
  if (onChainRoom?.winner) {
    winner = onChainRoom.winner;
  } else if (indexerRoom?.winner) {
    winner = indexerRoom.winner;
  }
  
  if (currentRoom?.winner) {
    winner = currentRoom.winner;
  }

  const moonPool = onChainRoom ? onChainRoom.moonPool : (indexerRoom ? indexerRoom.moonPool : base.moonPool);
  const jeetPool = onChainRoom ? onChainRoom.jeetPool : (indexerRoom ? indexerRoom.jeetPool : base.jeetPool);

  const openingPrice = onChainRoom?.openingPrice ?? indexerRoom?.openingPrice ?? base.openingPrice;
  const finalPrice = onChainRoom?.finalPrice ?? indexerRoom?.finalPrice ?? base.finalPrice;
  const twapFinalPrice = onChainRoom?.twapFinalPrice ?? indexerRoom?.twapFinalPrice ?? base.twapFinalPrice;

  return {
    ...base,
    token,
    creator: onChainRoom?.creator || indexerRoom?.creator || base.creator,
    moonPool,
    jeetPool,
    expiry: onChainRoom?.expiry || indexerRoom?.expiry || base.expiry,
    status,
    winner,
    createdAt: onChainRoom?.createdAt || indexerRoom?.createdAt || base.createdAt,
    duration: onChainRoom?.duration || indexerRoom?.duration || base.duration,
    openingPrice,
    finalPrice,
    twapFinalPrice,
  };
}



function extractErrorMessage(err: any): string {
  if (!err) return 'Unknown error';
  if (typeof err === 'string') return err;
  if (err.message && typeof err.message === 'string') return err.message;
  if (err.error && typeof err.error.message === 'string') return err.error.message;
  if (Array.isArray(err.logs) && err.logs.length > 0) {
    for (const log of err.logs) {
      if (log.includes('AnchorError') || log.includes('Error Message:')) {
        return log.replace('Program log: ', '');
      }
    }
    return `Logs: ${err.logs.slice(-3).join(' | ')}`;
  }
  try {
    const cleanObj: any = {};
    if (err.code !== undefined) cleanObj.code = err.code;
    if (err.type !== undefined) cleanObj.type = err.type;
    if (err.InstructionError !== undefined) cleanObj.InstructionError = err.InstructionError;
    if (err.err !== undefined) cleanObj.err = err.err;
    if (Object.keys(cleanObj).length > 0) return JSON.stringify(cleanObj);
    const str = JSON.stringify(err);
    if (str && str !== '{}') return str.length > 200 ? str.slice(0, 200) + '...' : str;
  } catch {}
  return String(err);
}

function getPriorityFeePrice(settings: any): number {
  if (!settings) return 2_000_000;
  switch (settings.priorityFeeType) {
    case 'low': return 50_000;
    case 'medium': return 500_000;
    case 'high': return 2_000_000;
    case 'turbo': return 10_000_000;
    case 'custom': return Number(settings.customPriorityFee || 2_000_000);
    default: return 2_000_000;
  }
}

function handleRpcError(actionName: string, err: any) {
  const errMsg = extractErrorMessage(err);
  const lowerMsg = errMsg.toLowerCase();
  const title = `${actionName.toUpperCase()} FAILED`;
  const desc = lowerMsg.includes('not confirmed') || lowerMsg.includes('timeout')
    ? 'The Solana network is taking too long to confirm your transaction. It might have still succeeded! Please wait a few moments, refresh, and verify your ammo balance.'
    : errMsg;
  
  useAppState.getState().addToast(title, 'error', desc);
}

export const useAppState = create<AppState>()(
  persist(
    (set, get) => ({
  rooms: [],
  roomsLoaded: false,
  isPaused: false,
  user: null,
  leaderboard: {
    moon: [],
    jeet: []
  },
  chatMessages: [],
  activityLog: [],
  fullDegenMode: false,
  shareCardData: null,
  setShareCardData: (data) => set({ shareCardData: data }),


  wallet: null,
  isTransactionLoading: false,
  transactionError: null,
  sendTransaction: null,

  // Settings initial state with SSR check
  settings: (() => {
    let savedSettings: any = {};
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem('sm_settings');
        if (stored) savedSettings = JSON.parse(stored);
      } catch (e) {
        console.warn('Failed to parse saved settings', e);
      }
    }
    return {
      priorityFeeType: savedSettings.priorityFeeType || 'high',
      customPriorityFee: savedSettings.customPriorityFee || 2_000_000,
      slippage: savedSettings.slippage || 1.0,
    };
  })(),

  updateSettings: (updates) => {
    set((state) => {
      const newSettings = { ...state.settings, ...updates };
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem('sm_settings', JSON.stringify(newSettings));
        } catch (e) {
          console.warn('Failed to save settings to localStorage', e);
        }
      }
      return { settings: newSettings };
    });
  },

  toasts: [],
  addToast: (message, type, description = '', txSig = null) => {
    const id = 'toast-' + Date.now() + Math.random().toString(36).substr(2, 9);
    set((state) => ({
      toasts: [...state.toasts, { id, message, type, description, txSig }]
    }));
    // Auto-remove standard toasts after 6s (loading toasts persist until updated)
    if (type !== 'loading') {
      setTimeout(() => {
        get().removeToast(id);
      }, 6000);
    }
    return id;
  },

  removeToast: (id) => {
    set((state) => ({
      toasts: state.toasts.filter((t) => t.id !== id)
    }));
  },

  customAlert: null,
  showAlert: (message, type = 'error', title = '', onConfirm = undefined, anchorRect = undefined) => {
    set({
      customAlert: { message, type, title, onConfirm, anchorRect }
    });
  },
  hideAlert: () => {
    const currentAlert = get().customAlert;
    set({ customAlert: null });
    if (currentAlert?.onConfirm) {
      currentAlert.onConfirm();
    }
  },

  updateToast: (id, updates) => {
    set((state) => ({
      toasts: state.toasts.map((t) => (t.id === id ? { ...t, ...updates } : t))
    }));
    // If changed to a non-loading state, auto-remove after 6s
    if (updates.type && updates.type !== 'loading') {
      setTimeout(() => {
        get().removeToast(id);
      }, 6000);
    }
  },

  addActivity: (activity) => {
    const userWallet = get().wallet;
    
    // Optimistically update UI instantly
    set((state) => ({
      activityLog: [
        { ...activity, id: Date.now().toString() + Math.random(), timestamp: Date.now(), read: false },
        ...state.activityLog
      ]
    }));

    const address = typeof userWallet === 'string'
      ? userWallet
      : userWallet?.publicKey?.toBase58() || get().user?.wallet;

    if (address) {
      // Async sync to the backend
      fetch(`${INDEXER_URL}/api/profile/activities`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPubkey: address,
          type: activity.type,
          title: activity.title,
          message: activity.message,
          link: activity.link,
        })
      }).catch(err => console.error("Failed to sync activity to backend:", err));
    }
  },

  markActivitiesRead: () => {
    const userWallet = get().wallet;
    
    // Optimistically update
    set((state) => ({
      activityLog: state.activityLog.map(a => ({ ...a, read: true }))
    }));

    const address = typeof userWallet === 'string'
      ? userWallet
      : userWallet?.publicKey?.toBase58() || get().user?.wallet;

    if (address) {
      fetch(`${INDEXER_URL}/api/profile/activities/read`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userPubkey: address })
      }).catch(err => console.error("Failed to mark activities read on backend:", err));
    }
  },

  setWallet: (wallet: any) => {
    set({ wallet });
  },

  setSendTransaction: (fn: (tx: any) => Promise<string>) => {
    set({ sendTransaction: fn });
  },

  setTransactionLoading: (loading: boolean) => set({ isTransactionLoading: loading }),
  setTransactionError: (error: string | null) => set({ transactionError: error }),

  fetchRooms: async () => {
    try {
      const indexerApi = INDEXER_URL;
      const res = await fetchWithTimeout(`${indexerApi}/api/rooms?status=all&limit=50`, {}, 3000);
      const json = await res.json();
      if (json.success && json.data) {
        const mapped = json.data.map(mapApiRoom);

        // Industry Standard Fast-Path: Render indexer data immediately!
        const currentRooms = get().rooms;
        const missingRooms = currentRooms.filter(cr => !mapped.some((mr: Room) => mr.id === cr.id));
        set({ rooms: [...mapped, ...missingRooms], roomsLoaded: true });

        // Hydrate on-chain state asynchronously in the background so it doesn't block UI rendering!
        (async () => {
          try {
            const program = getAnchorProgram(null as any);
            const pubkeys = mapped.map((r: Room) => new PublicKey(r.id));
            const onChainRooms = await withTimeout(
              (program.account as any).room.fetchMultiple(pubkeys),
              3000,
              'On-chain room fetch timed out'
            ) as any[];

            const hydrated = get().rooms.map((room: Room) => {
              const apiIndex = mapped.findIndex((m: Room) => m.id === room.id);
              if (apiIndex === -1) return room;
              const onChain = onChainRooms[apiIndex];
              if (onChain) {
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
                };
              }
              return room;
            });
            set({ rooms: hydrated });
          } catch (e) {
            console.warn('Could not hydrate on-chain room state in background', e);
          }
        })();
        
        // Fetch connected user's pending rooms in background
        const walletState = get().wallet;
        if (walletState && walletState.publicKey) {
          const creatorPubkey = walletState.publicKey.toBase58();
          (async () => {
            try {
              const pendingRes = await fetchWithTimeout(`${indexerApi}/api/rooms?status=pending&creator=${creatorPubkey}&limit=50`, {}, 3000);
              if (pendingRes.ok) {
                const pendingJson = await pendingRes.json();
                if (pendingJson && pendingJson.success && Array.isArray(pendingJson.data)) {
                  const pendingMapped = pendingJson.data.map(mapApiRoom);
                  const currentRooms = get().rooms;
                  const merged = [...currentRooms];
                  for (const pr of pendingMapped) {
                    const idx = merged.findIndex(r => r.id === pr.id);
                    if (idx === -1) {
                      merged.unshift(pr);
                    } else {
                      merged[idx] = pr;
                    }
                  }
                  set({ rooms: merged });
                }
              }
            } catch (pendingErr) {
              console.warn("Failed to fetch user's pending rooms in background:", pendingErr);
            }
          })();
        }
      }

      // Fetch PlatformConfig to see if paused
      try {
        const program = getAnchorProgram(null as any); // using read-only provider
        const configPda = getPlatformConfigPda();
        const accountInfo = await connection.getAccountInfo(configPda);
        if (accountInfo) {
          let data = accountInfo.data;
          const expectedLen = 162; // 8 discrim + 32 admin + 32 treasury + 32 keeper + 2 fee + 1 paused + 8 min_liquidity + 8 twap_window + 8 cooling_off + 1 bump
          if (data.length < expectedLen) {
            const padded = Buffer.alloc(expectedLen);
            data.copy(padded);
            data = padded;
          }
          const configAccount = program.coder.accounts.decode('platformConfig', data);
          set({ isPaused: configAccount.paused });
        }
      } catch (e) {
        console.warn('Could not fetch PlatformConfig for paused state', e);
      }

      // Mark rooms as loaded even if the request failed (so skeleton goes away)
      set({ roomsLoaded: true });
    } catch (err) {
      console.error('Failed to fetch rooms from indexer REST API:', err);
      set({ roomsLoaded: true });
    }
  },

  fetchSingleRoom: async (roomId: string) => {
    let indexerResult: Room | null = null;
    let onChainResult: Room | null = null;

    // Run indexer API fetch
    const indexerFetch = async () => {
      try {
        const indexerApi = INDEXER_URL;
        const res = await fetchWithTimeout(`${indexerApi}/api/rooms/${roomId}`, {}, 3000);
        const json = await res.json();
        if (json.success && json.data) {
          indexerResult = mapApiRoom(json.data);
          // Optimistically update store with indexer result immediately
          set((state) => {
            const current = state.rooms.find((r) => r.id === roomId);
            const merged = mergeRooms(current, indexerResult, null);
            if (merged && (!current || !isRoomEqual(current, merged))) {
              const exists = state.rooms.some((r) => r.id === roomId);
              const newRooms = exists
                ? state.rooms.map((r) => (r.id === roomId ? merged : r))
                : [merged, ...state.rooms];
              return { rooms: newRooms };
            }
            return {};
          });
        }
      } catch (err) {
        console.warn(`Failed to fetch room ${roomId} from indexer API:`, err);
      }
    };

    // Run on-chain fetch
    const onChainFetch = async () => {
      try {
        const program = getAnchorProgram(null as any);
        const onChain = await withTimeout(
          (program.account as any).room.fetch(new PublicKey(roomId)),
          3000,
          'On-chain room fetch timed out'
        ) as any;

        if (onChain) {
          const statusStr = Object.keys(onChain.status)[0].toLowerCase() as 'active' | 'settled';
          let winnerStr: 'moon' | 'jeet' | 'draw' | undefined = undefined;
          if (onChain.winner) {
            const wKey = Object.keys(onChain.winner)[0].toLowerCase();
            if (wKey === 'moon' || wKey === 'jeet' || wKey === 'draw') {
              winnerStr = wKey;
            }
          }

          const current = get().rooms.find((r) => r.id === roomId);
          let decodedName = current?.token?.name || 'Unknown Token';
          if (!current) {
            const rawNameBytes = onChain.tokenName as number[] | Uint8Array;
            if (rawNameBytes) {
              const buffer = Buffer.from(rawNameBytes);
              const nullIndex = buffer.indexOf(0);
              decodedName = buffer.toString('utf8', 0, nullIndex === -1 ? buffer.length : nullIndex).trim();
            }
          }

          // Decode EVM address from zero-padded Solana public key
          const rawMint = onChain.tokenMint.toBase58();
          let lookupAddress = rawMint;
          let isEvm = false;
          try {
            const pubkey = new PublicKey(rawMint);
            const bytes = pubkey.toBytes();
            let evmCheck = true;
            for (let i = 20; i < 32; i++) {
              if (bytes[i] !== 0) {
                evmCheck = false;
                break;
              }
            }
            if (evmCheck) {
              let hex = '';
              for (let i = 0; i < 20; i++) {
                hex += bytes[i].toString(16).padStart(2, '0');
              }
              lookupAddress = '0x' + hex;
              isEvm = true;
            }
          } catch (err) {
            if (rawMint.startsWith('0x')) {
              isEvm = true;
            }
          }

          const updatedRoom: Room = {
            id: roomId,
            token: {
              address: current?.token?.address || lookupAddress,
              name: decodedName,
              symbol: current?.token?.symbol || decodedName.substring(0, 10).toUpperCase(),
              icon: current?.token?.icon || '💰',
              chainId: current?.token?.chainId || (isEvm ? 'monad' : 'solana'),
              pairAddress: current?.token?.pairAddress || '',
            },
            creator: onChain.creator.toBase58(),
            moonPool: onChain.moonPool.toNumber() / 1e9,
            jeetPool: onChain.jeetPool.toNumber() / 1e9,
            expiry: onChain.expiryTimestamp.toNumber() * 1000,
            status: statusStr,
            winner: winnerStr,
            createdAt: onChain.openingTimestamp.toNumber() * 1000,
            duration: onChain.durationMinutes as any,
            openingPrice: onChain.openingPrice.toNumber() === 0 ? undefined : onChain.openingPrice.toNumber() / 1e12,
            finalPrice: onChain.finalPrice ? onChain.finalPrice.toNumber() / 1e12 : undefined,
            twapFinalPrice: onChain.twapFinalPrice ? onChain.twapFinalPrice.toNumber() / 1e12 : undefined,
          };

          if (!updatedRoom.token.icon || !updatedRoom.token.icon.startsWith('http') || !updatedRoom.token.pairAddress || updatedRoom.token.pairAddress === '') {
            try {
              const dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${updatedRoom.token.address}`;
              const dsRes = await fetch(dsUrl);
              if (dsRes.ok) {
                const dsJson = await dsRes.json();
                const pairs = dsJson?.pairs || [];
                if (pairs.length > 0) {
                  const bestPair = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
                  const imageUrl = bestPair.info?.imageUrl;
                  if (imageUrl) {
                    updatedRoom.token.icon = imageUrl;
                  }
                  if (bestPair.baseToken?.name) updatedRoom.token.name = bestPair.baseToken.name;
                  if (bestPair.baseToken?.symbol) updatedRoom.token.symbol = bestPair.baseToken.symbol;
                  if (bestPair.chainId) updatedRoom.token.chainId = bestPair.chainId;
                  if (bestPair.pairAddress) updatedRoom.token.pairAddress = bestPair.pairAddress;
                }
              }
            } catch (err) {
              console.warn('Failed to fetch fallback token image from DexScreener:', err);
            }
          }

          onChainResult = updatedRoom;

          // Merge indexerResult, onChainResult, and current room state
          set((state) => {
            const current = state.rooms.find((r) => r.id === roomId);
            const merged = mergeRooms(current, indexerResult, onChainResult);
            if (merged && (!current || !isRoomEqual(current, merged))) {
              const exists = state.rooms.some((r) => r.id === roomId);
              const newRooms = exists
                ? state.rooms.map((r) => (r.id === roomId ? merged : r))
                : [merged, ...state.rooms];
              return { rooms: newRooms };
            }
            return {};
          });
        }
      } catch (e) {
        console.warn('Could not fetch or hydrate single on-chain room state in background:', e);
      }
    };

    // Run both indexer and on-chain fetches in parallel
    const indexerPromise = indexerFetch();
    const onChainPromise = onChainFetch();

    // Await ONLY the indexer fetch (very fast) so that loading screens resolve immediately
    await indexerPromise;
  },

  fetchLeaderboard: async () => {
    try {
      const indexerApi = INDEXER_URL;
      const res = await fetchWithTimeout(`${indexerApi}/api/leaderboard?sortBy=profit&limit=50`, {}, 3000);
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
        
        // Split top users into Moon and Jeet tabs based on their database-computed dominant bet side
        const moon = mapped.filter((u: any) => u.alignment === 'moon');
        const jeet = mapped.filter((u: any) => u.alignment === 'jeet');
        
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

  createRoom: async (room: Room, isSetPrice?: boolean) => {
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
      
      // Phase 3.4: Validate minimum liquidity & age via indexer
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
          const roomData: any = await (program.account as any).room.fetch(currentPda);
          const now = Math.floor(Date.now() / 1000);
          const isExpired = now >= roomData.expiryTimestamp.toNumber();

          if (!isExpired && roomData.status.active !== undefined) {
            // Previously we blocked duplicate creation here. Now we let it continue to find the next clean nonce!
            continue;
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
          const indexerUrl = INDEXER_URL;
          await fetch(`${indexerUrl}/api/rooms/${roomPda.toBase58()}`);
        } catch (syncErr) {
          console.warn("Failed to trigger self-healing sync on indexer:", syncErr);
        }

        // Force refreshing the rooms list in the background
        await get().fetchRooms();
        
        get().updateToast(toastId, {
          type: 'success',
          message: 'ARENA ALREADY ACTIVE',
          description: `Active battlefield room found at ${roomPda.toBase58().substring(0, 8)}...`
        });

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
        console.warn("Failed to fetch on-chain room right after creation for precise countdown:", fetchErr);
        if (livePriceUsd) {
          onChainOpeningPrice = parseFloat(livePriceUsd);
        }
      }

      // Optimistically inject the new room into local state to prevent 'TRENCH RUGGED' 404s before indexer syncs
      const optimisticRoom = { 
        ...room, 
        id: roomPda.toBase58(),
        expiry: onChainExpiry,
        createdAt: onChainCreatedAt,
        openingPrice: onChainOpeningPrice,
        status: 'active' as const,
      };
      set((state) => ({ rooms: [optimisticRoom, ...state.rooms] }));
      
      // Force refreshing the rooms list in the background
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

  placeBet: async (roomId: string, side: 'moon' | 'jeet', amount: number, isNewRoom?: boolean, onCloseRedirectUrl?: string) => {
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
          new BN(amount * 1e9) // convert SOL to lamports
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
      
      // Optimistically add to personal user bets to immediately update UI alliances
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
      
      const room = get().rooms.find((r) => r.id === roomId);
      const tokenSymbol = room?.token?.symbol || 'UNKNOWN';
      const duration = room?.duration || 5;
      const expiry = room?.expiry || (Date.now() + duration * 60000);
      const openingPrice = room?.openingPrice;
      
      get().setShareCardData({
        roomId,
        side,
        tokenSymbol,
        duration,
        amount,
        isNewRoom: !!isNewRoom,
        onCloseRedirectUrl,
        expiry,
        openingPrice
      });
      
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

  claimWinnings: async (roomId: string) => {
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
      'Securing spoils from prediction arena vault...'
    );
    
    try {
      // ── Step 1: Init program early (needed for on-chain status check) ─────────
      const program = getAnchorProgram(wallet);
      const roomPda = new PublicKey(roomId);
      const escrowPda = getEscrowPda(roomPda);
      const [configPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('platform_config')],
        program.programId
      );

      // ── Step 2: Fetch fresh room state ────────────────────────────────────────
      // Strategy: check on-chain first (authoritative), then indexer, then local state.
      // This prevents claiming against an unsettled room even when indexer is down.

      // 2a. On-chain room account — the true source of truth
      let onChainSettled = false;
      let onChainWinner: string | null = null;
      try {
        const onChainRoom: any = await (program.account as any).room.fetch(roomPda);
        const statusKey = Object.keys(onChainRoom.status ?? {})[0] ?? 'active';
        onChainSettled = statusKey === 'settled';
        if (onChainRoom.winner) {
          const winnerKey = Object.keys(onChainRoom.winner)[0];
          onChainWinner = winnerKey === 'moon' ? 'moon' : winnerKey === 'jeet' ? 'jeet' : 'draw';
        }
        console.log(`On-chain room status: ${statusKey}, winner: ${onChainWinner ?? 'none'}`);
      } catch (e) {
        console.warn('Could not fetch on-chain room status (RPC may be slow):', e);
      }

      // 2b. Indexer / local state — used for expiry and winner metadata
      let freshRoomData: any = null;
      try {
        const roomFetchRes = await fetch(`${INDEXER_URL}/api/rooms/${roomId}`);
        if (roomFetchRes.ok) {
          const roomFetchJson = await roomFetchRes.json();
          freshRoomData = roomFetchJson?.data ?? null;
        }
      } catch (e) {
        console.warn('Indexer unreachable, using local state:', e);
      }

      const localRoom = get().rooms.find((r) => r.id === roomId);
      const roomExpiry: number = freshRoomData?.expiry
        ? new Date(freshRoomData.expiry).getTime()
        : (localRoom?.expiry ?? 0);
      const roomWinner: string | null = onChainWinner ?? freshRoomData?.winner ?? localRoom?.winner ?? null;

      // ── Step 3: Settle the room if needed ────────────────────────────────────
      // Use on-chain status as the authoritative check. If on-chain is already settled,
      // skip straight to claiming. If not, trigger settlement and poll until confirmed.
      const isExpired = roomExpiry <= Date.now();
      const needsSettle = !onChainSettled; // trust on-chain, not indexer DB

      if (needsSettle) {
        if (!isExpired) {
          throw new Error('Room has not expired yet. You can claim after it ends.');
        }

        console.log(`Room ${roomId} not settled on-chain — triggering settlement...`);

        // Kick off settlement via indexer keeper
        try {
          const settleRes = await fetch(`${INDEXER_URL}/api/rooms/${roomId}/settle`, {
            method: 'POST',
          });
          const settleJson = await settleRes.json().catch(() => ({}));
          console.log(`Settle response: ${settleRes.status}`, settleJson);

          const settleError =
            settleJson?.error ||
            (settleRes.statusText && settleRes.statusText !== 'OK' ? settleRes.statusText : null) ||
            `HTTP ${settleRes.status}`;

          if (!settleRes.ok || settleJson?.success === false) {
            if (typeof settleError === 'string' && settleError.toLowerCase().includes('already settled')) {
              console.log('On-demand settlement reports room already settled, continuing to poll on-chain.');
            } else {
              throw new Error(`Settlement request failed: ${settleError}`);
            }
          }
        } catch (e) {
          if (e instanceof Error && e.message.startsWith('Settlement request failed:')) {
            throw e;
          }

          console.warn('Indexer settle endpoint unreachable:', e);
          throw new Error(
            'The indexer is not running. Please ensure the indexer (npm start) is running, then try again.'
          );
        }

        get().updateToast(toastId, {
          type: 'loading',
          message: 'SETTLING ROOM',
          description: 'Waiting for settlement to confirm on-chain...',
        });

        // Poll: check on-chain status every 3s (not indexer DB — on-chain is truth)
        const startTime = Date.now();
        const TIMEOUT_MS = 60_000;
        let settled = false;

        while (Date.now() - startTime < TIMEOUT_MS) {
          await new Promise(r => setTimeout(r, 3000));
          try {
            const pollRoom: any = await (program.account as any).room.fetch(roomPda);
            const pollStatusKey = Object.keys(pollRoom.status ?? {})[0] ?? 'active';
            const elapsed = Math.round((Date.now() - startTime) / 1000);
            console.log(`Settlement on-chain poll: ${pollStatusKey} (${elapsed}s elapsed)`);
            if (pollStatusKey === 'settled') {
              settled = true;
              // Update winner from on-chain data
              if (pollRoom.winner) {
                const wKey = Object.keys(pollRoom.winner)[0];
                onChainWinner = wKey === 'moon' ? 'moon' : wKey === 'jeet' ? 'jeet' : 'draw';
              }
              break;
            }
          } catch (pollErr) {
            console.warn('On-chain poll error:', pollErr);
            // Fall back to indexer poll
            try {
              const pollRes = await fetch(`${INDEXER_URL}/api/rooms/${roomId}`);
              if (pollRes.ok) {
                const pollJson = await pollRes.json();
                const pollStatus = pollJson?.data?.status ?? '';
                if (pollStatus === 'settled') { settled = true; break; }
              }
            } catch { /* ignore */ }
          }
        }

        if (!settled) {
          throw new Error(
            'Room settlement timed out. The keeper may be busy or the indexer may be down. Please try again in a moment.'
          );
        }

        await get().fetchRooms();
        get().updateToast(toastId, {
          type: 'loading',
          message: 'RECOVERING SPOILS',
          description: 'Room settled on-chain! Processing your claim...',
        });
      }



      // ── Step 4: Determine which side to claim on ──────────────────────────
      // For voided (winner='draw') and draw rooms the user claims their OWN bet side.
      // Priority: (1) local user bet record → (2) on-chain PDA existence → (3) winner (non-draw only)
      let claimSide: 'moon' | 'jeet' | null = null;
      
      // First, try to find the user's unclaimed bet in local state
      const userBet = get().user?.bets.find((b) => b.roomId === roomId && !b.claimed);
      if (userBet && (userBet.side === 'moon' || userBet.side === 'jeet')) {
        claimSide = userBet.side;
        console.log(`ClaimSide from user bet record: ${claimSide}`);
      } else {
        // Check on-chain which bet PDA actually exists for this wallet
        try {
          const moonBetPda = getBetPda(roomPda, wallet.publicKey, 'moon');
          const moonInfo = await connection.getAccountInfo(moonBetPda);
          if (moonInfo) {
            claimSide = 'moon';
            console.log('ClaimSide from on-chain moon PDA');
          } else {
            const jeetBetPda = getBetPda(roomPda, wallet.publicKey, 'jeet');
            const jeetInfo = await connection.getAccountInfo(jeetBetPda);
            if (jeetInfo) {
              claimSide = 'jeet';
              console.log('ClaimSide from on-chain jeet PDA');
            }
          }
        } catch (e) {
          console.warn('Failed PDA check for claim side:', e);
        }
      }

      // If we still couldn't determine the claim side, try via room winner
      // (only for non-draw/non-void rooms — draw/void rooms require on-chain PDA lookup)
      if (!claimSide) {
        if (roomWinner && roomWinner !== 'draw' && roomWinner !== null) {
          claimSide = roomWinner as 'moon' | 'jeet';
          console.log(`ClaimSide from room winner: ${claimSide}`);
        } else {
          // For draw/void rooms, we must have a claim side from the bet or PDA.
          // If we can't find it, throw an error rather than guessing 'moon'.
          throw new Error(
            'Could not determine your bet side for this draw/voided room. ' +
            'This may happen if the RPC is unreachable. Please try again.'
          );
        }
      }

      const betPda = getBetPda(roomPda, wallet.publicKey, claimSide);

      const remainingAccounts = [];
      const userState = get().user;
      if (userState && userState.referredBy) {
        try {
          const referrerPubkey = new PublicKey(userState.referredBy);
          const userReferralPda = getUserReferralPda(wallet.publicKey);
          const referralStatePda = getReferralStatePda(referrerPubkey);

          const referralAccInfo = await connection.getAccountInfo(userReferralPda);
          if (!referralAccInfo) {
            console.log("On-chain user referral not registered. Registering now...");
            if (!sendTransaction) {
              throw new Error("No transaction sender registered.");
            }
            const regTxObj = await (program.methods as any)
              .registerReferral(referrerPubkey)
              .accounts({
                userReferral: userReferralPda,
                user: wallet.publicKey,
                systemProgram: SystemProgram.programId,
              })
              .transaction();
            const regTx = await sendTransaction(regTxObj);
            console.log("On-chain referral registered! Tx:", regTx);
          }

          remainingAccounts.push({
            pubkey: userReferralPda,
            isWritable: false,
            isSigner: false,
          });
          remainingAccounts.push({
            pubkey: referralStatePda,
            isWritable: true,
            isSigner: false,
          });
        } catch (e) {
          console.warn("Failed to register/verify referral on-chain:", e);
        }
      }
      
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
        .remainingAccounts(remainingAccounts)
        .preInstructions([
          ComputeBudgetProgram.setComputeUnitLimit({ units: 180_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeValue })
        ])
        .transaction();
        
      if (!sendTransaction) {
        throw new Error("No transaction sender registered. Connect your wallet command helmet first.");
      }
      const tx = await sendTransaction(txObj);
        
      console.log("Winnings claimed successfully! Tx:", tx);
      
      // Optimistically update the claimed flag for all bets of this user in this room
      const currentUser = get().user;
      if (currentUser && currentUser.bets) {
        const updatedBets = currentUser.bets.map((b) => {
          if (b.roomId === roomId) {
            return { ...b, claimed: true };
          }
          return b;
        });
        set({
          user: {
            ...currentUser,
            bets: updatedBets
          }
        });
      }

      // Add to personal activity log
      get().addActivity({
        type: 'win',
        title: `BOOTY CLAIMED IN ROOM ${roomId.substring(0, 4)}`,
        message: `Successfully recovered spoils from ${claimSide.toUpperCase()} victory.`,
        link: `/room/${roomId}`
      });

      // Reload balance and room state so the UI reflects the claim immediately
      await get().fetchBalance();
      await get().fetchRooms();

      // In the background, refresh the profile/balance after 2 seconds to sync with the database
      setTimeout(() => {
        if (wallet.publicKey) {
          get().setWalletAddress(wallet.publicKey.toBase58()).catch(() => {});
        }
      }, 2000);
      
      get().updateToast(toastId, {
        type: 'success',
        message: 'WAR BOOTY SECURED',
        description: 'Spoils successfully routed to your vault.',
        txSig: tx
      });

      return tx;
    } catch (err: any) {
      console.error("Failed to claim winnings on-chain:", err);
      setTransactionError(err.message || String(err));
      
      const cleanErr = extractErrorMessage(err);
      get().updateToast(toastId, {
        type: 'error',
        message: 'RETRIEVAL OPERATION FAILED',
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
      const program = getAnchorProgram(wallet);
      const referralStatePda = getReferralStatePda(wallet.publicKey);
      const vaultPda = getVaultPda();

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
          ComputeBudgetProgram.setComputeUnitLimit({ units: 100_000 }),
          ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFeeValue })
        ])
        .transaction();

      if (!sendTransaction) {
        throw new Error("No transaction sender registered. Connect your wallet command helmet first.");
      }
      const tx = await sendTransaction(txObj);

      console.log("Referral rewards claimed successfully! Tx:", tx);

      // Add to personal activity log
      get().addActivity({
        type: 'win',
        title: `REFERRAL REWARDS CLAIMED`,
        message: `Successfully recovered referral commission spoils.`,
      });

      // Reload balance and profile
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
        message: 'REWARDS RETRIEVAL FAILED',
        description: cleanErr
      });
      
      throw err;
    } finally {
      setTransactionLoading(false);
    }
  },

  connectWallet: () => {
    console.log("Connect wallet action invoked via trigger-wallet-connection event");
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('trigger-wallet-connection'));
    }
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
      let username: string | null = null;
      let avatarUrl: string | null = null;
      let referredBy: string | null = null;
      let referralCode: string | null = null;
      let referralsCount = 0;
      let referralEarnings = '0';
      let referralPayouts: any[] = [];
      let unclaimedReferralRewards = 0;
      let activities: any[] = [];
      
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
        // Account not initialized or fetch failed (e.g. no rewards)
      }
      
      try {
        const indexerApi = INDEXER_URL;
        const res = await fetchWithTimeout(`${indexerApi}/api/profile/${address}`, {}, 3000);
        const json = await res.json();
        if (json.success && json.data) {
          trenchScore = json.data.trenchScore || 'D';
          username = json.data.username || null;
          avatarUrl = json.data.avatarUrl || null;
          referredBy = json.data.referredBy || null;
          referralCode = json.data.referralCode || null;
          referralsCount = json.data.referralsCount || 0;
          referralEarnings = json.data.referralEarnings || '0';
          referralPayouts = json.data.referralPayouts || [];
          activities = (json.data.activities || []).map((a: any) => ({
            id: a.id,
            type: a.type,
            title: a.title,
            message: a.message,
            link: a.link,
            read: a.read,
            timestamp: a.timestamp,
          }));
          stats = {
            totalBets: json.data.totalBets || 0,
            wins: json.data.wins || 0,
            losses: json.data.losses || 0,
            profit: Number(json.data.profit || 0) / 1e9,
            winStreak: json.data.winStreak || 0,
            longestWinStreak: json.data.longestWinStreak || 0,
            biggestBet: Number(json.data.biggestBet || 0) / 1e9,
          };
          bets = (json.data.bets || []).map((b: any) => ({
            id: b.id,
            roomId: b.roomPubkey,
            user: b.userPubkey,
            side: b.side,
            amount: Number(b.amount) / 1e9,
            claimed: b.claimed,
            timestamp: new Date(b.createdAt).getTime(),
            txSig: b.txSig || null,
          }));

          const existingOptimisticBets = get().user?.bets.filter(b => b.id.startsWith('opt-')) || [];
          for (const optBet of existingOptimisticBets) {
            const exists = bets.some((b: any) => b.roomId === optBet.roomId && b.side === optBet.side);
            if (!exists) {
              bets.push(optBet);
            }
          }
        }
      } catch (err) {
        console.error('Failed to fetch profile from indexer:', err);
      }
      
      // Auto-affiliation linkage checks
      if (typeof window !== 'undefined' && !referredBy) {
        const cachedRef = localStorage.getItem('ref');
        if (cachedRef && cachedRef !== address && cachedRef !== referralCode) {
          console.log(`Auto-linking referrer ${cachedRef} for wallet ${address}...`);
          try {
            const indexerApi = INDEXER_URL;
            await fetchWithTimeout(`${indexerApi}/api/profile/update`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ userPubkey: address, referredBy: cachedRef }),
            }, 3000).then(r => r.json()).then(data => {
              if (data.success) {
                referredBy = data.data.referredBy || null;
                referralCode = data.data.referralCode || null;
                username = data.data.username || null;
                avatarUrl = data.data.avatarUrl || null;
                localStorage.removeItem('ref'); // successfully linked
              }
            });
          } catch (e) {
            console.error('Failed to auto-link referrer:', e);
          }
        }
      }
      
      set({
        user: {
          wallet: address,
          balance,
          bets,
          achievements,
          stats,
          trenchScore,
          username,
          avatarUrl,
          referredBy,
          referralCode,
          referralsCount,
          referralEarnings,
          referralPayouts,
          unclaimedReferralRewards,
        }
      });
    } else {
      set({
        user: null,
        wallet: null,
      });
    }
  },

  updateProfile: async (username: string | null, avatarUrl: string | null, referredBy?: string | null) => {
    const { wallet, user } = get();
    const address = wallet?.publicKey?.toBase58() || user?.wallet;
    if (!address) {
      return { success: false, error: 'No wallet connected' };
    }

    try {
      const indexerApi = INDEXER_URL;
      const res = await fetchWithTimeout(`${indexerApi}/api/profile/update`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userPubkey: address,
          username: username === undefined ? undefined : username,
          avatarUrl: avatarUrl === undefined ? undefined : avatarUrl,
          referredBy: referredBy === undefined ? undefined : referredBy,
        }),
      }, 5000);

      const json = await res.json();
      if (!res.ok || !json.success) {
        return { success: false, error: json.error || 'Failed to update profile' };
      }

      // Refresh local user state fields
      if (user) {
        set({
          user: {
            ...user,
            username: json.data.username || null,
            avatarUrl: json.data.avatarUrl || null,
            referredBy: json.data.referredBy || null,
            referralCode: json.data.referralCode || null,
          }
        });
      }

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
      // Account not initialized or fetch failed (e.g. no rewards)
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
      console.error('Failed to refresh profile from indexer:', err);
    }
  },

  addMessage: (msg: ChatMessage) => {
    set((state) => ({
      chatMessages: [...state.chatMessages, msg].slice(-100)
    }));
  },

  fetchRoomChats: async (roomId: string) => {
    try {
      const indexerApi = INDEXER_URL;
      const res = await fetch(`${indexerApi}/api/rooms/${roomId}/chats`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data) {
          set((state) => {
            const currentRoomChats = state.chatMessages.filter((c) => c.roomId === roomId);
            const newChats = json.data;
            if (currentRoomChats.length === newChats.length &&
                currentRoomChats.every((c, i) => c.message === newChats[i]?.message && c.user === newChats[i]?.user && c.side === newChats[i]?.side)) {
              return {};
            }
            const otherChats = state.chatMessages.filter((c) => c.roomId !== roomId);
            return { chatMessages: [...otherChats, ...newChats].slice(-500) };
          });
        }
      }
    } catch (err) {
      console.warn(`Failed to fetch chats for room ${roomId}:`, err);
    }
  },

  sendRoomChat: async (roomId: string, side: 'moon' | 'jeet' | 'all', user: string, message: string) => {
    try {
      const indexerApi = INDEXER_URL;
      await fetch(`${indexerApi}/api/rooms/${roomId}/chats`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user, side, message }),
      });
    } catch (err) {
      console.warn(`Failed to send chat for room ${roomId}:`, err);
    }
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
      const duplicate = state.user.bets.some((b) => b.id === bet.id);
      if (duplicate) return {};
      
      const existingIdx = state.user.bets.findIndex((b) => b.roomId === bet.roomId && b.side === bet.side);
      let newBets = [...state.user.bets];
      if (existingIdx > -1) {
        newBets[existingIdx] = {
          ...newBets[existingIdx],
          amount: newBets[existingIdx].amount + bet.amount,
          timestamp: Math.max(newBets[existingIdx].timestamp, bet.timestamp),
          txSig: bet.txSig || newBets[existingIdx].txSig
        };
      } else {
        newBets = [bet, ...newBets];
      }
      return {
        user: {
          ...state.user,
          bets: newBets,
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
}),
{
  name: 'shitmarket-storage',
  partialize: (state) => ({
    settings: state.settings,
  }),
}
));
