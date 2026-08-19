'use client';

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppState, Room, ChatMessage, formatCashtag, formatPrice, publicClient, AM_POOL_ABI, AM_POOL_FACTORY_ABI, CONDITIONAL_TOKENS_ABI } from '@/store/useAppState';
import { INDEXER_URL, CONTRACT_ADDRESSES } from '@/utils/config';
import { PixelGasMask, PixelBarbedWire } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS } from '@/components/MemeAssets';
import { OrderBook } from '@/components/OrderBook';
import { HeaderPanel } from '@/components/ui/HeaderPanel';
import { PublicProfileModal } from '@/components/PublicProfileModal';
import { 
  Bomb, Send, ArrowLeft, ShieldAlert, Award, MessageSquare, Brain,
  AlertTriangle, Swords, Flame, Coins, Loader2, Sparkles, Users, Radio, Terminal, Bookmark,
  ExternalLink, Scale, FileText, CheckCircle2, ChevronDown, Share2
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import confetti from 'canvas-confetti';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { getAnchorProgram, connection, getListingPda, getBetPda, safePublicKey, cleanEvmAddress, isSameRoom } from '@/utils/solanaClient';
import { Listing } from '@/store/useAppState';
import { BN } from '@coral-xyz/anchor';

// 1. Stable, Static, and Dynamic Memoized DexScreener Iframe Chart Component
// Uses the smallest possible chart-only pair embed, lazy mounts only when visible, and stays stable across unrelated parent renders.
const StableDexChart = React.memo(({ chainId, pairAddress }: { chainId: string; pairAddress: string }) => {
  const [localLoading, setLocalLoading] = useState(true);
  const iframeSrc = useMemo(
    () => `https://dexscreener.com/${chainId}/${pairAddress}?embed=1&theme=dark`,
    [chainId, pairAddress]
  );

  return (
    <div className="w-full h-full relative bg-black">
      {localLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070c04] z-10 animate-pulse pt-12">
          <Loader2 size={32} className="animate-spin text-neon-moon mb-4" />
          <span className="font-mono text-xs text-trench-gasmask font-bold uppercase tracking-widest">
            LOADING CHART...
          </span>
        </div>
      )}
      <iframe
        className="w-full h-full border-none"
        src={iframeSrc}
        title="Token Chart Widget"
        loading="lazy"
        referrerPolicy="no-referrer"
        onLoad={() => setLocalLoading(false)}
      />
    </div>
  );
}, (prevProps, nextProps) => {
  return prevProps.chainId === nextProps.chainId && prevProps.pairAddress === nextProps.pairAddress;
});

StableDexChart.displayName = 'StableDexChart';

const LazyDexChart = ({ chainId, pairAddress }: { chainId: string; pairAddress: string }) => {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: '250px', threshold: 0.1 }
    );

    observer.observe(container);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full">
      {shouldRender ? (
        <StableDexChart chainId={chainId} pairAddress={pairAddress} />
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-[#070c04] text-center px-4">
          <Loader2 size={28} className="animate-spin text-neon-moon mb-3" />
          <span className="font-mono text-[10px] text-trench-gasmask uppercase tracking-widest">
            PREPARING CHART VIEW...
          </span>
        </div>
      )}
    </div>
  );
};

interface ChartPoint {
  timestamp: number;
  prices: number[];
}

