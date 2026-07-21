'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppState, Room, formatCashtag, formatPrice, MarketCategory, CATEGORIES, detectCategory } from '@/store/useAppState';
import { PixelCrackedHelmet, PixelShovel, PixelGasMask } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { Search, Flame, Bomb, ArrowRight, UserPlus, Plus, X, Bookmark, Rocket } from 'lucide-react';

const NetworkLogo = ({ chainId, active, className = "w-7 h-7" }: { chainId: string; active: boolean; className?: string }) => {
  if (chainId === 'all') {
    return (
      <div 
        className={`w-7 h-7 rounded-full border flex items-center justify-center font-staatliches text-[10px] tracking-wider transition-all select-none ${
          active 
            ? 'bg-neon-moon/20 border-neon-moon text-neon-moon shadow-glow-moon scale-110 font-extrabold' 
            : 'bg-trench-black/60 border-trench-sandbag/45 text-trench-gasmask hover:text-white hover:border-gray-500'
        }`}
      >
        ALL
      </div>
    );
  }

  const normalizedId = chainId.toLowerCase();

  return (
    <img
      src={`https://dd.dexscreener.com/ds-data/chains/${normalizedId}.png`}
      alt={chainId}
      className={`${className} object-contain rounded-full border border-trench-sandbag/20 transition-all ${
        active 
          ? 'opacity-100 scale-110 filter drop-shadow-[0_0_8px_#39ff14] border-neon-moon/80' 
          : 'opacity-50 hover:opacity-80'
      }`}
      onError={(e) => {
        e.currentTarget.src = 'https://dd.dexscreener.com/ds-data/chains/solana.png';
      }}
    />
  );
};

const OTHER_NETWORKS = [
  { id: 'arbitrum', name: 'Arbitrum' },
  { id: 'optimism', name: 'Optimism' },
  { id: 'polygon', name: 'Polygon' },
  { id: 'bsc', name: 'BSC' },
  { id: 'avalanche', name: 'Avalanche' },
  { id: 'sui', name: 'Sui' },
  { id: 'aptos', name: 'Aptos' },
  { id: 'blast', name: 'Blast' },
  { id: 'linea', name: 'Linea' },
  { id: 'scroll', name: 'Scroll' },
  { id: 'fantom', name: 'Fantom' },
  { id: 'cronos', name: 'Cronos' },
  { id: 'celo', name: 'Celo' },
  { id: 'ton', name: 'TON' },
  { id: 'hedera', name: 'Hedera' }
];

const formatExpiryUTC = (timestamp: number) => {
  const d = new Date(timestamp);
  const pad = (val: number) => String(val).padStart(2, '0');
  const hours = pad(d.getUTCHours());
  const mins = pad(d.getUTCMinutes());
  const date = pad(d.getUTCDate());
  const month = pad(d.getUTCMonth() + 1);
  const year = d.getUTCFullYear();
  return `${hours}:${mins} UTC ON ${date}/${month}/${year}`;
};

