'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { PixelBarbedWire } from '@/components/PixelArt';
import { useAppState, Room, formatPrice } from '@/store/useAppState';
import { PEPE_ASSETS, PepePortrait, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';
import { Flame, Zap, Target, Bookmark, Layers } from 'lucide-react';
import { MarketGridCard } from '@/components/MarketGridCard';

function HomeContent() {
  const { isPaused, rooms, parlayCart, addLegToParlay, removeLegFromParlay } = useAppState();
  const [activeTab, setActiveTab] = React.useState<'latest' | 'biggest' | 'expire'>('latest');
  const [mounted, setMounted] = React.useState(false);
  const [watchlistedIds, setWatchlistedIds] = React.useState<string[]>([]);

  React.useEffect(() => {
    setMounted(true);
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

  React.useEffect(() => {
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
              <button className="uiverse-cyber-btn uiverse-cyber-btn-green w-full h-[53px] font-sans font-bold uppercase tracking-wider text-white shadow-lg">ENTER ARENA</button>
            </Link>
            {mounted && !isPaused && (
              <Link href="/create-room" className="w-full sm:w-80">
                <button className="uiverse-cyber-btn uiverse-cyber-btn-gray w-full h-[53px] font-sans font-bold uppercase tracking-wider text-slate-900 dark:text-white shadow-md">CREATE MARKET</button>
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-6 pb-4">
          {mounted ? (
            trendingRooms.slice(0, 12).map(room => (
              <MarketGridCard 
                key={room.id} 
                room={room} 
                watchlistedIds={watchlistedIds}
                toggleBookmark={toggleBookmark}
                parlayCart={parlayCart}
                addLegToParlay={addLegToParlay}
                removeLegFromParlay={removeLegFromParlay}
                quickAmount={10}
              />
            ))
          ) : (
            <div className="w-72 h-[260px] bg-slate-100 dark:bg-slate-900/40 animate-pulse rounded-2xl shrink-0" />
          )}
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

          {mounted ? (
            (() => {
              const currentList = activeTab === 'latest' ? latestRooms : activeTab === 'biggest' ? biggestPotRooms : soonToExpireRooms;
              return currentList.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
                  {currentList.map((room) => (
                    <MarketGridCard 
                      key={room.id} 
                      room={room} 
                      watchlistedIds={watchlistedIds}
                      toggleBookmark={toggleBookmark}
                      parlayCart={parlayCart}
                      addLegToParlay={addLegToParlay}
                      removeLegFromParlay={removeLegFromParlay}
                      quickAmount={10}
                    />
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 font-mono text-xs text-slate-400 uppercase font-bold border border-slate-200 dark:border-slate-800 rounded-2xl bg-slate-50/50 dark:bg-slate-950/50">
                  <p>Awaiting deployment of prediction sectors...</p>
                </div>
              );
            })()
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-[230px] bg-slate-100 dark:bg-slate-900/40 animate-pulse rounded-2xl" />
              ))}
            </div>
          )}
        </div>
      </section>

      <section className="w-full py-16 bg-black text-center relative z-10 flex flex-col items-center justify-center">
        <div className="px-8 py-3 rounded-full bg-[#E3FCFE] border-2 border-[#54E6F4] text-[#004B4C] font-mono text-base font-extrabold uppercase tracking-widest shadow-[0_0_15px_rgba(84,230,244,0.3)] inline-block mb-8">
          COMING SOON
        </div>

        <div className="bg-white rounded-[28px] border-[10px] border-white/20 p-6 md:p-8 max-w-md w-full mx-auto shadow-2xl flex items-center justify-center gap-4">
          <div className="flex items-center gap-2.5 bg-black text-white px-4 py-2.5 rounded-xl cursor-not-allowed select-none transition-all shadow-md w-1/2 justify-center">
            <svg className="w-5 h-5 shrink-0" viewBox="0 0 24 24">
              <path fill="#EA4335" d="M5.2,2.2c-0.2,0.2-0.3,0.5-0.3,0.9v17.8c0,0.4,0.1,0.7,0.3,0.9l0.1,0.1L15.3,12l-10-10L5.2,2.2z" />
              <path fill="#FBBC05" d="M18.6,15.3l-3.3-3.3L15.3,12l3.3-3.3L18.6,8.7L22.4,11c1.1,0.6,1.1,1.5,0,2.1L18.6,15.3z" />
              <path fill="#34A853" d="M15.3,12L5.3,22c0.3,0.3,0.8,0.3,1.3,0l12-6.8L15.3,12z" />
              <path fill="#4285F4" d="M15.3,12L18.6,8.7L6.6,1.9C6.1,1.6,5.6,1.6,5.3,1.9L15.3,12z" />
            </svg>
            <div className="text-left leading-none shrink-0">
              <p className="text-[7px] text-gray-400 font-sans uppercase font-extrabold tracking-wide">GET IT ON</p>
              <p className="text-[11px] text-white font-sans font-black tracking-tight mt-0.5">Google Play</p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 bg-black text-white px-4 py-2.5 rounded-xl cursor-not-allowed select-none transition-all shadow-md w-1/2 justify-center">
            <svg className="w-5 h-5 fill-current text-white shrink-0" viewBox="0 0 24 24">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 4.17c.66-.81 1.11-1.93.99-3.06-1 .04-2.21.67-2.93 1.49-.62.69-1.16 1.84-1.01 2.96 1.12.09 2.27-.58 2.95-1.39z"/>
            </svg>
            <div className="text-left leading-none shrink-0">
              <p className="text-[7px] text-gray-400 font-sans uppercase font-extrabold tracking-wide">Download on the</p>
              <p className="text-[11px] text-white font-sans font-black tracking-tight mt-0.5">App Store</p>
            </div>
          </div>
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
