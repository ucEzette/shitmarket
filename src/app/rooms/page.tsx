'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppState, Room, formatCashtag, formatPrice } from '@/store/useAppState';
import { PixelCrackedHelmet, PixelShovel, PixelGasMask } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { Search, Flame, Bomb, ArrowRight, UserPlus } from 'lucide-react';

export default function RoomsPage() {
  const formatDuration = (mins: number) => {
    if (mins >= 43200) return `${Math.floor(mins/43200)} MONTH`;
    if (mins >= 10080) return `${Math.floor(mins/10080)} WEEK`;
    if (mins >= 1440) return `${Math.floor(mins/1440)} DAY`;
    if (mins >= 60) return `${Math.floor(mins/60)} HR`;
    return `${mins} MIN`;
  };

  const router = useRouter();
  const { rooms, roomsLoaded, user, placeBet, connectWallet } = useAppState();
  const [filter, setFilter] = useState<'ending' | 'biggest' | 'active-bets' | 'expired' | 'pending-orders'>('ending');
  const [search, setSearch] = useState('');
  const [timeRemainingText, setTimeRemainingText] = useState<{ [id: string]: string }>({});
  const [showSkeleton, setShowSkeleton] = useState(true);

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

    // Apply global search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.token.name.toLowerCase().includes(q) ||
          r.token.symbol.toLowerCase().includes(q) ||
          r.token.address.toLowerCase() === q
      );
    }

    // 1. New (Newest listed first)
    const newRoomsList = [...list].sort((a, b) => b.createdAt - a.createdAt);

    // 2. Ending Soon (Closest expiry first)
    const endingSoonRoomsList = [...list].sort((a, b) => a.expiry - b.expiry);

    // 3. Biggest Pot (Highest total pot first)
    const biggestPotRoomsList = [...list].sort((a, b) => {
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

  const renderRoomCard = (room: Room) => {
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
          <div className={`text-[9px] font-mono font-bold bg-trench-black px-1.5 py-0.5 rounded border border-trench-sandbag/30 uppercase ${isSettled ? 'text-moon-gold' : 'text-neon-moon animate-pulse'}`}>
            {timeText}
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
            ENDS ABOVE ${formatPrice(room.openingPrice)}?
          </p>
        </div>

        {/* Pools Breakdown progress bar */}
        <div className="space-y-1 mb-2 font-mono text-[8px] font-bold">
          <div className="flex justify-between">
            <span className="text-neon-moon">🟢 {room.moonPool.toFixed(2)} SOL</span>
            <span className="text-jeet-red">🔴 {room.jeetPool.toFixed(2)} SOL</span>
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
              onClick={(e) => handleQuickBet(e, room.id, 'moon', 0.01)}
              className="retro-btn retro-btn-moon py-1 px-1 rounded font-staatliches text-xs tracking-wider uppercase text-center active:translate-y-0.5 transition-transform"
            >
              MOON 0.01
            </button>
            <button
              onClick={(e) => handleQuickBet(e, room.id, 'jeet', 0.05)}
              className="retro-btn retro-btn-jeet py-1 px-1 rounded font-staatliches text-xs tracking-wider uppercase text-center active:translate-y-0.5 transition-transform"
            >
              JEET 0.05
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
        <div className="flex items-center gap-4">
          <PepePortrait src={PEPE_ASSETS.apeGeneral} size={56} glowColor="moon" animated className="rounded-lg" />
          <div>
            <h2 className="font-staatliches text-4xl text-white tracking-wider flex items-center gap-2 stencil-shadow">
              <Flame className="text-neon-moon animate-pulse" />
              THE WAR TABLE
            </h2>
            <p className="font-mono text-xs text-trench-gasmask uppercase font-bold mt-1">
              Active prediction rooms. Stake ammo on Moon or Jeet before the timer bomb drops.
            </p>
          </div>
        </div>

        {/* Shovel Dig CTA */}
        <Link href="/create-room" className="w-full md:w-auto">
          <button className="w-full py-2.5 px-6 font-staatliches text-xl tracking-wider text-black bg-neon-moon hover:bg-green-500 rounded border-b-4 border-green-800 shadow-glow-moon active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase font-bold">
            <PixelShovel size={20} />
            <span>DIG NEW TRENCH</span>
          </button>
        </Link>
      </div>

      {/* Filter and Search Panel */}
      <div className="retro-panel p-3 rounded-xl mb-6 flex flex-col md:flex-row justify-between gap-4 items-center">
        
        {/* Live / Expired toggle */}
        <div className="flex gap-1 bg-trench-black/80 p-1 border border-trench-sandbag rounded shadow-inner w-full md:w-auto">
          <button
            onClick={() => {
              setFilter('ending');
              synthSound('bet');
            }}
            className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
              filter !== 'expired'
                ? 'bg-trench-sandbag text-neon-moon font-bold shadow-glow-moon'
                : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
            }`}
          >
            🟢 Live Prediction Arenas
          </button>
          <button
            onClick={() => {
              setFilter('expired');
              synthSound('bet');
            }}
            className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
              filter === 'expired'
                ? 'bg-trench-sandbag text-moon-gold font-bold shadow-glow-gold'
                : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
            }`}
          >
            💀 Expired Rooms
          </button>
        </div>

        {/* Contract/Name Search Input */}
        <div className="relative w-full md:max-w-md shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-neon-moon">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="SEARCH CONTRACT OR TOKEN SYMBOL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-12 py-2 bg-trench-black/80 border border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none tracking-widest uppercase font-bold shadow-inner"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-trench-gasmask hover:text-white font-mono text-[10px] font-bold"
            >
              CLEAR
            </button>
          )}
        </div>

      </div>

      {/* 3-Column Dashboard View */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-start min-h-0 w-full mb-6">
        
        {/* Column 1: New */}
        <div className="flex flex-col bg-trench-black/40 border-2 border-trench-sandbag/60 rounded-xl p-4 lg:max-h-[68vh] w-full">
          <div className="flex items-center justify-between border-b-2 border-trench-sandbag/40 pb-2 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-neon-moon shadow-[0_0_6px_#39ff14]" />
              <h3 className="font-staatliches text-xl tracking-wider text-white uppercase">NEW</h3>
            </div>
            <span className="font-mono text-[9px] text-trench-gasmask bg-trench-black px-1.5 py-0.5 rounded border border-trench-sandbag/30 font-bold">
              {newRooms.length} ROOMS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : newRooms.length > 0 ? (
              newRooms.map(renderRoomCard)
            ) : (
              renderEmptyColumn()
            )}
          </div>
        </div>

        {/* Column 2: Ending Soon */}
        <div className="flex flex-col bg-trench-black/40 border-2 border-trench-sandbag/60 rounded-xl p-4 lg:max-h-[68vh] w-full">
          <div className="flex items-center justify-between border-b-2 border-trench-sandbag/40 pb-2 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-jeet-red shadow-[0_0_6px_#ff073a]" />
              <h3 className="font-staatliches text-xl tracking-wider text-white uppercase">ENDING SOON</h3>
            </div>
            <span className="font-mono text-[9px] text-trench-gasmask bg-trench-black px-1.5 py-0.5 rounded border border-trench-sandbag/30 font-bold">
              {endingSoonRooms.length} ROOMS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : endingSoonRooms.length > 0 ? (
              endingSoonRooms.map(renderRoomCard)
            ) : (
              renderEmptyColumn()
            )}
          </div>
        </div>

        {/* Column 3: Biggest Pot */}
        <div className="flex flex-col bg-trench-black/40 border-2 border-trench-sandbag/60 rounded-xl p-4 lg:max-h-[68vh] w-full">
          <div className="flex items-center justify-between border-b-2 border-trench-sandbag/40 pb-2 mb-3 shrink-0">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-moon-gold shadow-[0_0_6px_#ffd700]" />
              <h3 className="font-staatliches text-xl tracking-wider text-white uppercase">BIGGEST POT</h3>
            </div>
            <span className="font-mono text-[9px] text-trench-gasmask bg-trench-black px-1.5 py-0.5 rounded border border-trench-sandbag/30 font-bold">
              {biggestPotRooms.length} ROOMS
            </span>
          </div>
          <div className="flex-1 overflow-y-auto pr-1 space-y-3 scrollbar-thin">
            {showSkeleton ? (
              renderColumnSkeleton()
            ) : biggestPotRooms.length > 0 ? (
              biggestPotRooms.map(renderRoomCard)
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
