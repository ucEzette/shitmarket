'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { PixelBarbedWire } from '@/components/PixelArt';
import { useAppState } from '@/store/useAppState';
import { PEPE_ASSETS, DegenQuoteBanner, PepePortrait, WarPropaganda, MascotRow } from '@/components/MemeAssets';
import { IntroScreen } from '@/components/IntroScreen';
import { FloatingCoins } from '@/components/FloatingCoins';
import { Flame, ShieldAlert, Award, ArrowUpRight, Zap, Target, Users, Swords, Skull, Rocket, Smartphone, Bell } from 'lucide-react';

function HomeContent() {
  const { leaderboard, isPaused } = useAppState();
  const [showIntro, setShowIntro] = React.useState(true);
  const searchParams = useSearchParams();

  React.useEffect(() => {
    if (searchParams && searchParams.get('play_intro') === 'true') {
      sessionStorage.removeItem('intro_played');
      setShowIntro(true);
      
      // Clean up the query parameter to avoid looping on refreshes
      const url = new URL(window.location.href);
      url.searchParams.delete('play_intro');
      window.history.replaceState({}, '', url.toString());
    } else if (sessionStorage.getItem('intro_played')) {
      setShowIntro(false);
    }
  }, [searchParams]);

  const handleIntroComplete = () => {
    sessionStorage.setItem('intro_played', 'true');
    setShowIntro(false);
  };

  // Combine top leaderboard profiles to showcase a mixed 'War Heroes' list
  const topHeroes = [
    {
      name: leaderboard?.moon?.[0]?.name || 'TBD',
      profit: leaderboard?.moon?.[0]?.profit ?? 0,
      winRate: leaderboard?.moon?.[0]?.winRate ?? 0,
      type: 'MOON FIGHTER',
      color: 'text-neon-moon border-neon-moon/40',
      pepe: PEPE_ASSETS.chadBull
    },
    {
      name: leaderboard?.jeet?.[0]?.name || 'TBD',
      profit: leaderboard?.jeet?.[0]?.profit ?? 0,
      winRate: leaderboard?.jeet?.[0]?.winRate ?? 0,
      type: 'JEET SNIPER',
      color: 'text-jeet-red border-jeet-red/40',
      pepe: PEPE_ASSETS.jeetSkeleton
    },
    {
      name: leaderboard?.moon?.[1]?.name || 'TBD',
      profit: leaderboard?.moon?.[1]?.profit ?? 0,
      winRate: leaderboard?.moon?.[1]?.winRate ?? 0,
      type: 'MOON FIGHTER',
      color: 'text-neon-moon border-neon-moon/40',
      pepe: PEPE_ASSETS.apeGeneral
    },
    {
      name: leaderboard?.jeet?.[1]?.name || 'TBD',
      profit: leaderboard?.jeet?.[1]?.profit ?? 0,
      winRate: leaderboard?.jeet?.[1]?.winRate ?? 0,
      type: 'JEET SNIPER',
      color: 'text-jeet-red border-jeet-red/40',
      pepe: PEPE_ASSETS.neonWojak
    },
  ];

  if (showIntro) {
    return <IntroScreen onComplete={handleIntroComplete} />;
  }

  return (
    <div className="relative flex flex-col w-full overflow-hidden select-none">

      {/* 1. HERO SECTION — PVP ARENA */}
      <section className="relative w-full py-20 md:py-28 border-b border-cyan-200 dark:border-white/10 overflow-hidden min-h-[750px] flex items-center justify-center bg-[#A8EEFF] dark:bg-[#07080d] transition-colors duration-200">
        {/* Splitscreen Battlefield Background */}
        <div className="absolute inset-0 z-0 flex w-full h-full">
          {/* Left Side: Bullish Trench */}
          <div className="w-1/2 h-full relative overflow-hidden border-r border-[#193012]/30">
            <img 
              alt="Moon Army Charging" 
              className="w-full h-full object-cover opacity-20 filter sepia saturate-[250%] hue-rotate-[85deg] contrast-[1.1]" 
              src={PEPE_ASSETS.moonJuice}
            />
            <div className="absolute inset-0 bg-gradient-to-r from-[#A8EEFF] dark:from-[#07080d] via-[#A8EEFF]/35 dark:via-[#07080d]/35 to-transparent"></div>
            <div className="absolute inset-0 bg-teal-600/5 dark:bg-neon-moon/5 mix-blend-color pointer-events-none"></div>
            <div className="absolute bottom-6 left-6 font-mono text-[9px] text-[#00796B]/40 dark:text-neon-moon/20 font-bold uppercase tracking-widest pointer-events-none hidden md:block">
              BULLISH TRENCH // REGION A
            </div>
          </div>

          {/* Right Side: Bearish Wasteland */}
          <div className="w-1/2 h-full relative overflow-hidden">
            <img 
              alt="Jeet Skeleton Forces" 
              className="w-full h-full object-cover opacity-20 filter sepia saturate-[300%] hue-rotate-[320deg] contrast-[1.1]" 
              src={PEPE_ASSETS.jeetSkeleton}
            />
            <div className="absolute inset-0 bg-gradient-to-l from-[#A8EEFF] dark:from-[#07080d] via-[#A8EEFF]/35 dark:via-[#07080d]/35 to-transparent"></div>
            <div className="absolute inset-0 bg-red-600/5 dark:bg-jeet-red/5 mix-blend-color pointer-events-none"></div>
            <div className="absolute bottom-6 right-6 font-mono text-[9px] text-red-600/40 dark:text-jeet-red/20 font-bold uppercase tracking-widest pointer-events-none hidden md:block text-right">
              BEARISH WASTELAND // REGION B
            </div>
          </div>
        </div>

        {/* Center Divider Line */}
        <div className="absolute left-1/2 top-0 bottom-0 -translate-x-1/2 w-[1px] bg-gradient-to-b from-transparent via-cyan-300 dark:via-[#5c5244]/40 to-transparent z-10 hidden lg:block" />

        {/* Atmospheric Overlays */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#A8EEFF_90%)] dark:bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#07080d_90%)] pointer-events-none" />
        <div className="absolute inset-0 z-0 portal-glow pointer-events-none" />
        
        {/* Floating Coins Layer */}
        <FloatingCoins />

        <div className="mx-auto max-w-7xl px-4 flex flex-col items-center justify-center relative z-10 w-full">
          {/* Main Title Heading */}
          <motion.h1
            initial={{ y: -30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className="font-staatliches text-4xl sm:text-6xl md:text-7xl leading-none text-[#0A1A2A] dark:text-white tracking-widest text-center mb-4 drop-shadow-[0_2px_8px_rgba(0,0,0,0.1)] dark:drop-shadow-[0_2px_8px_rgba(0,0,0,0.8)]"
          >
            PICK A SIDE. <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#00796B] to-emerald-600 dark:from-neon-moon dark:to-emerald-400">BET THE TRENCH.</span>
          </motion.h1>
          <motion.h2
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
            className="text-sm sm:text-base md:text-lg font-mono uppercase tracking-[0.35em] text-[#2C3E50] dark:text-white text-center mb-10 font-bold"
          >
            permissionless pvp prediction markets
          </motion.h2>

          {/* Centered Premium Dynamic Battle Arena Splitscreen Card */}
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
            className="w-full max-w-2xl px-4 mt-6 flex justify-center"
          >
            <div className="w-full premium-glass-card rounded-[20px] overflow-hidden p-2 md:p-2.5 shadow-2xl border border-cyan-200 dark:border-trench-sandbag/45 relative dark:scanlines group">
              {/* Decorative corner rivets */}
              <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />
              <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />
              <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />
              <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-cyan-200 dark:bg-trench-black border border-cyan-300 dark:border-trench-sandbag/30 z-20" />

              {/* Video Banner Container */}
              <div className="relative overflow-hidden w-full aspect-video rounded-xl border border-cyan-200 dark:border-trench-sandbag/30 bg-black/60 shadow-inner">
                <video
                  src="/pepes/Chad_soldiers_and_Wojak_soldier_202606070100.mp4"
                  autoPlay
                  loop
                  muted
                  playsInline
                  className="w-full h-full object-cover opacity-90"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-[#16A34A]/5 mix-blend-color pointer-events-none" />
              </div>
            </div>
          </motion.div>


          {/* Bottom CTA Buttons */}
          <motion.div
            initial={{ y: 30, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: 0.7, ease: 'easeOut', delay: 0.45 }}
            className="mt-14 sm:mt-16 flex flex-col sm:flex-row gap-6 justify-center items-center w-full max-w-4xl"
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
        {/* Ticker side-faders */}
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


      {/* 3. MASCOT PARADE / CHARACTER LINEUP */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <div className="premium-glass-card p-8 rounded-[24px] relative shadow-2xl border border-cyan-200 dark:border-white/10">
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white dark:bg-black/60 backdrop-blur-md border border-cyan-200 dark:border-white/15 text-[#0A1A2A] dark:text-white px-6 py-1.5 rounded-full font-mono text-[10px] tracking-widest shadow-lg uppercase font-bold">
            THE TRENCH COMMANDERS
          </div>
          <h3 className="font-staatliches text-2xl text-[#0A1A2A] dark:text-white tracking-wider mb-4 mt-2 text-center uppercase">
            MEET YOUR BATTLE COMPANIONS
          </h3>
          <MascotRow />
        </div>
      </section>

      {/* 4. DOUBLE PLANK FEATURES (HOW IT WORKS & RECENT WAR LEADERS) */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* Left Column: Blueprint Guide */}
        <div className="premium-glass-card p-8 rounded-[24px] shadow-2xl relative border border-cyan-200 dark:border-white/10">
          {/* Clipboard binder clip */}
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white dark:bg-black/60 backdrop-blur-md border border-cyan-200 dark:border-white/15 text-[#0A1A2A] dark:text-white px-6 py-1.5 rounded-full font-mono text-[10px] tracking-widest shadow-lg uppercase font-bold">
            OPERATIONAL PROTOCOLS
          </div>

          <h3 className="font-staatliches text-3xl text-[#0A1A2A] dark:text-white tracking-wider mb-6 mt-2 flex items-center gap-2">
            <Users className="text-[#00796B] dark:text-neon-moon" />
            HOW TO FIGHT THE TRENCHES
          </h3>

          <div className="space-y-6 font-mono text-sm text-slate-700 dark:text-trench-gasmask">

            <div className="flex gap-4 items-start">
              <PepePortrait src={PEPE_ASSETS.cryptoBunker} size={48} glowColor="moon" className="rounded shrink-0" />
              <div>
                <h4 className="text-[#0A1A2A] dark:text-white font-bold uppercase text-base flex items-center gap-1.5">
                  <Rocket size={14} className="text-[#00796B] dark:text-neon-moon" /> Select Your Combat Arena
                </h4>
                <p className="mt-1">
                  Navigate to the <span className="text-[#00796B] dark:text-neon-moon font-bold">WAR TABLE</span>. Scan the active trenches dug for tokens. Monitor their pools, volume, and the decaying mission countdown.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={48} glowColor="gold" className="rounded shrink-0" />
              <div>
                <h4 className="text-[#0A1A2A] dark:text-white font-bold uppercase text-base flex items-center gap-1.5">
                  <Swords size={14} className="text-[#C62828] dark:text-jeet-red" /> Choose Your Alignment
                </h4>
                <p className="mt-1">
                  Stake your <span className="text-amber-700 dark:text-moon-gold font-bold">Ammo SOL</span> on either the <span className="text-[#00796B] dark:text-neon-moon font-bold">MOON</span> army (betting the token will pump) or the <span className="text-[#C62828] dark:text-jeet-red font-bold">JEET</span> army (betting the token will dump).
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <PepePortrait src={PEPE_ASSETS.moonJuice} size={48} glowColor="gold" className="rounded shrink-0" />
              <div>
                <h4 className="text-[#0A1A2A] dark:text-white font-bold uppercase text-base flex items-center gap-1.5">
                  <Award size={14} className="text-amber-700 dark:text-moon-gold" /> Claim Booty & Collect Medals
                </h4>
                <p className="mt-1">
                  Once the countdown bomb detonates, the room settles. The winning army takes the entire losing army&apos;s pool (minus a flat 1.25% HQ fee) divided proportionally.
                </p>
              </div>
            </div>

          </div>

          <div className="mt-8 p-4 bg-cyan-50/80 dark:bg-black/40 border border-cyan-200 dark:border-white/10 rounded-xl flex items-center gap-3">
            <ShieldAlert size={20} className="text-amber-700 dark:text-moon-gold animate-pulse shrink-0" />
            <p className="text-[11px] text-slate-700 dark:text-trench-gasmask uppercase leading-tight font-bold">
              Platform is fully decentralizable and zero-slippage. Settled rooms execute completely peer-to-peer.
            </p>
          </div>
        </div>

        {/* Right Column: Top Winners Leaderboard */}
        <div className="premium-glass-card p-8 rounded-[24px] shadow-2xl relative border border-cyan-200 dark:border-white/10">
          {/* Clip */}
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white dark:bg-black/60 backdrop-blur-md border border-cyan-200 dark:border-white/15 text-[#0A1A2A] dark:text-white px-6 py-1.5 rounded-full font-mono text-[10px] tracking-widest shadow-lg uppercase font-bold">
            FRONT-LINE DECORATIONS
          </div>

          <div className="flex items-center justify-between mb-6 mt-2">
            <h3 className="font-staatliches text-3xl text-[#0A1A2A] dark:text-white tracking-wider flex items-center gap-2">
              <Award className="text-amber-700 dark:text-moon-gold" />
              TRENCH HEROES
            </h3>
            <Link href="/leaderboard" className="font-mono text-xs text-[#00796B] dark:text-neon-moon hover:underline uppercase font-bold flex items-center gap-0.5">
              Full List <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Leaders Board Grid */}
          <div className="space-y-3">
            {topHeroes.map((hero, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3.5 bg-cyan-50/70 dark:bg-trench-black/80 border-l-4 rounded border border-cyan-200 dark:border-trench-sandbag/60 hover:bg-cyan-100 dark:hover:bg-trench-black transition-all"
              >
                <div className="flex items-center gap-3">
                  <PepePortrait
                    src={hero.pepe}
                    size={40}
                    glowColor={index % 2 === 0 ? 'moon' : 'jeet'}
                    className="rounded-full"
                  />
                  <div>
                    <span className="font-mono text-sm font-bold text-[#0A1A2A] dark:text-white block">
                      {hero.name}
                    </span>
                    <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-white dark:bg-trench-mud border ${hero.color}`}>
                      {hero.type}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-staatliches text-xl text-amber-700 dark:text-moon-gold block leading-none">
                    +{hero.profit.toFixed(2)} SOL
                  </span>
                  <span className="font-mono text-[10px] text-slate-500 dark:text-trench-gasmask uppercase font-bold">
                    WIN RATE: {hero.winRate}%
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Degen quote banner */}
          <div className="mt-6">
            <DegenQuoteBanner />
          </div>
        </div>

      </section>

      {/* 4.5 MOBILE APP COMING SOON */}
      <section className="mx-auto max-w-7xl w-full px-4 py-6">
        <div className="premium-glass-card p-6 md:p-8 rounded-[24px] relative shadow-2xl border border-cyan-200 dark:border-white/10 overflow-hidden group">
          {/* Header Badge */}
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white dark:bg-black/60 backdrop-blur-md border border-cyan-200 dark:border-white/15 text-[#0A1A2A] dark:text-white px-6 py-1.5 rounded-full font-mono text-[10px] tracking-widest shadow-lg uppercase font-bold z-10 flex items-center gap-1.5">
            <Smartphone size={10} className="text-[#00796B] dark:text-neon-moon" />
            <span>MOBILE OPERATIONS HQ</span>
          </div>

          {/* Glowing background effects */}
          <div className="absolute -right-24 -bottom-24 w-96 h-96 bg-[#00796B]/10 dark:bg-neon-moon/10 rounded-full blur-[80px] pointer-events-none group-hover:bg-[#00796B]/15 dark:group-hover:bg-neon-moon/15 transition-all duration-700" />
          <div className="absolute -left-24 -top-24 w-96 h-96 bg-[#C62828]/5 dark:bg-jeet-red/5 rounded-full blur-[80px] pointer-events-none" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center relative z-10">
            {/* Text description (Left Column) */}
            <div className="lg:col-span-7 space-y-4 text-center lg:text-left">
              <h3 className="font-staatliches text-3xl sm:text-4xl text-[#0A1A2A] dark:text-white tracking-wider uppercase leading-none">
                SHITMARKET <span className="text-[#00796B] dark:text-neon-moon">MOBILE CLIENT</span>
              </h3>
              <p className="font-mono text-xs sm:text-sm text-slate-700 dark:text-trench-gasmask leading-relaxed max-w-2xl mx-auto lg:mx-0">
                Deploy, monitor, and bet on meme trenches directly from your pocket. The upcoming ShitMarket mobile application brings decentralized PvP warfare to iOS and Android with premium UI, instant execution, and zero compromise.
              </p>
              
              {/* Feature Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 text-left">
                <div className="bg-cyan-50/70 dark:bg-trench-black/45 border border-cyan-200 dark:border-trench-sandbag/40 rounded-xl p-3 hover:border-[#00796B]/55 dark:hover:border-neon-moon/55 transition-all duration-300">
                  <span className="font-staatliches text-sm text-[#00796B] dark:text-neon-moon block mb-1 flex items-center gap-1 font-bold">
                    <Zap size={12} /> NATIVE SPEED
                  </span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-trench-gasmask/90 leading-normal block">
                    Zero-lag React Native core engineered for real-time Solana indexing.
                  </span>
                </div>
                <div className="bg-cyan-50/70 dark:bg-trench-black/45 border border-cyan-200 dark:border-trench-sandbag/40 rounded-xl p-3 hover:border-[#00796B]/55 dark:hover:border-neon-moon/55 transition-all duration-300">
                  <span className="font-staatliches text-sm text-amber-700 dark:text-moon-gold block mb-1 flex items-center gap-1 font-bold">
                    <Bell size={12} /> COMMS FEED
                  </span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-trench-gasmask/90 leading-normal block">
                    Push alerts for target settlements, parlay triggers, and new arenas.
                  </span>
                </div>
                <div className="bg-cyan-50/70 dark:bg-trench-black/45 border border-cyan-200 dark:border-trench-sandbag/40 rounded-xl p-3 hover:border-[#00796B]/55 dark:hover:border-neon-moon/55 transition-all duration-300">
                  <span className="font-staatliches text-sm text-[#C62828] dark:text-jeet-red block mb-1 flex items-center gap-1 font-bold">
                    <ShieldAlert size={12} /> BIO SECURITY
                  </span>
                  <span className="font-mono text-[10px] text-slate-600 dark:text-trench-gasmask/90 leading-normal block">
                    Biometric authentication and local key encryption for bulletproof security.
                  </span>
                </div>
              </div>
            </div>

            {/* Badges Image (Right Column) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center gap-4 text-center">
              <div className="bg-cyan-50 dark:bg-trench-mud border border-cyan-200 dark:border-trench-sandbag/40 rounded-full px-4 py-1.5 shadow-sm dark:shadow-md">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#00796B] dark:bg-neon-moon animate-pulse" />
                  <span className="font-mono text-[10px] text-[#00796B] dark:text-neon-moon font-extrabold uppercase tracking-widest">
                    DEPLOYMENT IN PROGRESS • COMING SOON
                  </span>
                </div>
              </div>

              {/* Badge container with stylish glass wrap */}
              <div className="p-2 bg-white dark:bg-trench-black border-2 border-cyan-200 dark:border-trench-sandbag rounded-xl shadow-xl dark:shadow-2xl overflow-hidden max-w-sm relative group/badge">
                <div className="absolute inset-0 bg-gradient-to-tr from-[#00796B]/10 dark:from-neon-moon/10 to-transparent opacity-0 group-hover/badge:opacity-100 transition-opacity duration-500 pointer-events-none" />
                <img
                  src="/pepes/app_store_badges.png"
                  alt="Download ShitMarket mobile on Google Play & App Store - Coming Soon"
                  className="w-full h-auto object-contain rounded-md relative z-10 hover:scale-[1.02] transition-transform duration-300"
                />
              </div>
              <span className="font-mono text-[9px] text-slate-500 dark:text-trench-gasmask uppercase font-semibold">
                compatible with ios 15+ and android 10+
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* 5. WAR PROPAGANDA GALLERY */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <div className="premium-glass-card p-8 rounded-[24px] relative shadow-2xl border border-cyan-200 dark:border-white/10">
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white dark:bg-black/60 backdrop-blur-md border border-cyan-200 dark:border-white/15 text-[#0A1A2A] dark:text-white px-6 py-1.5 rounded-full font-mono text-[10px] tracking-widest shadow-lg uppercase font-bold">
            🎖️ WAR PROPAGANDA 🎖️
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

      {/* 6. BARBED WIRE BREAK */}
      <div className="w-full overflow-hidden my-4">
        <PixelBarbedWire height={16} />
      </div>

    </div>
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