export default function RoomsPage() {
  const formatDuration = (mins: number | undefined) => {
    if (!mins) return '60 MIN';
    if (mins >= 43200) return `${Math.floor(mins/43200)} MONTH`;
    if (mins >= 10080) return `${Math.floor(mins/10080)} WEEK`;
    if (mins >= 1440) return `${Math.floor(mins/1440)} DAY`;
    if (mins >= 60) return `${Math.floor(mins/60)} HR`;
    return `${mins} MIN`;
  };

  const router = useRouter();
  const { rooms, roomsLoaded, fetchRooms, user, placeBet, connectWallet, addToast } = useAppState();
  const [filterNew, setFilterNew] = useState<'ending' | 'expired'>('ending');
  const [filterSoon, setFilterSoon] = useState<'ending' | 'expired'>('ending');
  const [filterBiggest, setFilterBiggest] = useState<'ending' | 'expired'>('ending');
  const [selectedNetwork, setSelectedNetwork] = useState<string>('all');
  const [selectedCategory, setSelectedCategory] = useState<MarketCategory>('all');
  const [showOtherNetworksDrawer, setShowOtherNetworksDrawer] = useState(false);
  const [drawerSearch, setDrawerSearch] = useState('');
  const [mounted, setMounted] = useState(false);
  const [watchlistedIds, setWatchlistedIds] = useState<string[]>([]);
  const [showWatchlistDrawer, setShowWatchlistDrawer] = useState(false);

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

  const toggleBookmark = (roomId: string) => {
    setWatchlistedIds((prev) => {
      let next;
      if (prev.includes(roomId)) {
        next = prev.filter((id) => id !== roomId);
      } else {
        next = [...prev, roomId];
      }
      localStorage.setItem('shitmarket-watchlist', JSON.stringify(next));
      window.dispatchEvent(new CustomEvent('watchlist-updated', { detail: next }));
      return next;
    });
  };

  useEffect(() => {
    setMounted(true);
  }, []);
  const [searchNew, setSearchNew] = useState('');
  const [searchSoon, setSearchSoon] = useState('');
  const [searchBiggest, setSearchBiggest] = useState('');
  const [sortNew, setSortNew] = useState<'newest' | 'pot'>('newest');
  const [sortSoon, setSortSoon] = useState<'expiry' | 'pot'>('expiry');
  const [sortBiggest, setSortBiggest] = useState<'pot' | 'newest'>('pot');
  const [timeRemainingText, setTimeRemainingText] = useState<{ [id: string]: string }>({});
  const [showSkeleton, setShowSkeleton] = useState(!roomsLoaded);

  const [quickAmountNew, setQuickAmountNew] = useState<number>(10);
  const [quickAmountSoon, setQuickAmountSoon] = useState<number>(10);
  const [quickAmountBiggest, setQuickAmountBiggest] = useState<number>(10);
  const [audioEnabled, setAudioEnabled] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setAudioEnabled(!!(window as any).isAudioEnabled);
    }
    const handleToggle = () => {
      setAudioEnabled(!!(window as any).isAudioEnabled);
    };
    window.addEventListener('audio-state-changed', handleToggle);
    return () => window.removeEventListener('audio-state-changed', handleToggle);
  }, []);

  const toggleAudio = () => {
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('toggle-audio'));
    }
  };

  const [showGearNew, setShowGearNew] = useState(false);
  const [showGearSoon, setShowGearSoon] = useState(false);
  const [showGearBiggest, setShowGearBiggest] = useState(false);

  // Load fresh active rooms directly on mount
  useEffect(() => {
    fetchRooms().catch(console.error);
  }, [fetchRooms]);

  // Show loading skeleton while rooms are syncing, hide instantly when loaded
  useEffect(() => {
    if (roomsLoaded) {
      setShowSkeleton(false);
    }
  }, [roomsLoaded]);

  // Real-time ticking state for timer clocks
  useEffect(() => {
    const updateTimers = () => {
      const texts: { [id: string]: string } = {};
      const now = Date.now();

      rooms.forEach((room) => {
        if (room.status === 'disputed') {
          texts[room.id] = '⚠️ DISPUTED';
          return;
        }
        if (room.status !== 'active') {
          texts[room.id] = 'SETTLED';
          return;
        }

        const delta = room.expiry - now;
        if (delta <= 0) {
          texts[room.id] = 'SETTLING...';
          return;
        }

        const hrs = Math.floor(delta / 3600000);
        const mins = Math.floor((delta % 3600000) / 60000);
        const secs = Math.floor((delta % 60000) / 1000);

        const format = (val: number) => String(val).padStart(2, '0');
        texts[room.id] = `${format(hrs)}:${format(mins)}:${format(secs)}`;
      });

      setTimeRemainingText(texts);
    };

    updateTimers();
    const interval = setInterval(updateTimers, 1000);
    return () => clearInterval(interval);
  }, [rooms]);

  // Filtering & Sorting Logic for the 3 columns
  const getCategorizedRooms = () => {
    const now = Date.now();

    // Helper to filter a room by selected status, network, and category
    const filterRoom = (r: Room, listFilter: 'ending' | 'expired') => {
      if (!r.token || !r.token.name || r.token.name === 'Unknown Token' || r.token.symbol === 'UNKNOWN' || r.token.symbol === 'UNKNWN') {
        return false;
      }
      if (selectedCategory !== 'all') {
        const cat = r.category || detectCategory(r.token.name, r.token.symbol);
        if (cat !== selectedCategory) return false;
      }
      if (listFilter === 'expired') {
        if (r.status !== 'settled' && r.status !== 'disputed' && r.expiry > now) return false;
      } else {
        if (r.status !== 'active' || r.expiry <= now) return false;
      }
      if (selectedNetwork !== 'all' && r.token.chainId !== selectedNetwork) {
        return false;
      }
      return true;
    };

    // 1. New (Newest listed first / or sorted by pot)
    let newRoomsList = rooms.filter(r => filterRoom(r, filterNew));
    if (searchNew.trim()) {
      const q = searchNew.toLowerCase();
      newRoomsList = newRoomsList.filter(
        (r) =>
          r.token.name.toLowerCase().includes(q) ||
          r.token.symbol.toLowerCase().includes(q) ||
          r.token.address.toLowerCase() === q
      );
    }
    newRoomsList.sort((a, b) => {
      if (sortNew === 'pot') {
        const potA = a.moonPool + a.jeetPool;
        const potB = b.moonPool + b.jeetPool;
        return potB - potA;
      }
      return b.createdAt - a.createdAt;
    });

    // 2. Ending Soon (Closest expiry first / or sorted by pot)
    let endingSoonRoomsList = rooms.filter(r => filterRoom(r, filterSoon));
    if (searchSoon.trim()) {
      const q = searchSoon.toLowerCase();
      endingSoonRoomsList = endingSoonRoomsList.filter(
        (r) =>
          r.token.name.toLowerCase().includes(q) ||
          r.token.symbol.toLowerCase().includes(q) ||
          r.token.address.toLowerCase() === q
      );
    }
    endingSoonRoomsList.sort((a, b) => {
      if (sortSoon === 'pot') {
        const potA = a.moonPool + a.jeetPool;
        const potB = b.moonPool + b.jeetPool;
        return potB - potA;
      }
      return a.expiry - b.expiry;
    });

    // 3. Biggest Pot (Highest total pot first / or sorted by date)
    let biggestPotRoomsList = rooms.filter(r => filterRoom(r, filterBiggest));
    if (searchBiggest.trim()) {
      const q = searchBiggest.toLowerCase();
      biggestPotRoomsList = biggestPotRoomsList.filter(
        (r) =>
          r.token.name.toLowerCase().includes(q) ||
          r.token.symbol.toLowerCase().includes(q) ||
          r.token.address.toLowerCase() === q
      );
    }
    biggestPotRoomsList.sort((a, b) => {
      if (sortBiggest === 'newest') {
        return b.createdAt - a.createdAt;
      }
      const potA = a.moonPool + a.jeetPool;
      const potB = b.moonPool + b.jeetPool;
      return potB - potA;
    });

    return {
      newRooms: newRoomsList,
      endingSoonRooms: endingSoonRoomsList,
      biggestPotRooms: biggestPotRoomsList,
      allMatchingCount: newRoomsList.length + endingSoonRoomsList.length + biggestPotRoomsList.length
    };
  };

  const { newRooms, endingSoonRooms, biggestPotRooms, allMatchingCount } = getCategorizedRooms();

  // Quick Bet Placement handler
  const handleQuickBet = (e: React.MouseEvent, roomId: string, side: 'moon' | 'jeet', amount: number) => {
    e.stopPropagation(); // Prevent card redirect click
    e.preventDefault();

    if (!user || !user.wallet) {
      connectWallet();
      synthSound('bet');
      return;
    }

    placeBet(roomId, side, amount);
    synthSound('bet');
  };

  const renderRoomCard = (room: Room, quickAmount: number) => {
    const isMoonLeading = room.moonPool > room.jeetPool;
    const totalPot = room.moonPool + room.jeetPool;
    const moonPercentage = totalPot > 0 ? (room.moonPool / totalPot) * 100 : 50;
    const jeetPercentage = totalPot > 0 ? (room.jeetPool / totalPot) * 100 : 50;

    const timeText = timeRemainingText[room.id] || '00:00:00';
    const isSettled = room.status === 'settled';
    const isDisputed = room.status === 'disputed';

    // Left border indicator & background tint & box shadow glow
    const borderGlow = isDisputed
      ? 'border-l-[4px] border-l-jeet-red/85 shadow-[inset_4px_0_10px_rgba(255,7,58,0.15)] animate-pulse'
      : isSettled
      ? 'border-l-[4px] border-l-moon-gold/80 shadow-[inset_4px_0_10px_rgba(255,215,0,0.06)]'
      : isMoonLeading
      ? 'border-l-[4px] border-l-neon-moon/80 shadow-[inset_4px_0_10px_rgba(22,163,74,0.1)]'
      : 'border-l-[4px] border-l-jeet-red/80 shadow-[inset_4px_0_10px_rgba(255,7,58,0.1)]';

    const hoverGlow = isDisputed
      ? 'hover:bg-[#1a0205] hover:shadow-[inset_4px_0_15px_rgba(255,7,58,0.22),_0_0_12px_rgba(255,7,58,0.15)]'
      : isSettled
      ? 'hover:bg-[#171103] hover:shadow-[inset_4px_0_15px_rgba(255,215,0,0.12),_0_0_12px_rgba(255,215,0,0.1)]'
      : isMoonLeading
      ? 'hover:bg-[#07170a] hover:shadow-[inset_4px_0_15px_rgba(22,163,74,0.18),_0_0_12px_rgba(22,163,74,0.12)]'
      : 'hover:bg-[#180507] hover:shadow-[inset_4px_0_15px_rgba(255,7,58,0.18),_0_0_12px_rgba(255,7,58,0.12)]';

    return (
      <div
        key={room.id}
        onClick={() => router.push(`/room/${room.id}`)}
        className={`p-3.5 cursor-pointer flex flex-col justify-between relative group transition-all duration-150 select-none scanlines ${borderGlow} ${hoverGlow} bg-[#05050A]`}
      >
        {/* Timer Bomb Clock Header */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1 bg-trench-black border border-trench-sandbag/80 rounded px-1.5 py-0.5">
            <Bomb size={9} className={isDisputed ? 'text-jeet-red animate-pulse' : isSettled ? 'text-moon-gold' : 'text-jeet-red'} />
            <span className={`font-mono text-[9px] font-bold ${isDisputed ? 'text-jeet-red' : isSettled ? 'text-moon-gold' : 'text-white'}`}>
              {formatDuration(room.duration)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Bookmark button */}
            <button
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
                toggleBookmark(room.id);
                synthSound('bet');
              }}
              className="p-1 hover:bg-trench-black border border-trench-sandbag/30 text-trench-gasmask hover:text-white rounded transition-colors"
              title={watchlistedIds.includes(room.id) ? "Remove Bookmark" : "Bookmark Room"}
            >
              <Bookmark 
                size={10} 
                className={watchlistedIds.includes(room.id) ? "fill-neon-moon text-neon-moon" : ""} 
              />
            </button>
            {/* Small Chain Icon to indicate network */}
            <div className="bg-trench-black p-0.5 rounded border border-trench-sandbag/30 flex items-center justify-center h-5 w-5 shrink-0" title={`Network: ${room.token.chainId?.toUpperCase() || (process.env.NEXT_PUBLIC_CORE_CHAIN?.toUpperCase() || 'AVALANCHE')}`}>
              <NetworkLogo chainId={room.token.chainId || (process.env.NEXT_PUBLIC_CORE_CHAIN || 'avalanche')} active={true} className="w-3.5 h-3.5" />
            </div>
            <div className={`text-[9px] font-mono font-bold bg-trench-black px-1.5 py-0.5 rounded border uppercase ${
              isDisputed
                ? 'text-jeet-red border-jeet-red/50 animate-pulse'
                : isSettled
                ? 'text-moon-gold border-trench-sandbag/30'
                : 'text-neon-moon border-trench-sandbag/30 animate-pulse'
            }`}>
              {timeText}
            </div>
          </div>
        </div>

        {/* Token Details with compact structure */}
        <div className="flex items-center gap-2 border-b border-trench-sandbag/30 pb-2 mb-2">
          <div className="relative bg-trench-black p-0.5 border border-trench-sandbag rounded overflow-hidden shrink-0 w-8 h-8 flex items-center justify-center">
            {room.token.icon && room.token.icon.startsWith('http') ? (
              <img src={room.token.icon} alt={room.token.name} className="w-full h-full object-cover rounded" />
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
                size={24}
                glowColor={isMoonLeading ? 'moon' : 'jeet'}
                className="rounded"
              />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1 flex-wrap">
              <h4 className="font-staatliches text-base text-white tracking-wide truncate max-w-[90px]">
                {room.token.name}
              </h4>
              <span className="font-mono text-[9px] text-neon-moon font-bold truncate">
                {formatCashtag(room.token.symbol)}
              </span>
            </div>
            <span 
              onClick={(e) => {
                e.stopPropagation();
                navigator.clipboard.writeText(room.token.address);
                addToast("CONTRACT COPIED!", 'success');
              }}
              className="font-mono text-[8px] text-trench-gasmask hover:text-white transition-colors cursor-pointer select-all truncate block max-w-[140px]"
              title="Click to copy CA"
            >
              📋 {room.token.address}
            </span>
          </div>
        </div>

        {/* Polymarket prediction target box */}
        <div className="bg-trench-black/40 border border-trench-sandbag/20 p-1.5 rounded mb-2 text-center font-mono text-[9px] leading-tight">
          <p className="text-white font-bold uppercase">
            WILL {room.token.symbol.startsWith('$') ? room.token.symbol.toUpperCase() : `$${room.token.symbol.toUpperCase()}`} END ABOVE {room.openingPrice !== undefined && formatPrice(room.openingPrice) !== 'N/A' ? `$${formatPrice(room.openingPrice)}` : '$1.00'} ON {formatExpiryUTC(room.expiry)}?
          </p>
        </div>

        {/* Pools Breakdown progress bar */}
        <div className="space-y-1 mb-2 font-mono text-[8px] font-bold">
          <div className="flex justify-between text-[9px]">
            <span className="text-neon-moon uppercase">MOON POT: {room.moonPool.toFixed(2)} {room.token.chainId === 'avalanche' || process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche' ? 'USDC' : 'SOL'}</span>
            <span className="text-jeet-red uppercase">JEET POT: {room.jeetPool.toFixed(2)} {room.token.chainId === 'avalanche' || process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche' ? 'USDC' : 'SOL'}</span>
          </div>

          {/* Dual Bar */}
          <div className="w-full h-1.5 bg-trench-black border border-trench-sandbag/60 rounded overflow-hidden flex">
            <div
              style={{ width: `${moonPercentage}%` }}
              className="bg-neon-moon h-full transition-all duration-300"
            />
            <div
              style={{ width: `${jeetPercentage}%` }}
              className="bg-jeet-red h-full transition-all duration-300"
            />
          </div>
        </div>

        {/* Quick Bet Buttons / Settlement Badges */}
        {isDisputed ? (
          <div className="w-full py-1 bg-red-950/45 border border-dashed border-jeet-red text-center rounded mt-auto">
            <span className="font-staatliches text-xs text-jeet-red uppercase tracking-widest animate-pulse font-bold">
              ⚠️ VERDICT DISPUTED
            </span>
          </div>
        ) : isSettled ? (
          <div className="w-full py-1 bg-trench-black border border-dashed border-moon-gold/40 text-center rounded mt-auto">
            <span className="font-staatliches text-xs text-moon-gold uppercase tracking-widest glow-gold font-bold">
              WINNER: {room.winner?.toUpperCase() || 'MOON'}
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-1.5 mt-auto">
            <button
              onClick={(e) => handleQuickBet(e, room.id, 'moon', quickAmount)}
              className="uiverse-btn uiverse-btn-sm uiverse-btn-moon font-staatliches tracking-wider"
            >
              <img src="/pepes/pepe-few-understand.png" className="btn-icon object-contain" alt="Pepe" />
              <span className="now">MOON</span>
              <span className="play !whitespace-nowrap">MOON {quickAmount}</span>
            </button>
            <button
              onClick={(e) => handleQuickBet(e, room.id, 'jeet', quickAmount)}
              className="uiverse-btn uiverse-btn-sm uiverse-btn-jeet font-staatliches tracking-wider"
            >
              <img src="/pepes/jeet-skeleton.png" className="btn-icon object-contain" alt="Pepe" />
              <span className="now">JEET</span>
              <span className="play !whitespace-nowrap">JEET {quickAmount}</span>
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderColumnSkeleton = () => (
    <div className="retro-panel rounded-xl overflow-hidden divide-y divide-trench-sandbag bg-black animate-pulse">
      {[1, 2, 3].map((n) => (
        <div key={n} className="p-3.5 h-44 bg-[#05050A]" />
      ))}
    </div>
  );

  const renderEmptyColumn = () => (
    <div className="flex flex-col items-center justify-center py-10 text-center text-trench-gasmask border border-dashed border-trench-sandbag/40 rounded-lg p-4 font-mono text-[10px] uppercase font-bold">
      <p>No Arenas Found</p>
    </div>
  );

  return (
    <div className="w-full px-4 md:px-8 py-6 flex-1 flex flex-col select-none max-w-full">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-50">
        <div className="flex items-center gap-6">
          <h2 className="font-staatliches text-4xl text-white tracking-wider font-bold">
            War Room
          </h2>
          {/* Network Selection Icons */}
          <div className="flex items-center gap-3">
            {(['all', 'solana', 'base', 'ethereum'] as const).map((net) => (
              <button
                key={net}
                onClick={() => {
                  setSelectedNetwork(net);
                  synthSound('bet');
                }}
                className="focus:outline-none transition-transform active:scale-95 flex items-center justify-center"
                title={`Network: ${net.toUpperCase()}`}
              >
                <NetworkLogo chainId={net} active={selectedNetwork === net} />
              </button>
            ))}

            {/* Selected Other Network Tab if it's active */}
            {!['all', 'solana', 'base', 'ethereum'].includes(selectedNetwork) && (
              <button
                onClick={() => {
                  synthSound('bet');
                }}
                className="focus:outline-none transition-transform active:scale-95 flex items-center gap-1 bg-trench-black px-2 py-0.5 rounded border border-neon-moon/60 scale-95"
                title={`Network: ${selectedNetwork.toUpperCase()}`}
              >
                <NetworkLogo chainId={selectedNetwork} active={true} className="w-5 h-5" />
                <span className="font-mono text-[9px] text-neon-moon font-bold uppercase">{selectedNetwork}</span>
              </button>
            )}

            {/* Other Networks Trigger Wrapper */}
            <div className="relative flex items-center">
              <button
                onClick={() => {
                  setShowOtherNetworksDrawer(prev => !prev);
                  synthSound('bet');
                }}
                className={`focus:outline-none transition-all active:scale-95 w-7 h-7 rounded-full border flex items-center justify-center text-trench-gasmask hover:text-white hover:border-white ${
                  showOtherNetworksDrawer 
                    ? 'bg-trench-sandbag text-white border-white scale-110 shadow-glow-moon' 
                    : 'bg-trench-black/40 border-trench-sandbag/40'
                }`}
                title="More Networks"
              >
                <Plus size={14} className="stroke-[3]" />
              </button>

              {showOtherNetworksDrawer && (
                <>
                  {/* Invisible Backdrop to close on click outside */}
                  <div 
                    className="fixed inset-0 z-[998]"
                    onClick={() => setShowOtherNetworksDrawer(false)}
                  />
                  
                  {/* Communications Bay Dropdown */}
                  <div 
                    className="!absolute right-0 top-full mt-2 w-80 bg-trench-mud border-4 border-trench-sandbag z-[999] flex flex-col shadow-2xl scanlines rounded-lg overflow-hidden animate-fadeIn"
                    style={{ maxHeight: '60vh' }}
                  >
                    {/* Header */}
                    <div className="p-3 border-b-2 border-trench-sandbag/40 bg-trench-black/60 flex items-center justify-between shrink-0">
                      <div className="flex items-center gap-1.5">
                        <span className="w-2.5 h-2.5 rounded-full bg-neon-moon shadow-[0_0_6px_#39ff14] animate-pulse" />
                        <h3 className="font-staatliches text-base tracking-widest text-white uppercase">COMMUNICATIONS BAY</h3>
                      </div>
                      <button 
                        onClick={() => {
                          setShowOtherNetworksDrawer(false);
                          synthSound('bet');
                        }}
                        className="p-1 hover:bg-trench-black border border-trench-sandbag/40 text-trench-gasmask hover:text-white rounded transition-colors"
                        title="Abort Connection"
                      >
                        <X size={12} className="stroke-[2.5]" />
                      </button>
                    </div>

                    {/* Search Bar */}
                    <div className="p-2.5 border-b border-trench-sandbag/20 bg-trench-black/20 shrink-0">
                      <div className="relative">
                        <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-trench-gasmask" />
                        <input
                          type="text"
                          placeholder="SEARCH NETWORK CHANNEL..."
                          value={drawerSearch}
                          onChange={(e) => setDrawerSearch(e.target.value)}
                          className="w-full pl-8 pr-3 py-1.5 bg-trench-black/80 border border-trench-sandbag/40 text-white font-mono text-[9px] placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none uppercase tracking-wider font-bold"
                        />
                      </div>
                    </div>

                    {/* Drawer Content */}
                    <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 custom-scrollbar">
                      <span className="font-mono text-[8px] text-trench-gasmask font-bold uppercase tracking-wider block mb-1">
                        SELECT ALTERNATIVE TRENCH NETWORK:
                      </span>

                      {/* Grid of Other Networks */}
                      <div className="grid grid-cols-2 gap-2">
                        {OTHER_NETWORKS
                          .filter(net => net.name.toLowerCase().includes(drawerSearch.toLowerCase()) || net.id.toLowerCase().includes(drawerSearch.toLowerCase()))
                          .map((net) => {
                            const isActive = selectedNetwork === net.id;
                            return (
                              <button
                                key={net.id}
                                onClick={() => {
                                  setSelectedNetwork(net.id);
                                  setShowOtherNetworksDrawer(false);
                                  synthSound('bet');
                                }}
                                className={`p-1.5 rounded border flex flex-col items-center justify-center gap-1.5 transition-all active:scale-95 group hover:-translate-y-0.5 ${
                                  isActive
                                    ? 'bg-neon-moon/10 border-neon-moon text-neon-moon shadow-glow-moon'
                                    : 'bg-trench-black/60 border-trench-sandbag/40 text-trench-gasmask hover:text-white hover:border-trench-sandbag'
                                }`}
                              >
                                <img
                                  src={`https://dd.dexscreener.com/ds-data/chains/${net.id}.png`}
                                  alt={net.name}
                                  className={`w-6 h-6 object-contain rounded-full transition-transform group-hover:scale-105 ${
                                    isActive ? 'filter drop-shadow-[0_0_4px_#39ff14]' : 'opacity-70 group-hover:opacity-100'
                                  }`}
                                  onError={(e) => {
                                    e.currentTarget.src = 'https://dd.dexscreener.com/ds-data/chains/solana.png';
                                  }}
                                />
                                <span className="font-mono text-[9px] font-bold uppercase tracking-wider truncate max-w-full text-center">
                                  {net.name}
                                </span>
                              </button>
                            );
                          })}
                      </div>

                      {/* Reset button if filter is active */}
                      {selectedNetwork !== 'all' && (
                        <button
                          onClick={() => {
                            setSelectedNetwork('all');
                            setShowOtherNetworksDrawer(false);
                            synthSound('bet');
                          }}
                          className="w-full mt-4 py-2 border-2 border-dashed border-trench-sandbag/60 text-trench-gasmask hover:text-white hover:border-white rounded font-mono text-[10px] uppercase font-bold text-center transition-colors block"
                        >
                          CLEAR CHANNEL FILTERS [ALL NETWORKS]
                        </button>
                      )}
                    </div>

                    {/* Drawer Footer */}
                    <div className="p-3 border-t border-trench-sandbag/40 bg-trench-black/40 text-center font-mono text-[7px] text-trench-gasmask uppercase tracking-wider shrink-0 select-none">
                      SYSTEM SCANNING ACTIVE // SECURE CONCOM
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Watchlist Command Center & Deploy CTA */}
        <div className="flex items-center gap-3 w-full md:w-auto">
          {/* Watchlist Command Console trigger */}
          <div className="relative">
            <button
              onClick={() => {
                setShowWatchlistDrawer(prev => !prev);
                synthSound('bet');
              }}
              className={`p-2 rounded border-2 flex items-center justify-center transition-all h-11 w-11 shrink-0 relative hover:-translate-y-0.5 select-none ${
                showWatchlistDrawer
                  ? 'bg-trench-sandbag text-white border-white scale-105 shadow-glow-moon'
                  : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white hover:border-white'
              }`}
              title="Targeted Watchlist"
            >
              <Bookmark size={20} className={watchlistedIds.length > 0 ? "fill-neon-moon text-neon-moon" : ""} />
              {watchlistedIds.length > 0 && (
                <span className="absolute -top-1.5 -right-1.5 bg-jeet-red text-white text-[9px] font-bold h-4 w-4 rounded-full border border-trench-black flex items-center justify-center font-mono">
                  {watchlistedIds.length}
                </span>
              )}
            </button>

            {/* Watchlist Mini-Page Dropdown/Drawer */}
            {showWatchlistDrawer && (
              <>
                {/* Invisible backdrop to click-close */}
                <div 
                  className="fixed inset-0 z-[998]"
                  onClick={() => setShowWatchlistDrawer(false)}
                />
                
                {/* Dropdown Panel */}
                <div 
                  className="!absolute right-0 top-full mt-2 w-80 bg-trench-mud border-4 border-trench-sandbag z-[999] flex flex-col shadow-2xl scanlines rounded-lg overflow-hidden animate-fadeIn"
                  style={{ maxHeight: '60vh' }}
                >
                  {/* Header */}
                  <div className="p-3 border-b-2 border-trench-sandbag/40 bg-trench-black/60 flex items-center justify-between shrink-0">
                    <div className="flex items-center gap-1.5">
                      <Bookmark size={14} className="text-neon-moon fill-neon-moon animate-pulse" />
                      <h3 className="font-staatliches text-base tracking-widest text-white uppercase">WATCHLIST CONSOLE</h3>
                    </div>
                    <button 
                      onClick={() => {
                        setShowWatchlistDrawer(false);
                        synthSound('bet');
                      }}
                      className="p-1 hover:bg-trench-black border border-trench-sandbag/40 text-trench-gasmask hover:text-white rounded transition-colors"
                      title="Close Watchlist"
                    >
                      <X size={12} className="stroke-[2.5]" />
                    </button>
                  </div>

                  {/* Watchlist content list */}
                  <div className="flex-1 overflow-y-auto p-3 space-y-2.5 min-h-0 custom-scrollbar bg-trench-black/20">
                    {watchlistedIds.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-8 text-center text-trench-gasmask font-mono text-[9px] font-bold uppercase tracking-wider leading-relaxed">
                        <p>No Token Channels Targeted</p>
                        <p className="mt-1 text-[8px] text-trench-gasmask/60">Bookmark active rooms to lock radar tracking</p>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        {rooms
                          .filter((r) => watchlistedIds.includes(r.id))
                          .map((r) => {
                            const totalPot = r.moonPool + r.jeetPool;
                            const isMoonLeading = r.moonPool > r.jeetPool;
                            const isSettled = r.status === 'settled';
                            const timeText = timeRemainingText[r.id] || '00:00:00';
                            
                            return (
                              <div 
                                key={r.id}
                                onClick={() => {
                                  router.push(`/room/${r.id}`);
                                  setShowWatchlistDrawer(false);
                                }}
                                className="p-2 bg-trench-black/60 border border-trench-sandbag/40 hover:border-neon-moon rounded flex items-center justify-between gap-2 cursor-pointer transition-colors"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  <div className="relative shrink-0 w-6 h-6 bg-trench-black border border-trench-sandbag/30 rounded flex items-center justify-center">
                                    {r.token.icon && r.token.icon.startsWith('http') ? (
                                      <img src={r.token.icon} alt={r.token.name} className="w-full h-full object-cover rounded" />
                                    ) : (
                                      <PepePortrait
                                        src={(() => {
                                          let hash = 0;
                                          for (let i = 0; i < r.id.length; i++) {
                                            hash = r.id.charCodeAt(i) + ((hash << 5) - hash);
                                          }
                                          const index = Math.abs(hash);
                                          return isMoonLeading 
                                            ? MOON_PEPES[index % MOON_PEPES.length] 
                                            : JEET_PEPES[index % JEET_PEPES.length];
                                        })()}
                                        size={18}
                                        glowColor={isMoonLeading ? 'moon' : 'jeet'}
                                        className="rounded"
                                      />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <span className="font-staatliches text-xs text-white block truncate leading-tight">
                                      {r.token.name}
                                    </span>
                                    <span className="font-mono text-[8px] text-neon-moon font-bold block leading-none">
                                      {formatCashtag(r.token.symbol)} // {totalPot.toFixed(1)} {r.token.chainId === 'avalanche' || process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche' ? 'USDC' : 'SOL'} POT
                                    </span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <div className={`font-mono text-[8px] font-bold px-1 py-0.5 rounded border border-trench-sandbag/20 ${
                                    isSettled ? 'text-moon-gold' : 'text-neon-moon'
                                  }`}>
                                    {isSettled ? 'SETTLED' : timeText}
                                  </div>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      e.preventDefault();
                                      toggleBookmark(r.id);
                                      synthSound('bet');
                                    }}
                                    className="p-1 hover:bg-red-500/20 text-trench-gasmask hover:text-jeet-red rounded border border-transparent hover:border-jeet-red/30 transition-all"
                                    title="Unbookmark Channel"
                                  >
                                    <X size={10} className="stroke-[2.5]" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    )}
                  </div>

                  {/* Drawer Footer */}
                  <div className="p-2 border-t border-trench-sandbag/40 bg-trench-black/40 text-center font-mono text-[7px] text-trench-gasmask uppercase tracking-wider shrink-0 select-none">
                    RADAR TRACKING CONSOLE ACTIVE // TARGET LOCK
                  </div>
                </div>
              </>
            )}
          {/* Rocket Deploy Button */}
          <Link href="/create-room" className="w-full md:w-auto">
            <button className="w-full py-2 px-4 font-staatliches text-lg tracking-wider text-black bg-neon-moon hover:bg-green-500 rounded border-b-4 border-green-800 shadow-glow-moon active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase font-bold h-11 text-center">
              <Rocket size={18} className="animate-bounce text-black" />
              <span>DEPLOY ROOM</span>
            </button>
          </Link>
        </div>
      </div>
    </div>

      {/* Polymarket-Style Category Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 scrollbar-none border-b border-trench-sandbag/40 shrink-0">
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.id;
          return (
            <button
              key={cat.id}
              onClick={() => {
                setSelectedCategory(cat.id);
                synthSound('bet');
              }}
              className={`px-3 py-1.5 rounded-lg border font-staatliches text-xs tracking-wider uppercase transition-all duration-150 flex items-center gap-1.5 shrink-0 select-none ${
                isActive
                  ? 'bg-neon-moon/20 border-neon-moon text-neon-moon shadow-glow-moon scale-105 font-bold'
                  : 'bg-trench-black/60 border-trench-sandbag/40 text-trench-gasmask hover:text-white hover:border-gray-500'
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* 3-Column Dashboard View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start min-h-0 w-full mb-6">
        
        {/* Column 1: New */}
        <div className="flex flex-col bg-trench-black/40 border-2 border-trench-sandbag/60 rounded-xl p-4 lg:max-h-[68vh] w-full">
          <div className="flex flex-col border-b-2 border-trench-sandbag/40 pb-2 mb-3 shrink-0 relative">
            <div className="flex items-center justify-between gap-1 flex-wrap lg:flex-nowrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-neon-moon shadow-[0_0_6px_#39ff14]" />
                <h3 className="font-staatliches text-lg tracking-wider text-white uppercase">NEW</h3>
              </div>

              {/* Search Pill */}
              <div className="relative flex-1 min-w-[60px] max-w-[100px]">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchNew}
                  onChange={(e) => setSearchNew(e.target.value)}
                  className="w-full px-2 py-0.5 bg-trench-black/80 border border-trench-sandbag/40 text-white font-mono text-[9px] placeholder-trench-gasmask/60 rounded-full focus:border-neon-moon focus:outline-none uppercase font-bold text-center"
                />
              </div>

              {/* Quick Bet Pill: ⚡ Amount USDC */}
              <div className="flex items-center gap-0.5 bg-trench-black/80 border border-trench-sandbag/40 rounded-full px-1.5 py-0.5 text-white font-mono text-[9px] h-6 shrink-0" title="Quick Stake Amount (USDC)">
                <span className="text-neon-moon font-bold select-none">⚡</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={quickAmountNew}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setQuickAmountNew(isNaN(val) ? 0 : val);
                  }}
                  className="w-10 bg-transparent text-white font-bold focus:outline-none text-center"
                />
                <span className="font-staatliches text-[10px] text-neon-moon font-bold ml-0.5 tracking-wider">USDC</span>
              </div>


              {/* Settings Gear Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowGearNew(prev => !prev);
                    synthSound('bet');
                  }}
                  className={`p-1 text-xs rounded transition-all h-6 flex items-center justify-center shrink-0 ${showGearNew ? 'text-neon-moon font-bold scale-110' : 'text-trench-gasmask hover:text-white'}`}
                  title="Filter and Sort Settings"
                >
                  ⚙
                </button>
                {showGearNew && (
                  <div className="absolute right-0 top-7 z-30 w-44 bg-trench-black border-2 border-trench-sandbag rounded-lg p-3 shadow-glow-moon scanlines font-mono text-[10px] space-y-2.5">
                    <div className="flex justify-between items-center border-b border-trench-sandbag/40 pb-1 mb-1">
                      <span className="text-white font-bold uppercase">SETTINGS</span>
                      <button onClick={() => setShowGearNew(false)} className="text-trench-gasmask hover:text-white font-bold">×</button>
                    </div>
                    <div className="space-y-1">
                      <span className="text-neon-moon font-bold uppercase block text-[9px]">SORT BY</span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => {
                            setSortNew('newest');
                            synthSound('bet');
                          }}
                          className={`px-1.5 py-0.5 rounded text-center border transition-all text-[8px] ${
                            sortNew === 'newest'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          NEWEST
                        </button>
                        <button
                          onClick={() => {
                            setSortNew('pot');
                            synthSound('bet');
                          }}
                          className={`px-1.5 py-0.5 rounded text-center border transition-all text-[8px] ${
                            sortNew === 'pot'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          POT
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-neon-moon font-bold uppercase block text-[9px]">STATUS FILTER</span>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            setFilterNew('ending');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filterNew !== 'expired'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          🟢 LIVE ARENAS
                        </button>
                        <button
                          onClick={() => {
                            setFilterNew('expired');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filterNew === 'expired'
                              ? 'bg-trench-sandbag text-moon-gold border-moon-gold font-bold shadow-glow-gold'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          💀 EXPIRED ROOMS
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin max-h-[480px] lg:max-h-none">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : newRooms.length > 0 ? (
              <div className="retro-panel rounded-xl overflow-hidden divide-y divide-trench-sandbag bg-black shadow-[0_0_15px_rgba(22,163,74,0.05)]">
                {newRooms.map((room) => renderRoomCard(room, quickAmountNew))}
              </div>
            ) : (
              renderEmptyColumn()
            )}
          </div>
        </div>

        {/* Column 2: Ending Soon */}
        <div className="flex flex-col bg-trench-black/40 border-2 border-trench-sandbag/60 rounded-xl p-4 lg:max-h-[68vh] w-full">
          <div className="flex flex-col border-b-2 border-trench-sandbag/40 pb-2 mb-3 shrink-0 relative">
            <div className="flex items-center justify-between gap-1 flex-wrap lg:flex-nowrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-jeet-red shadow-[0_0_6px_#ff073a]" />
                <h3 className="font-staatliches text-lg tracking-wider text-white uppercase">ENDING SOON</h3>
              </div>

              {/* Search Pill */}
              <div className="relative flex-1 min-w-[60px] max-w-[100px]">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchSoon}
                  onChange={(e) => setSearchSoon(e.target.value)}
                  className="w-full px-2 py-0.5 bg-trench-black/80 border border-trench-sandbag/40 text-white font-mono text-[9px] placeholder-trench-gasmask/60 rounded-full focus:border-jeet-red focus:outline-none uppercase font-bold text-center"
                />
              </div>

              {/* Quick Bet Pill: ⚡ Amount USDC */}
              <div className="flex items-center gap-0.5 bg-trench-black/80 border border-trench-sandbag/40 rounded-full px-1.5 py-0.5 text-white font-mono text-[9px] h-6 shrink-0" title="Quick Stake Amount (USDC)">
                <span className="text-neon-moon font-bold select-none">⚡</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={quickAmountSoon}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setQuickAmountSoon(isNaN(val) ? 0 : val);
                  }}
                  className="w-10 bg-transparent text-white font-bold focus:outline-none text-center"
                />
                <span className="font-staatliches text-[10px] text-neon-moon font-bold ml-0.5 tracking-wider">USDC</span>
              </div>


              {/* Settings Gear Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowGearSoon(prev => !prev);
                    synthSound('bet');
                  }}
                  className={`p-1 text-xs rounded transition-all h-6 flex items-center justify-center shrink-0 ${showGearSoon ? 'text-neon-moon font-bold scale-110' : 'text-trench-gasmask hover:text-white'}`}
                  title="Filter and Sort Settings"
                >
                  ⚙
                </button>
                {showGearSoon && (
                  <div className="absolute right-0 top-7 z-30 w-44 bg-trench-black border-2 border-trench-sandbag rounded-lg p-3 shadow-glow-moon scanlines font-mono text-[10px] space-y-2.5">
                    <div className="flex justify-between items-center border-b border-trench-sandbag/40 pb-1 mb-1">
                      <span className="text-white font-bold uppercase">SETTINGS</span>
                      <button onClick={() => setShowGearSoon(false)} className="text-trench-gasmask hover:text-white font-bold">×</button>
                    </div>
                    <div className="space-y-1">
                      <span className="text-neon-moon font-bold uppercase block text-[9px]">SORT BY</span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => {
                            setSortSoon('expiry');
                            synthSound('bet');
                          }}
                          className={`px-1.5 py-0.5 rounded text-center border transition-all text-[8px] ${
                            sortSoon === 'expiry'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          TIME
                        </button>
                        <button
                          onClick={() => {
                            setSortSoon('pot');
                            synthSound('bet');
                          }}
                          className={`px-1.5 py-0.5 rounded text-center border transition-all text-[8px] ${
                            sortSoon === 'pot'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          POT
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-neon-moon font-bold uppercase block text-[9px]">STATUS FILTER</span>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            setFilterSoon('ending');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filterSoon !== 'expired'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          🟢 LIVE ARENAS
                        </button>
                        <button
                          onClick={() => {
                            setFilterSoon('expired');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filterSoon === 'expired'
                              ? 'bg-trench-sandbag text-moon-gold border-moon-gold font-bold shadow-glow-gold'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          💀 EXPIRED ROOMS
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin max-h-[480px] lg:max-h-none">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : endingSoonRooms.length > 0 ? (
              <div className="retro-panel rounded-xl overflow-hidden divide-y divide-trench-sandbag bg-black shadow-[0_0_15px_rgba(22,163,74,0.05)]">
                {endingSoonRooms.map((room) => renderRoomCard(room, quickAmountSoon))}
              </div>
            ) : (
              renderEmptyColumn()
            )}
          </div>
        </div>

        {/* Column 3: Biggest Pot */}
        <div className="flex flex-col bg-trench-black/40 border-2 border-trench-sandbag/60 rounded-xl p-4 lg:max-h-[68vh] w-full">
          <div className="flex flex-col border-b-2 border-trench-sandbag/40 pb-2 mb-3 shrink-0 relative">
            <div className="flex items-center justify-between gap-1 flex-wrap lg:flex-nowrap">
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="w-2 h-2 rounded-full bg-moon-gold shadow-[0_0_6px_#ffd700]" />
                <h3 className="font-staatliches text-lg tracking-wider text-white uppercase">BIGGEST POT</h3>
              </div>

              {/* Search Pill */}
              <div className="relative flex-1 min-w-[60px] max-w-[100px]">
                <input
                  type="text"
                  placeholder="Search"
                  value={searchBiggest}
                  onChange={(e) => setSearchBiggest(e.target.value)}
                  className="w-full px-2 py-0.5 bg-trench-black/80 border border-trench-sandbag/40 text-white font-mono text-[9px] placeholder-trench-gasmask/60 rounded-full focus:border-moon-gold focus:outline-none uppercase font-bold text-center"
                />
              </div>

              {/* Quick Bet Pill: ⚡ Amount USDC */}
              <div className="flex items-center gap-0.5 bg-trench-black/80 border border-trench-sandbag/40 rounded-full px-1.5 py-0.5 text-white font-mono text-[9px] h-6 shrink-0" title="Quick Stake Amount (USDC)">
                <span className="text-neon-moon font-bold select-none">⚡</span>
                <input
                  type="number"
                  step="1"
                  min="1"
                  value={quickAmountBiggest}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setQuickAmountBiggest(isNaN(val) ? 0 : val);
                  }}
                  className="w-10 bg-transparent text-white font-bold focus:outline-none text-center"
                />
                <span className="font-staatliches text-[10px] text-neon-moon font-bold ml-0.5 tracking-wider">USDC</span>
              </div>


              {/* Settings Gear Dropdown */}
              <div className="relative">
                <button
                  onClick={() => {
                    setShowGearBiggest(prev => !prev);
                    synthSound('bet');
                  }}
                  className={`p-1 text-xs rounded transition-all h-6 flex items-center justify-center shrink-0 ${showGearBiggest ? 'text-neon-moon font-bold scale-110' : 'text-trench-gasmask hover:text-white'}`}
                  title="Filter and Sort Settings"
                >
                  ⚙
                </button>
                {showGearBiggest && (
                  <div className="absolute right-0 top-7 z-30 w-44 bg-trench-black border-2 border-trench-sandbag rounded-lg p-3 shadow-glow-moon scanlines font-mono text-[10px] space-y-2.5">
                    <div className="flex justify-between items-center border-b border-trench-sandbag/40 pb-1 mb-1">
                      <span className="text-white font-bold uppercase">SETTINGS</span>
                      <button onClick={() => setShowGearBiggest(false)} className="text-trench-gasmask hover:text-white font-bold">×</button>
                    </div>
                    <div className="space-y-1">
                      <span className="text-neon-moon font-bold uppercase block text-[9px]">SORT BY</span>
                      <div className="grid grid-cols-2 gap-1">
                        <button
                          onClick={() => {
                            setSortBiggest('pot');
                            synthSound('bet');
                          }}
                          className={`px-1.5 py-0.5 rounded text-center border transition-all text-[8px] ${
                            sortBiggest === 'pot'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          POT
                        </button>
                        <button
                          onClick={() => {
                            setSortBiggest('newest');
                            synthSound('bet');
                          }}
                          className={`px-1.5 py-0.5 rounded text-center border transition-all text-[8px] ${
                            sortBiggest === 'newest'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          DATE
                        </button>
                      </div>
                    </div>
                    <div className="space-y-1">
                      <span className="text-neon-moon font-bold uppercase block text-[9px]">STATUS FILTER</span>
                      <div className="flex flex-col gap-1">
                        <button
                          onClick={() => {
                            setFilterBiggest('ending');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filterBiggest !== 'expired'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          🟢 LIVE ARENAS
                        </button>
                        <button
                          onClick={() => {
                            setFilterBiggest('expired');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filterBiggest === 'expired'
                              ? 'bg-trench-sandbag text-moon-gold border-moon-gold font-bold shadow-glow-gold'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          💀 EXPIRED ROOMS
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 scrollbar-thin max-h-[480px] lg:max-h-none">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : biggestPotRooms.length > 0 ? (
              <div className="retro-panel rounded-xl overflow-hidden divide-y divide-trench-sandbag bg-black shadow-[0_0_15px_rgba(22,163,74,0.05)]">
                {biggestPotRooms.map((room) => renderRoomCard(room, quickAmountBiggest))}
              </div>
            ) : (
              renderEmptyColumn()
            )}
          </div>
        </div>

      </div>

      {/* Wallet Connection Helper Prompter */}
      {!user && (
        <div className="bg-trench-mud/50 border-2 border-trench-sandbag rounded-lg p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
          <div className="flex items-center gap-3">
            <PepePortrait src={PEPE_ASSETS.neonWojak} size={56} glowColor="jeet" animated className="rounded-lg" />
            <div>
              <h4 className="font-staatliches text-lg text-white tracking-wide uppercase">
                FIGHT IN COLD BLOOD? CONNECT YOUR AMMO WALLET!
              </h4>
              <p className="font-mono text-xs text-trench-gasmask font-bold uppercase mt-0.5">
                Connect your wallet to stack ammo on Moon or Jeet across live prediction rooms.
              </p>
            </div>
          </div>
          <button
            onClick={connectWallet}
            className="w-full md:w-auto px-6 py-2 bg-jeet-red hover:bg-red-700 text-white font-staatliches text-base tracking-wider rounded uppercase flex items-center justify-center gap-1.5 border-b-4 border-red-950 font-bold"
          >
            <UserPlus size={16} />
            <span>INSTANT DEPLOY WALLET</span>
          </button>
        </div>
      )}

      {/* Degen Quote Banner at bottom */}
      <div className="mt-4 shrink-0">
        <DegenQuoteBanner />
      </div>



    </div>
  );
}
