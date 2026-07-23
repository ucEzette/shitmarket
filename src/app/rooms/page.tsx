'use client';

import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppState, Room, formatCashtag, formatPrice, MarketCategory, CATEGORIES, detectCategory } from '@/store/useAppState';
import { PixelCrackedHelmet, PixelShovel, PixelGasMask } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { Search, Flame, Bomb, ArrowRight, UserPlus, Plus, X, Bookmark, Rocket, Clock } from 'lucide-react';

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

  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<'newest' | 'expiry' | 'pot'>('newest');
  const [statusFilter, setStatusFilter] = useState<'live' | 'expired'>('live');
  const [timeRemainingText, setTimeRemainingText] = useState<{ [id: string]: string }>({});
  const [showSkeleton, setShowSkeleton] = useState(!roomsLoaded);
  const [quickAmount, setQuickAmount] = useState<number>(10);
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

  // Unified Filtering & Sorting Logic
  const getFilteredAndSortedRooms = () => {
    const now = Date.now();

    let filtered = rooms.filter((r) => {
      if (!r || !r.id || !r.token) return false;

      // 1. Category Filter
      if (selectedCategory !== 'all') {
        const cat = r.category || detectCategory(r.token.name, r.token.symbol, r.resolutionCriteria);
        if (cat !== selectedCategory) return false;
      }

      // 2. Status Filter
      if (statusFilter === 'expired') {
        if (r.status !== 'settled' && r.status !== 'disputed' && r.expiry > now) return false;
      } else {
        if (r.status === 'settled' || r.status === 'disputed' || r.expiry <= now) return false;
      }

      // 3. Network Filter
      if (selectedNetwork !== 'all') {
        const roomNet = (r.token.chainId || 'solana').toLowerCase();
        const selNet = selectedNetwork.toLowerCase();
        if (roomNet !== selNet && !(selNet === 'avalanche' && (roomNet === 'fuji' || roomNet === 'avax'))) {
          return false;
        }
      }

      // 4. Search Query Filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = r.token.name.toLowerCase().includes(q);
        const matchesSymbol = r.token.symbol.toLowerCase().includes(q);
        const matchesAddress = r.token.address.toLowerCase() === q;
        const matchesCriteria = r.resolutionCriteria?.toLowerCase().includes(q);
        if (!matchesName && !matchesSymbol && !matchesAddress && !matchesCriteria) {
          return false;
        }
      }

      return true;
    });

    // 5. Sorting
    filtered.sort((a, b) => {
      if (sortBy === 'pot') {
        const potA = a.moonPool + a.jeetPool;
        const potB = b.moonPool + b.jeetPool;
        return potB - potA;
      } else if (sortBy === 'expiry') {
        return a.expiry - b.expiry;
      } else {
        return b.createdAt - a.createdAt;
      }
    });

    return filtered;
  };

  // Quick Bet Placement handler
  const handleQuickBet = (e: React.MouseEvent, roomId: string, side: 'moon' | 'jeet', amount: number) => {
    e.stopPropagation();
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
    const isDebateRoom = 
      (room.category as string) === 'debate' || 
      (room.category as string) === 'prediction' || 
      (!!room.resolutionCriteria && room.resolutionCriteria.length > 0 && (!room.token.pairAddress || room.token.pairAddress === '')) ||
      room.token.address === room.creator;

    const isMoonLeading = room.moonPool > room.jeetPool;
    const totalPot = room.moonPool + room.jeetPool;
    const moonPercentage = totalPot > 0 ? (room.moonPool / totalPot) * 100 : 50;
    const jeetPercentage = totalPot > 0 ? (room.jeetPool / totalPot) * 100 : 50;

    const timeText = timeRemainingText[room.id] || '00:00:00';
    const isSettled = room.status === 'settled';
    const isDisputed = room.status === 'disputed';

    return (
      <div
        key={room.id}
        onClick={() => router.push(`/room/${room.id}`)}
        className={`bg-trench-mud border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none relative group hover:-translate-y-0.5 ${
          isMoonLeading
            ? 'border-neon-moon/30 shadow-glow-moon hover:border-neon-moon/70 hover:shadow-glow-moon-strong'
            : 'border-jeet-red/30 shadow-glow-jeet hover:border-jeet-red/70 hover:shadow-glow-jeet-strong'
        }`}
      >
        {/* Card Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-start gap-3">
            {/* Icon */}
            <div className="relative bg-trench-black border border-trench-sandbag rounded-xl overflow-hidden shrink-0 w-10 h-10 flex items-center justify-center">
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
                  size={36}
                  glowColor={isMoonLeading ? 'moon' : 'jeet'}
                  className="rounded-lg"
                />
              )}
            </div>
            {/* Question */}
            <div className="min-w-0">
              <h4 className="font-bold text-sm text-slate-100 line-clamp-2 leading-snug tracking-wide group-hover:text-white transition-colors">
                {isDebateRoom 
                  ? (room.resolutionCriteria ? room.resolutionCriteria.split('| Ref:')[0].split('Ref:')[0].trim() : room.token.name)
                  : `Will ${room.token.symbol.startsWith('$') ? room.token.symbol.toUpperCase() : `$${room.token.symbol.toUpperCase()}`} end above ${room.openingPrice !== undefined && formatPrice(room.openingPrice) !== 'N/A' ? `$${formatPrice(room.openingPrice)}` : '$1.00'}?`}
              </h4>
              {!isDebateRoom && room.token.address && (
                <span 
                  onClick={(e) => {
                    e.stopPropagation();
                    navigator.clipboard.writeText(room.token.address);
                    addToast("CONTRACT COPIED!", 'success');
                  }}
                  className="font-mono text-[9px] text-trench-gasmask hover:text-slate-300 transition-colors cursor-pointer select-all truncate mt-0.5 inline-block max-w-[150px]"
                  title="Click to copy CA"
                >
                  CA: {room.token.address.slice(0, 6)}...{room.token.address.slice(-4)}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Outcome Selector Rows */}
        <div className="space-y-2 mb-4">
          {/* Moon Outcome Row */}
          <div className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
            isSettled && room.winner === 'moon'
              ? 'bg-green-950/20 border-green-500/30'
              : isSettled && room.winner !== 'moon'
              ? 'opacity-40 border-transparent'
              : 'bg-trench-black/40 border-trench-sandbag/40 hover:border-trench-sandbag'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-sm">🚀</span>
              <span className="font-bold text-xs text-slate-200">MOON</span>
              {isSettled && room.winner === 'moon' && <span className="text-[10px] text-green-500 bg-green-500/10 px-1.5 py-0.5 rounded font-mono font-bold">WINNER</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-slate-100">{moonPercentage.toFixed(0)}%</span>
              {!isSettled && !isDisputed ? (
                <button
                  onClick={(e) => handleQuickBet(e, room.id, 'moon', quickAmount)}
                  className="px-3.5 py-1 bg-green-600/10 text-green-500 hover:bg-green-600 hover:text-white border border-green-600/30 transition-all rounded-lg font-bold text-xs min-w-[70px] text-center"
                >
                  MOON
                </button>
              ) : (
                <div className="w-[70px]" />
              )}
            </div>
          </div>

          {/* Jeet Outcome Row */}
          <div className={`flex items-center justify-between p-2 rounded-xl border transition-all ${
            isSettled && room.winner === 'jeet'
              ? 'bg-red-950/20 border-red-500/30'
              : isSettled && room.winner !== 'jeet'
              ? 'opacity-40 border-transparent'
              : 'bg-trench-black/40 border-trench-sandbag/40 hover:border-trench-sandbag'
          }`}>
            <div className="flex items-center gap-2">
              <span className="text-sm">💀</span>
              <span className="font-bold text-xs text-slate-200">JEET</span>
              {isSettled && room.winner === 'jeet' && <span className="text-[10px] text-red-500 bg-red-500/10 px-1.5 py-0.5 rounded font-mono font-bold">WINNER</span>}
            </div>
            <div className="flex items-center gap-3">
              <span className="font-bold text-sm text-slate-100">{jeetPercentage.toFixed(0)}%</span>
              {!isSettled && !isDisputed ? (
                <button
                  onClick={(e) => handleQuickBet(e, room.id, 'jeet', quickAmount)}
                  className="px-3.5 py-1 bg-red-600/10 text-red-500 hover:bg-red-600 hover:text-white border border-red-600/30 transition-all rounded-lg font-bold text-xs min-w-[70px] text-center"
                >
                  JEET
                </button>
              ) : (
                <div className="w-[70px]" />
              )}
            </div>
          </div>
        </div>

        {/* Card Footer */}
        <div className="flex items-center justify-between border-t border-trench-sandbag/40 pt-3 mt-auto text-[10px] font-mono text-trench-gasmask">
          {/* Left Info Badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Network */}
            <div className="flex items-center gap-1 bg-trench-black/60 px-1.5 py-0.5 rounded border border-trench-sandbag/40 shrink-0">
              <NetworkLogo chainId={room.token.chainId || (process.env.NEXT_PUBLIC_CORE_CHAIN || 'avalanche')} active={true} className="w-3.5 h-3.5" />
              <span className="uppercase text-[9px] font-bold text-slate-300">
                {(room.token.chainId || 'solana').slice(0, 5)}
              </span>
            </div>

            <span>·</span>

            {/* Volume */}
            <span className="font-bold text-slate-300">
              ${totalPot.toLocaleString(undefined, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} {room.token.chainId === 'avalanche' || process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche' ? 'USDC' : 'SOL'} Vol.
            </span>

            <span>·</span>

            {/* Status */}
            {isDisputed ? (
              <span className="text-red-500 font-bold animate-pulse">⚠️ DISPUTED</span>
            ) : isSettled ? (
              <span className="text-moon-gold font-bold">💀 SETTLED</span>
            ) : (
              <div className="flex items-center gap-1 text-green-500 font-bold">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                <span>{timeText}</span>
              </div>
            )}
          </div>

          {/* Right Bookmark button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              toggleBookmark(room.id);
              synthSound('bet');
            }}
            className="p-1 hover:bg-trench-black border border-trench-sandbag/40 text-trench-gasmask hover:text-white rounded transition-colors"
            title={watchlistedIds.includes(room.id) ? "Remove Bookmark" : "Bookmark Room"}
          >
            <Bookmark 
              size={11} 
              className={watchlistedIds.includes(room.id) ? "fill-neon-moon text-neon-moon animate-pulse" : ""} 
            />
          </button>
        </div>
      </div>
    );
  };

  const renderGridSkeleton = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 animate-pulse">
      {[1, 2, 3, 4, 5, 6, 7, 8].map((n) => (
        <div key={n} className="bg-trench-mud border border-trench-sandbag rounded-2xl p-4 h-48" />
      ))}
    </div>
  );

  const renderEmptyGrid = () => (
    <div className="flex flex-col items-center justify-center py-20 text-center text-trench-gasmask border-2 border-dashed border-trench-sandbag/40 rounded-2xl p-8 font-mono text-xs uppercase font-bold w-full bg-trench-mud/30">
      <p className="text-slate-400 text-sm">No Active Markets Found</p>
      <p className="mt-2 text-[10px] text-trench-gasmask">Try adjusting your filters or search query.</p>
    </div>
  );

  const filteredRooms = getFilteredAndSortedRooms();

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
                                    {r.token.icon && (r.token.icon.startsWith('http') || r.token.icon.startsWith('data:') || r.token.icon.startsWith('blob:')) ? (
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
          </div>
          {/* Rocket Deploy Button */}
          <Link href="/create-room" className="w-full md:w-auto">
            <button className="w-full py-2 px-4 font-staatliches text-lg tracking-wider text-black bg-neon-moon hover:bg-green-500 rounded border-b-4 border-green-800 shadow-glow-moon active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase font-bold h-11 text-center">
              <Rocket size={18} className="animate-bounce text-black" />
              <span>DEPLOY ROOM</span>
            </button>
          </Link>
        </div>
      </div>

      {/* Category Selector Bar */}
      <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-6 scrollbar-none border-b border-trench-sandbag/40 shrink-0">
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

      {/* Unified Search & Filters Toolbar */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-trench-mud border border-trench-sandbag rounded-2xl p-3.5 mb-6">
        <div className="flex items-center gap-2">
          <span className="font-staatliches text-xl text-white tracking-wider font-bold uppercase">
            All Markets
          </span>
          <span className="font-mono text-xs text-trench-gasmask bg-trench-black border border-trench-sandbag/80 px-2 py-0.5 rounded-full font-bold">
            {filteredRooms.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Search */}
          <div className="relative flex-1 md:flex-initial min-w-[200px] max-w-full">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-trench-gasmask" />
            <input
              type="text"
              placeholder="Search markets..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 bg-trench-black/80 border border-trench-sandbag/60 text-white font-mono text-xs placeholder-trench-gasmask/50 rounded-lg focus:border-neon-moon focus:outline-none uppercase font-bold tracking-wider"
            />
          </div>

          {/* Sort */}
          <div className="flex items-center bg-trench-black/80 border border-trench-sandbag/60 rounded-lg p-0.5 h-9 shrink-0">
            {(['newest', 'expiry', 'pot'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  setSortBy(opt);
                  synthSound('bet');
                }}
                className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-all ${
                  sortBy === opt
                    ? 'bg-trench-sandbag text-neon-moon border border-neon-moon/40'
                    : 'text-trench-gasmask hover:text-slate-200'
                }`}
              >
                {opt === 'newest' ? 'NEW' : opt === 'expiry' ? 'TIME' : 'POT'}
              </button>
            ))}
          </div>

          {/* Status filter */}
          <div className="flex items-center bg-trench-black/80 border border-trench-sandbag/60 rounded-lg p-0.5 h-9 shrink-0">
            {(['live', 'expired'] as const).map((opt) => (
              <button
                key={opt}
                onClick={() => {
                  setStatusFilter(opt);
                  synthSound('bet');
                }}
                className={`px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-all ${
                  statusFilter === opt
                    ? 'bg-trench-sandbag text-neon-moon border border-neon-moon/40'
                    : 'text-trench-gasmask hover:text-slate-200'
                }`}
              >
                {opt === 'live' ? '🟢 LIVE' : '💀 EXPIRED'}
              </button>
            ))}
          </div>

          {/* Quick Bet Stake Input */}
          <div className="flex items-center gap-1.5 bg-trench-black/80 border border-trench-sandbag/60 rounded-lg px-2 py-1 h-9 font-mono text-xs text-white shrink-0" title="Quick Bet Stake Amount">
            <span className="text-neon-moon font-bold animate-pulse select-none">⚡</span>
            <input
              type="number"
              step="1"
              min="1"
              value={quickAmount}
              onChange={(e) => {
                const val = parseFloat(e.target.value);
                setQuickAmount(isNaN(val) ? 0 : val);
              }}
              className="w-10 bg-transparent text-white font-bold focus:outline-none text-center"
            />
            <span className="font-staatliches text-xs text-neon-moon font-bold tracking-wider select-none">
              {process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche' ? 'USDC' : 'SOL'}
            </span>
          </div>
        </div>
      </div>

      {/* Markets Grid */}
      <div className="flex-1 min-h-0 w-full mb-6">
        {showSkeleton ? (
          renderGridSkeleton()
        ) : filteredRooms.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {filteredRooms.map((room) => renderRoomCard(room, quickAmount))}
          </div>
        ) : (
          renderEmptyGrid()
        )}
      </div>

      {/* Wallet Connection Helper Prompter */}
      {!user && (
        <div className="bg-trench-mud/50 border-2 border-trench-sandbag rounded-lg p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md mb-6">
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
