'use client';

import React from 'react';
import { useRouter } from 'next/navigation';
import { Bookmark, Layers, Clock, TrendingUp } from 'lucide-react';
import { Room, useAppState } from '@/store/useAppState';
import { synthSound } from '@/components/ClientWrapper';
import { PepePortrait, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';

const formatPrice = (price: number | undefined): string => {
  if (price === undefined || isNaN(price)) return 'N/A';
  if (price < 0.000001) return price.toExponential(2);
  if (price < 0.01) return price.toFixed(6);
  if (price < 1) return price.toFixed(4);
  return price.toFixed(2);
};

interface MarketGridCardProps {
  room: Room;
  watchlistedIds?: string[];
  toggleBookmark?: (roomId: string) => void;
  parlayCart?: { roomId: string; side: 'moon' | 'jeet' }[];
  addLegToParlay?: (roomId: string, side: 'moon' | 'jeet') => void;
  removeLegFromParlay?: (roomId: string) => void;
  quickAmount?: number;
  timeRemainingText?: string;
}

export const MarketGridCard: React.FC<MarketGridCardProps> = ({
  room,
  watchlistedIds = [],
  toggleBookmark,
  parlayCart = [],
  addLegToParlay,
  removeLegFromParlay,
  quickAmount = 10,
  timeRemainingText,
}) => {
  const router = useRouter();
  const { user, connectWallet, placeBet, isEvm: globalIsEvm } = useAppState();

  const isEvm = room.id.startsWith('0x') || room.token.chainId === 'avalanche';
  const labelsSafe: string[] = (room.outcomeLabels && room.outcomeLabels.length >= 2)
    ? room.outcomeLabels
    : [room.moonLabel || 'YES', room.jeetLabel || 'NO'];

  const isMultiOutcome = labelsSafe.length > 2;
  const targetCount = labelsSafe.length;

  // Calculate reserves and CPMM prices
  const rawMoon = room.moonPool || 0;
  const rawJeet = room.jeetPool || 0;

  let rawReserves: number[] = [];
  if (room.poolReserves && room.poolReserves.length === targetCount && room.poolReserves.some(r => r > 0)) {
    rawReserves = room.poolReserves;
  } else {
    const totalSeed = (rawMoon + rawJeet) || 500;
    const defaultPerOutcome = totalSeed / targetCount;
    rawReserves = Array(targetCount).fill(defaultPerOutcome);
    if (rawMoon > 0 || rawJeet > 0) {
      if (rawReserves[0] !== undefined) rawReserves[0] = rawMoon || defaultPerOutcome;
      if (rawReserves[1] !== undefined) rawReserves[1] = rawJeet || defaultPerOutcome;
    }
  }

  let sumReciprocals = 0;
  for (const r of rawReserves) {
    if (r > 0) sumReciprocals += 1 / r;
  }
  const poolUSDCVal = sumReciprocals > 0 ? 1 / sumReciprocals : 0;
  const totalPot = isEvm ? poolUSDCVal * targetCount : (rawMoon + rawJeet);

  const pricesSafe = rawReserves.map(r => {
    if (!isEvm) {
      const sum = rawReserves.reduce((a, b) => a + b, 0);
      return sum > 0 ? r / sum : (1 / targetCount);
    }
    return (r > 0 && sumReciprocals > 0) ? (1 / r) / sumReciprocals : (1 / targetCount);
  });

  const isMoonLeading = (pricesSafe[0] || 0.5) >= (pricesSafe[1] || 0.5);

  const isBookmarked = watchlistedIds.includes(room.id);
  const isInParlay = parlayCart.some(leg => leg.roomId === room.id);
  const isSettled = room.status === 'settled';
  const isDisputed = room.status === 'disputed';

  const isDebateRoom = 
    (room.category as string) === 'debate' || 
    (room.category as string) === 'prediction' || 
    (!!room.resolutionCriteria && room.resolutionCriteria.length > 0 && (!room.token.pairAddress || room.token.pairAddress === '')) ||
    room.token.address === room.creator;

  const questionTitle = isDebateRoom 
    ? (() => {
        const raw = room.token.name || 'Prediction Market';
        const bracketMatch = raw.match(/^(\[.+?\])/);
        if (bracketMatch) return bracketMatch[1].replace(/[\[\]]/g, '').trim();
        const cutIdx = raw.search(/\.\s+[A-Z]|\s*[|]\s*/);
        return cutIdx > 10 ? raw.slice(0, cutIdx).trim() : raw;
      })()
    : `Will ${room.token.symbol.startsWith('$') ? room.token.symbol.toUpperCase() : `$${room.token.symbol.toUpperCase()}`} end above ${room.openingPrice !== undefined && formatPrice(room.openingPrice) !== 'N/A' ? `$${formatPrice(room.openingPrice)}` : '$1.00'}?`;

  // Live Synced Trades Count
  const tradesCount = room.tradesCount !== undefined ? room.tradesCount : 0;

  // Format Countdown
  const formatTimeRemaining = () => {
    if (timeRemainingText) return timeRemainingText;
    const diff = room.expiry - Date.now();
    if (diff <= 0) return 'Ended';
    const hours = Math.floor(diff / 3600000);
    const mins = Math.floor((diff % 3600000) / 60000);
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `Ends in ${days}d`;
    }
    return `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`;
  };

  const handleTrade = async (e: React.MouseEvent, outcomeIndex: number, outcomeSide: 'moon' | 'jeet' = 'moon') => {
    e.stopPropagation();
    e.preventDefault();
    synthSound('bet');

    if (!user || !user.wallet) {
      connectWallet();
      return;
    }

    try {
      await placeBet(room.id, isMultiOutcome ? outcomeIndex : outcomeSide, quickAmount);
    } catch (err) {
      console.error("Fast trade failed:", err);
    }
  };

  // Payout returns helper for a default stake
  const calculateReturn = (prob: number) => {
    const p = Math.max(0.01, Math.min(0.99, prob));
    const payout = quickAmount / p;
    return Math.round(payout);
  };

  const sliceColors = [
    'from-emerald-400 to-emerald-500',
    'from-rose-400 to-rose-500',
    'from-blue-400 to-blue-500',
    'from-amber-400 to-amber-500',
    'from-purple-400 to-purple-500',
    'from-teal-400 to-teal-500'
  ];

  return (
    <div
      onClick={() => {
        router.push(`/room/${room.id}`);
        synthSound('bet');
      }}
      className={`bg-white dark:bg-slate-900/90 border border-slate-200 dark:border-slate-800 rounded-2xl p-5 flex flex-col justify-between cursor-pointer transition-all duration-300 select-none relative group hover:-translate-y-1 shadow-sm hover:shadow-md text-slate-800 dark:text-white w-full ${
        isMultiOutcome ? 'min-h-[290px]' : 'min-h-[260px]'
      } ${
        isMoonLeading
          ? 'hover:border-emerald-500/60 dark:hover:border-emerald-500/40'
          : 'hover:border-rose-500/60 dark:hover:border-rose-500/40'
      }`}
    >
      {/* Top Header Row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-start gap-3 min-w-0">
          {/* Avatar / Icon */}
          <div className="relative bg-slate-100 dark:bg-slate-800 border border-slate-200 dark:border-slate-700/60 rounded-xl overflow-hidden shrink-0 w-10 h-10 flex items-center justify-center shadow-xs">
            {room.token.icon && (room.token.icon.startsWith('http') || room.token.icon.startsWith('data:') || room.token.icon.startsWith('blob:')) ? (
              <img src={room.token.icon} alt={room.token.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <PepePortrait
                src={(() => {
                  const id = room.id || '';
                  let hash = 0;
                  for (let i = 0; i < id.length; i++) {
                    hash = id.charCodeAt(i) + ((hash << 5) - hash);
                  }
                  const index = Math.abs(hash);
                  return isMoonLeading 
                    ? MOON_PEPES[index % MOON_PEPES.length] 
                    : JEET_PEPES[index % JEET_PEPES.length];
                })()}
                size={34}
                glowColor={isMoonLeading ? 'moon' : 'jeet'}
                className="rounded-lg"
              />
            )}
          </div>

          {/* Question Title */}
          <div className="min-w-0 pr-1">
            <h4 
              className="font-sans font-bold text-sm text-slate-900 dark:text-slate-100 leading-snug tracking-tight group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors"
              style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}
            >
              {questionTitle}
            </h4>
          </div>
        </div>

        {/* Action Top Right: Bookmark + Parlay */}
        <div className="flex items-center gap-1 shrink-0">
          {toggleBookmark && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleBookmark(room.id);
                synthSound('bet');
              }}
              className={`p-1.5 rounded-lg border transition-all text-slate-400 hover:text-slate-700 dark:hover:text-white ${
                isBookmarked
                  ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 fill-emerald-500'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60'
              }`}
              title={isBookmarked ? "Bookmarked" : "Bookmark"}
            >
              <Bookmark size={13} className={isBookmarked ? "fill-current" : ""} />
            </button>
          )}

          {addLegToParlay && removeLegFromParlay && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                if (isInParlay) {
                  removeLegFromParlay(room.id);
                } else {
                  addLegToParlay(room.id, isMoonLeading ? 'moon' : 'jeet');
                }
                synthSound('bet');
              }}
              className={`p-1.5 rounded-lg border transition-all text-slate-400 hover:text-slate-700 dark:hover:text-white ${
                isInParlay
                  ? 'bg-teal-50 dark:bg-emerald-950/30 border-teal-500/40 text-teal-600 dark:text-emerald-400'
                  : 'bg-slate-50 dark:bg-slate-800/80 border-slate-200 dark:border-slate-700/60'
              }`}
              title={isInParlay ? "Remove from Parlay" : "Add to Parlay"}
            >
              <Layers size={13} />
            </button>
          )}
        </div>
      </div>

      {/* Main Body: Multi-Outcome Rows vs Binary Large Buttons */}
      {isMultiOutcome ? (
        /* Multi-Choice Sub-Market Rows (Polymarket Style) */
        <div className="space-y-2 my-2">
          {labelsSafe.slice(0, 2).map((label, idx) => {
            const prob = pricesSafe[idx] || (1 / targetCount);
            const yesCents = Math.round(prob * 100);
            const noCents = 100 - yesCents;

            return (
              <div 
                key={idx} 
                className="flex items-center justify-between gap-2 p-1.5 rounded-xl bg-slate-50/70 dark:bg-slate-800/40 border border-slate-200/60 dark:border-slate-800"
              >
                <div className="flex items-center gap-1.5 min-w-0 pr-2">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${idx === 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                  <span className="font-sans text-xs font-bold text-slate-700 dark:text-slate-200 truncate">{label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    onClick={(e) => handleTrade(e, idx, 'moon')}
                    className="px-2.5 py-1 rounded-lg bg-blue-500/10 dark:bg-blue-500/20 hover:bg-blue-500 hover:text-white text-blue-600 dark:text-blue-400 border border-blue-500/30 font-bold text-xs font-mono transition-all"
                  >
                    Yes - {yesCents}¢
                  </button>
                  <button
                    onClick={(e) => handleTrade(e, (idx + 1) % targetCount, 'jeet')}
                    className="px-2.5 py-1 rounded-lg bg-rose-500/10 dark:bg-rose-500/20 hover:bg-rose-500 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/30 font-bold text-xs font-mono transition-all"
                  >
                    No - {noCents}¢
                  </button>
                </div>
              </div>
            );
          })}

          {labelsSafe.length > 2 && (
            <div className="flex items-center justify-between text-[10px] font-mono text-slate-400 dark:text-slate-400 px-1">
              <span>+{labelsSafe.length - 2} more options</span>
              <span className="text-emerald-500 font-bold hover:underline">View All Outcomes →</span>
            </div>
          )}
        </div>
      ) : (
        /* Binary Yes/No or Moon/Jeet Side-by-Side Cards with Payout Projection */
        <div className="my-2 space-y-2">
          <div className="grid grid-cols-2 gap-2.5">
            {/* Left Button (Yes / Up / Moon) */}
            <div className="space-y-1 text-center">
              <button
                onClick={(e) => handleTrade(e, 0, 'moon')}
                className="w-full py-2 px-3 rounded-xl bg-blue-500/10 dark:bg-blue-500/15 hover:bg-blue-600 hover:text-white text-blue-600 dark:text-blue-400 border border-blue-500/30 font-extrabold text-xs font-mono transition-all flex items-center justify-center gap-1 shadow-xs"
              >
                <span>Buy {labelsSafe[0]}</span>
                <span>- {Math.round((pricesSafe[0] || 0.5) * 100)}¢</span>
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 block">
                ${quickAmount} → <span className="text-emerald-500 font-black">${calculateReturn(pricesSafe[0] || 0.5)}</span>
              </span>
            </div>

            {/* Right Button (No / Down / Jeet) */}
            <div className="space-y-1 text-center">
              <button
                onClick={(e) => handleTrade(e, 1, 'jeet')}
                className="w-full py-2 px-3 rounded-xl bg-rose-500/10 dark:bg-rose-500/15 hover:bg-rose-600 hover:text-white text-rose-600 dark:text-rose-400 border border-rose-500/30 font-extrabold text-xs font-mono transition-all flex items-center justify-center gap-1 shadow-xs"
              >
                <span>Buy {labelsSafe[1]}</span>
                <span>- {Math.round((pricesSafe[1] || 0.5) * 100)}¢</span>
              </button>
              <span className="text-[10px] font-mono font-bold text-slate-500 dark:text-slate-400 block">
                ${quickAmount} → <span className="text-emerald-500 font-black">${calculateReturn(pricesSafe[1] || 0.5)}</span>
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Slim Industry-Standard Probability Distribution Bar */}
      <div className="my-2">
        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800/80 p-0.5 overflow-hidden flex gap-0.5 shadow-inner">
          {labelsSafe.map((_, idx) => {
            const pct = (pricesSafe[idx] || 0) * 100;
            const gradient = sliceColors[idx % sliceColors.length];
            return (
              <div 
                key={idx}
                title={`${labelsSafe[idx]}: ${pct.toFixed(1)}%`}
                className={`bg-gradient-to-r ${gradient} h-full rounded-full transition-all duration-700 ease-out`} 
                style={{ width: `${Math.max(0.5, pct)}%` }} 
              />
            );
          })}
        </div>
      </div>

      {/* Card Footer: Trades Counter · Volume · Expiry / Timer */}
      <div className="flex items-center justify-between border-t border-slate-200/60 dark:border-slate-800/60 pt-2.5 text-[11px] font-mono text-slate-500 dark:text-slate-400">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Trades Counter */}
          <span className="flex items-center gap-1 font-bold text-slate-700 dark:text-slate-300">
            <TrendingUp size={12} className="text-emerald-500" />
            {tradesCount >= 1000 ? `${(tradesCount / 1000).toFixed(1)}K` : tradesCount} Trades
          </span>

          <span>·</span>

          {/* Volume */}
          <span className="font-bold text-slate-700 dark:text-slate-300">
            ${totalPot.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })} Vol
          </span>

          <span>·</span>

          {/* Countdown / Expiry */}
          {isDisputed ? (
            <span className="text-rose-500 font-bold">⚠️ Disputed</span>
          ) : isSettled ? (
            <span className="text-amber-500 font-bold">Settled</span>
          ) : (
            <span className="flex items-center gap-1 font-bold text-emerald-600 dark:text-emerald-400">
              <Clock size={11} className="animate-pulse" />
              {formatTimeRemaining()}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
