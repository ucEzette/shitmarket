'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PixelBarbedWire } from '@/components/PixelArt';
import { useAppState, Room, formatPrice } from '@/store/useAppState';
import { PEPE_ASSETS, WarPropaganda } from '@/components/MemeAssets';
import { FloatingCoins } from '@/components/FloatingCoins';
import { Flame, Zap, Target } from 'lucide-react';

const RoomCountdown = ({ expiry }: { expiry: number }) => {
  const [timeLeft, setTimeLeft] = React.useState('');

  React.useEffect(() => {
    const update = () => {
      const diff = expiry - Date.now();
      if (diff <= 0) {
        setTimeLeft('EXPIRED');
        return;
      }
      const hrs = Math.floor(diff / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);
      const pad = (n: number) => String(n).padStart(2, '0');
      setTimeLeft(`${pad(hrs)}:${pad(mins)}:${pad(secs)}`);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [expiry]);

  return <span>{timeLeft}</span>;
};

const HomepageRoomCard = ({ room }: { room: Room }) => {
  const router = useRouter();
  const isDebateRoom = 
    (room.category as string) === 'debate' || 
    (room.category as string) === 'prediction' || 
    (!!room.resolutionCriteria && room.resolutionCriteria.length > 0 && (!room.token.pairAddress || room.token.pairAddress === '')) ||
    room.token.address === room.creator;

  const isMoonLeading = room.moonPool > room.jeetPool;
  const totalPot = room.moonPool + room.jeetPool;
  const moonPercentage = totalPot > 0 ? (room.moonPool / totalPot) * 100 : 50;
  const jeetPercentage = totalPot > 0 ? (room.jeetPool / totalPot) * 100 : 50;

  return (
    <div
      onClick={() => {
        router.push(`/room/${room.id}`);
        if (typeof window !== 'undefined' && (window as any).synthSound) {
          (window as any).synthSound('bet');
        }
      }}
      className={`bg-white dark:bg-trench-mud border rounded-2xl p-4 flex flex-col justify-between cursor-pointer transition-all duration-200 select-none relative group hover:-translate-y-0.5 shadow-md dark:shadow-none text-slate-800 dark:text-white shrink-0 snap-start w-[280px] sm:w-[320px] md:w-auto ${
        isMoonLeading
          ? 'border-teal-600/30 dark:border-neon-moon/30 shadow-sm dark:shadow-glow-moon hover:border-teal-600 dark:hover:border-neon-moon/70'
          : 'border-red-600/30 dark:border-jeet-red/30 shadow-sm dark:shadow-glow-jeet hover:border-red-600 dark:hover:border-jeet-red/70'
      }`}
    >
      <div className="flex items-start justify-between gap-3 mb-4">
        <div className="flex items-start gap-3">
          <div className="relative bg-cyan-50 dark:bg-trench-black border border-cyan-200 dark:border-trench-sandbag rounded-xl overflow-hidden shrink-0 w-10 h-10 flex items-center justify-center">
            {room.token.icon && (room.token.icon.startsWith('http') || room.token.icon.startsWith('data:') || room.token.icon.startsWith('blob:')) ? (
              <img src={room.token.icon} alt={room.token.name} className="w-full h-full object-cover rounded-lg" />
            ) : (
              <span className="text-xl">🗣️</span>
            )}
          </div>
          <div className="min-w-0">
            <h4 className="font-bold text-sm text-slate-900 dark:text-slate-100 line-clamp-2 leading-snug tracking-wide group-hover:text-teal-700 dark:group-hover:text-white transition-colors">
              {isDebateRoom 
                ? (room.resolutionCriteria ? room.resolutionCriteria.split('| Ref:')[0].split('Ref:')[0].trim() : room.token.name)
                : `Will ${room.token.symbol.toUpperCase()} end above $${formatPrice(room.openingPrice || 0)}?`}
            </h4>
          </div>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        <div className="flex items-center justify-between p-2 rounded-xl bg-cyan-50/50 dark:bg-trench-black/40 border border-cyan-200/60 dark:border-trench-sandbag/40">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">🚀 MOON</span>
          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{moonPercentage.toFixed(0)}%</span>
        </div>
        <div className="flex items-center justify-between p-2 rounded-xl bg-cyan-50/50 dark:bg-trench-black/40 border border-cyan-200/60 dark:border-trench-sandbag/40">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">💀 JEET</span>
          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{jeetPercentage.toFixed(0)}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-cyan-200 dark:border-trench-sandbag/40 pt-3 mt-auto text-[10px] font-mono text-slate-600 dark:text-trench-gasmask">
        <span className="font-bold text-[#00796B] dark:text-neon-moon uppercase">
          POT: {totalPot.toFixed(2)} USDC
        </span>
        <span className="font-bold text-[#C62828] dark:text-jeet-red flex items-center gap-1">
          ⏳ <RoomCountdown expiry={room.expiry} />
        </span>
      </div>
    </div>
  );
};

function HomeContent() {
  const { isPaused, rooms } = useAppState();
  const [activeTab, setActiveTab] = React.useState<'latest' | 'biggest' | 'expire'>('latest');

  const allRooms = rooms || [];
  
  // Sorting groups
  const trendingRooms = React.useMemo(() => {
    return [...allRooms]
      .sort((a, b) => (b.moonPool + b.jeetPool) - (a.moonPool + a.jeetPool))
      .slice(0, 10);
  }, [allRooms]);

  const latestRooms = React.useMemo(() => {
    return [...allRooms]
      .sort((a, b) => (b.expiry || 0) - (a.expiry || 0))
      .slice(0, 8);
  }, [allRooms]);

  const biggestPotRooms = React.useMemo(() => {
    return [...allRooms]
      .sort((a, b) => (b.moonPool + b.jeetPool) - (a.moonPool + a.jeetPool))
      .slice(0, 8);
  }, [allRooms]);

  const soonToExpireRooms = React.useMemo(() => {
    return [...allRooms]
      .filter(r => r.status === 'active')
      .sort((a, b) => (a.expiry || 0) - (b.expiry || 0))
      .slice(0, 8);
  }, [allRooms]);



  return (
    <main className="sm-shell relative flex flex-col w-full overflow-hidden select-none">

      {/* 1. HERO SECTION — PREDICTION ARENA */}
      <section className="relative w-full overflow-hidden border-b border-border-color py-16 md:py-24 min-h-[600px] flex items-center justify-center bg-trench-black transition-colors duration-200">
        <div className="absolute inset-0 z-0 flex w-full h-full">
          <div className="w-1/2 h-full relative overflow-hidden border-r border-[#193012]/30">
            <img 
              alt="Moon Army Charging" 
              className="w-full h-full object-cover opacity-20 filter sepia saturate-[250%] hue-rotate-[85deg] contrast-[1.1]" 
              src={PEPE_ASSETS.moonJuice}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#A8EEFF] dark:from-[#07080d] via-[#A8EEFF]/35 dark:via-[#07080d]/35 to-transparent"></div>
            <div className="absolute bottom-6 left-6 font-mono text-[9px] text-[#00796B]/40 dark:text-neon-moon/20 font-bold uppercase tracking-widest pointer-events-none hidden md:block">
              BULLISH TRENCH // REGION A
            </div>
          </div>

          <div className="w-1/2 h-full relative overflow-hidden">
            <img 
              alt="Jeet Skeleton Forces" 
              className="w-full h-full object-cover opacity-20 filter sepia saturate-[300%] hue-rotate-[320deg] contrast-[1.1]" 
              src={PEPE_ASSETS.jeetSkeleton}
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#A8EEFF] dark:from-[#07080d] via-[#A8EEFF]/35 dark:via-[#07080d]/35 to-transparent"></div>
            <div className="absolute bottom-6 right-6 font-mono text-[9px] text-red-600/40 dark:text-jeet-red/20 font-bold uppercase tracking-widest pointer-events-none hidden md:block text-right">
              BEARISH WASTELAND // REGION B
            </div>
          </div>
        </div>

        <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[1px] bg-gradient-to-b from-transparent via-cyan-300 dark:via-[#5c5244]/40 to-transparent z-10 hidden lg:block" />
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#A8EEFF_90%)] dark:bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#07080d_90%)] pointer-events-none" />
        <div className="absolute inset-0 z-0 portal-glow pointer-events-none" />
        
        <FloatingCoins />

        <div className="mx-auto max-w-7xl px-4 flex flex-col items-center justify-center relative z-10 w-full">
          <motion.h1
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="font-staatliches text-4xl sm:text-6xl md:text-7xl leading-none text-[#0A1A2A] dark:text-white tracking-widest text-center mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            PICK A SIDE. <span className="text-neon-moon">BET THE TRENCH.</span>
          </motion.h1>
          <motion.h2
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="text-sm sm:text-base md:text-lg font-mono uppercase tracking-[0.35em] text-[#2C3E50] dark:text-white text-center mb-6 font-bold"
          >
            permissionless prediction markets
          </motion.h2>

          {/* Slimmer Banner Container (aspect-[3/1] and capped height) */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className="w-full max-w-4xl px-4 mt-2 flex justify-center"
          >
            <div className="w-full premium-glass-card rounded-[20px] overflow-hidden p-2 md:p-2.5 shadow-2xl border border-cyan-200 dark:border-trench-sandbag/45 relative dark:scanlines group">
              <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />
              <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />
              <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />

              <div className="relative overflow-hidden w-full aspect-[3/1] rounded-xl border border-cyan-200 dark:border-trench-sandbag/30 bg-black/60 shadow-inner">
                <video
                  src="/pepes/Chad_soldiers_and_Wojak_soldier_202606070100.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </motion.div>

          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.45 }}
            className="mt-10 flex flex-col sm:flex-row gap-6 justify-center items-center w-full max-w-4xl"
          >
            <Link href="/rooms" className="w-full sm:w-auto">
              <button className="w-full sm:w-80 py-4 font-staatliches text-xl sm:text-2xl uppercase tracking-widest text-white dark:text-black premium-btn-moon rounded-full flex items-center justify-center gap-3 shadow-lg dark:shadow-[0_0_20px_rgba(34,197,94,0.3)]">
                ENTER PREDICTION ARENA
              </button>
            </Link>
            {isPaused ? (
              <button disabled className="w-full sm:w-80 py-4 font-staatliches text-xl sm:text-2xl uppercase tracking-widest bg-gray-300 dark:bg-gray-700/60 text-gray-500 dark:text-gray-400 rounded-full border border-gray-300 dark:border-gray-600/30 cursor-not-allowed flex items-center justify-center gap-3">
                SYSTEM PAUSED
              </button>
            ) : (
              <Link href="/create-room" className="w-full sm:w-auto">
                <button className="w-full sm:w-80 py-4 font-staatliches text-xl sm:text-2xl uppercase tracking-widest text-[#0A1A2A] dark:text-black premium-btn-neutral rounded-full flex items-center justify-center gap-3 shadow-lg dark:shadow-[0_0_20px_rgba(251,191,36,0.3)]">
                  CREATE PREDICTION MARKET
                </button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      {/* 2. LIVE MARQUEE TICKER */}
      <div className="w-full bg-white/70 dark:bg-black/40 border-y border-cyan-200 dark:border-white/5 py-3 relative overflow-hidden backdrop-blur-md text-[#0A1A2A] dark:text-white">
        <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-[#A8EEFF] dark:from-trench-black to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-[#A8EEFF] dark:from-trench-black to-transparent z-10 pointer-events-none" />

        <div className="flex w-[200%] animate-marquee">
          {Array(2).fill(0).map((_, groupIndex) => (
            <div key={groupIndex} className="flex justify-around items-center w-full min-w-full font-mono text-xs uppercase tracking-wider font-bold">
              <span className="flex items-center gap-1.5 text-[#00796B] dark:text-neon-moon">
                <Zap size={12} />
                ANON WENT 1.5 SOL ON <span className="bg-cyan-100 dark:bg-trench-black px-1.5 py-0.5 rounded border border-[#00796B]/40 dark:border-neon-moon/40">$BONK2</span> → MOON (BULL)
              </span>
              <span className="text-slate-400 dark:text-trench-gasmask">•</span>
              <span className="flex items-center gap-1.5 text-[#C62828] dark:text-jeet-red">
                <Target size={12} />
                DEGEN CHAD JEETED 3.0 SOL ON <span className="bg-cyan-100 dark:bg-trench-black px-1.5 py-0.5 rounded border border-[#C62828]/40 dark:border-jeet-red/40">$PEPE5</span> → JEET (BEAR)
              </span>
              <span className="text-slate-400 dark:text-trench-gasmask">•</span>
              <span className="flex items-center gap-1.5 text-[#00796B] dark:text-neon-moon">
                <Zap size={12} />
                WHALE DEPLOYED 5.2 SOL ON <span className="bg-cyan-100 dark:bg-trench-black px-1.5 py-0.5 rounded border border-[#00796B]/40 dark:border-neon-moon/40">$SLERF</span> → MOON 🐸
              </span>
              <span className="text-slate-400 dark:text-trench-gasmask">•</span>
              <span className="flex items-center gap-1.5 text-[#C62828] dark:text-jeet-red">
                <Target size={12} />
                SKEL_REAPER DUMPED 0.85 SOL ON <span className="bg-cyan-100 dark:bg-trench-black px-1.5 py-0.5 rounded border border-[#C62828]/40 dark:border-jeet-red/40">$WOJAK</span> → JEET 🦴
              </span>
              <span className="text-slate-400 dark:text-trench-gasmask">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* 3. TRENDING CAROUSEL */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <div className="flex items-center gap-2 mb-6">
          <Flame className="text-red-500 animate-pulse" />
          <h3 className="font-staatliches text-3xl text-[#0A1A2A] dark:text-white tracking-widest uppercase">
            TRENDING PREDICTIONS
          </h3>
        </div>
        <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-none snap-x select-text">
          {trendingRooms.length > 0 ? (
            trendingRooms.map(room => (
              <div key={room.id} className="snap-start shrink-0">
                <HomepageRoomCard room={room} />
              </div>
            ))
          ) : (
            <div className="w-full text-center py-12 font-mono text-xs text-slate-500 dark:text-trench-gasmask uppercase font-bold bg-[#050803]/40 border border-cyan-200 dark:border-trench-sandbag/40 rounded-xl">
              Awaiting Prediction Markets deployment...
            </div>
          )}
        </div>
      </section>

      {/* 4. MARKET PLAZA TABS (LATEST, BIGGEST, EXPIRE) */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <div className="bg-white/50 dark:bg-black/40 border-2 border-cyan-200 dark:border-trench-sandbag rounded-[24px] overflow-hidden p-6 relative z-10 shadow-2xl backdrop-blur-md">
          <div className="flex border-b border-cyan-200 dark:border-trench-sandbag/45 bg-cyan-50/50 dark:bg-trench-mud overflow-x-auto scrollbar-none rounded-t-xl">
            <button
              onClick={() => {
                setActiveTab('latest');
                if (typeof window !== 'undefined' && (window as any).synthSound) {
                  (window as any).synthSound('bet');
                }
              }}
              className={`px-6 py-4 font-staatliches text-lg uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'latest'
                  ? 'bg-white dark:bg-trench-black text-[#00796B] dark:text-neon-moon border-b-4 border-[#00796B] dark:border-neon-moon font-extrabold shadow-sm'
                  : 'text-slate-600 dark:text-trench-gasmask hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Latest Markets
            </button>
            <button
              onClick={() => {
                setActiveTab('biggest');
                if (typeof window !== 'undefined' && (window as any).synthSound) {
                  (window as any).synthSound('bet');
                }
              }}
              className={`px-6 py-4 font-staatliches text-lg uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'biggest'
                  ? 'bg-white dark:bg-trench-black text-[#00796B] dark:text-neon-moon border-b-4 border-[#00796B] dark:border-neon-moon font-extrabold shadow-sm'
                  : 'text-slate-600 dark:text-trench-gasmask hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Biggest Pools
            </button>
            <button
              onClick={() => {
                setActiveTab('expire');
                if (typeof window !== 'undefined' && (window as any).synthSound) {
                  (window as any).synthSound('bet');
                }
              }}
              className={`px-6 py-4 font-staatliches text-lg uppercase tracking-wider transition-all whitespace-nowrap ${
                activeTab === 'expire'
                  ? 'bg-white dark:bg-trench-black text-[#00796B] dark:text-neon-moon border-b-4 border-[#00796B] dark:border-neon-moon font-extrabold shadow-sm'
                  : 'text-slate-600 dark:text-trench-gasmask hover:text-slate-900 dark:hover:text-white'
              }`}
            >
              Soon To Expire
            </button>
          </div>

          <div className="mt-8">
            {(() => {
              const currentList = 
                activeTab === 'latest' ? latestRooms :
                activeTab === 'biggest' ? biggestPotRooms :
                soonToExpireRooms;

              if (currentList.length === 0) {
                return (
                  <div className="text-center py-16 font-mono text-xs text-slate-500 dark:text-trench-gasmask uppercase font-bold">
                    No active prediction markets detected.
                  </div>
                );
              }

              return (
                <div className="flex md:grid overflow-x-auto md:overflow-x-visible md:grid-cols-3 lg:grid-cols-4 gap-6 pb-4 md:pb-0 scrollbar-none snap-x select-text">
                  {currentList.map(room => (
                    <HomepageRoomCard key={room.id} room={room} />
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      </section>

      {/* 5. HOW THE ARENA WORKS */}
      <section className="mx-auto grid w-full max-w-7xl gap-4 px-4 py-8 md:grid-cols-[1.4fr_0.6fr]">
        <div className="sm-panel-raised p-5 md:p-6">
          <div className="mb-5 flex items-end justify-between gap-4">
            <div>
              <p className="sm-kicker text-neon-moon">Field manual / 004</p>
              <h2 className="sm-display mt-2 text-2xl font-bold text-foreground md:text-3xl">A clean fight, start to finish.</h2>
            </div>
            <span className="sm-badge text-trench-gasmask">No custody</span>
          </div>
          <div className="grid gap-3 md:grid-cols-4">
            {[
              ['01', 'Choose a side', 'Read the market. Pick MOON or JEET.'],
              ['02', 'Stake ammo', 'Commit USDC to the pool before cutoff.'],
              ['03', 'Oracle settles', 'Price data closes the room without a committee.'],
              ['04', 'Claim the bag', 'Winners collect their share. Losers get lore.'],
            ].map(([number, title, copy]) => (
              <div key={number} className="border-l border-sandbag/70 pl-3">
                <p className="sm-kicker text-moon-gold">{number}</p>
                <h3 className="mt-2 text-sm font-bold text-foreground">{title}</h3>
                <p className="mt-2 text-xs leading-5 text-muted-foreground">{copy}</p>
              </div>
            ))}
          </div>
        </div>
        <div className="sm-panel flex flex-col justify-between gap-5 p-5 md:p-6">
          <div>
            <p className="sm-kicker text-jeet-red">Protocol posture</p>
            <p className="mt-3 font-syne text-xl font-extrabold leading-tight text-foreground">Permissionless by design. Ruthless by nature.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <div className="border-t border-border-color pt-3"><span className="sm-kicker text-muted-foreground">Settlement</span><p className="mt-1 font-bold text-neon-moon">AUTOMATED</p></div>
            <div className="border-t border-border-color pt-3"><span className="sm-kicker text-muted-foreground">House edge</span><p className="mt-1 font-bold text-moon-gold">2.0%</p></div>
          </div>
        </div>
      </section>

      {/* 6. MOBILE APP COMING SOON (SIMPLIFIED VERSION) */}
      <section className="mx-auto max-w-4xl w-full px-4 py-12 text-center">
        <div className="premium-glass-card p-8 rounded-[24px] relative shadow-2xl border border-cyan-200 dark:border-white/10 overflow-hidden">
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />
          
          <h3 className="font-staatliches text-3xl sm:text-4xl text-[#0A1A2A] dark:text-white tracking-widest uppercase mb-2">
            SHITMARKET MOBILE APP
          </h3>
          <span className="font-mono text-xs text-[#00796B] dark:text-neon-moon font-extrabold uppercase tracking-widest bg-cyan-50 dark:bg-trench-black border border-cyan-200 dark:border-neon-moon/40 px-3.5 py-1 rounded-full inline-block mb-8 animate-pulse">
            COMING SOON
          </span>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 max-w-md mx-auto">
            <div className="w-56 p-3 bg-white dark:bg-trench-black border border-cyan-200 dark:border-trench-sandbag rounded-xl shadow-lg hover:scale-105 transition-all duration-300">
              <img
                src="/pepes/app_store_badges.png"
                alt="App Store and Google Play Download badges"
                className="w-full h-auto object-contain rounded-md"
              />
            </div>
          </div>
        </div>
      </section>

      {/* 6. WAR PROPAGANDA GALLERY */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <div className="premium-glass-card p-8 rounded-[24px] relative shadow-2xl border border-cyan-200 dark:border-white/10">
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white dark:bg-black/60 backdrop-blur-md border border-cyan-200 dark:border-white/15 text-[#0A1A2A] dark:text-white px-6 py-1.5 rounded-full font-mono text-[10px] tracking-widest shadow-lg uppercase font-bold">
            🎖️ PROPAGANDA GALLERY 🎖️
          </div>
          <h3 className="font-staatliches text-2xl text-[#0A1A2A] dark:text-white tracking-wider mb-6 mt-2 text-center uppercase">
            DISPATCHES FROM THE FRONTLINE
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <WarPropaganda
              src={PEPE_ASSETS.moonJuice}
              caption="MOON JUICE RATION CRATE"
              subcaption="Drink up soldier. Green candles fuel the war machine."
              glowColor="moon"
            />
            <WarPropaganda
              src={PEPE_ASSETS.cryptoBunker}
              caption="THE CRYPTO BUNKER"
              subcaption="Where real alpha is analyzed. Ammo crates and charts only."
              glowColor="gold"
            />
            <WarPropaganda
              src={PEPE_ASSETS.apeGeneral}
              caption="APE GENERAL'S ORDERS"
              subcaption="Smoke cigar. Read chart. Ape in. Simple as."
              glowColor="moon"
            />
            <WarPropaganda
              src={PEPE_ASSETS.diamondHands}
              caption="DIAMOND HANDS DIVISION"
              subcaption="Trench warfare specialist. Never sells. Never yields."
              glowColor="gold"
            />
            <WarPropaganda
              src={PEPE_ASSETS.jeetSkeleton}
              caption="JEET SKELETON OPS"
              subcaption="Every dump has a bag holder. Don't let it be you."
              glowColor="jeet"
            />
            <WarPropaganda
              src={PEPE_ASSETS.neonWojak}
              caption="NEON WOJAK RECON"
              subcaption="Eyes glowing. Night vision activated. Scouting dumps."
              glowColor="jeet"
            />
          </div>
        </div>
      </section>

      {/* 7. BARBED WIRE BREAK */}
      <div className="w-full overflow-hidden my-4">
        <PixelBarbedWire height={16} />
      </div>

    </main>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-[#071105] flex flex-col items-center justify-center font-mono text-yellow-400 gap-2">
        <div className="w-8 h-8 border-4 border-yellow-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs uppercase tracking-widest font-bold">Loading Frontline Comms...</span>
      </div>
    }>
      <HomeContent />
    </React.Suspense>
  );
}
