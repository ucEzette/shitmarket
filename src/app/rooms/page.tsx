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
  const { rooms, user, placeBet, connectWallet } = useAppState();
  const [filter, setFilter] = useState<'ending' | 'biggest' | 'active-bets'>('ending');
  const [search, setSearch] = useState('');
  const [timeRemainingText, setTimeRemainingText] = useState<{ [id: string]: string }>({});

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
      // nearest expiry first, active rooms first
      list.sort((a, b) => {
        if (a.status !== b.status) {
          return a.status === 'active' ? -1 : 1;
        }
        return a.expiry - b.expiry;
      });
    } else if (filter === 'biggest') {
      // total pot descending
      list.sort((a, b) => {
        const potA = a.moonPool + a.jeetPool;
        const potB = b.moonPool + b.jeetPool;
        return potB - potA;
      });
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
        </div>

        {/* Jeet Alerts Stub Button with Custom Tooltip */}
        <div className="relative group shrink-0">
          <button className="px-4 py-2 bg-trench-black border border-trench-sandbag text-trench-gasmask hover:text-jeet-red hover:border-jeet-red rounded font-staatliches text-xs tracking-wider uppercase transition-all flex items-center gap-1.5 active:translate-y-0.5">
            <span className="w-2 h-2 rounded-full bg-jeet-red animate-pulse" />
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

      {/* Grid of rooms */}
      {activeFiltered.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
                className={`bg-trench-mud border-4 border-trench-sandbag rounded-lg p-5 cursor-pointer flex flex-col justify-between shadow-lg relative group transition-all duration-200 hover:-translate-y-1 select-none scanlines ${hoverGlow}`}
              >
                {/* Timer Bomb Clock Header */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center gap-1 bg-trench-black border border-trench-sandbag/80 rounded px-2.5 py-1">
                    <Bomb size={12} className={isSettled ? 'text-moon-gold' : 'text-jeet-red animate-pulse'} />
                    <span className={`font-mono text-xs font-bold ${isSettled ? 'text-moon-gold' : 'text-white'}`}>
                      {timeText}
                    </span>
                  </div>
                  <div className="text-[10px] font-mono text-trench-gasmask font-bold bg-trench-black px-2 py-0.5 rounded border border-trench-sandbag/30 uppercase">
                    {formatDuration(room.duration)} ROUND
                  </div>
                </div>

                {/* Token Details with Helmet overlay */}
                <div className="flex items-center gap-3.5 mb-4 border-b border-trench-sandbag/40 pb-3">
                  <div className="relative bg-trench-black p-0.5 border border-trench-sandbag rounded group-hover:scale-105 transition-transform duration-200 overflow-hidden shrink-0 w-[48px] h-[48px] flex items-center justify-center">
                    {room.token.icon && room.token.icon.startsWith('http') ? (
                      <img src={room.token.icon} alt={room.token.name} className="w-full h-full object-cover rounded" />
                    ) : (
                      <PepePortrait
                        src={isMoonLeading ? MOON_PEPES[parseInt(room.id) % MOON_PEPES.length] : JEET_PEPES[parseInt(room.id) % JEET_PEPES.length]}
                        size={44}
                        glowColor={isMoonLeading ? 'moon' : 'jeet'}
                        className="rounded"
                      />
                    )}
                  </div>
                  <div>
                    <h4 className="font-staatliches text-2xl text-white tracking-wide group-hover:text-neon-moon transition-colors -mb-1">
                      {room.token.name}
                    </h4>
                    <span className="font-mono text-xs text-neon-moon font-bold flex items-center gap-2">
                      ${room.token.symbol}
                      {room.token.chainId && (
                        <span className="text-[9px] bg-trench-black text-gray-400 px-1.5 py-0.5 rounded border border-trench-sandbag uppercase">
                          {room.token.chainId}
                        </span>
                      )}
                    </span>
                    <span className="font-mono text-[9px] text-trench-gasmask/60 block font-bold mt-0.5">
                      {room.token.address.substring(0, 8)}...{room.token.address.substring(room.token.address.length - 8)}
                    </span>
                  </div>
                </div>

                {/* Pools Breakdown progress bar */}
                <div className="space-y-2 mb-5">
                  <div className="flex justify-between text-xs font-mono font-bold leading-none">
                    <span className="text-neon-moon flex items-center gap-1">
                      🟢 MOON: {room.moonPool.toFixed(2)} SOL
                    </span>
                    <span className="text-jeet-red flex items-center gap-1">
                      🔴 JEET: {room.jeetPool.toFixed(2)} SOL
                    </span>
                  </div>

                  {/* Dual Bar */}
                  <div className="w-full h-3 bg-trench-black border border-trench-sandbag/80 rounded overflow-hidden flex">
                    <div
                      style={{ width: `${moonPercentage}%` }}
                      className="bg-neon-moon h-full transition-all duration-500 shadow-[inset_0_0_5px_rgba(0,0,0,0.6)]"
                    />
                    <div
                      style={{ width: `${jeetPercentage}%` }}
                      className="bg-jeet-red h-full transition-all duration-500 shadow-[inset_0_0_5px_rgba(0,0,0,0.6)]"
                    />
                  </div>
                  
                  <div className="flex justify-between font-mono text-[9px] text-trench-gasmask font-bold uppercase mt-1">
                    <span>MOON ARMY ({moonPercentage.toFixed(0)}%)</span>
                    <span>JEET SQUAD ({jeetPercentage.toFixed(0)}%)</span>
                  </div>
                </div>

                {/* Quick Bet Buttons */}
                {!isSettled ? (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <button
                      onClick={(e) => handleQuickBet(e, room.id, 'moon', 0.01)}
                      className="btn-wood-green py-1.5 px-1 sm:py-2 sm:px-2.5 rounded font-staatliches text-xs sm:text-sm tracking-wider uppercase text-center active:translate-y-1 transition-transform"
                    >
                      BET MOON 0.01
                    </button>
                    <button
                      onClick={(e) => handleQuickBet(e, room.id, 'jeet', 0.05)}
                      className="btn-wood-red py-1.5 px-1 sm:py-2 sm:px-2.5 rounded font-staatliches text-xs sm:text-sm tracking-wider uppercase text-center active:translate-y-1 transition-transform"
                    >
                      BET JEET 0.05
                    </button>
                  </div>
                ) : (
                  <div className="w-full py-2 bg-trench-black border-2 border-dashed border-moon-gold/40 text-center rounded">
                    <span className="font-staatliches text-base text-moon-gold uppercase tracking-widest glow-gold font-bold">
                      WINNER: {room.winner?.toUpperCase() || 'MOON'}
                    </span>
                    <span className="block font-mono text-[9px] text-trench-gasmask font-bold mt-0.5">
                      BATTLE DECREED • CLICK FOR BOOTY
                    </span>
                  </div>
                )}

                {/* Room Detail Entry Overlay Chevron */}
                <div className="absolute bottom-2.5 right-2.5 opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none text-white">
                  <ArrowRight size={14} className="animate-ping" />
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
                Connecting generates a mock sandbox degen profile with 4.2 SOL for full-feature betting rooms.
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
