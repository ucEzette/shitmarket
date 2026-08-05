'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PixelBarbedWire } from '@/components/PixelArt';
import { useAppState, Room, formatPrice } from '@/store/useAppState';
import { PEPE_ASSETS } from '@/components/MemeAssets';
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
      className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 flex flex-col justify-between cursor-pointer hover:border-emerald-500 transition-all select-none w-72 h-48 shrink-0 snap-start"
    >
      <div>
        <span className="font-mono text-[9px] text-slate-500 uppercase tracking-wider block">
          {room.token.name}
        </span>
        <h4 className="font-sans font-bold text-sm text-slate-900 dark:text-white line-clamp-2 mt-1 leading-snug">
          Will {room.token.symbol.toUpperCase()} end above {room.openingPrice !== undefined ? `$${formatPrice(room.openingPrice)}` : '$1.00'}?
        </h4>
      </div>

      <div className="space-y-1.5 my-3">
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-xs font-bold text-emerald-500">🚀 MOON</span>
          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{moonPercentage.toFixed(0)}%</span>
        </div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">💀 JEET</span>
          <span className="font-bold text-xs text-slate-900 dark:text-slate-100">{jeetPercentage.toFixed(0)}%</span>
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 dark:border-slate-800 pt-3 mt-auto text-[10px] font-mono text-slate-600 dark:text-slate-400">
        <span className="font-bold text-emerald-600 dark:text-emerald-500 uppercase">
          POT: {totalPot.toFixed(2)} USDC
        </span>
        <span className="font-bold text-red-500 flex items-center gap-1">
          ⏳ <RoomCountdown expiry={room.expiry} />
        </span>
      </div>
    </div>
  );
};

