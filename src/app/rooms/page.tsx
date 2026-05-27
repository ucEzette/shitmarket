'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAppState, Room } from '@/store/useAppState';
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
  const [filter, setFilter] = useState<'ending' | 'biggest' | 'active-bets' | 'expired'>('ending');
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

  // Filtering Logic
  const getFilteredRooms = () => {
    let list = [...rooms];
    const now = Date.now();

    // Separate active and expired rooms
    if (filter !== 'expired') {
      list = list.filter((r) => r.status === 'active' && r.expiry > now);
    } else {
      list = list.filter((r) => r.status !== 'active' || r.expiry <= now);
    }

    // Filter by search query
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (r) =>
          r.token.name.toLowerCase().includes(q) ||
          r.token.symbol.toLowerCase().includes(q) ||
          r.token.address.toLowerCase() === q
      );
    }

    // Filter by active bets
    if (filter === 'active-bets') {
      if (!user) return [];
      const userRoomIds = user.bets.map((b) => b.roomId);
      list = list.filter((r) => userRoomIds.includes(r.id));
    }

    // Sorting
    if (filter === 'ending') {
      // nearest expiry first
      list.sort((a, b) => a.expiry - b.expiry);
    } else if (filter === 'biggest') {
      // total pot descending
      list.sort((a, b) => {
        const potA = a.moonPool + a.jeetPool;
        const potB = b.moonPool + b.jeetPool;
        return potB - potA;
      });
    } else if (filter === 'expired') {
      // newest expired/settled first
      list.sort((a, b) => b.expiry - a.expiry);
    }

    return list;
  };

  const activeFiltered = getFilteredRooms();

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

  return (
    <div className="mx-auto max-w-7xl w-full px-4 py-8 flex-1 flex flex-col select-none">
      
      {/* Page Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
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
      <div className="bg-trench-mud p-4 border-2 border-trench-sandbag rounded-md shadow-md mb-8 flex flex-col lg:flex-row justify-between gap-4 items-center">
        
        {/* Tactical filter radio tabs */}
        <div className="flex flex-wrap gap-1 bg-trench-black p-1 border border-trench-sandbag rounded">
          <button
            onClick={() => setFilter('ending')}
            className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
              filter === 'ending'
                ? 'bg-trench-sandbag text-neon-moon font-bold'
                : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
            }`}
          >
            ⏳ Ending Soon
          </button>
          <button
            onClick={() => setFilter('biggest')}
            className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
              filter === 'biggest'
                ? 'bg-trench-sandbag text-moon-gold font-bold'
                : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
            }`}
          >
            💰 Biggest Pots
          </button>
          <button
            onClick={() => setFilter('active-bets')}
            className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
              filter === 'active-bets'
                ? 'bg-trench-sandbag text-jeet-red font-bold'
                : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
            }`}
          >
            🎖️ My Active Bets
          </button>
          <button
            onClick={() => setFilter('expired')}
            className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
              filter === 'expired'
                ? 'bg-trench-sandbag text-moon-gold font-bold'
                : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
            }`}
          >
            💀 Expired Rooms
          </button>
        </div>

        {/* Jeet Alerts Stub Button with Custom Tooltip */}
        <div className="relative group shrink-0">
          <button className="px-4 py-2 bg-trench-black border border-trench-sandbag text-trench-gasmask hover:text-jeet-red hover:border-jeet-red rounded font-staatliches text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 active:translate-y-0.5">
            <span className="w-2 h-2 rounded-full bg-jeet-red shadow-[0_0_6px_#ff535a]" />
            <span>ENABLE JEET ALERTS</span>
          </button>
          
          {/* Tooltip */}
          <div className="absolute bottom-full left-[50%] -translate-x-[50%] mb-2 hidden group-hover:block w-52 bg-trench-black border-2 border-trench-sandbag p-2.5 rounded shadow-2xl z-20 text-center font-mono text-[9px] text-trench-gasmask uppercase tracking-wider font-bold">
            <span className="text-jeet-red font-bold block mb-1">🔴 RADAR DE-ENERGIZED</span>
            Audio alarms sound when developers dump tokens. Operational features coming soon.
            <div className="absolute top-full left-[50%] -translate-x-[50%] border-4 border-transparent border-t-trench-black" />
          </div>
        </div>

        {/* Contract/Name Search Input */}
        <div className="relative w-full lg:max-w-md shrink-0">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-trench-gasmask">
            <Search size={16} />
          </div>
          <input
            type="text"
            placeholder="PASTE CONTRACT ADDRESS OR TOKEN SYMBOL..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 bg-trench-black border-2 border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none tracking-widest uppercase font-bold"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute inset-y-0 right-0 pr-3 flex items-center text-trench-gasmask hover:text-white font-mono text-xs"
            >
              CLEAR
            </button>
          )}
        </div>

      </div>

      {/* Loading Skeleton while syncing with backend */}
      {showSkeleton && activeFiltered.length === 0 ? (
        <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6 animate-pulse">
          {[1, 2, 3, 4, 5, 6].map((n) => (
            <div key={n} className="bg-trench-mud border-2 md:border-4 border-trench-sandbag rounded-lg p-3 md:p-5 flex flex-col justify-between shadow-lg scanlines">
              <div className="flex justify-between items-center mb-2 md:mb-4">
                <div className="h-5 w-24 bg-trench-sandbag/40 rounded" />
                <div className="h-4 w-16 bg-trench-sandbag/40 rounded" />
              </div>
              <div className="flex items-center gap-2 md:gap-3.5 mb-2 md:mb-4 border-b border-trench-sandbag/40 pb-2 md:pb-3">
                <div className="w-[36px] h-[36px] md:w-[48px] md:h-[48px] bg-trench-sandbag/40 rounded" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-5 w-36 bg-trench-sandbag/40 rounded" />
                  <div className="h-3 w-20 bg-trench-sandbag/30 rounded" />
                </div>
              </div>
              <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-5">
                <div className="flex justify-between">
                  <div className="h-3 w-20 bg-trench-sandbag/40 rounded" />
                  <div className="h-3 w-20 bg-trench-sandbag/40 rounded" />
                </div>
                <div className="h-2 md:h-3 bg-trench-sandbag/30 rounded" />
              </div>
              <div className="grid grid-cols-2 gap-1.5 md:gap-2">
                <div className="h-8 md:h-10 bg-trench-sandbag/30 rounded" />
                <div className="h-8 md:h-10 bg-trench-sandbag/30 rounded" />
              </div>
              <div className="mt-3 flex items-center justify-center gap-2">
                <div className="w-3 h-3 rounded-full bg-neon-moon/40 animate-ping" />
                <span className="font-mono text-[9px] text-trench-gasmask/60 uppercase font-bold tracking-wider">
                  SYNCING WITH COMMAND HQ...
                </span>
              </div>
            </div>
          ))}
        </div>
      ) : activeFiltered.length > 0 ? (
        <div className="flex flex-col md:grid md:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-6">
          {activeFiltered.map((room) => {
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
                className={`bg-trench-mud border-2 md:border-4 border-trench-sandbag rounded-lg md:rounded-lg p-3 md:p-5 cursor-pointer flex flex-col justify-between shadow-lg relative group transition-all duration-200 hover:-translate-y-1 select-none scanlines ${hoverGlow}`}
              >
                {/* Timer Bomb Clock Header */}
                <div className="flex justify-between items-center mb-2 md:mb-4">
                  <div className="flex items-center gap-1 bg-trench-black border border-trench-sandbag/80 rounded px-2 md:px-2.5 py-0.5 md:py-1">
                    <Bomb size={10} className={isSettled ? 'text-moon-gold' : 'text-jeet-red'} />
                    <span className={`font-mono text-[10px] md:text-xs font-bold ${isSettled ? 'text-moon-gold' : 'text-white'}`}>
                      {formatDuration(room.duration)} ROUND
                    </span>
                  </div>
                  <div className={`text-[9px] md:text-[10px] font-mono font-bold bg-trench-black px-1.5 md:px-2 py-0.5 rounded border border-trench-sandbag/30 uppercase ${isSettled ? 'text-moon-gold' : 'text-neon-moon animate-pulse'}`}>
                    {timeText}
                  </div>
                </div>

                {/* Token Details with Helmet overlay — more compact row on mobile */}
                <div className="flex items-center gap-2 md:gap-3.5 mb-2 md:mb-4 border-b border-trench-sandbag/40 pb-2 md:pb-3">
                  <div className="relative bg-trench-black p-0.5 border border-trench-sandbag rounded group-hover:scale-105 transition-transform duration-200 overflow-hidden shrink-0 w-[36px] h-[36px] md:w-[48px] md:h-[48px] flex items-center justify-center">
                    {room.token.icon && room.token.icon.startsWith('http') ? (
                      <img src={room.token.icon} alt={room.token.name} className="w-full h-full object-cover rounded" />
                    ) : (
                      <PepePortrait
                        src={isMoonLeading ? MOON_PEPES[parseInt(room.id) % MOON_PEPES.length] : JEET_PEPES[parseInt(room.id) % JEET_PEPES.length]}
                        size={32}
                        glowColor={isMoonLeading ? 'moon' : 'jeet'}
                        className="rounded"
                      />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <h4 className="font-staatliches text-lg md:text-2xl text-white tracking-wide group-hover:text-neon-moon transition-colors -mb-1 truncate max-w-[160px] md:max-w-none">
                        {room.token.name}
                      </h4>
                      <span className="font-mono text-[10px] md:text-xs text-neon-moon font-bold flex items-center gap-1 shrink-0">
                        ${room.token.symbol}
                        {room.token.chainId && (
                          <span className="text-[8px] md:text-[9px] bg-trench-black text-gray-400 px-1 md:px-1.5 py-0.5 rounded border border-trench-sandbag uppercase">
                            {room.token.chainId}
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex items-center gap-1 mt-1">
                      <span 
                        onClick={(e) => {
                          e.stopPropagation();
                          navigator.clipboard.writeText(room.token.address);
                          alert("CONTRACT ADDRESS COPIED TO CLIPBOARD!");
                        }}
                        className="font-mono text-[8px] md:text-[9px] text-neon-moon hover:text-white transition-colors bg-trench-black/60 px-1.5 py-0.5 rounded border border-trench-sandbag/30 cursor-pointer select-all truncate block w-full max-w-[180px] md:max-w-[240px]"
                        title="Click to copy full contract address"
                      >
                        📋 {room.token.address}
                      </span>
                    </div>
                    <span className="font-mono text-[7px] md:text-[8px] text-trench-gasmask block mt-1 uppercase font-bold">
                      ⚔️ LISTED: {new Date(room.createdAt).toISOString().replace('T', ' ').substring(0, 19)} UTC
                    </span>
                  </div>
                </div>

                {/* Pools Breakdown progress bar — stacked on mobile too */}
                <div className="space-y-1.5 md:space-y-2 mb-3 md:mb-5">
                  <div className="flex justify-between text-[10px] md:text-xs font-mono font-bold leading-none">
                    <span className="text-neon-moon flex items-center gap-1">
                      🟢 <span className="hidden sm:inline">MOON:</span> {room.moonPool.toFixed(2)} SOL
                    </span>
                    <span className="text-jeet-red flex items-center gap-1">
                      🔴 <span className="hidden sm:inline">JEET:</span> {room.jeetPool.toFixed(2)} SOL
                    </span>
                  </div>

                  {/* Dual Bar */}
                  <div className="w-full h-2 md:h-3 bg-trench-black border border-trench-sandbag/80 rounded overflow-hidden flex">
                    <div
                      style={{ width: `${moonPercentage}%` }}
                      className="bg-neon-moon h-full transition-all duration-500 shadow-[inset_0_0_5px_rgba(0,0,0,0.6)]"
                    />
                    <div
                      style={{ width: `${jeetPercentage}%` }}
                      className="bg-jeet-red h-full transition-all duration-500 shadow-[inset_0_0_5px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                  
                  <div className="flex justify-between font-mono text-[8px] md:text-[9px] text-trench-gasmask font-bold uppercase mt-0.5 md:mt-1">
                    <span>MOON ({moonPercentage.toFixed(0)}%)</span>
                    <span>JEET ({jeetPercentage.toFixed(0)}%)</span>
                  </div>
                </div>

                {/* Quick Bet Buttons */}
                {!isSettled ? (
                  <div className="grid grid-cols-2 gap-1.5 md:gap-2 mt-1 md:mt-2">
                    <button
                      onClick={(e) => handleQuickBet(e, room.id, 'moon', 0.01)}
                      className="btn-wood-green py-1 md:py-1.5 px-1 md:px-2.5 rounded font-staatliches text-[10px] md:text-sm tracking-wider uppercase text-center active:translate-y-0.5 md:active:translate-y-1 transition-transform"
                    >
                      MOON 0.01
                    </button>
                    <button
                      onClick={(e) => handleQuickBet(e, room.id, 'jeet', 0.05)}
                      className="btn-wood-red py-1 md:py-1.5 px-1 md:px-2.5 rounded font-staatliches text-[10px] md:text-sm tracking-wider uppercase text-center active:translate-y-0.5 md:active:translate-y-1 transition-transform"
                    >
                      JEET 0.05
                    </button>
                  </div>
                ) : (
                  <div className="w-full py-1.5 md:py-2 bg-trench-black border border-dashed md:border-2 border-moon-gold/40 text-center rounded">
                    <span className="font-staatliches text-sm md:text-base text-moon-gold uppercase tracking-widest glow-gold font-bold">
                      WINNER: {room.winner?.toUpperCase() || 'MOON'}
                    </span>
                    <span className="block font-mono text-[8px] md:text-[9px] text-trench-gasmask font-bold mt-0.5">
                      BATTLE DECREED • CLICK FOR BOOTY
                    </span>
                  </div>
                )}

                {/* Room Detail Entry Overlay Chevron */}
                <div className="absolute bottom-2 right-2 md:bottom-2.5 md:right-2.5 opacity-0 group-hover:opacity-100 transition-all duration-200 group-hover:translate-x-1 pointer-events-none text-white">
                  <ArrowRight size={10} />
                </div>
              </div>
            );
          })}
        </div>

      ) : (
        /* Empty State */
        <div className="flex flex-col items-center justify-center py-20 bg-trench-mud border-4 border-dashed border-trench-sandbag rounded-lg shadow-inner text-center p-6 scanlines">
          <div className="relative mb-6">
            <div className="absolute inset-0 bg-jeet-red/10 rounded-full blur-xl animate-pulse" />
            <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={120} glowColor="gold" animated className="rounded-xl relative z-10" />
          </div>
          <h3 className="font-staatliches text-3xl text-white uppercase tracking-wider mb-2">
            No trenches dug yet!
          </h3>
          <p className="font-mono text-sm text-trench-gasmask uppercase max-w-sm font-bold leading-relaxed mb-6">
            The battlefield lies silent. Paste a token contract and launch a fresh prediction room now to seed the first war pot.
          </p>

          <Link href="/create-room">
            <button className="py-3 px-8 font-staatliches text-2xl uppercase tracking-wider text-black bg-neon-moon hover:bg-green-500 rounded border-b-4 border-green-800 shadow-glow-moon active:translate-y-1 transition-all flex items-center gap-2">
              <PixelShovel size={24} />
              DIG THE FIRST TRENCH
            </button>
          </Link>
        </div>
      )}

      {/* Wallet Connection Helper Prompter */}
      {!user && (
        <div className="mt-12 bg-trench-mud/50 border-2 border-trench-sandbag rounded-lg p-5 flex flex-col md:flex-row justify-between items-center gap-4 shadow-md">
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
      <div className="mt-8">
        <DegenQuoteBanner />
      </div>

    </div>
  );
}