const OddsHistoryChart = ({ 
  pricesSafe, 
  labelsSafe, 
  bets = [] 
}: { 
  pricesSafe: number[]; 
  labelsSafe: string[]; 
  bets?: any[]; 
}) => {
  const [history, setHistory] = useState<ChartPoint[]>([]);
  const [hoveredPoint, setHoveredPoint] = useState<{ x: number; y: number; prices: number[]; date: string } | null>(null);

  // Generate historical data points
  useEffect(() => {
    const pointsCount = 30;
    const now = Date.now();
    const mockPoints: ChartPoint[] = [];

    const outcomeCount = pricesSafe.length || 2;
    const startingPrices = Array(outcomeCount).fill(1 / outcomeCount);

    for (let i = 0; i < pointsCount; i++) {
      const stepTime = now - (pointsCount - i) * 10 * 60 * 1000;
      const progress = i / (pointsCount - 1);
      
      const prices = pricesSafe.map((targetVal, idx) => {
        const start = startingPrices[idx] || 0.5;
        const diff = targetVal - start;
        const trend = start + diff * progress;
        const swing = i < pointsCount - 1 ? (Math.sin(i * 0.8 + idx) * 0.04 * (1 - progress)) : 0;
        return Math.max(0.01, Math.min(0.99, trend + swing));
      });

      const sum = prices.reduce((a, b) => a + b, 0) || 1;
      mockPoints.push({
        timestamp: stepTime,
        prices: prices.map(p => p / sum),
      });
    }

    setHistory(mockPoints);
  }, [JSON.stringify(pricesSafe)]);

  // Append new real-time price updates
  useEffect(() => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    const changed = pricesSafe.some((p, i) => Math.abs(p - (last.prices[i] || 0)) > 0.001);
    if (changed) {
      setHistory(prev => [...prev.slice(1), { timestamp: Date.now(), prices: [...pricesSafe] }]);
    }
  }, [pricesSafe, history]);

  const width = 500;
  const height = 200;
  const padding = { top: 20, right: 50, bottom: 20, left: 10 };

  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const paths = useMemo(() => {
    if (history.length < 2) return [];
    const outcomeCount = pricesSafe.length;
    
    return Array(outcomeCount).fill(0).map((_, outcomeIdx) => {
      let pathStr = '';
      let fillStr = '';
      
      history.forEach((pt, ptIdx) => {
        const x = padding.left + (ptIdx / (history.length - 1)) * chartWidth;
        const price = pt.prices[outcomeIdx] ?? (1 / outcomeCount);
        const y = padding.top + (1 - price) * chartHeight;
        
        if (ptIdx === 0) {
          pathStr = `M ${x} ${y}`;
          fillStr = `M ${x} ${padding.top + chartHeight} L ${x} ${y}`;
        } else {
          const prevPt = history[ptIdx - 1];
          const prevX = padding.left + ((ptIdx - 1) / (history.length - 1)) * chartWidth;
          const prevPrice = prevPt.prices[outcomeIdx] ?? (1 / outcomeCount);
          const prevY = padding.top + (1 - prevPrice) * chartHeight;
          const controlX = (prevX + x) / 2;
          pathStr += ` C ${controlX} ${prevY}, ${controlX} ${y}, ${x} ${y}`;
          fillStr += ` C ${controlX} ${prevY}, ${controlX} ${y}, ${x} ${y}`;
        }

        if (ptIdx === history.length - 1) {
          fillStr += ` L ${x} ${padding.top + chartHeight} Z`;
        }
      });
      return { pathStr, fillStr };
    });
  }, [history, pricesSafe.length, chartWidth, chartHeight]);

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (history.length === 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    const clientY = e.clientY - rect.top;

    const progress = Math.max(0, Math.min(1, (clientX - padding.left) / chartWidth));
    const idx = Math.round(progress * (history.length - 1));
    const point = history[idx];
    if (point) {
      const dateStr = new Date(point.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      setHoveredPoint({
        x: padding.left + (idx / (history.length - 1)) * chartWidth,
        y: clientY,
        prices: point.prices,
        date: dateStr
      });
    }
  };

  const handleMouseLeave = () => {
    setHoveredPoint(null);
  };

  const LINE_COLORS = [
    '#3b82f6', // blue
    '#f59e0b', // amber
    '#10b981', // emerald
    '#f43f5e', // rose
    '#8b5cf6', // purple
    '#ec4899', // pink
    '#06b6d4', // cyan
  ];

  return (
    <div className="w-full bg-slate-950/40 border border-slate-200 dark:border-slate-800/80 rounded-xl p-4 space-y-4 shadow-inner">
      <div className="flex flex-wrap gap-x-4 gap-y-1.5 border-b border-slate-200 dark:border-slate-800 pb-3">
        {labelsSafe.map((label, idx) => {
          const color = LINE_COLORS[idx % LINE_COLORS.length];
          const pct = (pricesSafe[idx] || 0) * 100;
          return (
            <div key={idx} className="flex items-center gap-1.5 font-mono text-[10px] uppercase font-bold">
              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
              <span className="text-slate-500 dark:text-slate-400">{label}</span>
              <span className="text-slate-800 dark:text-white">{pct.toFixed(1)}%</span>
            </div>
          );
        })}
      </div>

      <div className="relative">
        <svg 
          viewBox={`0 0 ${width} ${height}`} 
          className="w-full h-[220px] select-none cursor-crosshair overflow-visible"
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <defs>
            {LINE_COLORS.map((color, idx) => (
              <linearGradient key={idx} id={`gradient-${idx}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={color} stopOpacity="0.15" />
                <stop offset="100%" stopColor={color} stopOpacity="0.00" />
              </linearGradient>
            ))}
          </defs>

          {[0, 0.25, 0.5, 0.75, 1].map((ratio, gridIdx) => {
            const y = padding.top + ratio * chartHeight;
            const pct = Math.round((1 - ratio) * 100);
            return (
              <g key={gridIdx} className="opacity-40 dark:opacity-20">
                <line 
                  x1={padding.left} 
                  y1={y} 
                  x2={padding.left + chartWidth} 
                  y2={y} 
                  stroke="#64748b" 
                  strokeWidth="0.75" 
                  strokeDasharray="4 4" 
                />
                <text 
                  x={padding.left + chartWidth + 6} 
                  y={y + 4} 
                  fill="#94a3b8" 
                  className="font-mono text-[8px] font-bold"
                >
                  {pct}%
                </text>
              </g>
            );
          })}

          {paths.map((p, idx) => {
            const color = LINE_COLORS[idx % LINE_COLORS.length];
            return (
              <g key={idx}>
                <path d={p.fillStr} fill={`url(#gradient-${idx})`} />
                <path 
                  d={p.pathStr} 
                  fill="none" 
                  stroke={color} 
                  strokeWidth="2.5" 
                  strokeLinecap="round" 
                  strokeLinejoin="round" 
                />
              </g>
            );
          })}

          {hoveredPoint && (
            <g>
              <line 
                x1={hoveredPoint.x} 
                y1={padding.top} 
                x2={hoveredPoint.x} 
                y2={padding.top + chartHeight} 
                stroke="#64748b" 
                strokeWidth="1.5" 
                strokeDasharray="3 3" 
                className="opacity-70"
              />
              {hoveredPoint.prices.map((p, idx) => {
                const color = LINE_COLORS[idx % LINE_COLORS.length];
                const y = padding.top + (1 - p) * chartHeight;
                return (
                  <circle 
                    key={idx} 
                    cx={hoveredPoint.x} 
                    cy={y} 
                    r="4" 
                    fill={color} 
                    stroke="#0f172a" 
                    strokeWidth="1.5" 
                  />
                );
              })}
            </g>
          )}
        </svg>

        {hoveredPoint && (
          <div 
            className="absolute z-30 pointer-events-none bg-slate-950/95 border border-slate-800 p-2.5 rounded-lg shadow-xl font-mono text-[9px] text-left space-y-1"
            style={{ 
              left: `${Math.min(hoveredPoint.x + 10, width - 110)}px`,
              top: `${Math.max(10, hoveredPoint.y - 60)}px` 
            }}
          >
            <div className="text-slate-500 font-bold border-b border-slate-900 pb-1 mb-1">
              TIME: {hoveredPoint.date}
            </div>
            {labelsSafe.map((label, idx) => {
              const color = LINE_COLORS[idx % LINE_COLORS.length];
              const pct = (hoveredPoint.prices[idx] || 0) * 100;
              return (
                <div key={idx} className="flex justify-between items-center gap-3">
                  <div className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                    <span className="text-slate-400 truncate max-w-[70px]">{label}</span>
                  </div>
                  <span className="text-white font-bold">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

function LiquidityTabPanel({ roomId }: { roomId: string }) {
  const { addAmmLiquidity, removeAmmLiquidity, claimAmmFees, wallet } = useAppState();
  const [usdcAmount, setUsdcAmount] = useState<string>('');
  const [lpAmount, setLpAmount] = useState<string>('');
  const [lpBalance, setLpBalance] = useState<number>(0);
  const [claimableFees, setClaimableFees] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(false);
  const [claiming, setClaiming] = useState<boolean>(false);

  const fetchLpBalanceAndFees = async () => {
    if (!wallet?.address) return;
    try {
      const poolFactoryAddress = CONTRACT_ADDRESSES.AM_POOL_FACTORY;
      const poolAddress = await publicClient.readContract({
        address: poolFactoryAddress,
        abi: AM_POOL_FACTORY_ABI,
        functionName: 'getPool',
        args: [roomId as `0x${string}`]
      }) as `0x${string}`;

      if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
        const bal = await publicClient.readContract({
          address: poolAddress,
          abi: [
            {
              name: 'balanceOf',
              type: 'function',
              stateMutability: 'view',
              inputs: [{ name: 'account', type: 'address' }],
              outputs: [{ name: '', type: 'uint256' }]
            }
          ],
          functionName: 'balanceOf',
          args: [wallet.address as `0x${string}`]
        }) as bigint;
        setLpBalance(Number(bal) / 1e6);

        // Fetch claimable swap fees
        try {
          const fees = await publicClient.readContract({
            address: poolAddress,
            abi: AM_POOL_ABI,
            functionName: 'getClaimableFees',
            args: [wallet.address as `0x${string}`]
          }) as bigint;
          setClaimableFees(Number(fees) / 1e6);
        } catch (feeErr) {
          console.warn("Failed to fetch claimable fees:", feeErr);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch LP balance:", e);
    }
  };

  useEffect(() => {
    fetchLpBalanceAndFees();
    const interval = setInterval(fetchLpBalanceAndFees, 6000);
    return () => clearInterval(interval);
  }, [wallet?.address, roomId]);

  const handleAdd = async () => {
    if (!usdcAmount || isNaN(Number(usdcAmount))) return;
    setLoading(true);
    try {
      await addAmmLiquidity(roomId, Number(usdcAmount));
      setUsdcAmount('');
      await fetchLpBalanceAndFees();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleRemove = async () => {
    if (!lpAmount || isNaN(Number(lpAmount))) return;
    setLoading(true);
    try {
      await removeAmmLiquidity(roomId, Number(lpAmount));
      setLpAmount('');
      await fetchLpBalanceAndFees();
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  const handleClaim = async () => {
    if (claimableFees <= 0) return;
    setClaiming(true);
    try {
      await claimAmmFees(roomId);
      await fetchLpBalanceAndFees();
    } catch (e) {
      console.error(e);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div className="space-y-6 text-left p-2">
      {/* LP Balance & Claimable Fees Card */}
      <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-200 dark:border-slate-800 font-mono text-xs space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-slate-500 uppercase font-bold">Your Liquidity Shares:</span>
          <span className="font-extrabold text-slate-950 dark:text-white">{lpBalance.toFixed(2)} SM-LP</span>
        </div>
        <div className="flex justify-between items-center pt-2 border-t border-slate-200 dark:border-slate-800">
          <div>
            <span className="text-slate-500 uppercase font-bold block">Accrued Swap Fees:</span>
            <span className="text-[10px] text-slate-400">0.07% pro-rata trade volume</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="font-extrabold text-emerald-600 dark:text-neon-moon text-sm">
              ${claimableFees.toFixed(4)} USDC
            </span>
            <button
              onClick={handleClaim}
              disabled={claiming || claimableFees <= 0}
              className="px-3 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-lg font-mono text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed shadow-sm flex items-center gap-1"
            >
              {claiming ? <Loader2 size={12} className="animate-spin" /> : <Coins size={12} />}
              CLAIM FEES
            </button>
          </div>
        </div>
      </div>

      {/* Add Liquidity section */}
      <div className="space-y-2">
        <label className="block font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          ADD USDC LIQUIDITY:
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={usdcAmount}
            onChange={(e) => setUsdcAmount(e.target.value)}
            disabled={loading}
            placeholder="USDC Amount..."
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-emerald-500"
          />
          <button
            onClick={handleAdd}
            disabled={loading || !usdcAmount}
            className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-mono text-xs font-bold transition-all disabled:opacity-50"
          >
            ADD
          </button>
        </div>
      </div>

      {/* Remove Liquidity section */}
      <div className="space-y-2">
        <label className="block font-mono text-[10px] font-bold text-slate-500 uppercase tracking-wider">
          REMOVE LP RESERVES:
        </label>
        <div className="flex gap-2">
          <input
            type="number"
            value={lpAmount}
            onChange={(e) => setLpAmount(e.target.value)}
            disabled={loading}
            placeholder="LP tokens to burn..."
            className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs text-slate-900 dark:text-white placeholder-slate-400 dark:placeholder-slate-600 focus:outline-none focus:border-rose-500"
          />
          <button
            onClick={handleRemove}
            disabled={loading || !lpAmount || Number(lpAmount) > lpBalance}
            className="px-6 py-3 bg-rose-500 hover:bg-rose-600 text-white rounded-xl font-mono text-xs font-bold transition-all disabled:opacity-50"
          >
            REMOVE
          </button>
        </div>
      </div>
    </div>
  );
}

interface MortarProjectile {
  id: number;
  side: 'moon' | 'jeet';
  tx: number;
  ty: number;
  txHalf: number;
  tyPeak: number;
}

interface ExplosionParticles {
  id: number;
  side: 'moon' | 'jeet';
  x: number;
  y: number;
}
const formatDuration = (mins: number) => {
  if (mins >= 525600) return `${Math.round(mins / 525600)} YEAR${Math.round(mins / 525600) > 1 ? 'S' : ''}`;
  if (mins >= 43200) return `${Math.round(mins / 43200)} MONTH${Math.round(mins / 43200) > 1 ? 'S' : ''}`;
  if (mins >= 10080) return `${Math.round(mins / 10080)} WEEK${Math.round(mins / 10080) > 1 ? 'S' : ''}`;
  if (mins >= 1440) return `${Math.round(mins / 1440)} DAY${Math.round(mins / 1440) > 1 ? 'S' : ''}`;
  if (mins >= 60) return `${Math.round(mins / 60)} HOUR${Math.round(mins / 60) > 1 ? 'S' : ''}`;
  return `${mins} MINS`;
};

const formatRelativeTime = (timestamp: number) => {
  const diffMs = Date.now() - timestamp;
  if (diffMs < 0) return 'just now';
  const diffSeconds = Math.floor(diffMs / 1000);
  if (diffSeconds < 60) return `${diffSeconds}s ago`;
  const diffMinutes = Math.floor(diffSeconds / 60);
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  return `${diffDays}d ago`;
};



export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const { 
    rooms, user, chatMessages, placeBet, placeLimitOrder, executeEvmMarketTrade, claimWinnings, 
    addMessage, connectWallet, isTransactionLoading, 
    fetchSingleRoom, fetchRoomChats, sendRoomChat, refreshProfile, fetchBalance,
    showAlert, addToast,
    listings, fetchRoomListings, listPosition, cancelListing, buyPosition, wallet,
    disputeRoom, resolveDispute,
    parlayCart, addLegToParlay, removeLegFromParlay
  } = useAppState();

  const room = rooms.find((r) => r.id === roomId);

  const getEvmBuyCost = (shares: number, side: 'moon' | 'jeet', moonRes: number, jeetRes: number): number => {
    const rTarget = side === 'moon' ? jeetRes : moonRes;
    const rOpposite = side === 'moon' ? moonRes : jeetRes;
    if (rTarget <= 0 || rOpposite <= 0) return shares * 0.5;
    if (shares >= rTarget + rOpposite) return shares * 0.99;
    
    const B = rTarget + rOpposite - shares;
    const C = -shares * rOpposite;
    const desc = B * B - 4 * C;
    if (desc < 0) return shares * 0.99;
    const dx = (-B + Math.sqrt(desc)) / 2;
    return (dx * 10000) / 9970;
  };

  const getEvmSharesReceived = (usdcAmount: number, side: 'moon' | 'jeet' | number, reserves: number[]): number => {
    let outcomeIndex = 0;
    if (typeof side === 'number') {
      outcomeIndex = side;
    } else {
      outcomeIndex = side === 'moon' ? 0 : 1;
    }
    const reservesCount = reserves.length;
    if (reservesCount < 2) return usdcAmount / 0.5;

    const netUsdc = (usdcAmount * 9970) / 10000;
    const targetReserve = reserves[outcomeIndex] || 0;
    if (targetReserve <= 0) return usdcAmount / 0.5;

    let prodBefore = 1;
    let prodAfter = 1;
    for (let j = 0; j < reservesCount; j++) {
      if (j !== outcomeIndex) {
        prodBefore *= reserves[j] || 1;
        prodAfter *= ((reserves[j] || 0) + netUsdc) || 1;
      }
    }
    const newTargetReserve = (targetReserve * prodBefore) / prodAfter;
    return netUsdc + targetReserve - newTargetReserve;
  };

  const getEvmSellReceived = (shares: number, side: 'moon' | 'jeet' | number, reserves: number[]): number => {
    let outcomeIndex = 0;
    if (typeof side === 'number') {
      outcomeIndex = side;
    } else {
      outcomeIndex = side === 'moon' ? 0 : 1;
    }
    const reservesCount = reserves.length;
    if (reservesCount < 2) return shares * 0.5;

    const targetReserve = reserves[outcomeIndex] || 0;
    if (targetReserve <= 0) return shares * 0.5;

    const price = targetReserve > 0 ? (1 / targetReserve) / (reserves.reduce((acc, r) => acc + (r > 0 ? 1 / r : 0), 0) || 1) : 0.5;
    return shares * price * 0.99;
  };

  const isDebateMarket = room ? (
    (room.category as string) === 'debate' || 
    (room.category as string) === 'prediction' || 
    (!!room.resolutionCriteria && room.resolutionCriteria.length > 0 && (!room.token.pairAddress || room.token.pairAddress === '')) ||
    room.token.address === room.creator
  ) : false;

  const [evmBalances, setEvmBalances] = useState<number[]>([]);
  const [evmReserves, setEvmReserves] = useState<number[]>([]);
  const [selectedOutcomeIndex, setSelectedOutcomeIndex] = useState<number>(0);
  const selectedSide = selectedOutcomeIndex === 0 ? 'moon' : 'jeet';
  const setSelectedSide = (side: 'moon' | 'jeet') => {
    setSelectedOutcomeIndex(side === 'moon' ? 0 : 1);
  };
  const [activeChatTab, setActiveChatTab] = useState<'moon' | 'jeet'>('moon');
  const [stakeAmount, setStakeAmount] = useState<number>(10);
  const [chatInput, setChatInput] = useState('');
  const [countdownText, setCountdownText] = useState('00:00:00');
  const [isRoomSettling, setIsRoomSettling] = useState(false);
  
  // AMM Trade states
  const [orderType, setOrderType] = useState<'buy' | 'sell'>('buy');
  const [tradeMode, setTradeMode] = useState<'market' | 'limit'>('limit');
  const [limitPrice, setLimitPrice] = useState<number>(0.50);
  const [sharesInput, setSharesInput] = useState<number>(10);
  const [selectedProfileAddress, setSelectedProfileAddress] = useState<string | null>(null);
  const [activeRulesTab, setActiveRulesTab] = useState<'rules' | 'context'>('rules');
  const [activeMainTab, setActiveMainTab] = useState<'trade' | 'chart' | 'liquidity' | 'holdings' | 'activity' | 'discussion'>('trade');
  const [localShake, setLocalShake] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [watchlistedIds, setWatchlistedIds] = useState<string[]>([]);
  const [onChainBets, setOnChainBets] = useState<any[]>([]);
  const [selectedBetToList, setSelectedBetToList] = useState<any | null>(null);
  const [askPriceInput, setAskPriceInput] = useState<string>('');
  const [shareCardHolding, setShareCardHolding] = useState<any | null>(null);
  const [mounted, setMounted] = useState(false);

  const [disputeCountdown, setDisputeCountdown] = useState<string | null>(null);
  const [arbitrationWinner, setArbitrationWinner] = useState<'moon' | 'jeet' | 'draw'>('moon');
  const [arbitrationOverturned, setArbitrationOverturned] = useState<boolean>(true);

  useEffect(() => {
    const settlementTime = room?.settlementTimestamp ? Number(room.settlementTimestamp) : 0;
    if (!room || room.status !== 'settled' || !settlementTime) {
      setDisputeCountdown(null);
      return;
    }
    const timer = setInterval(() => {
      const now = Date.now();
      const windowExpiry = settlementTime + 30 * 60 * 1000;
      const diff = windowExpiry - now;
      if (diff <= 0) {
        setDisputeCountdown(null);
        clearInterval(timer);
        return;
      }
      const mins = Math.floor(diff / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      setDisputeCountdown(`${mins}m ${String(secs).padStart(2, '0')}s`);
    }, 1000);
    return () => clearInterval(timer);
  }, [room?.status, room?.settlementTimestamp]);

  const isEvm = room?.id?.startsWith('0x') || room?.token?.chainId === 'avalanche';

  // Bulletproof safety parsers for all numeric room fields
  const rawMoonPool = typeof room?.moonPool === 'number' ? room.moonPool : parseFloat(room?.moonPool as any) || 0;
  const rawJeetPool = typeof room?.jeetPool === 'number' ? room.jeetPool : parseFloat(room?.jeetPool as any) || 0;

  const labelsSafe: string[] = room?.outcomeLabels && room.outcomeLabels.length >= 2
    ? room.outcomeLabels
    : [room?.moonLabel || 'YES', room?.jeetLabel || 'NO'];

  const isMultiOutcome = labelsSafe.length > 2;

  const targetCount = labelsSafe.length;
  let rawReserves: number[] = [];

  if (evmReserves.length === targetCount && evmReserves.some(r => r > 0)) {
    rawReserves = evmReserves;
  } else if (room?.poolReserves && room.poolReserves.length === targetCount && room.poolReserves.some(r => r > 0)) {
    rawReserves = room.poolReserves;
  } else {
    // If on-chain pool has a different number of outcomes or is initializing, normalize gracefully
    const totalSeed = (rawMoonPool + rawJeetPool) || 500;
    const defaultPerOutcome = totalSeed / targetCount;
    rawReserves = Array(targetCount).fill(defaultPerOutcome);
    if (targetCount === 2 && (rawMoonPool > 0 || rawJeetPool > 0)) {
      rawReserves[0] = rawMoonPool || defaultPerOutcome;
      rawReserves[1] = rawJeetPool || defaultPerOutcome;
    }
  }

  // Sum of reciprocals for multi-outcome CPMM pricing
  let sumReciprocals = 0;
  for (const r of rawReserves) {
    if (r > 0) {
      sumReciprocals += 1 / r;
    }
  }
  const poolUSDCVal = sumReciprocals > 0 ? 1 / sumReciprocals : 0;

  const reservesSafe = isEvm 
    ? rawReserves.map(() => poolUSDCVal)
    : rawReserves;

  const pricesSafe = rawReserves.map(r => {
    if (!isEvm) {
      const sum = rawReserves.reduce((a, b) => a + b, 0);
      return sum > 0 ? r / sum : (1 / targetCount);
    }
    return (r > 0 && sumReciprocals > 0) ? (1 / r) / sumReciprocals : (1 / targetCount);
  });

  const totalPotSafe = reservesSafe.reduce((a, b) => a + b, 0);
  const betsVolume = (room?.bets || []).reduce((sum: number, b: any) => sum + (Number(b.amount) || 0), 0);
  const totalVolumeSafe = totalPotSafe + betsVolume;

  const moonPoolSafe = reservesSafe[0] || 0;
  const jeetPoolSafe = reservesSafe[1] || 0;
  const moonPercentageSafe = (pricesSafe[0] || 0.5) * 100;

  const openingPriceSafe = typeof room?.openingPrice === 'number' ? room.openingPrice : room?.openingPrice ? parseFloat(room.openingPrice as any) || 0 : undefined;
  const finalPriceSafe = typeof room?.finalPrice === 'number' ? room.finalPrice : room?.finalPrice ? parseFloat(room.finalPrice as any) || 0 : undefined;
  const twapFinalPriceSafe = typeof room?.twapFinalPrice === 'number' ? room.twapFinalPrice : room?.twapFinalPrice ? parseFloat(room.twapFinalPrice as any) || 0 : undefined;
  const durationSafe = typeof room?.duration === 'number' ? room.duration : room?.duration ? parseFloat(room.duration as any) || 0 : undefined;
  const expirySafe = typeof room?.expiry === 'number' ? room.expiry : room?.expiry ? parseFloat(room.expiry as any) || 0 : 0;


  const evmYesBalance = evmBalances[0] || 0;
  const evmNoBalance = evmBalances[1] || 0;

  useEffect(() => {
    setMounted(true);
  }, []);

  const lastSyncedLabel = room?.lastSyncedAt ? formatRelativeTime(room.lastSyncedAt) : 'syncing...';

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('shitmarket-watchlist');
      if (stored) {
        try {
          setWatchlistedIds(JSON.parse(stored));
        } catch (e) {
          console.error(e);
        }
      }
    }
  }, []);

  useEffect(() => {
    const handleWatchlistChange = (e: Event) => {
      const customEvent = e as CustomEvent;
      if (customEvent.detail) {
        setWatchlistedIds(customEvent.detail);
      }
    };
    window.addEventListener('watchlist-updated', handleWatchlistChange);
    return () => window.removeEventListener('watchlist-updated', handleWatchlistChange);
  }, []);

  const toggleBookmark = (id: string) => {
    setWatchlistedIds((prev) => {
      let next;
      if (prev.includes(id)) {
        next = prev.filter((item) => item !== id);
      } else {
        next = [...prev, id];
      }
      localStorage.setItem('shitmarket-watchlist', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: next }));
      return next;
    });
  };

  const fetchEvmBalances = useCallback(async () => {
    const targetConditionId = (room?.roomPubkey?.startsWith('0x') 
      ? room.roomPubkey 
      : (room?.id?.startsWith('0x') ? room.id : (roomId?.startsWith('0x') ? roomId : ''))) as `0x${string}`;

    if (!wallet?.address || !targetConditionId || !room) return;
    try {
      const tokensAddress = CONTRACT_ADDRESSES.CONDITIONAL_TOKENS;
      const outcomeCount = room?.outcomeLabels && room.outcomeLabels.length >= 2
        ? room.outcomeLabels.length
        : 2;

      const promises = [];
      for (let i = 0; i < outcomeCount; i++) {
        promises.push((async () => {
          try {
            const tokenId = await publicClient.readContract({
              address: tokensAddress,
              abi: CONDITIONAL_TOKENS_ABI,
              functionName: 'getTokenId',
              args: [targetConditionId, BigInt(i)]
            }) as bigint;

            const bal = await publicClient.readContract({
              address: tokensAddress,
              abi: CONDITIONAL_TOKENS_ABI,
              functionName: 'balanceOf',
              args: [wallet.address as `0x${string}`, tokenId]
            }) as bigint;
            return Number(bal) / 1e6;
          } catch {
            return 0;
          }
        })());
      }
      const balances = await Promise.all(promises);
      setEvmBalances(balances);
    } catch (e) {
      console.warn("Failed to fetch EVM outcome balances:", e);
    }
  }, [wallet?.address, roomId, room]);

  const fetchEvmPoolReserves = useCallback(async () => {
    const targetConditionId = (room?.roomPubkey?.startsWith('0x') 
      ? room.roomPubkey 
      : (room?.id?.startsWith('0x') ? room.id : (roomId?.startsWith('0x') ? roomId : ''))) as `0x${string}`;
      
    if (!targetConditionId) return;
    try {
      const poolFactoryAddress = CONTRACT_ADDRESSES.AM_POOL_FACTORY;
      const poolAddress = await publicClient.readContract({
        address: poolFactoryAddress,
        abi: AM_POOL_FACTORY_ABI,
        functionName: 'getPool',
        args: [targetConditionId]
      }) as `0x${string}`;

      if (poolAddress && poolAddress !== '0x0000000000000000000000000000000000000000') {
        const outcomeCount = room?.outcomeLabels && room.outcomeLabels.length >= 2
          ? room.outcomeLabels.length
          : 2;

        const promises = [];
        for (let i = 0; i < outcomeCount; i++) {
          promises.push(
            publicClient.readContract({
              address: poolAddress,
              abi: [{
                name: 'reserves',
                type: 'function',
                stateMutability: 'view',
                inputs: [{ name: '', type: 'uint256' }],
                outputs: [{ name: '', type: 'uint256' }]
              }] as const,
              functionName: 'reserves',
              args: [BigInt(i)]
            }).then((val: any) => Number(val) / 1e6).catch(() => 0)
          );
        }
        const reserves = await Promise.all(promises);
        if (reserves.some(r => r > 0)) {
          setEvmReserves(reserves);
        }
      }
    } catch (e) {
      console.warn("Failed to fetch EVM pool reserves directly on-chain:", e);
    }
  }, [roomId, room]);

  const handleSwitchTabOrSide = useCallback((newOrderType: 'buy' | 'sell', newSide: 'moon' | 'jeet', newOutcomeIndex?: number) => {
    setOrderType(newOrderType);
    if (newOutcomeIndex !== undefined) {
      setSelectedOutcomeIndex(newOutcomeIndex);
    } else {
      setSelectedOutcomeIndex(newSide === 'moon' ? 0 : 1);
    }
    synthSound('bet');
    
    if (newOrderType === 'sell' && room) {
      const isEvm = room.id.startsWith('0x') || room.token.chainId === 'avalanche';
      const outcomeIdx = newOutcomeIndex !== undefined ? newOutcomeIndex : (newSide === 'moon' ? 0 : 1);
      const userBetsInRoom = user ? user.bets.filter(b => isSameRoom(b.roomId, room.id)) : [];
      
      let selectedSharesOwned = 0;
      if (isEvm) {
        selectedSharesOwned = evmBalances[outcomeIdx] || 0;
      } else {
        const totalPool = (room.moonPool || 0) + (room.jeetPool || 0);
        const priceMoon = totalPool > 0 ? (room.moonPool + 10) / (totalPool + 20) : 0.5;
        const priceJeet = totalPool > 0 ? (room.jeetPool + 10) / (totalPool + 20) : 0.5;
        const price = outcomeIdx === 0 ? priceMoon : priceJeet;
        selectedSharesOwned = userBetsInRoom
          .filter(b => b.side === (outcomeIdx === 0 ? 'moon' : 'jeet'))
          .reduce((sum, b) => sum + (b.shares || (b.amount / price)), 0);
      }
      setSharesInput(selectedSharesOwned > 0 ? selectedSharesOwned : 0);
    } else {
      setSharesInput(10);
    }
  }, [room, user, evmBalances]);

  const synthSound = (type: 'bet' | 'explosion' | 'whistle' | 'victory' | 'defeat' | 'degen') => {
    if (!isMuted && typeof window !== 'undefined' && (window as any).playDAppSound) {
      (window as any).playDAppSound(type);
    }
  };
  
  // Mortar animation states
  const [mortars, setMortars] = useState<MortarProjectile[]>([]);
  const [explosions, setExplosions] = useState<ExplosionParticles[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const battleLogScrollRef = useRef<HTMLDivElement>(null);

  // Top 10 Trending Meme Tokens Data for continuous marquee tape
  const top10Tokens = [
    { name: "TRENCH PEPE", symbol: "PEPE", price: "$0.00000864", change: "+101.4%" },
    { name: "SOLDIER DOG", symbol: "WIF", price: "$0.9420", change: "-77.8%" },
    { name: "TRENCH SHOVEL", symbol: "BONK", price: "$0.00001380", change: "+5.6%" },
    { name: "BREADLINE SKELETON", symbol: "JEET", price: "$0.00000001", change: "-1456%" },
    { name: "POPCAT TRUCKER", symbol: "POPCAT", price: "$1.2400", change: "+14.8%" },
    { name: "BOOK OF MEME", symbol: "BOME", price: "$0.008450", change: "-12.3%" },
    { name: "CAT IN WORLD", symbol: "MEW", price: "$0.005120", change: "+22.4%" },
    { name: "SLERF LAZY", symbol: "SLERF", price: "$0.2150", change: "-8.7%" },
    { name: "WODGE SOLDIER", symbol: "WODGE", price: "$0.000450", change: "+156.4%" },
    { name: "CHAD BULL", symbol: "CHAD", price: "$0.04560", change: "+342.1%" }
  ];

  // Tactical custom command/battle log entries
  const [battleLogs, setBattleLogs] = useState<string[]>([
    "[SYSTEM ONLINE] Battle arena telemetry initialized.",
    "[CHAD SQUAD] Parachute division waiting for deployment orders."
  ]);

  // Local room bets state
  const [roomBets, setRoomBets] = useState<any[]>([]);

  // Function to fetch room bets
  const fetchRoomBets = useCallback(async () => {
    try {
      const res = await fetch(`${INDEXER_URL}/api/rooms/${roomId}`);
      if (res.ok) {
        const json = await res.json();
        if (json.success && json.data && json.data.bets) {
          const isEvm = roomId.startsWith('0x');
          const mapped = json.data.bets.map((b: any) => ({
            id: b.id,
            user: b.userPubkey,
            side: b.side,
            amount: Number(b.amount) / (isEvm ? 1e6 : 1e9),
            timestamp: new Date(b.createdAt).getTime(),
            txSig: b.txSig || b.signature || '',
            action: b.action || 'buy'
          })).sort((a: any, b: any) => b.timestamp - a.timestamp);

          const seen = new Set();
          const clean = mapped.filter((b: any) => {
            const key = b.txSig ? b.txSig.toLowerCase() : b.id;
            if (seen.has(key)) return false;
            seen.add(key);
            return true;
          });
          setRoomBets(clean);
        }
      }
    } catch (err) {
      console.warn('Failed to fetch room bets:', err);
    }
  }, [roomId]);

  // Synchronize room details from indexer API and chain on mount & periodically
  useEffect(() => {
    let active = true;

    // Await ONLY the critical room metadata load to unblock the page layout as fast as possible
    fetchSingleRoom(roomId).finally(() => {
      if (active) setIsLoading(false);
    });

    // Hydrate secondary components (chats, profile stats, bet transactions) concurrently in background
    fetchRoomChats(roomId);
    refreshProfile();
    fetchBalance();
    fetchRoomBets();
    fetchEvmBalances();
    fetchEvmPoolReserves();

    const interval = setInterval(() => {
      fetchSingleRoom(roomId);
      fetchRoomChats(roomId);
      refreshProfile();
      fetchBalance();
      fetchRoomBets();
      fetchEvmBalances();
      fetchEvmPoolReserves();
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [roomId, fetchSingleRoom, refreshProfile, fetchBalance, fetchRoomBets, fetchEvmBalances, fetchEvmPoolReserves]);

  // Poll live token price aggregator (DexScreener, Birdeye, Jupiter, Chainlink, Pyth) every 5 seconds
  useEffect(() => {
    if (!room || room.status !== 'active') return;

    const fetchLivePrice = async () => {
      try {
        const params = new URLSearchParams();
        if (room.priceFeedId) params.set('pythFeedId', room.priceFeedId);
        if (room.token.pairAddress) params.set('pairAddress', room.token.pairAddress);
        const qs = params.toString() ? `?${params.toString()}` : '';
        const indexerUrl = `${process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:3001'}/api/rooms/token-price/${room.token.address}${qs}`;
        
        const res = await fetch(indexerUrl);
        if (res.ok) {
          const json = await res.json();
          if (json.success && isFinite(json.priceUsd) && json.priceUsd > 0) {
            setLivePrice(json.priceUsd);
          }
        }
      } catch (err) {
        console.warn('Failed to fetch live aggregated price inside room details:', err);
      }
    };

    fetchLivePrice();
    const priceInterval = setInterval(fetchLivePrice, 5000);
    return () => clearInterval(priceInterval);
  }, [room?.token?.address, room?.priceFeedId, room?.status, room?.id]);

  useEffect(() => {
    if (room?.id) {
      fetchRoomListings(room.id);
    }
  }, [room?.id]);

  useEffect(() => {
    const loadOnChainBets = async () => {
      if (!room?.id) {
        setOnChainBets([]);
        return;
      }

      if (room.id.startsWith('0x') || !wallet?.publicKey) {
        const evmBets = user ? user.bets.filter((b) => isSameRoom(b.roomId, room.id)) : [];
        setOnChainBets(evmBets.map((b) => ({
          pubkey: b.id || (b as any).pubkey || String(Date.now()),
          roomId: b.roomId,
          user: b.user,
          currentOwner: b.user,
          side: b.side,
          amount: b.amount,
          claimed: b.claimed
        })));
        return;
      }

      try {
        const program = getAnchorProgram(wallet);
        const roomPda = safePublicKey(room.id);
        if (!roomPda) {
          setOnChainBets([]);
          return;
        }
        const [newBets, legacyBets] = await Promise.all([
          connection.getProgramAccounts(program.programId, {
            filters: [
              { dataSize: 115 }, // New Bet size
              { memcmp: { offset: 8, bytes: roomPda.toBase58() } },
              { memcmp: { offset: 72, bytes: wallet.publicKey.toBase58() } }
            ]
          }),
          connection.getProgramAccounts(program.programId, {
            filters: [
              { dataSize: 83 }, // Legacy Bet size
              { memcmp: { offset: 8, bytes: roomPda.toBase58() } },
              { memcmp: { offset: 40, bytes: wallet.publicKey.toBase58() } }
            ]
          })
        ]);

        const parsedNew = newBets.map(acc => {
          const decoded = (program.coder.accounts as any).decode('Bet', acc.account.data);
          return {
            pubkey: acc.pubkey.toBase58(),
            roomId: decoded.room.toBase58(),
            user: decoded.user.toBase58(),
            currentOwner: decoded.currentOwner?.toBase58() || decoded.user.toBase58(),
            side: Object.keys(decoded.side)[0] as 'moon' | 'jeet',
            amount: decoded.amount.toNumber() / 1e9,
            claimed: decoded.claimed,
          };
        });

        const parsedLegacy = legacyBets.map(acc => {
          const data = acc.account.data;
          const room = new PublicKey(data.subarray(8, 40)).toBase58();
          const user = new PublicKey(data.subarray(40, 72)).toBase58();
          const sideByte = data[72];
          const side = sideByte === 0 ? 'moon' : 'jeet';
          const amountBN = new BN(data.subarray(73, 81), 'le');
          const amount = amountBN.toNumber() / 1e9;
          const claimed = data[81] === 1;

          return {
            pubkey: acc.pubkey.toBase58(),
            roomId: room,
            user,
            currentOwner: user, // Seller is original owner
            side,
            amount,
            claimed,
          };
        });

        setOnChainBets([...parsedNew, ...parsedLegacy]);
      } catch (err) {
        console.warn('Failed to load on-chain bets:', err);
      }
    };

    loadOnChainBets();
    const interval = setInterval(loadOnChainBets, 10000);
    return () => clearInterval(interval);
  }, [wallet?.publicKey, wallet?.address, user, room?.id, listings]);

  // Auto scroll chat list to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChatTab]);

  // Auto scroll battle logs to bottom
  useEffect(() => {
    if (battleLogScrollRef.current) {
      battleLogScrollRef.current.scrollTop = battleLogScrollRef.current.scrollHeight;
    }
  }, [battleLogs]);

  // Real-time ticking clock for this specific room
  useEffect(() => {
    if (!room) return;

    if (room.status === 'pending') {
      setCountdownText('PENDING TRIGGER');
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      if (room.status !== 'active') {
        setCountdownText('SETTLED');
        clearInterval(timer);
        return;
      }

      const delta = expirySafe - now;
      if (isNaN(delta) || delta <= 0) {
        setCountdownText('SETTLED');
        setIsRoomSettling(true);
        clearInterval(timer);
        return;
      }

      const hrs = Math.floor(delta / 3600000);
      const mins = Math.floor((delta % 3600000) / 60000);
      const secs = Math.floor((delta % 60000) / 1000);
      const format = (v: number) => String(v).padStart(2, '0');
      setCountdownText(`${format(hrs)}:${format(mins)}:${format(secs)}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [room]);

  // Find user wagers in this room
  const userBetsInRoom = user && room ? user.bets.filter((b) => isSameRoom(b.roomId, room.id)) : [];
  
  // Consolidated user bets combining local state, indexer DB profile, and on-chain account fetches
  const displayBets = useMemo(() => {
    const map = new Map<string, any>();

    userBetsInRoom.forEach((b) => {
      const roomPk = safePublicKey(room?.id);
      const userPk = safePublicKey(user?.wallet || wallet?.address || wallet?.publicKey?.toBase58()) || SystemProgram.programId;
      const key = roomPk && userPk ? getBetPda(roomPk, userPk, b.side).toBase58() : (b.id || `bet-${b.side}`);
      map.set(key, {
        pubkey: key,
        id: b.id,
        roomId: b.roomId,
        user: user?.wallet || wallet?.address || '',
        currentOwner: user?.wallet || wallet?.address || '',
        side: b.side,
        amount: b.amount,
        claimed: b.claimed,
        timestamp: b.timestamp || Date.now()
      });
    });

    onChainBets.forEach((b) => {
      map.set(b.pubkey, b);
    });

    return Array.from(map.values());
  }, [onChainBets, userBetsInRoom, room?.id, user?.wallet, wallet?.address, wallet?.publicKey]);

  // Consolidated sector transaction history combining indexer API logs and local/on-chain bets
  const allSectorBets = useMemo(() => {
    const map = new Map<string, any>();

    const getBetKey = (b: any) => {
      if (b.txSig && b.txSig !== '0x' && b.txSig !== '') {
        return `tx-${b.txSig}`;
      }
      const timeBucket = Math.floor((b.timestamp || 0) / 10000); // 10-second window
      const userClean = (b.user || b.currentOwner || '').toLowerCase();
      const sideStr = (b.side || 'moon').toLowerCase();
      const amountRounded = Math.round(Number(b.amount || 0) * 100);
      return `${userClean}-${sideStr}-${amountRounded}-${timeBucket}`;
    };

    roomBets.forEach((b) => {
      const key = getBetKey(b);
      map.set(key, {
        id: b.id || key,
        user: b.user,
        side: b.side,
        amount: b.amount,
        timestamp: b.timestamp || Date.now(),
        txSig: b.txSig
      });
    });

    displayBets.forEach((b) => {
      const key = getBetKey(b);
      if (!map.has(key)) {
        map.set(key, {
          id: b.pubkey || b.id || key,
          user: b.user || b.currentOwner || 'Recruit',
          side: b.side,
          amount: b.amount,
          timestamp: b.timestamp || Date.now(),
          txSig: b.txSig
        });
      }
    });

    return Array.from(map.values()).sort((a, b) => b.timestamp - a.timestamp);
  }, [roomBets, displayBets]);

  // Memoized top holders list derived from real live transaction logs (strictly no mocks)
  const topHolders = useMemo(() => {
    const yesMap = new Map<string, { user: string; shares: number; totalSpent: number }>();
    const noMap = new Map<string, { user: string; shares: number; totalSpent: number }>();

    // Process real transaction logs
    allSectorBets.forEach((bet) => {
      const u = bet.user || bet.currentOwner;
      if (!u) return;
      
      const side = bet.side;
      const amount = bet.amount; // already scaled to SOL/USDC

      // Estimate shares from amount spent (shares = amount / 0.50 if not specified)
      const shares = bet.shares || (amount / 0.5);

      if (side === 'moon') {
        const existing = yesMap.get(u) || { user: u, shares: 0, totalSpent: 0 };
        existing.shares += shares;
        existing.totalSpent += amount;
        yesMap.set(u, existing);
      } else {
        const existing = noMap.get(u) || { user: u, shares: 0, totalSpent: 0 };
        existing.shares += shares;
        existing.totalSpent += amount;
        noMap.set(u, existing);
      }
    });

    // Clean up negative or zero balance positions (e.g. from sells)
    const yesList = Array.from(yesMap.values())
      .filter(item => item.shares > 0.01 && item.totalSpent > 0.01)
      .sort((a, b) => b.shares - a.shares)
      .slice(0, 10);

    const noList = Array.from(noMap.values())
      .filter(item => item.shares > 0.01 && item.totalSpent > 0.01)
      .sort((a, b) => b.shares - a.shares)
      .slice(0, 10);
    
    return { yesList, noList };
  }, [allSectorBets]);

  if (isLoading && !room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center select-none bg-trench-black scanlines">
        <Loader2 size={48} className="animate-spin text-neon-moon mb-4" />
        <h3 className="font-staatliches text-2xl text-white uppercase tracking-wider">RECONSTRUCTING COURIER INTEL...</h3>
        <p className="font-mono text-xs text-trench-gasmask mt-2 uppercase font-bold tracking-widest animate-pulse">
          Decrypting block records and indexing battlefield sector...
        </p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center select-none bg-trench-black">
        <PepePortrait src={PEPE_ASSETS.jeetSkeleton} size={120} glowColor="jeet" animated className="rounded-xl mb-6" />
        <h3 className="font-staatliches text-3xl text-white uppercase tracking-wider">TRENCH RUGGED!</h3>
        <p className="font-mono text-sm text-trench-gasmask mt-2 uppercase max-w-xs font-bold leading-relaxed mb-6">
          This trench sector does not exist or has been collapsed by artillery fire.
        </p>
        <button onClick={() => router.push('/rooms')} className="retro-btn retro-btn-neutral px-6 py-2 rounded">
          RETREAT TO FRONTLINES
        </button>
      </div>
    );
  }

  // Potential payout calculation (plat fee is 1.25%)
  const getPotentialPayout = (side: 'moon' | 'jeet') => {
    const isMoon = side === 'moon';
    const futureWinningPool = (isMoon ? moonPoolSafe : jeetPoolSafe) + stakeAmount;
    const futureLosingPool = isMoon ? jeetPoolSafe : moonPoolSafe;
    const futureTotalPot = futureWinningPool + futureLosingPool;
    const netPot = futureTotalPot * 0.9875;
    const shareRatio = stakeAmount / futureWinningPool;
    const payout = shareRatio * netPot;
    return isNaN(payout) ? 0 : Number(payout.toFixed(4));
  };

  const getMultiplier = (side: 'moon' | 'jeet') => {
    const pool = side === 'moon' ? moonPoolSafe : jeetPoolSafe;
    const oppPool = side === 'moon' ? jeetPoolSafe : moonPoolSafe;
    if (pool === 0) return 2.0;
    const mult = (pool + oppPool) / pool;
    return isNaN(mult) ? 1.0 : Number(mult.toFixed(2));
  };

  const userTotalBet = displayBets.reduce((sum, b) => sum + b.amount, 0);
  const userSidesChosen = Array.from(new Set(displayBets.map((b) => b.side)));
  
  const hasBetOnMoon = userSidesChosen.includes('moon');
  const hasBetOnJeet = userSidesChosen.includes('jeet');

  const handlePlaceOrder = async (mode: 'market' | 'limit', e?: React.MouseEvent<HTMLButtonElement>) => {
    if (!user || !user.wallet) {
      connectWallet();
      synthSound('bet');
      return;
    }

    const moonPool = room.moonPool || 0;
    const jeetPool = room.jeetPool || 0;
    const isEvm = room.id.startsWith('0x') || room.token.chainId === 'avalanche';

    let totalCost = 0;
    let sharesToTrade = sharesInput;
    if (isEvm) {
      if (orderType === 'buy') {
        const usdcAmount = sharesInput;
        sharesToTrade = getEvmSharesReceived(usdcAmount, selectedOutcomeIndex, reservesSafe);
        totalCost = usdcAmount;
      } else {
        const sharesToSell = sharesInput;
        totalCost = getEvmSellReceived(sharesToSell, selectedOutcomeIndex, reservesSafe);
        sharesToTrade = sharesToSell;
      }
    } else {
      const poolTotal = moonPool + jeetPool;
      const priceMoon = (moonPool + 10) / (poolTotal + 20);
      const priceJeet = (jeetPool + 10) / (poolTotal + 20);
      const price = selectedSide === 'moon' ? priceMoon : priceJeet;
      totalCost = sharesInput * price;
    }

    if (totalCost === Infinity) {
      const rect = e?.currentTarget.getBoundingClientRect();
      showAlert('NOT ENOUGH LIQUIDITY IN THE AMM POOL RESERVE!', 'error', 'AMM DEPLETED', undefined, rect);
      return;
    }

    if (orderType === 'buy' && user.balance < totalCost) {
      const rect = e?.currentTarget.getBoundingClientRect();
      showAlert('INSUFFICIENT AMMO USDC IN WALLET!', 'error', 'INSUFFICIENT AMMO', undefined, rect);
      return;
    }

    // Dynamic projectile physics relative values
    const tx = selectedSide === 'moon'
      ? -100 - Math.random() * 200 // Left field target
      : 100 + Math.random() * 200; // Right field target
    const ty = -60 - Math.random() * 120; // Arc peak offset
    const txHalf = tx / 2;
    const tyPeak = ty - 100;

    const newMortar: MortarProjectile = {
      id: Date.now(),
      side: selectedSide,
      tx,
      ty,
      txHalf,
      tyPeak
    };

    // Trigger mortar whistle sound synthesis!
    synthSound('whistle');
    setMortars((prev) => [...prev, newMortar]);
    setLocalShake(true);

    const labelText = orderType === 'buy' ? 'DEPLOYED' : 'LIQUIDATED';
    const newLog = `[ARTILLERY SHELL] Fired ${sharesToTrade.toFixed(2)} ${selectedSide.toUpperCase()} shares ${labelText.toLowerCase()} order payload!`;
    setBattleLogs((prev) => [...prev, newLog]);

    // After flight finishes (800ms)
    setTimeout(() => {
      setLocalShake(false);
      synthSound('explosion');
      
      // Spawn explosion particle
      const newExplosion: ExplosionParticles = {
        id: Date.now(),
        side: selectedSide,
        x: tx,
        y: ty
      };
      setExplosions((prev) => [...prev, newExplosion]);

      // Remove projectile
      setMortars((prev) => prev.filter((m) => m.id !== newMortar.id));

      // Clean up explosion particle after 500ms
      setTimeout(() => {
        setExplosions((prev) => prev.filter((e) => e.id !== newExplosion.id));
      }, 500);

      // Append hit confirmation to logs
      setBattleLogs((prev) => [...prev, `[IMPACT CONFIRMED] Shell detonated on opposing faction trenches!`]);
    }, 800);

    try {
      if (mode === 'limit') {
        await placeLimitOrder(room.id, orderType, selectedOutcomeIndex, limitPrice, sharesToTrade);
      } else {
        const slippageMultiplier = orderType === 'buy' ? 1.03 : 0.97;
        const limitUsdc = totalCost * slippageMultiplier;
        await executeEvmMarketTrade(room.id, selectedOutcomeIndex, sharesToTrade, orderType, limitUsdc);
        fetchEvmBalances();
        fetchEvmPoolReserves();
      }
      
      // Optimistic update for Activity tab
      const optimisticBet = {
        id: 'opt-' + Date.now(),
        user: user.wallet,
        side: selectedSide,
        amount: totalCost,
        timestamp: Date.now()
      };
      setRoomBets((prev) => [optimisticBet, ...prev]);
      
      fetchRoomBets();
    } catch (err) {
      console.error('Failed to execute bet:', err);
    }
  };

  const handleClaim = async () => {
    if (!user) return;
    try {
      await claimWinnings(room.id);
      synthSound('victory');
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.8 },
        colors: ['#FFD700', '#16A34A']
      });
      setBattleLogs((prev) => [...prev, `[BOOTY DISPATCHED] User claimed on-chain winnings/refund!`]);
    } catch (err: any) {
      console.error('Claim failed:', err);
      showAlert(
        err?.message || 'CLAIM FAILED — Transaction rejected. Please try again.',
        'error',
        'CLAIM FAILED'
      );
    }
  };

  const handleSendChat = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Restrict broadcasting to connected users
    if (!user || !user.wallet) {
      const submitBtn = e.currentTarget.querySelector('button[type="submit"]') as HTMLButtonElement | null;
      const rect = submitBtn ? submitBtn.getBoundingClientRect() : e.currentTarget.getBoundingClientRect();
      showAlert("SIGNAL INTRUSION DETECTED: BROADCAST DENIED! PLEASE ENLIST YOUR WALLET COMS HELMET TO TRANSMIT RADIO SIGNALS.", 'error', 'SIGNAL INTRUSION', undefined, rect);
      return;
    }

    sendRoomChat(room.id, activeChatTab, user.wallet, chatInput.trim());

    setChatInput('');
    synthSound('bet');
  };

  // Filter messages for current room and active chat tab (plus all-channels alerts)
  const activeRoomChats = chatMessages.filter(
    (c) => c.roomId === room.id && (c.side === activeChatTab || c.side === 'all')
  );

  if (!mounted || !room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] font-mono text-xs uppercase tracking-widest text-trench-gasmask animate-pulse bg-transparent">
        <Loader2 className="animate-spin text-neon-moon mb-3" size={32} />
        <span>ESTABLISHING TARGET SCAN... SECURING ENCRYPTED LINK</span>
      </div>
    );
  }

  const isSettled = room.status === 'settled';
  const isDrawOrVoid = isSettled && (!room.winner || room.winner === 'draw');
  const userWon = isSettled && room.winner && room.winner !== 'draw' && userSidesChosen.includes(room.winner as any);
  const userLost = isSettled && room.winner && room.winner !== 'draw' && userSidesChosen.length > 0 && !userSidesChosen.includes(room.winner as any);
  const hasUnclaimed = isSettled && (userWon || (isDrawOrVoid && userBetsInRoom.length > 0)) && userBetsInRoom.some((b) => !b.claimed);

  return (
    <div className={`w-full flex-1 flex flex-col select-none relative overflow-x-hidden transition-transform duration-100 bg-slate-50 dark:bg-slate-950 min-h-screen text-slate-900 dark:text-white font-mono ${
      localShake ? 'animate-[shake_0.5s_ease-in-out]' : ''
    }`}>
      
      {/* Dynamic inline style sheets */}
      <style dangerouslySetInnerHTML={{ __html: `
        .wood-btn {
            background-color: #5C3A21;
            border-bottom: 4px solid #3A2512;
            transition: all 0.1s;
        }
        .wood-btn:active {
            border-bottom: 0px solid #3A2512;
            transform: translateY(4px);
        }

        .neon-glow {
            box-shadow: 0 0 15px 2px rgba(57, 255, 20, 0.5);
        }
        
        .jeet-glow {
            box-shadow: 0 0 15px 2px rgba(255, 83, 90, 0.5);
        }

        .heavy-shake {
            animation: heavy-shake 0.8s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes heavy-shake {
            0%, 100% { transform: translate3d(0, 0, 0); }
            10%, 30%, 50%, 70%, 90% { transform: translate3d(-8px, 4px, 0) rotate(-1deg); }
            20%, 40%, 60%, 80% { transform: translate3d(8px, -4px, 0) rotate(1deg); }
        }

        /* Continuous scrolling tape marquee animation */
        @keyframes marquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-marquee {
            animation: marquee 35s linear infinite;
        }

        /* Diagonal stripes/hatch pattern background */
        .hatch-pattern {
            background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.08), rgba(0,0,0,0.08) 6px, transparent 6px, transparent 12px);
        }

        /* Mortar System Styles */
        .mortar-container {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 20;
            overflow: hidden;
        }

        .mortar {
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            pointer-events: none;
            animation: mortarArc cubic-bezier(.25,.1,.25,1) forwards 0.8s;
        }

        .mortar-moon {
            background-color: #16a34a;
            box-shadow: 0 0 10px #16a34a, 0 0 20px #16a34a, -10px 10px 20px rgba(57, 255, 20, 0.5);
        }

        .mortar-jeet {
            background-color: #ff535a;
            box-shadow: 0 0 10px #ff535a, 0 0 20px #ff535a, 10px 10px 20px rgba(255, 83, 90, 0.5);
        }

        @keyframes mortarArc {
            0% {
                transform: translate(0, 0) scale(1);
                opacity: 1;
            }
            50% {
                transform: translate(var(--tx-half), var(--ty-peak)) scale(1.8);
            }
            95% {
                transform: translate(var(--tx), var(--ty)) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx), var(--ty)) scale(0);
                opacity: 0;
            }
        }

        .explosion {
            position: absolute;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: explode 0.5s ease-out forwards;
            pointer-events: none;
            mix-blend-mode: screen;
        }

        .explosion-moon {
            background: radial-gradient(circle, rgba(57,255,20,1) 0%, rgba(57,255,20,0) 70%);
        }

        .explosion-jeet {
            background: radial-gradient(circle, rgba(255,83,90,1) 0%, rgba(255,83,90,0) 70%);
        }

        @keyframes explode {
            0% {
                width: 0;
                height: 0;
                opacity: 1;
            }
            100% {
                width: 140px;
                height: 140px;
                opacity: 0;
            }
        }

        @keyframes radar-sweep {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(380px); }
        }
        .radar-sweep-line {
            animation: radar-sweep 6s linear infinite;
        }
      ` }} />

      {/* 1. CYAN TOP NAVIGATION BAR */}
      <div className="w-full bg-[#A8EEFF] px-4 py-3 flex items-center justify-between z-20 relative select-none border-b border-cyan-300">
        <div className="flex items-center gap-2">
          <Link href="/rooms">
            <button
              onClick={() => synthSound('bet')}
              className="bg-black hover:bg-slate-900 text-white font-mono text-xs uppercase px-4 py-2 rounded font-bold shadow-md transition-all active:scale-95 border-b-2 border-slate-950"
            >
              ← WAR ROOM
            </button>
          </Link>
          <button
            onClick={() => {
              if (room) toggleBookmark(room.id);
              synthSound('bet');
            }}
            className="bg-black hover:bg-slate-900 text-white font-mono text-xs uppercase px-4 py-2 rounded font-bold shadow-md transition-all active:scale-95 border-b-2 border-slate-950 flex items-center gap-1.5"
          >
            <span>{room && watchlistedIds.includes(room.id) ? '☒' : '☐'}</span>
            <span>BOOKMARK</span>
          </button>
        </div>

        {room && (
          <div className="bg-[#B8001F] text-white px-3 py-1.5 rounded font-mono text-xs uppercase font-bold flex items-center gap-2 border border-red-800 shadow-sm shrink-0">
            <span className="opacity-75 text-[10px]">ARENA CLOSING</span>
            <span className="font-extrabold">{countdownText}</span>
          </div>
        )}
      </div>

      {/* 2. THE SPLIT-SCREEN TRENCH HEADER OR MULTI-OUTCOME REAL-TIME CHART */}
      {room && (
        isMultiOutcome ? (
          <section className="relative w-full bg-slate-950 border-b-4 border-slate-800 p-6 flex flex-col justify-center z-10 scanlines select-none">
            <div className="max-w-7xl mx-auto w-full space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-mono text-xs font-bold text-slate-400 tracking-wider">LIVE ODDS REAL-TIME TELEMETRY</span>
                <span className="font-mono text-[10px] text-emerald-500 font-extrabold flex items-center gap-1.5 animate-pulse">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                  REAL-TIME SYNC
                </span>
              </div>
              <OddsHistoryChart 
                pricesSafe={pricesSafe} 
                labelsSafe={labelsSafe} 
                bets={roomBets}
              />
            </div>
          </section>
        ) : (
          <section 
            className="relative w-full min-h-[220px] sm:min-h-[280px] h-[30vh] sm:h-[35vh] md:h-[38vh] overflow-hidden border-b-4 border-slate-800 flex z-10 scanlines bg-[#020501] select-none" 
            id="battlefield"
          >
            {/* Real-time Mortar Container Overlay */}
            <div className="mortar-container" id="mortar-container">
              {mortars.map((m) => (
                <div
                  key={m.id}
                  className={`mortar ${m.side === 'moon' ? 'mortar-moon' : 'mortar-jeet'}`}
                  style={{
                    left: '50%',
                    bottom: '0px',
                    '--tx': `${m.tx}px`,
                    '--ty': `${m.ty}px`,
                    '--tx-half': `${m.txHalf}px`,
                    '--ty-peak': `${m.tyPeak}px`,
                  } as React.CSSProperties}
                />
              ))}
              {explosions.map((e) => (
                <div
                  key={e.id}
                  className={`explosion ${e.side === 'moon' ? 'explosion-moon' : 'explosion-jeet'}`}
                  style={{
                    left: `calc(50% + ${e.x}px)`,
                    bottom: `calc(10px + ${Math.abs(e.y)}px)`,
                  }}
                />
              ))}
            </div>

            {/* Left Side: Moon Army (Charging Pepes) */}
            <div className="w-1/2 h-full bg-slate-950 relative group overflow-hidden border-r-2 border-dashed border-slate-800/40">
              <div className="absolute inset-0">
                <img 
                  alt="Moon Army Charging" 
                  className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-700 filter sepia saturate-[350%] hue-rotate-[85deg] contrast-[1.2]" 
                  src={PEPE_ASSETS.moonJuice}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-emerald-500/10 to-transparent mix-blend-color opacity-90 pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-r from-slate-950/80 via-transparent to-transparent pointer-events-none"></div>
              
              {/* Moon Army Commander Portrait */}
              <div className="absolute top-4 left-4 border-2 border-dashed border-emerald-500 bg-slate-950/90 px-3 py-1 rotate-[-4deg] shadow-lg flex items-center gap-1.5 z-10">
                <PepePortrait src={PEPE_ASSETS.chadBull} size={24} loading="eager" className="rounded-full shrink-0" />
                <span className="font-mono text-emerald-500 text-xs font-bold uppercase tracking-wider block">BULLISH TRENCH</span>
              </div>
              
              {/* Moon Stats Counter Card */}
              <div className="absolute bottom-4 left-4 bg-slate-950/85 border border-emerald-500/50 p-3 rounded-xl backdrop-blur-sm z-10 select-none text-left">
                <span className="font-mono text-[9px] text-emerald-500 uppercase tracking-widest block font-bold">MOON POT</span>
                <span className="font-mono text-white text-lg font-bold block mt-0.5">
                  {moonPoolSafe.toFixed(2)} USDC
                </span>
                <span className="font-mono text-[9px] text-slate-400 mt-0.5 block font-bold">
                  Implied Odds: <span className="text-white">{moonPercentageSafe.toFixed(0)}%</span>
                </span>
              </div>
            </div>

            {/* Right Side: Jeet Army (Charging Skeletons) */}
            <div className="w-1/2 h-full bg-slate-950 relative group overflow-hidden">
              <div className="absolute inset-0">
                <img 
                  alt="Jeet Army Fleeing" 
                  className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-700 filter sepia saturate-[250%] hue-rotate-[320deg] contrast-[1.1]" 
                  src={PEPE_ASSETS.jeetSkeleton}
                />
              </div>
              <div className="absolute inset-0 bg-gradient-to-l from-slate-950 via-rose-500/10 to-transparent mix-blend-color opacity-90 pointer-events-none"></div>
              <div className="absolute inset-0 bg-gradient-to-l from-slate-950/80 via-transparent to-transparent pointer-events-none"></div>
              
              {/* Jeet Army Commander Portrait */}
              <div className="absolute top-4 right-4 border-2 border-dashed border-rose-500 bg-slate-950/90 px-3 py-1 rotate-[4deg] shadow-lg flex items-center gap-1.5 z-10">
                <PepePortrait src={PEPE_ASSETS.jeetSkeleton} size={24} loading="eager" className="rounded-full shrink-0" />
                <span className="font-mono text-rose-500 text-xs font-bold uppercase tracking-wider block">BEARISH WASTELAND</span>
              </div>

              {/* Jeet Stats Counter Card */}
              <div className="absolute bottom-4 right-4 bg-slate-950/85 border border-rose-500/50 p-3 rounded-xl backdrop-blur-sm z-10 text-right select-none">
                <span className="font-mono text-[9px] text-rose-500 uppercase tracking-widest block font-bold">JEET POT</span>
                <span className="font-mono text-white text-lg font-bold block mt-0.5">
                  {jeetPoolSafe.toFixed(2)} USDC
                </span>
                <span className="font-mono text-[9px] text-slate-400 mt-0.5 block font-bold">
                  Implied Odds: <span className="text-white">{jeetPercentageSafe.toFixed(0)}%</span>
                </span>
              </div>
            </div>

            {/* Interactive Center Command Deck */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-20 flex flex-col items-center gap-3">
              {/* Mute/Sound Toggle Badge */}
              <button
                onClick={() => {
                  setIsMuted(!isMuted);
                  synthSound('bet');
                }}
                className="bg-black/90 hover:bg-slate-900 border border-slate-700/60 px-3 py-1.5 rounded-full font-mono text-[9px] text-white uppercase tracking-wider font-extrabold shadow-lg transition-all active:scale-95 flex items-center gap-1"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                <span>{isMuted ? 'SOUND MUTED' : 'SOUNDS PLAYING'}</span>
              </button>

              {/* Interactive Battle Swords - fires test artillery shell when clicked! */}
              <button
                onClick={() => {
                  synthSound('whistle');
                  const targetSide = (Math.random() > 0.5 ? 'moon' : 'jeet') as 'moon' | 'jeet';
                  const tx = targetSide === 'moon' ? -100 - Math.random() * 200 : 100 + Math.random() * 200;
                  const ty = -60 - Math.random() * 120;
                  const newMortar = { id: Date.now(), side: targetSide, tx, ty, txHalf: tx / 2, tyPeak: ty - 100 };
                  setMortars((prev) => [...prev, newMortar]);
                  setTimeout(() => {
                    synthSound('explosion');
                    setExplosions((prev) => [...prev, { id: Date.now(), side: targetSide, x: tx, y: ty }]);
                    setMortars((prev) => prev.filter((m) => m.id !== newMortar.id));
                    setTimeout(() => {
                      setExplosions((prev) => prev.filter((e) => e.id !== newMortar.id));
                    }, 500);
                  }, 800);
                }}
                className="w-16 h-16 rounded-full bg-black/90 hover:bg-slate-950 border-4 border-slate-800 text-white flex items-center justify-center shadow-2xl hover:scale-105 active:scale-95 transition-all group relative cursor-pointer"
                title="Click to Deploy Test Artillery Payload"
              >
                <Swords className="text-white group-hover:rotate-12 transition-transform" size={24} />
              </button>

              {/* User Fighter Role Stance Badge */}
              {(() => {
                const userBetsInRoom = user ? user.bets.filter(b => b.roomId === room.id) : [];
                const hasMoon = userBetsInRoom.some(b => b.side === 'moon');
                const hasJeet = userBetsInRoom.some(b => b.side === 'jeet');
                
                let fighterText = 'OBSERVER 🕵️‍♂️';
                if (hasMoon && hasJeet) fighterText = 'DOUBLE AGENT 🎭';
                else if (hasMoon) fighterText = 'YES SOLDIER 🚀';
                else if (hasJeet) fighterText = 'NO SOLDIER 💀';

                return (
                  <div className="bg-black/90 border border-slate-800 px-4 py-1.5 rounded font-mono text-[9px] text-slate-400 uppercase tracking-widest font-extrabold">
                    YOU ARE FIGHTING FOR: <span className="text-white">{fighterText}</span>
                  </div>
                );
              })()}
            </div>
          </section>
        )
      )}

      {/* 3. odds color split bar indicator separating visual header from content */}
      {room && (
        <div className="w-full h-1 flex z-10 relative bg-slate-950">
          {labelsSafe.map((_, idx) => {
            const pct = (pricesSafe[idx] || 0) * 100;
            const colors = ['bg-emerald-500', 'bg-rose-500', 'bg-blue-500', 'bg-amber-500', 'bg-purple-500', 'bg-teal-500'];
            const colorClass = colors[idx % colors.length];
            return (
              <div 
                key={idx}
                className={`${colorClass} h-full transition-all duration-700 ease-out`} 
                style={{ width: `${Math.max(0.5, pct)}%` }} 
              />
            );
          })}
        </div>
      )}

      {/* Main Container */}
      <div className="max-w-7xl mx-auto w-full px-4 py-8 flex-1 flex flex-col gap-6 text-slate-800 dark:text-white">
        
        {/* Sleek Polymarket-style Header Card */}
        {room && (
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 md:p-8 space-y-4">
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-md bg-slate-100 dark:bg-slate-855 font-mono text-[10px] text-slate-600 dark:text-slate-400 font-bold uppercase tracking-wider">
                {room.category || 'Crypto'}
              </span>
              <span className="px-2.5 py-0.5 rounded-md bg-emerald-500/10 border border-emerald-500/30 font-mono text-[10px] text-emerald-500 font-bold uppercase">
                Active
              </span>
            </div>

            <h1 className="font-sans text-2xl md:text-3xl text-slate-900 dark:text-white tracking-tight font-extrabold leading-tight">
              {room.resolutionCriteria 
                ? room.resolutionCriteria.split('| Ref:')[0].trim() 
                : `Will ${room.token.name} end above $${openingPriceSafe !== undefined ? formatPrice(openingPriceSafe) : 'N/A'}?`
              }
            </h1>

            <p className="font-sans text-sm text-slate-500 dark:text-slate-400 max-w-4xl leading-relaxed" suppressHydrationWarning>
              {isDebateMarket ? (
                room.resolutionCriteria 
                  ? room.resolutionCriteria.split('| Ref:')[0].trim() 
                  : (room.rules || `This market resolves according to the designated real-world event criteria before expiry.`)
              ) : (
                <>
                  This market resolves YES if the price of <strong>{room.token.symbol}</strong> closes above <strong>${openingPriceSafe !== undefined ? formatPrice(openingPriceSafe) : 'N/A'}</strong> at the resolution target time of <strong>{new Date(expirySafe).toLocaleString()}</strong>, as reported by oracle price feeds.
                  {room.resolutionCriteria && 
                   room.resolutionCriteria.trim().toUpperCase() !== room.token.symbol.toUpperCase() && 
                   room.resolutionCriteria.trim().toUpperCase() !== room.token.name.toUpperCase() && (
                    <span className="block mt-2 text-xs text-slate-400 dark:text-slate-500">
                      Additional Criteria: "{room.resolutionCriteria.split('| Ref:')[0].trim()}"
                    </span>
                  )}
                </>
              )}
            </p>

            {/* Crypto Market Live Price Trackers */}
            {!isDebateMarket && (
              <div className="flex gap-4 p-3.5 bg-slate-50 dark:bg-slate-950 border border-slate-100 dark:border-slate-800 rounded-xl max-w-md">
                <div className="flex-1 text-center font-mono">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold">STRIKE / ENTRY PRICE</div>
                  <div className="text-base text-slate-900 dark:text-white font-extrabold mt-1">
                    ${openingPriceSafe !== undefined ? formatPrice(openingPriceSafe) : '0.00'}
                  </div>
                </div>
                <div className="w-px bg-slate-200 dark:bg-slate-800" />
                <div className="flex-1 text-center font-mono">
                  <div className="text-[10px] text-slate-500 dark:text-slate-400 uppercase font-bold flex items-center justify-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping inline-block" /> LIVE PRICE
                  </div>
                  <div className="text-base text-emerald-500 font-extrabold mt-1">
                    {livePrice !== null ? `$${formatPrice(livePrice)}` : 'FETCHING...'}
                  </div>
                </div>
              </div>
            )}

            {/* Resolution Rules Details */}
            <div className="bg-slate-50/50 dark:bg-slate-950/40 border border-slate-100 dark:border-slate-800 p-4 rounded-xl max-w-4xl space-y-2 text-xs font-mono">
              <div className="text-slate-900 dark:text-white font-bold uppercase">Market Resolution Rules:</div>
              {isDebateMarket ? (
                <div className="space-y-2 text-slate-600 dark:text-slate-400 font-sans text-xs leading-relaxed">
                  <p className="font-semibold text-slate-800 dark:text-slate-200">
                    {room.resolutionCriteria 
                      ? room.resolutionCriteria.split('| Ref:')[0].trim() 
                      : (room.rules || 'Market resolves based on the verified real-world event outcome at or before expiry.')}
                  </p>
                  <ul className="list-disc list-inside space-y-1 font-mono text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                    {labelsSafe.map((label, idx) => (
                      <li key={idx}>
                        <span className="font-bold text-slate-800 dark:text-slate-200">{label}:</span> Resolves to 100% payout if this outcome is verified.
                      </li>
                    ))}
                    <li>
                      <span className="text-slate-900 dark:text-white font-bold">Settlement Oracle / Resolver:</span> {room.oracleAddress ? `Verified Oracle (${room.oracleAddress.slice(0, 6)}...${room.oracleAddress.slice(-4)})` : 'Designated Market Resolver'}
                    </li>
                  </ul>
                </div>
              ) : (
                <ul className="list-disc list-inside space-y-1 text-slate-500 dark:text-slate-400 font-bold">
                  <li>
                    <span className="text-emerald-500">YES Outcome ({room.moonLabel || 'YES'}):</span> The final oracle price at expiry is strictly greater than <span className="text-slate-900 dark:text-white">${openingPriceSafe !== undefined ? formatPrice(openingPriceSafe) : '0.00'}</span>.
                  </li>
                  <li>
                    <span className="text-rose-500">NO Outcome ({room.jeetLabel || 'NO'}):</span> The final oracle price at expiry is less than or equal to <span className="text-slate-900 dark:text-white">${openingPriceSafe !== undefined ? formatPrice(openingPriceSafe) : '0.00'}</span>.
                  </li>
                  <li>
                    <span className="text-slate-900 dark:text-white">Settlement Oracle:</span> Verified EVM Oracle Registry via assigned resolver address ({room.oracleAddress ? `${room.oracleAddress.slice(0, 8)}...${room.oracleAddress.slice(-6)}` : 'N/A'}).
                  </li>
                </ul>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-2 border-t border-slate-100 dark:border-slate-850 font-mono text-xs text-slate-400 dark:text-slate-500">
              <div className="flex items-center gap-1">
                <span>Ends:</span>
                <span className="text-slate-800 dark:text-slate-350 font-bold">{countdownText}</span>
              </div>
              <div 
                onClick={() => {
                  navigator.clipboard.writeText(room.id);
                  addToast("ROOM CONTRACT COPIED!", 'success');
                }}
                className="flex items-center gap-1.5 select-all cursor-pointer hover:text-emerald-500 transition-colors" 
                title={`Copy Room CA: ${room.id}`}
              >
                <span>Room CA:</span>
                <span className="text-slate-800 dark:text-slate-350 font-bold">{room.id.slice(0, 6)}...{room.id.slice(-4)}</span>
              </div>
              {!isDebateMarket && room.token.address && (
                <div 
                  onClick={() => {
                    navigator.clipboard.writeText(room.token.address);
                    addToast("TOKEN CONTRACT COPIED!", 'success');
                  }}
                  className="flex items-center gap-1.5 select-all cursor-pointer hover:text-emerald-500 transition-colors" 
                  title={`Copy Token CA: ${room.token.address}`}
                >
                  <span>Token CA:</span>
                  <span className="text-slate-800 dark:text-slate-350 font-bold">{room.token.address.slice(0, 6)}...{room.token.address.slice(-4)}</span>
                </div>
              )}
              <div className="flex items-center gap-1">
                <span>Volume:</span>
                <span className="text-slate-800 dark:text-slate-350 font-bold">{totalVolumeSafe.toFixed(2)} USDC</span>
              </div>
              {room.resolutionCriteria && room.resolutionCriteria.includes('Ref:') && (
                <a 
                  href={room.resolutionCriteria.split('Ref:')[1]?.trim() || '#'} 
                  target="_blank" 
                  rel="noreferrer" 
                  className="flex items-center gap-1 text-emerald-500 hover:text-emerald-400 transition-colors"
                >
                  <span>Resolution Source</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        )}

        {/* Dual Column Layout Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          
          {/* COLUMN 1: TRADING TERMINAL & MEDIA CONTENT (lg:col-span-8) */}
          <div className="lg:col-span-8 space-y-6">
            
            {/* Big outcomes percentage card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 rounded-2xl shadow-sm space-y-6">
              <div className={`grid gap-4 ${
                labelsSafe.length > 2 
                  ? 'grid-cols-2 md:grid-cols-3' 
                  : 'grid-cols-2'
              }`}>
                {labelsSafe.map((label, idx) => {
                  const pct = (pricesSafe[idx] || 0) * 100;
                  const isSelected = selectedOutcomeIndex === idx;
                  const themeColors = [
                    { text: 'text-emerald-500 dark:text-emerald-400', border: 'border-emerald-500', bg: 'bg-emerald-500/5', dot: 'bg-emerald-500' },
                    { text: 'text-rose-500 dark:text-rose-400', border: 'border-rose-500', bg: 'bg-rose-500/5', dot: 'bg-rose-500' },
                    { text: 'text-blue-500 dark:text-blue-400', border: 'border-blue-500', bg: 'bg-blue-500/5', dot: 'bg-blue-500' },
                    { text: 'text-amber-500 dark:text-amber-400', border: 'border-amber-500', bg: 'bg-amber-500/5', dot: 'bg-amber-500' },
                    { text: 'text-purple-500 dark:text-purple-400', border: 'border-purple-500', bg: 'bg-purple-500/5', dot: 'bg-purple-500' },
                    { text: 'text-teal-500 dark:text-teal-400', border: 'border-teal-500', bg: 'bg-teal-500/5', dot: 'bg-teal-500' }
                  ];
                  const theme = themeColors[idx % themeColors.length];

                  return (
                    <div 
                      key={idx}
                      onClick={() => { setSelectedOutcomeIndex(idx); setOrderType('buy'); synthSound('bet'); }}
                      className={`border rounded-xl p-4 sm:p-5 text-center cursor-pointer transition-all duration-200 relative overflow-hidden ${
                        isSelected && orderType === 'buy'
                          ? `${theme.bg} ${theme.border} shadow-lg shadow-emerald-500/5 ring-1 ring-emerald-500/30`
                          : 'bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/40 hover:border-slate-300 dark:hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-center gap-1.5 mb-1.5">
                        <span className={`w-2 h-2 rounded-full ${theme.dot}`} />
                        <span className="font-mono text-xs font-extrabold uppercase tracking-wider text-slate-700 dark:text-slate-300 truncate max-w-[150px]">{label}</span>
                      </div>
                      <span className={`font-sans text-3xl font-black ${theme.text} block tracking-tight`}>
                        {pct.toFixed(1)}%
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Industry-Standard Slim Odds Distribution Bar */}
              <div className="space-y-2 pt-1">
                <div className="w-full h-2 rounded-full bg-slate-100 dark:bg-slate-800/80 p-0.5 overflow-hidden flex gap-0.5 shadow-inner border border-slate-200/40 dark:border-slate-800/60">
                  {labelsSafe.map((_, idx) => {
                    const pct = (pricesSafe[idx] || 0) * 100;
                    const colors = [
                      'from-emerald-400 to-emerald-500 shadow-emerald-500/20',
                      'from-rose-400 to-rose-500 shadow-rose-500/20',
                      'from-blue-400 to-blue-500 shadow-blue-500/20',
                      'from-amber-400 to-amber-500 shadow-amber-500/20',
                      'from-purple-400 to-purple-500 shadow-purple-500/20',
                      'from-teal-400 to-teal-500 shadow-teal-500/20'
                    ];
                    const colorGradient = colors[idx % colors.length];
                    return (
                      <div 
                        key={idx}
                        title={`${labelsSafe[idx]}: ${pct.toFixed(1)}%`}
                        className={`bg-gradient-to-r ${colorGradient} h-full rounded-full transition-all duration-700 ease-out relative group`} 
                        style={{ width: `${Math.max(0.5, pct)}%` }} 
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between items-center text-[10px] font-mono text-slate-500 dark:text-slate-400 px-0.5">
                  <span>MARKET PROBABILITY SPREAD</span>
                  <span className="font-extrabold text-emerald-500">100% ALLOCATED</span>
                </div>
              </div>
            </div>

            {/* Tab Deck Card */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden shadow-sm">
              
              {/* Tab Bar Header */}
              <div className="flex border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 overflow-x-auto scrollbar">
                {(room.id.startsWith('0x') 
                  ? ['trade', 'chart', 'liquidity', 'holdings', 'activity', 'discussion'] as const 
                  : ['trade', 'chart', 'holdings', 'activity', 'discussion'] as const
                ).map((tab) => (
                  <button
                    key={tab}
                    type="button"
                    onClick={() => { setActiveMainTab(tab as any); synthSound('bet'); }}
                    className={`px-6 py-4 font-mono text-xs uppercase tracking-wider font-bold transition-all relative whitespace-nowrap ${
                      activeMainTab === tab
                        ? 'text-slate-900 dark:text-white'
                        : 'text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-355'
                    }`}
                  >
                    {tab}
                    {activeMainTab === tab && (
                      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-rose-500" />
                    )}
                  </button>
                ))}
              </div>

              {/* Tab Content Panels */}
              <div className="p-6">
                
                {/* 1. TRADE PANEL */}
                {activeMainTab === 'trade' && room && (
                  <div className="space-y-6">
                    {/* Buy / Sell swap toggles */}
                    <div className="grid grid-cols-2 gap-2 bg-slate-50 dark:bg-slate-950 p-1 border border-slate-200 dark:border-slate-855 rounded-xl">
                       <button
                         onClick={() => handleSwitchTabOrSide('buy', selectedSide)}
                         className={`py-3 text-center font-mono text-xs uppercase rounded-lg transition-all font-bold ${
                           orderType === 'buy' ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                         }`}
                       >
                         BUY
                       </button>
                       <button
                         onClick={() => handleSwitchTabOrSide('sell', selectedSide)}
                         className={`py-3 text-center font-mono text-xs uppercase rounded-lg transition-all font-bold ${
                           orderType === 'sell' ? 'bg-rose-500 text-white shadow-sm' : 'text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
                         }`}
                       >
                         SELL
                       </button>
                     </div>
 
                     {/* Stance selectors */}
                     <div className="space-y-2">
                       <label className="block font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                         CHOOSE OUTCOME:
                       </label>
                       <div className={`grid gap-3 ${
                         labelsSafe.length > 2 
                           ? 'grid-cols-2 md:grid-cols-3' 
                           : 'grid-cols-2'
                       }`}>
                         {labelsSafe.map((label, idx) => {
                           const pct = (pricesSafe[idx] || 0) * 100;
                           const isSelected = selectedOutcomeIndex === idx;
                           const isYesSide = idx === 0;
                           const borderClass = isSelected 
                             ? (isYesSide ? 'border-emerald-500 bg-emerald-500/5 text-emerald-500' : 'border-rose-500 bg-rose-500/5 text-rose-500')
                             : 'border-slate-200 dark:border-slate-800 text-slate-400 dark:text-slate-500 hover:text-slate-900 dark:hover:text-white';
                           return (
                             <button
                               key={idx}
                               type="button"
                               onClick={() => handleSwitchTabOrSide(orderType, idx === 0 ? 'moon' : 'jeet', idx)}
                               className={`py-4 rounded-xl border-2 font-mono text-xs uppercase font-bold transition-all flex flex-col items-center justify-center gap-1 ${borderClass}`}
                             >
                               <span className="truncate max-w-full px-2">{label}</span>
                               <span className="text-[10px] opacity-75">{pct.toFixed(0)}%</span>
                             </button>
                           );
                         })}
                       </div>
                    </div>

                    {/* Quantity Input */}
                    {(() => {
                      const userBetsInRoom = user ? user.bets.filter(b => isSameRoom(b.roomId, room.id)) : [];
                      const isEvm = room.id.startsWith('0x') || room.token.chainId === 'avalanche';
                      let selectedSharesOwned = 0;
                      
                      if (isEvm) {
                        selectedSharesOwned = evmBalances[selectedOutcomeIndex] || 0;
                      } else {
                        const moonPool = room.moonPool || 0;
                        const jeetPool = room.jeetPool || 0;
                        const totalPool = moonPool + jeetPool;
                        const priceMoon = totalPool > 0 ? (moonPool + 10) / (totalPool + 20) : 0.5;
                        const priceJeet = totalPool > 0 ? (jeetPool + 10) / (totalPool + 20) : 0.5;
                        const price = selectedOutcomeIndex === 0 ? priceMoon : priceJeet;
                        selectedSharesOwned = userBetsInRoom
                          .filter(b => b.side === (selectedOutcomeIndex === 0 ? 'moon' : 'jeet'))
                          .reduce((sum, b) => sum + (b.shares || (b.amount / price)), 0);
                      }

                      return (
                        <div className="space-y-2">
                          <label className="block font-mono text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex justify-between">
                            <span>{orderType === 'buy' ? 'USDC AMOUNT:' : 'SHARES AMOUNT:'}</span>
                            <span>
                              {orderType === 'buy'
                                ? <>
                                    Balance: {user?.balance !== undefined ? user.balance.toFixed(2) : '0.00'} USDC
                                    {user?.balance !== undefined && user.balance > 0 && (
                                      <button 
                                        type="button"
                                        onClick={() => setSharesInput(Math.floor(user.balance))}
                                        className="ml-2 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] rounded hover:bg-emerald-500/20 active:scale-95 transition-all font-bold cursor-pointer"
                                      >
                                        MAX
                                      </button>
                                    )}
                                  </>
                                : <>
                                    Balance: {selectedSharesOwned.toFixed(2)} {labelsSafe[selectedOutcomeIndex]} Shares
                                    {selectedSharesOwned > 0 && (
                                      <button 
                                        type="button"
                                        onClick={() => setSharesInput(selectedSharesOwned)}
                                        className="ml-2 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-500 text-[10px] rounded hover:bg-emerald-500/20 active:scale-95 transition-all font-bold cursor-pointer"
                                      >
                                        MAX
                                      </button>
                                    )}
                                  </>
                              }
                            </span>
                          </label>
                          <div className="relative flex items-center">
                            <input
                              type="number"
                              min="1"
                              placeholder={orderType === 'buy' ? 'ENTER USDC SWAP QUANTITY...' : 'ENTER SHARES TO SELL...'}
                              value={sharesInput}
                              onChange={(e) => setSharesInput(parseFloat(e.target.value) || 10)}
                              className="w-full bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-sm px-4 py-3 rounded-xl focus:border-emerald-500 focus:outline-none font-bold"
                            />
                            <span className="absolute right-4 font-mono text-xs text-slate-400 dark:text-slate-500 font-extrabold uppercase">
                              {orderType === 'buy' ? 'USDC' : 'Shares'}
                            </span>
                          </div>
                        </div>
                      );
                    })()}

                    {/* Execution details */}
                    {(() => {
                      const moonPool = room.moonPool || 0;
                      const jeetPool = room.jeetPool || 0;
                      const totalPool = moonPool + jeetPool;
                      const priceMoon = (moonPool + 10) / (totalPool + 20);
                      const priceJeet = (jeetPool + 10) / (totalPool + 20);
                      const currentPrice = selectedSide === 'moon' ? priceMoon : priceJeet;

                      let cost = 0;
                      let estShares = 0;
                      let estReturn = 0;
                      let avgPrice = currentPrice;

                       if (orderType === 'buy') {
                         cost = sharesInput;
                         estShares = getEvmSharesReceived(sharesInput, selectedOutcomeIndex, reservesSafe);
                         avgPrice = estShares > 0 ? cost / estShares : currentPrice;
                       } else {
                         estShares = sharesInput;
                         estReturn = getEvmSellReceived(sharesInput, selectedOutcomeIndex, reservesSafe);
                         avgPrice = estShares > 0 ? estReturn / estShares : currentPrice;
                       }

                       let slippagePercent = 0;
                       if (orderType === 'buy' && cost > 0 && estShares > 0) {
                         const targetPoolRes = reservesSafe[selectedOutcomeIndex] || 0; 
                         let oppositeSum = 0;
                         reservesSafe.forEach((r, idx) => { if (idx !== selectedOutcomeIndex) oppositeSum += r; });
                         if (oppositeSum > 0 && targetPoolRes > 0) {
                           const initialPrice = currentPrice;
                           slippagePercent = ((avgPrice - initialPrice) / initialPrice) * 100;
                         }
                       }

                      const maxPayout = orderType === 'buy' ? estShares : estReturn;
                      const profit = maxPayout - cost;
                      const roiPercent = cost > 0 ? (profit / cost) * 100 : 0;

                      return (
                        <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-4 rounded-xl space-y-2.5 font-mono text-xs">
                          <div className="flex justify-between text-slate-500 dark:text-slate-400 uppercase font-bold">
                            <span>AVG EXECUTION PRICE</span>
                            <span className="text-slate-900 dark:text-white font-bold">{(avgPrice * 100).toFixed(0)}¢ / share</span>
                          </div>
                          <div className="flex justify-between text-slate-500 dark:text-slate-400 uppercase font-bold">
                            <span>{orderType === 'buy' ? 'ESTIMATED SHARES' : 'ESTIMATED RETURN'}</span>
                            <span className="text-slate-900 dark:text-white font-bold">
                              {orderType === 'buy' ? `${estShares.toFixed(2)} Shares` : `${estReturn.toFixed(2)} USDC`}
                            </span>
                          </div>
                          {orderType === 'buy' && (
                            <div className="flex justify-between text-slate-500 dark:text-slate-400 uppercase font-bold">
                              <span>POTENTIAL RETURN</span>
                              <span className="text-emerald-500 font-bold">+{maxPayout.toFixed(2)} USDC (+{roiPercent.toFixed(0)}%)</span>
                            </div>
                          )}
                          {orderType === 'buy' && slippagePercent > 10 && (
                            <div className="p-3 bg-rose-500/10 border border-rose-500/30 text-rose-500 rounded-lg text-[10px] leading-relaxed font-bold uppercase">
                              ⚠️ HIGH SLIPPAGE WARNING: This order represents a large portion of the pool reserves and will cause significant slippage loss (estimated {slippagePercent.toFixed(1)}% slippage).
                            </div>
                          )}
                        </div>
                      );
                    })()}

                    {/* Submit Action Button */}
                    <button
                      onClick={(e) => { setTradeMode('market'); handlePlaceOrder('market', e); }}
                      disabled={isTransactionLoading}
                      className="w-full py-4 text-center bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-100 dark:disabled:bg-slate-800 disabled:text-slate-400 dark:disabled:text-slate-600 disabled:cursor-not-allowed font-mono text-xs uppercase text-white rounded-xl shadow-md transition-all flex items-center justify-center gap-2 font-bold"
                    >
                      {isTransactionLoading ? (
                        <>
                          <Loader2 className="animate-spin text-white shrink-0" size={14} />
                          <span>EXECUTING SWAP...</span>
                        </>
                      ) : (
                        <span>EXECUTE TRANSACTION</span>
                      )}
                    </button>

                    {/* Parlay bookmark action */}
                    {room.status === 'active' && (
                      <button
                        type="button"
                        onClick={() => {
                          const isInParlay = parlayCart.some((l) => l.roomId === room.id);
                          if (isInParlay) {
                            removeLegFromParlay(room.id);
                            addToast('Removed from Parlay Ticket', 'info');
                          } else {
                            addLegToParlay(room.id, selectedSide);
                            addToast(`Added $${room.token.symbol} (${selectedSide === 'moon' ? (room.moonLabel || 'YES') : (room.jeetLabel || 'NO')}) to Parlay Ticket`, 'success');
                          }
                          synthSound('bet');
                        }}
                        className={`w-full py-3.5 rounded-xl border font-mono text-xs uppercase font-extrabold tracking-wide transition-all flex items-center justify-center gap-2 ${
                          parlayCart.some((l) => l.roomId === room.id)
                            ? 'bg-emerald-500/10 border-emerald-500 text-emerald-500 hover:bg-emerald-500/15'
                            : 'border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white bg-slate-50 dark:bg-slate-950/40 hover:border-slate-350 hover:dark:border-slate-700'
                        }`}
                      >
                        <Bookmark size={14} className="shrink-0" />
                        <span>
                          {parlayCart.some((l) => l.roomId === room.id)
                            ? 'Added to Parlay Ticket ✓'
                            : 'Add Bet to Parlay Slip'}
                        </span>
                      </button>
                    )}
                  </div>
                )}

                {/* 1.5 LIQUIDITY PANEL */}
                {activeMainTab === 'liquidity' && room && (
                  <LiquidityTabPanel roomId={room.id} />
                )}

                {/* 2. CHART PANEL */}
                {activeMainTab === 'chart' && room && (
                  <div className="space-y-4">
                    <OddsHistoryChart 
                      pricesSafe={pricesSafe} 
                      labelsSafe={labelsSafe} 
                      bets={roomBets}
                    />
                  </div>
                )}

                {/* 3. HOLDINGS PANEL */}
                {activeMainTab === 'holdings' && room && (
                  <div className="space-y-4 font-mono text-xs text-left">
                    {(() => {
                      const userBetsInRoom = user ? user.bets.filter(b => isSameRoom(b.roomId, room.id)) : [];
                      
                      const holdings = labelsSafe.map((label, idx) => {
                        let sharesOwned = 0;
                        if (isEvm) {
                          sharesOwned = evmBalances[idx] || 0;
                        } else {
                          const totalPool = (room.moonPool || 0) + (room.jeetPool || 0);
                          const priceMoon = totalPool > 0 ? (room.moonPool + 10) / (totalPool + 20) : 0.5;
                          const priceJeet = totalPool > 0 ? (room.jeetPool + 10) / (totalPool + 20) : 0.5;
                          const price = idx === 0 ? priceMoon : priceJeet;
                          sharesOwned = userBetsInRoom
                            .filter(b => b.side === (idx === 0 ? 'moon' : 'jeet'))
                            .reduce((sum, b) => sum + (b.shares || (b.amount / price)), 0);
                        }

                        // Calculate amount spent
                        let totalSpent = 0;
                        if (isEvm) {
                          const userAddressStr = (wallet?.address || '').toLowerCase();
                          const userBets = roomBets.filter(
                            (b) => (b.user || '').toLowerCase() === userAddressStr &&
                                   (
                                     b.side === String(idx) ||
                                     b.side === `outcome_${idx}` ||
                                     (b.side === 'moon' && idx === 0) ||
                                     (b.side === 'jeet' && idx === 1)
                                   )
                          );
                          totalSpent = userBets.reduce((sum, b) => sum + Number(b.amount || 0), 0);
                        } else {
                          totalSpent = userBetsInRoom
                            .filter(b => b.side === (idx === 0 ? 'moon' : 'jeet'))
                            .reduce((sum, b) => sum + b.amount, 0);
                        }

                        // If they own shares but we don't have bet records logged, calculate a default spent based on current price
                        if (sharesOwned > 0 && totalSpent === 0) {
                          totalSpent = sharesOwned * (pricesSafe[idx] || 0.5);
                        }

                        const avgCost = sharesOwned > 0 ? totalSpent / sharesOwned : 0;
                        const currentPrice = pricesSafe[idx] || 0.5;
                        const currentValue = sharesOwned * currentPrice;
                        const pnl = currentValue - totalSpent;
                        const pnlPercent = totalSpent > 0 ? (pnl / totalSpent) * 100 : 0;

                        return {
                          label,
                          idx,
                          sharesOwned,
                          totalSpent,
                          avgCost,
                          currentPrice,
                          currentValue,
                          pnl,
                          pnlPercent,
                        };
                      }).filter(h => h.sharesOwned > 0.01);

                      if (holdings.length === 0) {
                        return (
                          <div className="text-center py-10 text-slate-400 dark:text-slate-500">
                            NO ACTIVE POSITIONS FOUND IN THIS ARENA
                          </div>
                        );
                      }

                      return (
                        <div className="space-y-3">
                          {holdings.map((h, idx) => {
                            const isPositive = h.pnl >= 0;
                            const colorClass = isPositive ? 'text-emerald-500' : 'text-rose-500';
                            const bgClass = isPositive ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20';
                            const badgeBorderClass = isPositive ? 'border-emerald-500/30' : 'border-rose-500/30';
                            
                            return (
                              <div key={idx} className={`flex justify-between items-center p-4 rounded-xl border ${bgClass}`}>
                                <div>
                                  <div className={`font-bold uppercase text-[10px] ${colorClass}`}>{h.label} Position</div>
                                  <div className="text-xs text-slate-600 dark:text-slate-400 font-bold mt-1">
                                    Shares Owned: {h.sharesOwned.toFixed(1)} | Avg Cost: ${h.avgCost.toFixed(2)} USDC
                                  </div>
                                  <div className="text-[10px] text-slate-500 dark:text-slate-450 mt-0.5 font-mono">
                                    PnL: <span className={`font-extrabold ${colorClass}`}>{isPositive ? '+' : ''}${h.pnl.toFixed(2)} ({isPositive ? '+' : ''}{h.pnlPercent.toFixed(1)}%)</span>
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setShareCardHolding(h);
                                    synthSound('bet');
                                  }}
                                  className={`px-3 py-1.5 bg-slate-900 hover:bg-slate-800 dark:bg-slate-950 dark:hover:bg-slate-900 border ${badgeBorderClass} text-white font-mono text-[10px] font-bold rounded-lg transition-all flex items-center gap-1 active:scale-95 cursor-pointer`}
                                >
                                  <Share2 size={12} className={colorClass} />
                                  <span>SHARE</span>
                                </button>
                              </div>
                            );
                          })}
                        </div>
                      );
                    })()}
                  </div>
                )}

                {/* 4. ACTIVITY PANEL */}
                {activeMainTab === 'activity' && (
                  <div className="h-72 overflow-y-auto space-y-2.5 pr-1 font-mono text-xs scrollbar">
                    {roomBets.length > 0 ? (
                      roomBets.map((bet) => {
                        const formattedUser = bet.user ? (bet.user.length > 8 ? bet.user.slice(0, 4) + '...' + bet.user.slice(-4) : bet.user) : 'DEGEN';
                        const isMoon = bet.side === 'moon';
                        const isBuy = bet.action === 'buy';
                        const colorClass = isMoon ? 'text-emerald-500' : 'text-rose-500';
                        const timeString = new Date(bet.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

                        return (
                          <div key={bet.id} className="flex items-center justify-between font-bold uppercase hover:bg-slate-50 dark:hover:bg-slate-900/40 p-2.5 rounded-xl transition-colors border border-slate-100 dark:border-slate-800">
                            <div className="flex items-center gap-2 truncate">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold tracking-wider ${
                                isBuy 
                                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' 
                                  : 'bg-rose-500/10 text-rose-500 border border-rose-500/20'
                              }`}>
                                {isBuy ? 'BUY' : 'SELL'}
                              </span>
                              <span className="text-slate-500 dark:text-slate-400">[{formattedUser}]</span>
                              <span className={`${colorClass} font-extrabold tracking-wide`}>
                                {isMoon ? (room.moonLabel || 'YES') : (room.jeetLabel || 'NO')}
                              </span>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-slate-900 dark:text-white font-bold">{bet.amount.toFixed(2)} USDC</span>
                              <span className="text-slate-400 dark:text-slate-500 text-[10px]">{timeString}</span>
                              {bet.txSig && bet.txSig.startsWith('0x') && (
                                <a 
                                  href={`https://testnet.snowtrace.io/tx/${bet.txSig}`} 
                                  target="_blank" 
                                  rel="noopener noreferrer" 
                                  className="text-slate-400 hover:text-emerald-500 transition-colors"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <div className="flex items-center justify-center h-full text-slate-400 dark:text-slate-500 font-bold uppercase animate-pulse">
                        AWAITING TRANSACTION LOGS...
                      </div>
                    )}
                  </div>
                )}

                {/* 5. DISCUSSION PANEL */}
                {activeMainTab === 'discussion' && (
                  <div className="h-80 flex flex-col justify-between relative">
                    <div className="flex gap-2 mb-3 pb-2 border-b border-slate-200 dark:border-slate-800">
                      <button
                        type="button"
                        onClick={() => { setActiveChatTab('moon'); synthSound('bet'); }}
                        className={`px-3 py-1 font-mono text-[10px] uppercase font-bold rounded-lg transition-all ${
                          activeChatTab === 'moon' ? 'bg-emerald-500 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        YES SQUAD ({chatMessages.filter((m) => m.side === 'moon').length})
                      </button>
                      <button
                        type="button"
                        onClick={() => { setActiveChatTab('jeet'); synthSound('bet'); }}
                        className={`px-3 py-1 font-mono text-[10px] uppercase font-bold rounded-lg transition-all ${
                          activeChatTab === 'jeet' ? 'bg-rose-500 text-white' : 'text-slate-500 hover:text-slate-900 dark:hover:text-white'
                        }`}
                      >
                        NO SQUAD ({chatMessages.filter((m) => m.side === 'jeet').length})
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto space-y-2 pr-1 scrollbar mb-3 max-h-[220px]">
                      {chatMessages
                        .filter((msg) => msg.side === activeChatTab)
                        .map((msg, idx) => (
                          <div key={idx} className="text-left bg-slate-50 dark:bg-slate-950 p-2.5 rounded-xl border border-slate-200 dark:border-slate-800">
                            <div className="flex items-center justify-between text-[10px] text-slate-400 dark:text-slate-500 font-mono">
                              <span className="font-bold cursor-pointer hover:underline" onClick={() => setSelectedProfileAddress(msg.user)}>
                                {msg.user.slice(0, 6)}...{msg.user.slice(-4)}
                              </span>
                            </div>
                            <p className="text-xs text-slate-855 dark:text-slate-205 mt-1 font-sans break-words font-medium">
                              {msg.message}
                            </p>
                          </div>
                        ))}
                    </div>

                    <form
                      onSubmit={(e) => {
                        e.preventDefault();
                        if (!chatInput.trim() || !user || !user.wallet) return;
                        sendRoomChat(room.id, activeChatTab, user.wallet, chatInput.trim());
                        setChatInput('');
                      }}
                      className="flex gap-2"
                    >
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        placeholder="ENTER COMMENTS..."
                        className="flex-1 px-4 py-2.5 bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 text-slate-900 dark:text-white font-mono text-xs rounded-xl focus:border-emerald-500 focus:outline-none"
                      />
                      <button
                        type="submit"
                        className="px-4 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-800 dark:text-white rounded-xl transition-all"
                      >
                        <Send size={14} />
                      </button>
                    </form>
                  </div>
                )}

              </div>
            </div>
          </div>

          {/* COLUMN 2: MARKET INFO & RESOLUTION (lg:col-span-4) */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Market Info Card */}
            {room && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5">
                <h3 className="font-sans text-sm text-slate-900 dark:text-white font-extrabold uppercase tracking-tight">
                  Market Info
                </h3>
                
                <div className="space-y-3 font-mono text-xs">
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 dark:text-slate-500">Liquidity Pool</span>
                    <span className="text-slate-800 dark:text-slate-350 font-bold">{totalPotSafe.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 dark:text-slate-500">{labelsSafe[0] || 'YES'} Shares</span>
                    <span className="text-emerald-500 font-bold">{moonPercentageSafe.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 dark:text-slate-500">{labelsSafe[1] || 'NO'} Shares</span>
                    <span className="text-rose-500 font-bold">{jeetPercentageSafe.toFixed(1)}%</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 dark:text-slate-500">Total Volume</span>
                    <span className="text-slate-800 dark:text-slate-350 font-bold">{totalVolumeSafe.toFixed(2)} USDC</span>
                  </div>
                  <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-855 pt-3">
                    <span className="text-slate-400 dark:text-slate-500">Created</span>
                    <span className="text-slate-800 dark:text-slate-350 font-bold">Aug 5, 2026</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-slate-400 dark:text-slate-500">Resolves</span>
                    <span className="text-slate-800 dark:text-slate-350 font-bold" suppressHydrationWarning>{new Date(room.expiry).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Resolution Criteria Card */}
            {room && (
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm space-y-5 text-left relative overflow-hidden">
                <div className="absolute top-0 left-0 w-1.5 h-full bg-[#00796B] dark:bg-neon-moon"></div>
                
                <div className="flex justify-between items-center border-b border-slate-100 dark:border-slate-800 pb-3">
                  <h3 className="font-sans text-xs text-slate-500 dark:text-slate-400 font-extrabold uppercase tracking-widest">
                    Detailed Resolution Rules & Oracle
                  </h3>
                  <span className="font-mono text-[9px] bg-teal-50 dark:bg-neon-moon/10 text-[#00796B] dark:text-neon-moon px-2 py-0.5 border border-[#00796B]/20 rounded font-bold uppercase">
                    Verification Protocol
                  </span>
                </div>
                
                {/* 1. Main Resolve Criteria Statement */}
                <div className="space-y-1.5">
                  <span className="block font-mono text-[9px] text-slate-400 dark:text-slate-500 uppercase font-extrabold">Market Criteria Statement</span>
                  <p className="font-sans text-sm text-slate-800 dark:text-slate-200 font-bold leading-snug">
                    {isDebateMarket 
                      ? (room.resolutionCriteria && room.resolutionCriteria.split('| Ref:')[0].trim().length > 0
                          ? room.resolutionCriteria.split('| Ref:')[0].trim()
                          : (room.rules || 'Market resolves based on the verified real-world event outcome before expiry.'))
                      : (room.resolutionCriteria && room.resolutionCriteria.split('| Ref:')[0].trim().length > 10
                          ? room.resolutionCriteria.split('| Ref:')[0].trim()
                          : `Will the final TWAP price of ${room.token.name} (${room.token.symbol}) end strictly above the strike price of $${openingPriceSafe !== undefined ? formatPrice(openingPriceSafe) : 'N/A'} at the expiry target time?`)
                    }
                  </p>
                </div>

                {room.rules && (
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <span className="block font-mono text-[9px] text-slate-400 dark:text-slate-500 uppercase font-extrabold">Market Rules / Guidelines</span>
                    <p className="font-sans text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {room.rules}
                    </p>
                  </div>
                )}

                {room.context && (
                  <div className="space-y-1.5 pt-3 border-t border-slate-100 dark:border-slate-800/60">
                    <span className="block font-mono text-[9px] text-slate-400 dark:text-slate-500 uppercase font-extrabold">Market Context / Background</span>
                    <p className="font-sans text-xs text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-wrap">
                      {room.context}
                    </p>
                  </div>
                )}

                {/* 2. Structured Rules */}
                {!isDebateMarket ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 font-mono text-xs">
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[9px] font-bold uppercase block">🟢 {labelsSafe[0] || 'YES'} WINS IF</span>
                      <span className="font-bold text-slate-800 dark:text-white">Final Price &gt; ${openingPriceSafe !== undefined ? formatPrice(openingPriceSafe) : 'N/A'}</span>
                    </div>
                    <div className="space-y-1">
                      <span className="text-slate-400 text-[9px] font-bold uppercase block">🔴 {labelsSafe[1] || 'NO'} WINS IF</span>
                      <span className="font-bold text-slate-800 dark:text-white">Final Price &lt; ${openingPriceSafe !== undefined ? formatPrice(openingPriceSafe) : 'N/A'}</span>
                    </div>
                  </div>
                ) : (
                  <div className="bg-slate-50 dark:bg-slate-950 p-4 rounded-xl border border-slate-100 dark:border-slate-800/80 font-mono text-xs space-y-2">
                    <span className="text-slate-400 text-[9px] font-bold uppercase block">OUTCOME RESOLUTION RULES</span>
                    <div className="space-y-1.5">
                      {labelsSafe.map((label, idx) => (
                        <div key={idx} className="flex justify-between items-center text-xs">
                          <span className="font-bold text-slate-800 dark:text-slate-200">{label}</span>
                          <span className="text-emerald-500 font-bold">100% Payout on Verification</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Oracle and Settlement Feed Details */}
                <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="flex items-start gap-3">
                    <div className="text-xl">
                      {(() => {
                        const addr = (room.oracleAddress || '').toLowerCase();
                        if (addr === '0x803e97fdffe050bfd781c26ba8a65df069ae9cc6') return '⚖️';
                        if (addr === '0xc0218f5894591b7b08ea186da3ad2a5e69e40b67' || addr === '0x17c48e0670548b798dcc3e56a18eb2f5b158aab2') return '🤖';
                        if (addr.includes('adapter')) return '🔮';
                        return '📡';
                      })()}
                    </div>
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <span className="block font-mono text-[9px] text-slate-400 dark:text-slate-500 uppercase font-extrabold">Assigned Resolution Oracle</span>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-sans text-xs text-slate-900 dark:text-white font-extrabold">
                          {(() => {
                            const addr = (room.oracleAddress || '').toLowerCase();
                            if (addr === '0x803e97fdffe050bfd781c26ba8a65df069ae9cc6') return 'Jury DAO Optimistic Oracle';
                            if (addr === '0xc0218f5894591b7b08ea186da3ad2a5e69e40b67' || addr === '0x17c48e0670548b798dcc3e56a18eb2f5b158aab2') return 'Programmatic AI Oracle';
                            if (addr.includes('adapter')) return 'UMA Optimistic Oracle (OOv3)';
                            return 'Custom Resolution Oracle Feed';
                          })()}
                        </span>
                        <span className="font-mono text-[9px] text-slate-500 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded select-all truncate block max-w-[200px]" title={room.oracleAddress || 'No Address'}>
                          {room.oracleAddress || 'No Address'}
                        </span>
                      </div>
                      <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400 leading-relaxed">
                        {(() => {
                          const addr = (room.oracleAddress || '').toLowerCase();
                          if (addr === '0x803e97fdffe050bfd781c26ba8a65df069ae9cc6') {
                            return 'Resolves optimistically. Disputes are resolved via decentralized voting by Jury DAO token holders on-chain.';
                          }
                          if (addr === '0xc0218f5894591b7b08ea186da3ad2a5e69e40b67' || addr === '0x17c48e0670548b798dcc3e56a18eb2f5b158aab2') {
                            return 'Settles automatically using cryptographically verified Pyth Network feeds, Chainlink, and DexScreener TWAP prices.';
                          }
                          return 'Resolves against the custom oracle contract or designated self-sovereign EOA resolver configured during room setup.';
                        })()}
                      </p>
                    </div>
                  </div>
                </div>

                {/* 4. Dispute Mechanism Guideline */}
                <div className="bg-amber-500/5 border border-amber-500/10 rounded-xl p-3 flex items-start gap-2.5 font-sans text-[10px] text-amber-600 dark:text-amber-400 leading-normal">
                  <span className="text-xs">⚠️</span>
                  <div>
                    <span className="font-bold block uppercase tracking-wide">On-Chain Dispute Mechanism</span>
                    <span>Once the oracle settles the market, a 1-hour challenge window is opened. Any user can challenge the proposed verdict by posting a 10 USDC dispute bond to slash inaccurate reports.</span>
                  </div>
                </div>

                {room.resolutionCriteria && room.resolutionCriteria.includes('Ref:') && (
                  <a 
                    href={room.resolutionCriteria.split('Ref:')[1]?.trim() || '#'} 
                    target="_blank" 
                    rel="noreferrer" 
                    className="inline-flex items-center gap-1 text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-mono font-bold pt-1"
                  >
                    <span>View reference source</span>
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            )}

            {/* Expired / Dispute Settlement Cards (Only shown if pool has ended) */}
            {room && (room.status === 'settled' || room.status === 'disputed' || room.expiry <= Date.now()) && (
              <div className="bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 p-5 rounded-2xl shadow-sm space-y-4">
                <h4 className="font-sans text-xs text-slate-900 dark:text-white font-extrabold uppercase">
                  Arena Verdict Console
                </h4>
                
                {room.status === 'disputed' ? (
                  <div className="text-xs space-y-2">
                    <div className="text-rose-500 font-bold uppercase">⚠️ Verdict Disputed</div>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed text-[11px]">
                      Bettor challenged the verdict. Funds are frozen pending arbitrator verification.
                    </p>
                  </div>
                ) : room.status === 'settled' ? (
                  <div className="text-xs space-y-3">
                    <span className={`font-bold block tracking-wider ${
                      room.winner === 'moon' ? 'text-emerald-500' : room.winner === 'jeet' ? 'text-rose-500' : 'text-amber-500'
                    }`}>
                      {room.winner === 'moon' ? 'Resolved YES / MOON' : room.winner === 'jeet' ? 'Resolved NO / JEET' : 'DRAW / VOIDED'}
                    </span>

                    {userWon && hasUnclaimed && (
                      <button
                        onClick={handleClaim}
                        disabled={isTransactionLoading}
                        className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 disabled:bg-slate-200 text-white font-mono text-xs uppercase rounded-xl font-bold transition-all"
                      >
                        {isTransactionLoading ? 'CLAIMING...' : 'CLAIM WINNINGS'}
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="text-xs space-y-3">
                    <span className="text-amber-500 font-bold block animate-pulse">TELEMETRY RESOLVING</span>
                    <button
                      onClick={handleClaim}
                      disabled={isTransactionLoading}
                      className="w-full py-3 bg-slate-200 dark:bg-slate-800 hover:bg-slate-355 dark:hover:bg-slate-700 disabled:opacity-50 text-slate-800 dark:text-white font-mono text-xs uppercase rounded-xl font-bold transition-all"
                    >
                      {isTransactionLoading ? 'RESOLVING...' : 'RESOLVE TRENCH'}
                    </button>
                  </div>
                )}
              </div>
            )}

          </div>

        </div>

      </div>

      {selectedProfileAddress && (
        <PublicProfileModal
          walletAddress={selectedProfileAddress}
          onClose={() => setSelectedProfileAddress(null)}
        />
      )}

      {shareCardHolding && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
          <div className="relative w-full max-w-md bg-slate-900 border border-slate-800 rounded-3xl overflow-hidden shadow-2xl p-6 space-y-6 text-center">
            
            {/* Modal Header */}
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <span className="font-mono text-xs font-bold text-slate-400 tracking-wider">SHARE POSITION RECEIPT</span>
              <button 
                type="button"
                onClick={() => setShareCardHolding(null)}
                className="text-slate-500 hover:text-slate-300 font-mono text-xs cursor-pointer font-bold"
              >
                [CLOSE]
              </button>
            </div>

            {/* Premium Preview Receipt Ticket */}
            <div className={`border-2 rounded-2xl p-5 text-left relative overflow-hidden shadow-lg space-y-4 transition-all duration-300 ${
              shareCardHolding.pnl >= 0 
                ? 'bg-gradient-to-b from-emerald-950/80 to-slate-950/95 border-emerald-500/40 shadow-emerald-500/5' 
                : 'bg-gradient-to-b from-rose-950/80 to-slate-950/95 border-rose-500/40 shadow-rose-500/5'
            }`}>
              {/* Decorative ticket cutouts */}
              <div className="absolute left-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-slate-900 rounded-r-full border-y border-r border-slate-800" />
              <div className="absolute right-0 top-1/2 -translate-y-1/2 w-4 h-8 bg-slate-900 rounded-l-full border-y border-l border-slate-800" />

              <div className="flex justify-between items-start">
                <div>
                  <h4 className="font-mono text-[10px] text-slate-400 font-extrabold tracking-widest uppercase">SHITMARKET.LOL</h4>
                  <span className={`font-mono text-[9px] font-bold block mt-0.5 uppercase tracking-wider ${
                    shareCardHolding.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                  }`}>LIVE POSITION RECEIPT</span>
                </div>
                <div className={`px-2.5 py-1 text-[9px] font-black tracking-widest rounded-lg border font-mono uppercase ${
                  shareCardHolding.pnl >= 0 
                    ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
                    : 'bg-rose-500/10 border-rose-500/30 text-rose-400'
                }`}>
                  {shareCardHolding.pnl >= 0 ? 'PROFIT CONFIRMED' : 'LOSS REPORTED'}
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-white/5 my-2" />

              <div className="space-y-1">
                <span className="font-mono text-[8px] text-slate-500 font-bold uppercase tracking-wider block">MARKET CONTRACT:</span>
                <p className="font-sans text-xs text-white font-bold leading-snug line-clamp-2">
                  {room.resolutionCriteria}
                </p>
              </div>

              {/* Chosen Faction Badge */}
              <div className="bg-white/5 border border-white/5 px-3 py-2 rounded-xl flex items-center justify-between">
                <span className="font-mono text-[9px] text-slate-400 font-extrabold tracking-wider">SELECTED OUTCOME:</span>
                <span className={`font-sans text-xs font-black uppercase ${
                  shareCardHolding.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {shareCardHolding.label}
                </span>
              </div>

              {/* PnL Display */}
              <div className="py-2">
                <div className={`font-sans text-5xl font-black tracking-tighter ${
                  shareCardHolding.pnl >= 0 ? 'text-emerald-400' : 'text-rose-400'
                }`}>
                  {shareCardHolding.pnl >= 0 ? '+' : ''}{shareCardHolding.pnlPercent.toFixed(1)}%
                </div>
                <span className="font-mono text-[8px] text-slate-500 font-bold tracking-wider mt-1 block">
                  {shareCardHolding.pnl >= 0 ? 'TOTAL NET REVENUE' : 'TOTAL LOSS VALUE'}
                </span>
              </div>

              {/* Data Table */}
              <div className="space-y-2.5 font-mono text-[10px] bg-white/5 p-3 rounded-xl border border-white/5">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase">SHARES HELD:</span>
                  <span className="text-white font-extrabold">{shareCardHolding.sharesOwned.toFixed(1)} UNITS @ ${shareCardHolding.avgCost.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase">TOTAL SPENT:</span>
                  <span className="text-white font-extrabold">${shareCardHolding.totalSpent.toFixed(2)} USDC</span>
                </div>
              </div>

              {/* Separator */}
              <div className="border-t border-white/5 my-2" />

              <div className="flex justify-between items-center text-[9px] text-slate-500 font-bold tracking-widest font-mono">
                <span>WWW.SHITMARKET.LOL</span>
                <span>PILOT: {wallet?.address ? (wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4)).toUpperCase() : 'ANON'}</span>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => {
                  const canvas = document.createElement('canvas');
                  const scale = 2; // Render at 2x resolution for extreme crispness
                  canvas.width = 600 * scale;
                  canvas.height = 480 * scale;
                  const ctx = canvas.getContext('2d');
                  if (!ctx) return;
                  ctx.scale(scale, scale);

                  const isProfit = shareCardHolding.pnl >= 0;

                  // 1. Dynamic Vibrant Base Background Gradient
                  const grad = ctx.createLinearGradient(0, 0, 0, 480);
                  if (isProfit) {
                    grad.addColorStop(0, '#061d14'); // Deep Emerald
                    grad.addColorStop(0.5, '#04150e');
                    grad.addColorStop(1, '#020b07');
                  } else {
                    grad.addColorStop(0, '#26060c'); // Deep Crimson
                    grad.addColorStop(0.5, '#190307');
                    grad.addColorStop(1, '#0c0103');
                  }
                  ctx.fillStyle = grad;
                  ctx.fillRect(0, 0, 600, 480);

                  // 2. High-contrast Glowing Outer Borders
                  ctx.strokeStyle = isProfit ? 'rgba(0, 255, 170, 0.15)' : 'rgba(255, 51, 102, 0.15)';
                  ctx.lineWidth = 16;
                  ctx.strokeRect(8, 8, 584, 464);

                  ctx.strokeStyle = isProfit ? '#00ffaa' : '#ff3366'; // Glowing neon borders
                  ctx.lineWidth = 3;
                  ctx.strokeRect(16, 16, 568, 448);

                  // 3. Header Branding
                  ctx.fillStyle = '#ffffff';
                  ctx.font = '900 22px sans-serif';
                  ctx.fillText('SHITMARKET.LOL', 40, 55);

                  ctx.fillStyle = isProfit ? '#00ffaa' : '#ff3366';
                  ctx.font = 'bold 9px monospace';
                  ctx.fillText('LIVE POSITION RECEIPT', 40, 75);

                  // Header Badge (PROFIT vs LOSS)
                  ctx.fillStyle = isProfit ? 'rgba(0, 255, 170, 0.12)' : 'rgba(255, 51, 102, 0.12)';
                  ctx.beginPath();
                  ctx.roundRect(435, 38, 125, 24, 6);
                  ctx.fill();
                  ctx.strokeStyle = isProfit ? '#00ffaa' : '#ff3366';
                  ctx.lineWidth = 1;
                  ctx.stroke();

                  ctx.fillStyle = isProfit ? '#00ffaa' : '#ff3366';
                  ctx.font = '900 10px monospace';
                  ctx.textAlign = 'center';
                  ctx.fillText(isProfit ? 'PROFIT CONFIRMED' : 'LOSS REPORTED', 497, 54);
                  ctx.textAlign = 'left';

                  // Separator line
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                  ctx.lineWidth = 1.5;
                  ctx.beginPath();
                  ctx.moveTo(40, 95);
                  ctx.lineTo(560, 95);
                  ctx.stroke();

                  // 4. Market Challenge Title (Wrap lines)
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
                  ctx.font = 'bold 9px monospace';
                  ctx.fillText('MARKET CONTRACT:', 40, 120);

                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 15px sans-serif';
                  const topic = room?.resolutionCriteria || 'Battlefield Prediction Arena';
                  const words = topic.split(' ');
                  let line = '';
                  let y = 142;
                  for (let n = 0; n < words.length; n++) {
                    let testLine = line + words[n] + ' ';
                    let metrics = ctx.measureText(testLine);
                    if (metrics.width > 520 && n > 0) {
                      ctx.fillText(line, 40, y);
                      line = words[n] + ' ';
                      y += 20;
                    } else {
                      line = testLine;
                    }
                  }
                  ctx.fillText(line, 40, y);

                  y += 18;

                  // 5. Chosen Faction Badge
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
                  ctx.beginPath();
                  ctx.roundRect(40, y, 520, 36, 8);
                  ctx.fill();
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                  ctx.lineWidth = 1;
                  ctx.stroke();

                  ctx.fillStyle = '#ffffff';
                  ctx.font = '900 11px monospace';
                  ctx.fillText('SELECTED OUTCOME:', 55, y + 22);

                  ctx.fillStyle = isProfit ? '#00ffaa' : '#ff3366';
                  ctx.font = '900 13px sans-serif';
                  ctx.fillText(shareCardHolding.label.toUpperCase(), 210, y + 23);

                  y += 50;

                  // 6. Giant Centered PnL Percentage display
                  ctx.fillStyle = isProfit ? '#00ffaa' : '#ff3366';
                  ctx.font = '900 52px sans-serif';
                  const pnlSign = shareCardHolding.pnl >= 0 ? '+' : '';
                  const pctText = `${pnlSign}${shareCardHolding.pnlPercent.toFixed(1)}%`;
                  ctx.fillText(pctText, 40, y + 45);

                  // Subtext
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                  ctx.font = 'bold 9px monospace';
                  ctx.fillText(isProfit ? 'TOTAL NET REVENUE' : 'TOTAL LOSS VALUE', 40, y + 62);

                  // 7. Mini Stats Grid on the Right
                  const statX = 350;
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                  ctx.font = '10px monospace';
                  ctx.fillText('Shares Held:', statX, y + 10);
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 11px monospace';
                  ctx.fillText(`${shareCardHolding.sharesOwned.toFixed(1)} units @ $${shareCardHolding.avgCost.toFixed(2)}`, statX, y + 25);

                  ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
                  ctx.font = '10px monospace';
                  ctx.fillText('Total Spent:', statX, y + 45);
                  ctx.fillStyle = '#ffffff';
                  ctx.font = 'bold 11px monospace';
                  ctx.fillText(`$${shareCardHolding.totalSpent.toFixed(2)} USDC`, statX, y + 60);

                  y += 85;

                  // Bottom divider
                  ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
                  ctx.lineWidth = 1;
                  ctx.beginPath();
                  ctx.moveTo(40, y);
                  ctx.lineTo(560, y);
                  ctx.stroke();

                  y += 22;

                  // 8. Footer Info
                  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
                  ctx.font = '900 10px monospace';
                  ctx.fillText('WWW.SHITMARKET.LOL', 40, y);

                  const userAddr = wallet?.address ? (wallet.address.slice(0, 6) + '...' + wallet.address.slice(-4)) : 'ANONYMOUS';
                  ctx.textAlign = 'right';
                  ctx.fillText(`PILOT: ${userAddr.toUpperCase()}`, 560, y);
                  ctx.textAlign = 'left';

                  const url = canvas.toDataURL('image/png');
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = `shitmarket_receipt_${room.id.slice(0, 6)}.png`;
                  a.click();
                  synthSound('victory');
                }}
                className="py-3 px-4 bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-xs uppercase font-extrabold rounded-xl transition-all shadow-md shadow-emerald-500/10 active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                📥 DOWNLOAD RECEIPT
              </button>
              <button
                type="button"
                onClick={() => {
                  const pnlSign = shareCardHolding.pnl >= 0 ? '+' : '';
                  const text = `⚔️ SHITMARKET ARENA BATTLEFIELD RECEIPT ⚔️\n\n🎯 Market: ${room.resolutionCriteria}\n🛡️ Position: ${shareCardHolding.label.toUpperCase()}\n📈 PnL: ${pnlSign}$${shareCardHolding.pnl.toFixed(2)} (${pnlSign}${shareCardHolding.pnlPercent.toFixed(1)}%)\n\nJoin the arena at www.shitmarket.lol !`;
                  navigator.clipboard.writeText(text);
                  useAppState.getState().addToast("RECEIPT COPIED", "success", "Share receipt copied to clipboard!");
                  synthSound('degen');
                }}
                className="py-3 px-4 bg-slate-800 hover:bg-slate-700 text-white font-mono text-xs uppercase font-extrabold rounded-xl transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
              >
                📋 COPY TEXT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
