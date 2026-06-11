'use client';

import React, { useState, useEffect } from 'react';
import { useAppState, Room, Bet, formatCashtag, formatPrice } from '@/store/useAppState';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { 
  Briefcase, TrendingUp, TrendingDown, ExternalLink, Clock, ArrowUpRight, 
  Activity, Check, Copy, Award, Zap, Coins, Users, Radio, X, Loader2, ArrowRight 
} from 'lucide-react';
import Link from 'next/link';

export default function PortfolioPage() {
  const { user, rooms, roomsLoaded, fetchRooms, refreshProfile, connectWallet } = useAppState();
  const [activeTab, setActiveTab] = useState<'overview' | 'positions' | 'trades' | 'performance' | 'orders'>('positions');
  const [currency, setCurrency] = useState<'SOL' | 'USD'>('USD');
  const [copiedWallet, setCopiedWallet] = useState(false);
  const [livePrices, setLivePrices] = useState<{ [address: string]: number }>({});
  const [timeRemainingText, setTimeRemainingText] = useState<{ [id: string]: string }>({});
  const [isLoadingPrices, setIsLoadingPrices] = useState(false);

  // Conversion rate (mock: 1 SOL = $150.00 USD)
  const SOL_USD_RATE = 150.0;

  // Poll database rooms and profile on mount & periodically
  useEffect(() => {
    fetchRooms().catch(console.error);
    refreshProfile().catch(console.error);

    const interval = setInterval(() => {
      fetchRooms().catch(console.error);
      refreshProfile().catch(console.error);
    }, 5000);

    return () => clearInterval(interval);
  }, [fetchRooms, refreshProfile]);

  // Timer clock ticking for active positions countdowns
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

  // Fetch live token prices from DexScreener for all user bet tokens
  useEffect(() => {
    if (!user || user.bets.length === 0) return;

    const fetchBetPrices = async () => {
      setIsLoadingPrices(true);
      const addressesToFetch = Array.from(
        new Set(
          user.bets
            .map((b) => rooms.find((r) => r.id === b.roomId)?.token.address)
            .filter((addr): addr is string => !!addr)
        )
      );

      if (addressesToFetch.length === 0) {
        setIsLoadingPrices(false);
        return;
      }

      const priceMap: { [address: string]: number } = {};
      
      try {
        // Fetch in chunks or call each sequentially
        await Promise.all(
          addressesToFetch.map(async (address) => {
            try {
              const res = await fetch(`https://api.dexscreener.com/latest/dex/tokens/${address}`);
              if (res.ok) {
                const json = await res.json();
                const pairs = json?.pairs || [];
                if (pairs.length > 0) {
                  // Sort by liquidity to get principal pool
                  const sorted = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
                  const price = parseFloat(sorted[0].priceUsd);
                  if (isFinite(price) && price > 0) {
                    priceMap[address] = price;
                  }
                }
              }
            } catch (e) {
              console.warn(`Failed to fetch live price for token ${address}:`, e);
            }
          })
        );
        setLivePrices((prev) => ({ ...prev, ...priceMap }));
      } catch (err) {
        console.error('Failed to fetch token prices:', err);
      } finally {
        setIsLoadingPrices(false);
      }
    };

    fetchBetPrices();
    const priceInterval = setInterval(fetchBetPrices, 10000); // refresh prices every 10 seconds
    return () => clearInterval(priceInterval);
  }, [user?.bets, rooms]);

  if (!user || !user.wallet) {
    return (
      <div className="mx-auto max-w-5xl w-full px-4 py-12 flex-1 flex flex-col justify-center select-none">
        <div className="bg-trench-mud p-8 border-4 border-dashed border-trench-sandbag rounded-lg shadow-2xl text-center max-w-xl mx-auto py-16 scanlines">
          <div className="relative mb-6 flex justify-center">
            <div className="absolute inset-0 bg-jeet-red/10 rounded-full blur-xl animate-pulse" />
            <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={120} glowColor="jeet" animated className="rounded-xl relative z-10" />
          </div>
          <h2 className="font-staatliches text-4xl text-white tracking-wider uppercase mb-2">
            TRENCH PORTFOLIO LOCK
          </h2>
          <p className="font-mono text-xs text-trench-gasmask uppercase max-w-md mx-auto leading-relaxed mb-8 font-bold">
            Connect your command ammunition wallet to decode tactical portfolio logs, track open prediction wagers, calculate live PNL metrics, and examine trade accuracy.
          </p>
          <button
            onClick={() => {
              connectWallet();
              synthSound('bet');
            }}
            className="w-full max-w-xs mx-auto py-4 font-staatliches text-2xl uppercase tracking-wider text-white bg-jeet-red hover:bg-red-700 rounded border-b-4 border-red-950 shadow-glow-jeet active:translate-y-1 transition-all flex items-center justify-center gap-2 font-bold"
          >
            <PepePortrait src={PEPE_ASSETS.neonWojak} size={28} className="rounded-full animate-bounce" />
            <span>CONNECT COMMAND WALLET</span>
          </button>
        </div>
      </div>
    );
  }

  // --- Calculations for Portfolio Assets ---

  // Helper to format currency
  const formatVal = (solAmount: number) => {
    if (currency === 'USD') {
      return `$${(solAmount * SOL_USD_RATE).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    }
    return `${solAmount.toFixed(3)} SOL`;
  };

  // Process all positions
  const parsedPositions = user.bets.map((bet) => {
    const room = rooms.find((r) => r.id === bet.roomId);
    const token = room?.token;
    const isSettled = room ? room.status === 'settled' : false;
    const livePrice = token ? livePrices[token.address] || room.openingPrice || 0 : 0;
    const openingPrice = room?.openingPrice || 0;

    let isWinning = false;
    let multiplier = 1.0;
    let netPayout = 0;
    let pnl = 0;
    let pnlPercent = 0;

    if (room) {
      const moonPool = room.moonPool || 0.01;
      const jeetPool = room.jeetPool || 0.01;
      const totalPool = moonPool + jeetPool;
      const netTotalPot = totalPool * 0.9875; // 1.25% fee

      if (bet.side === 'moon') {
        isWinning = livePrice > openingPrice;
        multiplier = totalPool > 0 ? netTotalPot / moonPool : 1.0;
      } else {
        isWinning = livePrice < openingPrice;
        multiplier = totalPool > 0 ? netTotalPot / jeetPool : 1.0;
      }

      if (isSettled) {
        const won = room.winner === bet.side;
        if (won) {
          netPayout = bet.amount * multiplier;
          pnl = netPayout - bet.amount;
          pnlPercent = ((netPayout - bet.amount) / bet.amount) * 100;
        } else {
          pnl = -bet.amount;
          pnlPercent = -100;
        }
      } else {
        // Active Position
        if (isWinning) {
          netPayout = bet.amount * multiplier;
          pnl = netPayout - bet.amount;
          pnlPercent = ((netPayout - bet.amount) / bet.amount) * 100;
        } else {
          pnl = -bet.amount;
          pnlPercent = -100;
        }
      }
    }

    return {
      bet,
      room,
      token,
      isSettled,
      livePrice,
      openingPrice,
      isWinning,
      multiplier,
      pnl,
      pnlPercent,
      cost: bet.amount
    };
  });

  // Open Positions
  const openPositions = parsedPositions.filter((p) => p.room && p.room.status === 'active');
  const settledPositions = parsedPositions.filter((p) => p.isSettled);

  // Totals
  const totalCostOpen = openPositions.reduce((sum, p) => sum + p.cost, 0);
  const unrealizedPnl = openPositions.reduce((sum, p) => sum + p.pnl, 0);
  
  const realizedPnl = settledPositions.reduce((sum, p) => sum + p.pnl, 0);
  const totalVolume = parsedPositions.reduce((sum, p) => sum + p.cost, 0);

  const winCount = settledPositions.filter((p) => p.room?.winner === p.bet.side).length;
  const lossCount = settledPositions.filter((p) => p.isSettled && p.room?.winner !== p.bet.side && p.room?.winner !== 'draw').length;
  const accuracy = settledPositions.length > 0 ? (winCount / settledPositions.length) * 100 : 0;

  // Copy wallet clipboard helper
  const handleCopyWallet = () => {
    navigator.clipboard.writeText(user.wallet || '');
    setCopiedWallet(true);
    synthSound('bet');
    setTimeout(() => setCopiedWallet(false), 2000);
  };

  return (
    <div className="mx-auto max-w-6xl w-full px-4 py-8 flex-1 flex flex-col select-none">
      
      {/* Portfolio Title Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 relative z-10">
        <div>
          <h2 className="font-staatliches text-4xl text-white tracking-wider font-bold">
            PORTFOLIO WALLETS
          </h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="w-2 h-2 rounded-full bg-neon-moon animate-pulse" />
            <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold tracking-widest">
              TELEMETRY DESK // COMMAND SECTOR
            </span>
          </div>
        </div>

        {/* Currency Switcher & Wallet summary */}
        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          {/* Currency Toggle */}
          <div className="bg-trench-black border border-trench-sandbag rounded p-0.5 flex">
            <button 
              onClick={() => { setCurrency('USD'); synthSound('bet'); }}
              className={`px-3 py-1 font-staatliches text-xs rounded transition-all ${
                currency === 'USD' 
                  ? 'bg-neon-moon text-black font-extrabold shadow-glow-moon' 
                  : 'text-trench-gasmask hover:text-white'
              }`}
            >
              USD
            </button>
            <button 
              onClick={() => { setCurrency('SOL'); synthSound('bet'); }}
              className={`px-3 py-1 font-staatliches text-xs rounded transition-all ${
                currency === 'SOL' 
                  ? 'bg-neon-moon text-black font-extrabold shadow-glow-moon' 
                  : 'text-trench-gasmask hover:text-white'
              }`}
            >
              SOL
            </button>
          </div>

          {/* Wallet Address Chip */}
          <button 
            onClick={handleCopyWallet}
            className="flex items-center gap-2 px-3 py-1.5 bg-trench-mud border border-trench-sandbag rounded font-mono text-[10px] text-white font-bold hover:border-white transition-colors cursor-pointer select-none"
          >
            <span>💳 {user.wallet.slice(0, 6)}...{user.wallet.slice(-4)}</span>
            {copiedWallet ? <Check size={10} className="text-neon-moon" /> : <Copy size={10} className="text-trench-gasmask" />}
          </button>
        </div>
      </div>

      {/* 4 Summary Header Boxes */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6 relative z-10">
        
        {/* Box 1: Balance */}
        <div className="bg-trench-mud border-4 border-trench-sandbag p-4 rounded-lg scanlines relative flex flex-col justify-between">
          <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">AMMO BALANCE</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-staatliches text-2xl text-white block leading-none">
              {formatVal(user.balance)}
            </span>
          </div>
          <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block mt-1.5 leading-none">
            AVAILABLE IN VAULT
          </span>
        </div>

        {/* Box 2: Unrealized PNL */}
        <div className="bg-trench-mud border-4 border-trench-sandbag p-4 rounded-lg scanlines relative flex flex-col justify-between">
          <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">UNREALIZED PNL</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`font-staatliches text-2xl block leading-none ${unrealizedPnl >= 0 ? 'text-neon-moon glow-moon' : 'text-jeet-red glow-jeet'}`}>
              {unrealizedPnl >= 0 ? '+' : ''}{formatVal(unrealizedPnl)}
            </span>
          </div>
          <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block mt-1.5 leading-none">
            {openPositions.length} OPEN CHANNELS
          </span>
        </div>

        {/* Box 3: Realized PNL */}
        <div className="bg-trench-mud border-4 border-trench-sandbag p-4 rounded-lg scanlines relative flex flex-col justify-between">
          <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">REALIZED PNL</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className={`font-staatliches text-2xl block leading-none ${realizedPnl >= 0 ? 'text-neon-moon glow-moon' : 'text-jeet-red glow-jeet'}`}>
              {realizedPnl >= 0 ? '+' : ''}{formatVal(realizedPnl)}
            </span>
          </div>
          <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block mt-1.5 leading-none">
            {settledPositions.length} BATTLES RESOLVED
          </span>
        </div>

        {/* Box 4: Total Volume */}
        <div className="bg-trench-mud border-4 border-trench-sandbag p-4 rounded-lg scanlines relative flex flex-col justify-between">
          <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">TOTAL STAKED VOLUME</span>
          <div className="flex items-baseline gap-1 mt-1">
            <span className="font-staatliches text-2xl text-moon-gold block leading-none glow-gold">
              {formatVal(totalVolume)}
            </span>
          </div>
          <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block mt-1.5 leading-none">
            {user.bets.length} TOTAL WAGERS
          </span>
        </div>

      </div>

      {/* Tabs list (Overview, Open Positions, Performance, Trades, Open Orders) */}
      <div className="border-b border-trench-sandbag/40 mb-6 flex flex-wrap gap-2 relative z-10">
        {(['positions', 'overview', 'performance', 'trades', 'orders'] as const).map((tab) => {
          let label = '';
          if (tab === 'positions') label = `OPEN POSITIONS (${openPositions.length})`;
          else if (tab === 'overview') label = 'OVERVIEW';
          else if (tab === 'performance') label = 'PERFORMANCE';
          else if (tab === 'trades') label = 'TRADES';
          else if (tab === 'orders') label = 'OPEN ORDERS (0)';

          const isActive = activeTab === tab;

          return (
            <button
              key={tab}
              onClick={() => { setActiveTab(tab); synthSound('bet'); }}
              className={`pb-2 px-4 font-staatliches text-sm sm:text-base tracking-wider uppercase border-b-2 font-bold transition-all ${
                isActive 
                  ? 'border-neon-moon text-neon-moon glow-moon font-extrabold scale-105' 
                  : 'border-transparent text-trench-gasmask hover:text-white'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Tab Contents View Container */}
      <div className="bg-trench-black/40 border-2 border-trench-sandbag/60 rounded-xl p-4 min-h-[40vh] relative z-10 scanlines flex flex-col justify-between mb-8">
        
        {/* TAB 1: OPEN POSITIONS */}
        {activeTab === 'positions' && (
          <div className="flex-1 flex flex-col">
            {openPositions.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-trench-gasmask font-mono text-xs font-bold uppercase tracking-wider leading-relaxed">
                <p>No Open Positions targeted</p>
                <p className="mt-1.5 text-[10px] text-trench-gasmask/60">Deploy wagers on active token battles to capture positions</p>
                <Link href="/rooms" className="mt-6">
                  <button className="px-5 py-2 retro-btn retro-btn-moon text-sm">DEPART TO WAR ROOM</button>
                </Link>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left font-mono text-[11px] border-collapse">
                  <thead>
                    <tr className="border-b border-trench-sandbag/45 text-trench-gasmask font-bold uppercase tracking-widest text-[9px] pb-2">
                      <th className="py-2.5">ASSET</th>
                      <th className="py-2.5">SIDE</th>
                      <th className="py-2.5 text-right">COST</th>
                      <th className="py-2.5 text-right">STRIKE / LIVE</th>
                      <th className="py-2.5 text-center">REMAINING</th>
                      <th className="py-2.5 text-right">PNL</th>
                      <th className="py-2.5 text-right">PNL %</th>
                      <th className="py-2.5 text-center">ACTIONS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-trench-sandbag/20 text-white font-bold">
                    {openPositions.map((pos, idx) => {
                      const room = pos.room!;
                      const token = pos.token!;
                      const timeText = timeRemainingText[room.id] || '00:00:00';
                      const pnlIsPositive = pos.pnl >= 0;

                      return (
                        <tr key={idx} className="hover:bg-trench-black/20 transition-colors">
                          {/* Asset Info */}
                          <td className="py-3 pr-2 min-w-[120px]">
                            <div className="flex items-center gap-2">
                              <div className="relative w-6 h-6 bg-trench-black border border-trench-sandbag/35 rounded overflow-hidden shrink-0 flex items-center justify-center">
                                {token.icon && token.icon.startsWith('http') ? (
                                  <img src={token.icon} alt={token.name} className="w-full h-full object-cover rounded" />
                                ) : (
                                  <PepePortrait
                                    src={(() => {
                                      let hash = 0;
                                      for (let i = 0; i < room.id.length; i++) {
                                        hash = room.id.charCodeAt(i) + ((hash << 5) - hash);
                                      }
                                      const index = Math.abs(hash);
                                      return pos.isWinning 
                                        ? MOON_PEPES[index % MOON_PEPES.length] 
                                        : JEET_PEPES[index % JEET_PEPES.length];
                                    })()}
                                    size={18}
                                    glowColor={pos.isWinning ? 'moon' : 'jeet'}
                                    className="rounded"
                                  />
                                )}
                              </div>
                              <div className="min-w-0">
                                <span className="font-staatliches text-xs block leading-tight truncate text-white uppercase">{token.name}</span>
                                <span className="text-[8px] text-trench-gasmask block leading-none">{formatCashtag(token.symbol)}</span>
                              </div>
                            </div>
                          </td>

                          {/* Side */}
                          <td className="py-3">
                            <span className={`px-2 py-0.5 rounded border text-[8px] uppercase tracking-wide ${
                              pos.bet.side === 'moon' 
                                ? 'bg-neon-moon/10 border-neon-moon text-neon-moon shadow-glow-moon' 
                                : 'bg-jeet-red/10 border-jeet-red text-jeet-red shadow-glow-jeet'
                            }`}>
                              {pos.bet.side}
                            </span>
                          </td>

                          {/* Cost */}
                          <td className="py-3 text-right">
                            {formatVal(pos.cost)}
                          </td>

                          {/* Strike / Live */}
                          <td className="py-3 text-right text-trench-gasmask font-mono">
                            <span className="text-white block leading-tight">${formatPrice(pos.openingPrice)}</span>
                            <span className={`text-[9px] block leading-none ${pos.isWinning ? 'text-neon-moon font-bold' : 'text-jeet-red'}`}>
                              ${formatPrice(pos.livePrice)}
                            </span>
                          </td>

                          {/* Remaining */}
                          <td className="py-3 text-center">
                            <div className="inline-flex items-center gap-1.5 bg-trench-black/80 px-2 py-0.5 border border-trench-sandbag/40 rounded text-[9px] text-neon-moon animate-pulse uppercase">
                              <Clock size={10} />
                              <span>{timeText}</span>
                            </div>
                          </td>

                          {/* PNL */}
                          <td className={`py-3 text-right font-bold ${pnlIsPositive ? 'text-neon-moon glow-moon' : 'text-jeet-red'}`}>
                            {pnlIsPositive ? '+' : ''}{formatVal(pos.pnl)}
                          </td>

                          {/* PNL % */}
                          <td className={`py-3 text-right font-extrabold ${pnlIsPositive ? 'text-neon-moon glow-moon' : 'text-jeet-red'}`}>
                            {pnlIsPositive ? '+' : ''}{pos.pnlPercent.toFixed(1)}%
                          </td>

                          {/* Actions */}
                          <td className="py-3 text-center">
                            <Link href={`/room/${room.id}`}>
                              <button className="p-1 hover:bg-neon-moon/10 text-trench-gasmask hover:text-neon-moon border border-trench-sandbag/40 hover:border-neon-moon/60 rounded flex items-center justify-center mx-auto transition-all" title="View Battlefield Room">
                                <ArrowUpRight size={12} />
                              </button>
                            </Link>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: OVERVIEW STATS */}
        {activeTab === 'overview' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            {/* Classification & Rank details */}
            <div className="bg-trench-mud/40 border-2 border-trench-sandbag/65 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-staatliches text-2xl text-white tracking-wider mb-4 flex items-center gap-1.5 uppercase">
                  <Award className="text-moon-gold" />
                  CLASSIFICATION RADAR
                </h4>
                <div className="flex gap-4 items-center mb-6">
                  <div className="bg-trench-black border-4 border-trench-sandbag rounded p-3 h-20 w-20 flex flex-col items-center justify-center relative">
                    <span className="font-staatliches text-4xl text-neon-moon leading-none font-black">{user.trenchScore}</span>
                    <span className="font-mono text-[7px] text-trench-gasmask uppercase font-bold leading-none -mt-0.5">RANK</span>
                  </div>
                  <div>
                    <span className="font-staatliches text-lg text-white tracking-wide block uppercase leading-tight">SOLDIER RANK DESK</span>
                    <p className="font-mono text-[10px] text-trench-gasmask font-bold uppercase mt-0.5">
                      Combat Accuracy and wager volume determine your classification. Currently classified as a frontline specialist.
                    </p>
                  </div>
                </div>

                <div className="space-y-2 font-mono text-[11px] font-bold">
                  <div className="flex justify-between border-b border-trench-sandbag/25 pb-1">
                    <span className="text-trench-gasmask uppercase">WAR PATH ACCURACY:</span>
                    <span className="text-white">{accuracy.toFixed(0)}%</span>
                  </div>
                  <div className="flex justify-between border-b border-trench-sandbag/25 pb-1">
                    <span className="text-trench-gasmask uppercase">COMBAT WIN COUNTS:</span>
                    <span className="text-neon-moon">{winCount} WINS</span>
                  </div>
                  <div className="flex justify-between border-b border-trench-sandbag/25 pb-1">
                    <span className="text-trench-gasmask uppercase">WAR DEFEATS COUNTS:</span>
                    <span className="text-jeet-red">{lossCount} LOSSES</span>
                  </div>
                </div>
              </div>
              
              <div className="mt-4 p-2 bg-trench-black/40 border border-trench-sandbag/30 rounded font-mono text-[8px] text-trench-gasmask uppercase tracking-wider leading-relaxed">
                DECENTRALIZED BATTLE RECORD AUTHENTICATED BY HQ-NET
              </div>
            </div>

            {/* Recent activity summary */}
            <div className="bg-trench-mud/40 border-2 border-trench-sandbag/65 rounded-lg p-5 flex flex-col justify-between">
              <div>
                <h4 className="font-staatliches text-2xl text-white tracking-wider mb-4 flex items-center gap-1.5 uppercase">
                  <Activity className="text-neon-moon" />
                  RECENT TACTICAL ACTIVITY
                </h4>

                {user.bets.length === 0 ? (
                  <p className="font-mono text-[10px] text-trench-gasmask uppercase font-bold py-6 text-center">No mission logs recorded</p>
                ) : (
                  <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin">
                    {user.bets.slice(0, 4).map((bet, idx) => {
                      const room = rooms.find((r) => r.id === bet.roomId);
                      const symbol = room ? room.token.symbol : 'TOKEN';
                      const isSettled = room ? room.status === 'settled' : false;
                      const win = room && room.winner === bet.side;

                      return (
                        <div key={idx} className="p-2 bg-trench-black/60 border border-trench-sandbag/40 rounded flex justify-between items-center text-[10px] font-mono font-bold">
                          <div>
                            <span className="text-white uppercase">{bet.amount.toFixed(1)} SOL on {formatCashtag(symbol)}</span>
                            <span className="text-trench-gasmask/70 text-[8px] block uppercase">Side: {bet.side} // {new Date(bet.timestamp).toLocaleDateString()}</span>
                          </div>
                          <div>
                            {!isSettled ? (
                              <span className="text-yellow-500 uppercase text-[8px] border border-yellow-500/30 px-1 py-0.5 rounded">ACTIVE</span>
                            ) : win ? (
                              <span className="text-neon-moon uppercase text-[8px] border border-neon-moon/30 px-1 py-0.5 rounded">WIN</span>
                            ) : (
                              <span className="text-jeet-red uppercase text-[8px] border border-jeet-red/30 px-1 py-0.5 rounded">REKT</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <Link href="/portfolio?tab=trades">
                <button 
                  onClick={() => { setActiveTab('trades'); synthSound('bet'); }}
                  className="w-full mt-4 py-2 border-2 border-dashed border-trench-sandbag/60 text-trench-gasmask hover:text-white hover:border-white rounded font-mono text-[9px] uppercase font-bold text-center transition-all flex items-center justify-center gap-1"
                >
                  <span>EXAMINE ENTIRE RADAR LOG</span>
                  <ArrowRight size={10} />
                </button>
              </Link>
            </div>

          </div>
        )}

        {/* TAB 3: PERFORMANCE DETAILS */}
        {activeTab === 'performance' && (
          <div className="flex-1 flex flex-col justify-between">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              
              <div className="bg-trench-mud/30 border border-trench-sandbag p-4 rounded text-center">
                <span className="font-mono text-[8px] text-trench-gasmask block uppercase font-bold">BATTLE ACCURACY</span>
                <span className="font-staatliches text-3xl text-white block mt-1 glow-white">{accuracy.toFixed(1)}%</span>
                <span className="font-mono text-[8px] text-trench-gasmask block mt-1">WIN TO LOSS RATIO</span>
              </div>

              <div className="bg-trench-mud/30 border border-trench-sandbag p-4 rounded text-center">
                <span className="font-mono text-[8px] text-trench-gasmask block uppercase font-bold">AVG WAGER SIZE</span>
                <span className="font-staatliches text-3xl text-neon-moon block mt-1 glow-moon">
                  {formatVal(user.bets.length > 0 ? totalVolume / user.bets.length : 0)}
                </span>
                <span className="font-mono text-[8px] text-trench-gasmask block mt-1">PER SECTOR DEPLOYMENT</span>
              </div>

              <div className="bg-trench-mud/30 border border-trench-sandbag p-4 rounded text-center">
                <span className="font-mono text-[8px] text-trench-gasmask block uppercase font-bold">PREFERRED FACTION</span>
                <span className="font-staatliches text-3xl text-jeet-red block mt-1 glow-jeet">
                  {(() => {
                    const moonCount = user.bets.filter((b) => b.side === 'moon').length;
                    const jeetCount = user.bets.filter((b) => b.side === 'jeet').length;
                    if (moonCount === 0 && jeetCount === 0) return 'NONE';
                    return moonCount >= jeetCount ? 'MOON ARMY' : 'JEET SQUAD';
                  })()}
                </span>
                <span className="font-mono text-[8px] text-trench-gasmask block mt-1">BASED ON WAGER COUNTS</span>
              </div>

              <div className="bg-trench-mud/30 border border-trench-sandbag p-4 rounded text-center">
                <span className="font-mono text-[8px] text-trench-gasmask block uppercase font-bold">MAX BATTLE STREAK</span>
                <span className="font-staatliches text-3xl text-moon-gold block mt-1 glow-gold">{user.stats.longestWinStreak || 0} WINS</span>
                <span className="font-mono text-[8px] text-trench-gasmask block mt-1">CONSECUTIVE TRIUMPHS</span>
              </div>

            </div>

            {/* Gamified visual breakdown panel */}
            <div className="bg-trench-mud/20 border border-trench-sandbag/45 p-4 rounded mt-6 font-mono text-[11px] leading-relaxed">
              <span className="font-staatliches text-lg text-white tracking-wider block uppercase mb-2">OPERATIONAL STRATEGIST FEEDBACK</span>
              <p className="text-trench-gasmask font-bold">
                Commander anon, your prediction accuracy currently stands at <span className="text-white">{accuracy.toFixed(0)}%</span>. 
                Your largest ammunition deployment was <span className="text-moon-gold font-bold">{user.stats.biggestBet.toFixed(2)} SOL</span>. 
                Keep backing sectors and tracking live contract telemetries in the War Room to secure additional frontline medals and boost your tactical ELO ranking.
              </p>
            </div>
          </div>
        )}

        {/* TAB 4: TRADES LEDGER */}
        {activeTab === 'trades' && (
          <div className="flex-1 flex flex-col">
            {user.bets.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-trench-gasmask font-mono text-xs font-bold uppercase tracking-wider leading-relaxed">
                <p>No transactions recorded on this commander helmet ID.</p>
              </div>
            ) : (
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left font-mono text-[10px] border-collapse">
                  <thead>
                    <tr className="border-b border-trench-sandbag/45 text-trench-gasmask font-bold uppercase tracking-widest text-[8px] pb-2">
                      <th className="py-2">ASSET</th>
                      <th className="py-2">SIDE</th>
                      <th className="py-2 text-right">STAKE</th>
                      <th className="py-2 text-center">OUTCOME</th>
                      <th className="py-2 text-right">REALIZED PNL</th>
                      <th className="py-2 text-center">DATE</th>
                      <th className="py-2 text-center">TX DISPATCH</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-trench-sandbag/20 text-white font-bold">
                    {parsedPositions.map((pos, idx) => {
                      const room = pos.room;
                      const symbol = room ? room.token.symbol : 'UNKNOWN';
                      const pnlIsPositive = pos.pnl >= 0;

                      return (
                        <tr key={idx} className="hover:bg-trench-black/20 transition-colors">
                          <td className="py-2.5 font-staatliches text-xs tracking-wider uppercase text-white">
                            {symbol}
                          </td>
                          <td className="py-2.5">
                            <span className={pos.bet.side === 'moon' ? 'text-neon-moon' : 'text-jeet-red'}>
                              {pos.bet.side.toUpperCase()}
                            </span>
                          </td>
                          <td className="py-2.5 text-right">
                            {formatVal(pos.cost)}
                          </td>
                          <td className="py-2.5 text-center">
                            {!room || room.status === 'active' ? (
                              <span className="text-yellow-500 border border-yellow-500/35 px-1 py-0.5 rounded text-[8px] uppercase">ACTIVE</span>
                            ) : room.winner === pos.bet.side ? (
                              <span className="text-neon-moon border border-neon-moon/35 px-1 py-0.5 rounded text-[8px] uppercase">WIN</span>
                            ) : (
                              <span className="text-jeet-red border border-jeet-red/35 px-1 py-0.5 rounded text-[8px] uppercase">REKT</span>
                            )}
                          </td>
                          <td className={`py-2.5 text-right font-bold ${pnlIsPositive ? 'text-neon-moon glow-moon' : 'text-jeet-red'}`}>
                            {pnlIsPositive ? '+' : ''}{formatVal(pos.pnl)}
                          </td>
                          <td className="py-2.5 text-center text-trench-gasmask">
                            {new Date(pos.bet.timestamp).toLocaleString()}
                          </td>
                          <td className="py-2.5 text-center">
                            {pos.bet.txSig ? (
                              <a 
                                href={pos.bet.txSig 
                                  ? (typeof window !== 'undefined' && window.location.hostname === 'localhost') 
                                    ? `https://explorer.solana.com/tx/${pos.bet.txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899` 
                                    : `https://solscan.io/tx/${pos.bet.txSig}?cluster=devnet`
                                  : '#'
                                } 
                                target="_blank" 
                                rel="noreferrer" 
                                className="inline-flex items-center gap-1 text-neon-moon hover:text-white transition-colors"
                              >
                                <span>Solscan</span>
                                <ExternalLink size={8} />
                              </a>
                            ) : (
                              <span className="text-trench-gasmask/50">-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* TAB 5: OPEN ORDERS */}
        {activeTab === 'orders' && (
          <div className="flex-1 flex flex-col items-center justify-center py-12 text-center text-trench-gasmask font-mono text-xs font-bold uppercase tracking-wider leading-relaxed">
            <p>No Open Orders recorded</p>
            <p className="mt-1.5 text-[10px] text-trench-gasmask/60">Limit orders or pending room triggers will display here.</p>
          </div>
        )}

      </div>

      {/* Degen Banner at bottom */}
      <DegenQuoteBanner />

    </div>
  );
}