function HomeContent() {
  const { isPaused, rooms } = useAppState();
  const [activeTab, setActiveTab] = React.useState<'latest' | 'biggest' | 'expire'>('latest');
  const [mounted, setMounted] = React.useState(false);

  React.useEffect(() => {
    setMounted(true);
  }, []);

  const allRooms = rooms || [];
  
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
    <div className="relative flex flex-col w-full overflow-hidden select-none">

      <section className="relative w-full py-16 md:py-20 border-b border-[var(--border-color)] overflow-hidden min-h-[550px] flex items-center justify-center bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <div className="absolute inset-0 z-0 flex w-full h-full">
          <div className="w-1/2 h-full relative overflow-hidden border-r border-slate-200 dark:border-slate-800/60">
            <img alt="Moon Army" className="w-full h-full object-cover opacity-10 filter sepia saturate-[250%] hue-rotate-[85deg]" src={PEPE_ASSETS.moonJuice} />
            <div className="absolute inset-0 bg-gradient-to-r from-slate-50 dark:from-slate-950 via-transparent to-transparent"></div>
          </div>
          <div className="w-1/2 h-full relative overflow-hidden">
            <img alt="Jeet Forces" className="w-full h-full object-cover opacity-10 filter sepia saturate-[300%] hue-rotate-[320deg]" src={PEPE_ASSETS.jeetSkeleton} />
            <div className="absolute inset-0 bg-gradient-to-l from-slate-50 dark:from-slate-950 via-transparent to-transparent"></div>
          </div>
        </div>

        <div className="mx-auto max-w-7xl px-4 flex flex-col items-center justify-center relative z-10 w-full">
          <motion.h1 initial={{ y: -30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="font-sans text-4xl sm:text-6xl md:text-7xl font-extrabold text-center mb-4 text-slate-900 dark:text-white">
            PICK A SIDE. <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-500 to-teal-400">SPECULATE THE TRENCH.</span>
          </motion.h1>
          
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="w-full max-w-4xl px-4 mt-2 flex justify-center">
            <div className="w-full bg-slate-900/40 rounded-[20px] overflow-hidden p-2 shadow-2xl border border-slate-200 dark:border-slate-800 relative group">
              <div className="relative overflow-hidden w-full aspect-[3/1] rounded-xl border border-slate-200 dark:border-slate-800 bg-black/60 shadow-inner">
                {mounted && (
                  <video
                    src="/pepes/Chad_soldiers_and_Wojak_soldier_202606070100.mp4"
                    autoPlay
                    loop
                    muted
                    preload="none"
                    playsInline
                    className="w-full h-full object-cover opacity-90"
                  />
                )}
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
              </div>
            </div>
          </motion.div>

          <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="mt-10 flex flex-col sm:flex-row gap-6 justify-center items-center w-full max-w-4xl">
            <Link href="/rooms" className="w-full sm:w-80">
              <button className="w-full py-4 font-mono text-sm uppercase tracking-wider text-white bg-emerald-500 hover:bg-emerald-600 font-extrabold rounded-xl shadow-lg shadow-emerald-500/20">ENTER ARENA</button>
            </Link>
            {!isPaused && (
              <Link href="/create-room" className="w-full sm:w-80">
                <button className="w-full py-4 font-mono text-sm uppercase tracking-wider text-slate-900 dark:text-white bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 font-extrabold rounded-xl border border-slate-300 dark:border-slate-700">CREATE MARKET</button>
              </Link>
            )}
          </motion.div>
        </div>
      </section>

      <div className="w-full bg-emerald-500/5 dark:bg-slate-900/50 border-b border-[var(--border-color)] py-3 overflow-hidden font-mono select-none">
        <div className="flex whitespace-nowrap animate-marquee gap-8">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex gap-8 items-center shrink-0">
              <span className="flex items-center gap-1.5 text-emerald-500"><Zap size={12} />COMMANDER STAKED 1.5 SOL ON $BONK → MOON 🚀</span>
              <span className="text-slate-400 dark:text-trench-gasmask">•</span>
              <span className="flex items-center gap-1.5 text-red-500"><Target size={12} />DEGEN JEETED 3.0 SOL ON $PEPE5 → JEET (BEAR)</span>
              <span className="text-slate-400 dark:text-trench-gasmask">•</span>
            </div>
          ))}
        </div>
      </div>

      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <h3 className="font-sans text-2xl font-extrabold text-slate-900 dark:text-white mb-6 uppercase tracking-tight flex items-center gap-2">
          <Flame className="text-emerald-500" /> Trending
        </h3>
        <div className="flex overflow-x-auto gap-6 pb-4 scrollbar-none snap-x">
          {trendingRooms.map(room => <HomepageRoomCard key={room.id} room={room} />)}
        </div>
      </section>

      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <div className="bg-white dark:bg-slate-900/60 border border-slate-200 dark:border-slate-800 rounded-[24px] overflow-hidden p-6 shadow-xl">
          <div className="flex border-b border-slate-200 dark:border-slate-800 mb-8">
            {['latest', 'biggest', 'expire'].map((tab) => (
              <button key={tab} onClick={() => setActiveTab(tab as any)} className={`px-6 py-4 font-mono text-xs uppercase font-bold border-b-2 ${activeTab === tab ? 'border-emerald-500 text-emerald-500' : 'border-transparent text-slate-500'}`}>
                {tab} Markets
              </button>
            ))}
          </div>

          {(() => {
            const currentList = activeTab === 'latest' ? latestRooms : activeTab === 'biggest' ? biggestPotRooms : soonToExpireRooms;
            return currentList.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                {currentList.map((room) => <HomepageRoomCard key={room.id} room={room} />)}
              </div>
            ) : (
              <div className="text-center py-20 font-mono text-xs text-slate-400 uppercase font-bold border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50">
                <p>Awaiting deployment of prediction sectors...</p>
              </div>
            );
          })()}
        </div>
      </section>

      <section className="mx-auto max-w-7xl w-full px-4 py-12 text-center relative z-10">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-[24px] p-8 shadow-xl max-w-2xl mx-auto">
          <h3 className="font-sans text-2xl font-extrabold text-slate-900 dark:text-white uppercase mb-2">DOWNLOAD MOBILE COMPANION</h3>
          <p className="font-mono text-xs text-slate-500 dark:text-slate-400 uppercase font-bold mb-6">Monitor sectors and claim yields on the go.</p>
          <span className="font-mono text-xs text-emerald-500 font-extrabold uppercase bg-emerald-500/10 border border-emerald-500/30 px-3.5 py-1 rounded-full inline-block mb-8 animate-pulse">COMING SOON</span>
        </div>
      </section>

      <div className="w-full overflow-hidden my-4">
        <PixelBarbedWire height={16} />
      </div>
    </div>
  );
}

export default function Home() {
  return (
    <React.Suspense fallback={
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-center font-mono text-slate-500 gap-2">
        <div className="w-8 h-8 border-4 border-emerald-500 border-t-transparent rounded-full animate-spin"></div>
        <span className="text-xs uppercase tracking-widest font-bold">Loading...</span>
      </div>
    }>
      <HomeContent />
    </React.Suspense>
  );
}
