'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppState, Room, formatCashtag, formatPrice } from '@/store/useAppState';
import { PixelCrackedHelmet, PixelShovel, PixelGasMask } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { Search, Flame, Bomb, ArrowRight, UserPlus } from 'lucide-react';

const SolanaIcon = ({ active }: { active: boolean }) => (
  <svg className={`w-7 h-7 transition-all ${active ? 'opacity-100 filter drop-shadow-[0_0_8px_#14f195]' : 'opacity-40 hover:opacity-75'}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M4 4.5h16l-3.5 4h-16l3.5-4zM20 10.5H4l3.5 4h16l-3.5-4zM4 16.5h16l-3.5 4h-16l3.5-4z" fill="url(#solana-grad-page)" />
    <defs>
      <linearGradient id="solana-grad-page" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#9945FF" />
        <stop offset="100%" stopColor="#14F195" />
      </linearGradient>
    </defs>
  </svg>
);

const BaseIcon = ({ active }: { active: boolean }) => (
  <svg className={`w-7 h-7 transition-all ${active ? 'opacity-100 text-[#0052FF] filter drop-shadow-[0_0_8px_#0052FF]' : 'text-white opacity-40 hover:opacity-75'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" xmlns="http://www.w3.org/2000/svg">
    <path d="M12 2.5L3.5 7.5v9l8.5 5 8.5-5v-9L12 2.5z" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M12 22.5V12.5M12 12.5L3.5 7.5M12 12.5l8.5-5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

const AllNetworksIcon = ({ active }: { active: boolean }) => (
  <svg className={`w-7 h-7 transition-all ${active ? 'opacity-100 filter drop-shadow-[0_0_8px_rgba(255,255,255,0.6)]' : 'opacity-40 hover:opacity-75'}`} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="12" cy="12" r="9" fill={active ? "#E2E8F0" : "#4A5568"} stroke={active ? "#FFFFFF" : "#718096"} strokeWidth="1.5" />
    <rect x="5" y="11" width="14" height="2" rx="1" fill="#1A202C" />
  </svg>
);

const EthereumIcon = ({ active }: { active: boolean }) => (
  <div className="relative flex items-center justify-center">
    <svg className={`w-7 h-7 transition-all ${active ? 'opacity-100 text-[#627EEA] filter drop-shadow-[0_0_8px_#627EEA]' : 'text-white opacity-40 hover:opacity-75'}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" xmlns="http://www.w3.org/2000/svg">
      <path d="M12 2L5 12l7 4 7-4-7-10z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 22l-7-6 7 2 7-2-7 6z" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M12 2v14M5 12h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
    <span className="absolute -bottom-1 -right-2 bg-trench-black text-[7px] font-mono px-0.5 rounded border border-trench-sandbag/60 text-trench-gasmask scale-75 uppercase select-none font-bold">
      beta
    </span>
  </div>
);

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
  const formatDuration = (mins: number) => {
    if (mins >= 43200) return `${Math.floor(mins/43200)} MONTH`;
    if (mins >= 10080) return `${Math.floor(mins/10080)} WEEK`;
    if (mins >= 1440) return `${Math.floor(mins/1440)} DAY`;
    if (mins >= 60) return `${Math.floor(mins/60)} HR`;
    return `${mins} MIN`;
  };

  const router = useRouter();
  const { rooms, roomsLoaded, fetchRooms, user, placeBet, connectWallet } = useAppState();
  const [filter, setFilter] = useState<'ending' | 'biggest' | 'active-bets' | 'expired' | 'pending-orders'>('ending');
  const [selectedNetwork, setSelectedNetwork] = useState<'all' | 'solana' | 'base' | 'ethereum'>('all');
  const [searchNew, setSearchNew] = useState('');
  const [searchSoon, setSearchSoon] = useState('');
  const [searchBiggest, setSearchBiggest] = useState('');
  const [sortNew, setSortNew] = useState<'newest' | 'pot'>('newest');
  const [sortSoon, setSortSoon] = useState<'expiry' | 'pot'>('expiry');
  const [sortBiggest, setSortBiggest] = useState<'pot' | 'newest'>('pot');
  const [timeRemainingText, setTimeRemainingText] = useState<{ [id: string]: string }>({});
  const [showSkeleton, setShowSkeleton] = useState(true);

  const [quickAmountNew, setQuickAmountNew] = useState<number>(0.8);
  const [quickAmountSoon, setQuickAmountSoon] = useState<number>(0.1);
  const [quickAmountBiggest, setQuickAmountBiggest] = useState<number>(0.1);
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
    // Base active or expired rooms
    let list = rooms.filter((r) => {
      if (filter === 'expired') {
        return r.status === 'settled' || r.expiry <= now;
      } else {
        return r.status === 'active' && r.expiry > now;
      }
    });

    // Apply network category filter
    if (selectedNetwork !== 'all') {
      list = list.filter((r) => r.token.chainId === selectedNetwork);
    }

    // 1. New (Newest listed first / or sorted by pot)
    let newRoomsList = [...list];
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
    let endingSoonRoomsList = [...list];
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
    let biggestPotRoomsList = [...list];
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
      allMatchingCount: list.length
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

    // Glow styling depends on which side is leading
    const hoverGlow = isSettled
      ? 'hover:shadow-glow-gold hover:border-moon-gold/80'
      : isMoonLeading
      ? 'hover:shadow-glow-moon hover:border-neon-moon/80'
      : 'hover:shadow-glow-jeet hover:border-jeet-red/80';

    return (
      <div
        key={room.id}
        onClick={() => router.push(`/room/${room.id}`)}
        className={`retro-panel p-3 cursor-pointer flex flex-col justify-between relative group transition-all duration-200 hover:-translate-y-0.5 select-none scanlines rounded-lg border-2 ${hoverGlow}`}
      >
        {/* Timer Bomb Clock Header */}
        <div className="flex justify-between items-center mb-2">
          <div className="flex items-center gap-1 bg-trench-black border border-trench-sandbag/80 rounded px-1.5 py-0.5">
            <Bomb size={9} className={isSettled ? 'text-moon-gold' : 'text-jeet-red'} />
            <span className={`font-mono text-[9px] font-bold ${isSettled ? 'text-moon-gold' : 'text-white'}`}>
              {formatDuration(room.duration)}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {/* Small Chain Icon to indicate network */}
            <div className="bg-trench-black p-0.5 rounded border border-trench-sandbag/30 flex items-center justify-center scale-[0.65] origin-right h-5 w-5">
              {room.token.chainId === 'solana' && <SolanaIcon active={true} />}
              {room.token.chainId === 'base' && <BaseIcon active={true} />}
              {room.token.chainId === 'ethereum' && <EthereumIcon active={true} />}
            </div>
            <div className={`text-[9px] font-mono font-bold bg-trench-black px-1.5 py-0.5 rounded border border-trench-sandbag/30 uppercase ${isSettled ? 'text-moon-gold' : 'text-neon-moon animate-pulse'}`}>
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
                alert("CONTRACT COPIED!");
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
            WILL {room.token.symbol.startsWith('$') ? room.token.symbol.toUpperCase() : `$${room.token.symbol.toUpperCase()}`} END ABOVE ${formatPrice(room.openingPrice)} ON {formatExpiryUTC(room.expiry)}?
          </p>
        </div>

        {/* Pools Breakdown progress bar */}
        <div className="space-y-1 mb-2 font-mono text-[8px] font-bold">
          <div className="flex justify-between text-[9px]">
            <span className="text-neon-moon uppercase">MOON POT: {room.moonPool.toFixed(2)} SOL</span>
            <span className="text-jeet-red uppercase">JEET POT: {room.jeetPool.toFixed(2)} SOL</span>
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

        {/* Quick Bet Buttons */}
        {!isSettled ? (
          <div className="grid grid-cols-2 gap-1.5 mt-auto">
            <button
              onClick={(e) => handleQuickBet(e, room.id, 'moon', quickAmount)}
              className="retro-btn retro-btn-moon py-1.5 px-1 rounded font-staatliches text-xs tracking-wider uppercase text-center active:translate-y-0.5 transition-transform"
            >
              MOON {quickAmount}
            </button>
            <button
              onClick={(e) => handleQuickBet(e, room.id, 'jeet', quickAmount)}
              className="retro-btn retro-btn-jeet py-1.5 px-1 rounded font-staatliches text-xs tracking-wider uppercase text-center active:translate-y-0.5 transition-transform"
            >
              JEET {quickAmount}
            </button>
          </div>
        ) : (
          <div className="w-full py-1 bg-trench-black border border-dashed border-moon-gold/40 text-center rounded mt-auto">
            <span className="font-staatliches text-xs text-moon-gold uppercase tracking-widest glow-gold font-bold">
              WINNER: {room.winner?.toUpperCase() || 'MOON'}
            </span>
          </div>
        )}
      </div>
    );
  };

  const renderColumnSkeleton = () => (
    <div className="space-y-3 animate-pulse">
      {[1, 2, 3].map((n) => (
        <div key={n} className="retro-panel p-3.5 rounded-lg border-2 border-trench-sandbag/40 h-28 bg-trench-black/20" />
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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div className="flex items-center gap-6">
          <h2 className="font-staatliches text-4xl text-white tracking-wider font-bold">
            Trenches
          </h2>
          {/* Network Selection Icons */}
          <div className="flex items-center gap-3">
            {(['solana', 'base', 'all', 'ethereum'] as const).map((net) => (
              <button
                key={net}
                onClick={() => {
                  setSelectedNetwork(net);
                  synthSound('bet');
                }}
                className="focus:outline-none transition-transform active:scale-95"
                title={`Network: ${net.toUpperCase()}`}
              >
                {net === 'solana' && <SolanaIcon active={selectedNetwork === 'solana'} />}
                {net === 'base' && <BaseIcon active={selectedNetwork === 'base'} />}
                {net === 'all' && <AllNetworksIcon active={selectedNetwork === 'all'} />}
                {net === 'ethereum' && <EthereumIcon active={selectedNetwork === 'ethereum'} />}
              </button>
            ))}
          </div>
        </div>

        {/* Shovel Dig CTA */}
        <Link href="/create-room" className="w-full md:w-auto">
          <button className="w-full py-2 px-4 font-staatliches text-lg tracking-wider text-black bg-neon-moon hover:bg-green-500 rounded border-b-4 border-green-800 shadow-glow-moon active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase font-bold">
            <PixelShovel size={16} />
            <span>DIG NEW TRENCH</span>
          </button>
        </Link>
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

              {/* Quick Bet Pill: ⚡ Amount SOL */}
              <div className="flex items-center gap-0.5 bg-trench-black/80 border border-trench-sandbag/40 rounded-full px-1.5 py-0.5 text-white font-mono text-[9px] h-6 shrink-0">
                <span className="text-neon-moon font-bold select-none">⚡</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={quickAmountNew}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setQuickAmountNew(isNaN(val) ? 0 : val);
                  }}
                  className="w-12 bg-transparent text-white font-bold focus:outline-none text-center"
                />
                <span className="text-[9px] text-[#14F195] font-bold select-none">≡</span>
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
                          DATE
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
                            setFilter('ending');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filter !== 'expired'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          🟢 LIVE ARENAS
                        </button>
                        <button
                          onClick={() => {
                            setFilter('expired');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filter === 'expired'
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
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : newRooms.length > 0 ? (
              newRooms.map((room) => renderRoomCard(room, quickAmountNew))
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

              {/* Quick Bet Pill: ⚡ Amount SOL */}
              <div className="flex items-center gap-0.5 bg-trench-black/80 border border-trench-sandbag/40 rounded-full px-1.5 py-0.5 text-white font-mono text-[9px] h-6 shrink-0">
                <span className="text-neon-moon font-bold select-none">⚡</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={quickAmountSoon}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setQuickAmountSoon(isNaN(val) ? 0 : val);
                  }}
                  className="w-12 bg-transparent text-white font-bold focus:outline-none text-center"
                />
                <span className="text-[9px] text-[#14F195] font-bold select-none">≡</span>
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
                            setFilter('ending');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filter !== 'expired'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          🟢 LIVE ARENAS
                        </button>
                        <button
                          onClick={() => {
                            setFilter('expired');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filter === 'expired'
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
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : endingSoonRooms.length > 0 ? (
              endingSoonRooms.map((room) => renderRoomCard(room, quickAmountSoon))
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

              {/* Quick Bet Pill: ⚡ Amount SOL */}
              <div className="flex items-center gap-0.5 bg-trench-black/80 border border-trench-sandbag/40 rounded-full px-1.5 py-0.5 text-white font-mono text-[9px] h-6 shrink-0">
                <span className="text-neon-moon font-bold select-none">⚡</span>
                <input
                  type="number"
                  step="0.1"
                  min="0"
                  value={quickAmountBiggest}
                  onChange={(e) => {
                    const val = parseFloat(e.target.value);
                    setQuickAmountBiggest(isNaN(val) ? 0 : val);
                  }}
                  className="w-12 bg-transparent text-white font-bold focus:outline-none text-center"
                />
                <span className="text-[9px] text-[#14F195] font-bold select-none">≡</span>
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
                            setFilter('ending');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filter !== 'expired'
                              ? 'bg-trench-sandbag text-neon-moon border-neon-moon font-bold shadow-glow-moon'
                              : 'bg-trench-black/40 border-trench-sandbag/40 text-trench-gasmask hover:text-white'
                          }`}
                        >
                          🟢 LIVE ARENAS
                        </button>
                        <button
                          onClick={() => {
                            setFilter('expired');
                            synthSound('bet');
                          }}
                          className={`px-2 py-0.5 rounded text-left border transition-all text-[8px] ${
                            filter === 'expired'
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
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : biggestPotRooms.length > 0 ? (
              biggestPotRooms.map((room) => renderRoomCard(room, quickAmountBiggest))
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
                Connect your Solana wallet to stack ammo on Moon or Jeet across live prediction rooms.
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
