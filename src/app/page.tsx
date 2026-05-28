'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { PixelBarbedWire } from '@/components/PixelArt';
import { useAppState } from '@/store/useAppState';
import { PEPE_ASSETS, DegenQuoteBanner, PepePortrait, WarPropaganda, MascotRow } from '@/components/MemeAssets';
import { AgentKeyAlphaZone } from '@/components/AgentKeyAlphaZone';
import { IntroScreen } from '@/components/IntroScreen';
import { Flame, ShieldAlert, Award, ArrowUpRight, Zap, Target, Users, Swords, Skull, Rocket } from 'lucide-react';

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

      {/* 1. HERO SECTION — MASSIVE BATTLEFIELD PANORAMA */}
      <section className="relative w-full py-24 md:py-32 border-b border-white/10 overflow-hidden min-h-[700px] flex items-center justify-center">
        {/* Full battlefield scene */}
        <div className="absolute inset-0 z-0">
          <img
            alt="Meme Trench Battlefield with raining coins"
            className="w-full h-full object-cover opacity-30 mix-blend-luminosity"
            src={PEPE_ASSETS.battlefield}
          />
        </div>
        {/* Atmospheric Overlays */}
        <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_at_center,_transparent_0%,_#05050A_85%)] pointer-events-none" />
        <div className="absolute inset-0 z-0 bg-neon-moon/5 pointer-events-none" />

        <div className="mx-auto max-w-7xl px-4 flex flex-col items-center justify-between gap-12 relative z-10 w-full">

          {/* Main Battlefield Statue Visuals */}
          <div className="w-full flex items-center justify-around gap-4 flex-wrap md:flex-nowrap">

            {/* Chad Bull Statue (Moon Army) */}
            <motion.div
              initial={{ x: -80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', duration: 1.2 }}
              className="flex flex-col items-center text-center p-3 sm:p-6 retro-panel rounded-2xl max-w-[145px] sm:max-w-[200px] md:max-w-[240px] shrink-0"
            >
              <div className="relative mb-4">
                <div className="absolute -inset-2 rounded-full bg-neon-moon/20 blur-xl animate-pulse" />
                <PepePortrait src={PEPE_ASSETS.chadBull} glowColor="moon" animated className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full border-0" />
              </div>
              <span className="font-staatliches text-xs sm:text-base md:text-xl text-neon-moon tracking-wider uppercase glow-moon leading-tight">
                CHAD BULL GENERAL
              </span>
              <p className="font-mono text-[8px] sm:text-[10px] text-trench-gasmask mt-1 uppercase font-bold leading-normal">
                Commander of the MOON Forces. Stake SOL on the PUMP.
              </p>
            </motion.div>

            {/* Middle Combat Information Banner */}
            <div className="flex flex-col items-center text-center max-w-2xl px-4 flex-1 min-w-[280px]">
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="inline-flex items-center gap-1.5 px-3 py-1 bg-trench-mud border-2 border-trench-sandbag rounded-full mb-6 shadow"
              >
                <Flame size={14} className="text-moon-gold animate-bounce" />
                <span className="font-mono text-[10px] sm:text-xs font-bold text-moon-gold uppercase tracking-wider">
                  Meme Coin PvP Prediction Trenches
                </span>
              </motion.div>

              {/* Pepe mascot above headline */}
              <motion.div
                initial={{ y: -40, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.4, type: 'spring' }}
                className="mb-4"
              >
                <PepePortrait src={PEPE_ASSETS.fewUnderstand} glowColor="gold" animated className="w-12 h-12 sm:w-20 sm:h-20 rounded-xl mx-auto border-0" />
              </motion.div>

              <motion.h2
                initial={{ y: -20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.6 }}
                className="font-staatliches text-3xl sm:text-5xl md:text-7xl leading-none text-white tracking-wide stencil-shadow"
              >
                Pick a side.<br />
                <span className="text-neon-moon glow-moon">Bet the trench.</span><br />
                <span className="text-jeet-red glow-jeet text-base sm:text-lg md:text-2xl leading-none">It's not a rug if you never own the coin, big brain.</span>



              </motion.h2>

              <p className="font-mono text-[11px] sm:text-sm text-trench-gasmask mt-4 sm:mt-6 max-w-lg uppercase font-bold leading-relaxed">
                Bet on coin pumps (Moon) or dumps (Jeet) within short windows (5m, 15m, 60m). You never hold the actual token. You bet against other degens. Plat fee is 1.25%.
              </p>

              {/* Enter Trenches CTA Button */}
              <div className="mt-8 sm:mt-10 flex flex-col sm:flex-row gap-4 sm:gap-6 justify-center items-center w-full">
                <Link href="/rooms" className="w-full sm:w-auto">
                  <button className="w-full sm:w-72 px-8 py-3.5 sm:py-4 font-staatliches text-xl sm:text-2xl uppercase tracking-wider retro-btn retro-btn-moon text-black">
                    ENTER THE TRENCHES 💣
                  </button>
                </Link>
                {isPaused ? (
                  <button disabled className="w-full sm:w-72 px-8 py-3.5 sm:py-4 font-staatliches text-xl sm:text-2xl uppercase tracking-wider bg-gray-600 text-gray-300 rounded border-b-4 border-gray-800 opacity-50 cursor-not-allowed">
                    SYSTEM PAUSED ⛏️
                  </button>
                ) : (
                  <Link href="/create-room" className="w-full sm:w-auto">
                    <button className="w-full sm:w-72 px-8 py-3.5 sm:py-4 font-staatliches text-xl sm:text-2xl uppercase tracking-wider retro-btn retro-btn-neutral text-black">
                      DIG A TRENCH (CREATE) ⛏️
                    </button>
                  </Link>
                )}
              </div>
            </div>

            {/* Skeleton Jeet Statue (Jeet Army) */}
            <motion.div
              initial={{ x: 80, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              transition={{ type: 'spring', duration: 1.2 }}
              className="flex flex-col items-center text-center p-3 sm:p-6 retro-panel rounded-2xl max-w-[145px] sm:max-w-[200px] md:max-w-[240px] shrink-0"
            >
              <div className="relative mb-4">
                <div className="absolute -inset-2 rounded-full bg-jeet-red/20 blur-xl animate-pulse" />
                <PepePortrait src={PEPE_ASSETS.jeetSkeleton} glowColor="jeet" animated className="w-16 h-16 sm:w-24 sm:h-24 md:w-28 md:h-28 rounded-full border-0" />
              </div>
              <span className="font-staatliches text-xs sm:text-base md:text-xl text-jeet-red tracking-wider uppercase glow-jeet leading-tight">
                SKELETON JEET REAPER
              </span>
              <p className="font-mono text-[8px] sm:text-[10px] text-trench-gasmask mt-1 uppercase font-bold leading-normal">
                Commander of the JEET Forces. Stake SOL on the DUMP.
              </p>
            </motion.div>

          </div>

        </div>
      </section>

      {/* 2. LIVE MARQUEE TICKER */}
      <div className="w-full bg-black/40 border-y border-white/5 py-3 relative overflow-hidden backdrop-blur-md">
        {/* Ticker side-faders */}
        <div className="absolute top-0 bottom-0 left-0 w-24 bg-gradient-to-r from-trench-black to-transparent z-10 pointer-events-none" />
        <div className="absolute top-0 bottom-0 right-0 w-24 bg-gradient-to-l from-trench-black to-transparent z-10 pointer-events-none" />

        <div className="flex w-[200%] animate-marquee">
          {Array(2).fill(0).map((_, groupIndex) => (
            <div key={groupIndex} className="flex justify-around items-center w-full min-w-full font-mono text-xs uppercase tracking-wider font-bold">
              <span className="flex items-center gap-1.5 text-neon-moon">
                <Zap size={12} />
                ANON WENT 1.5 SOL ON <span className="bg-trench-black px-1.5 py-0.5 rounded border border-neon-moon/40">$BONK2</span> → MOON 🚀
              </span>
              <span className="text-trench-gasmask">•</span>
              <span className="flex items-center gap-1.5 text-jeet-red">
                <Target size={12} />
                DEGEN CHAD JEETED 3.0 SOL ON <span className="bg-trench-black px-1.5 py-0.5 rounded border border-jeet-red/40">$PEPE5</span> → JEET 💀
              </span>
              <span className="text-trench-gasmask">•</span>
              <span className="flex items-center gap-1.5 text-neon-moon">
                <Zap size={12} />
                WHALE DEPLOYED 5.2 SOL ON <span className="bg-trench-black px-1.5 py-0.5 rounded border border-neon-moon/40">$SLERF</span> → MOON 🐸
              </span>
              <span className="text-trench-gasmask">•</span>
              <span className="flex items-center gap-1.5 text-jeet-red">
                <Target size={12} />
                SKEL_REAPER DUMPED 0.85 SOL ON <span className="bg-trench-black px-1.5 py-0.5 rounded border border-jeet-red/40">$WOJAK</span> → JEET 🦴
              </span>
              <span className="text-trench-gasmask">•</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2.5 AGENTKEY ALPHA ZONE */}
      <section className="mx-auto max-w-7xl w-full px-4 pt-12 pb-4">
        <AgentKeyAlphaZone />
      </section>

      {/* 3. MASCOT PARADE / CHARACTER LINEUP */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <div className="retro-panel p-8 rounded-2xl relative shadow-2xl">
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-1 rounded-full font-staatliches text-sm tracking-widest shadow-lg uppercase">
            ⚔️ THE TRENCH COMMANDERS ⚔️
          </div>
          <h3 className="font-staatliches text-2xl text-white tracking-wider mb-4 mt-2 text-center uppercase">
            MEET YOUR BATTLE COMPANIONS
          </h3>
          <MascotRow />
        </div>
      </section>

      {/* 4. DOUBLE PLANK FEATURES (HOW IT WORKS & RECENT WAR LEADERS) */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12 grid grid-cols-1 lg:grid-cols-2 gap-12">

        {/* Left Column: Blueprint Guide */}
        <div className="retro-panel p-8 rounded-2xl shadow-2xl relative">
          {/* Clipboard binder clip */}
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-1 rounded-full font-staatliches text-sm tracking-widest shadow-lg uppercase">
            OPERATIONAL PROTOCOLS
          </div>

          <h3 className="font-staatliches text-3xl text-white tracking-wider mb-6 mt-2 flex items-center gap-2">
            <Users className="text-neon-moon" />
            HOW TO FIGHT THE TRENCHES
          </h3>

          <div className="space-y-6 font-mono text-sm text-trench-gasmask">

            <div className="flex gap-4 items-start">
              <PepePortrait src={PEPE_ASSETS.cryptoBunker} size={48} glowColor="moon" className="rounded shrink-0" />
              <div>
                <h4 className="text-white font-bold uppercase text-base flex items-center gap-1.5">
                  <Rocket size={14} className="text-neon-moon" /> Select Your Combat Arena
                </h4>
                <p className="mt-1">
                  Navigate to the <span className="text-neon-moon">WAR TABLE</span>. Scan the active trenches dug for tokens. Monitor their pools, volume, and the decaying mission countdown.
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={48} glowColor="gold" className="rounded shrink-0" />
              <div>
                <h4 className="text-white font-bold uppercase text-base flex items-center gap-1.5">
                  <Swords size={14} className="text-jeet-red" /> Choose Your Alignment
                </h4>
                <p className="mt-1">
                  Stake your <span className="text-moon-gold">Ammo SOL</span> on either the <span className="text-neon-moon">MOON</span> army (betting the token will pump) or the <span className="text-jeet-red">JEET</span> army (betting the token will dump).
                </p>
              </div>
            </div>

            <div className="flex gap-4 items-start">
              <PepePortrait src={PEPE_ASSETS.moonJuice} size={48} glowColor="gold" className="rounded shrink-0" />
              <div>
                <h4 className="text-white font-bold uppercase text-base flex items-center gap-1.5">
                  <Award size={14} className="text-moon-gold" /> Claim Booty & Collect Medals
                </h4>
                <p className="mt-1">
                  Once the countdown bomb detonates, the room settles. The winning army takes the entire losing army&apos;s pool (minus a flat 1.25% HQ fee) divided proportionally.
                </p>
              </div>
            </div>

          </div>

          <div className="mt-8 p-4 bg-black/40 border border-white/10 rounded-xl flex items-center gap-3">
            <ShieldAlert size={20} className="text-moon-gold animate-pulse shrink-0" />
            <p className="text-[11px] text-trench-gasmask uppercase leading-tight font-bold">
              Platform is fully decentralizable and zero-slippage. Settled rooms execute completely peer-to-peer.
            </p>
          </div>
        </div>

        {/* Right Column: Top Winners Leaderboard */}
        <div className="retro-panel p-8 rounded-2xl shadow-2xl relative">
          {/* Clip */}
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-1 rounded-full font-staatliches text-sm tracking-widest shadow-lg uppercase">
            FRONT-LINE DECORATIONS
          </div>

          <div className="flex items-center justify-between mb-6 mt-2">
            <h3 className="font-staatliches text-3xl text-white tracking-wider flex items-center gap-2">
              <Award className="text-moon-gold" />
              TRENCH HEROES
            </h3>
            <Link href="/leaderboard" className="font-mono text-xs text-neon-moon hover:underline uppercase font-bold flex items-center gap-0.5">
              Full List <ArrowUpRight size={14} />
            </Link>
          </div>

          {/* Leaders Board Grid */}
          <div className="space-y-3">
            {topHeroes.map((hero, index) => (
              <div
                key={index}
                className="flex items-center justify-between p-3.5 bg-trench-black/80 border-l-4 rounded border border-trench-sandbag/60 hover:bg-trench-black transition-all"
              >
                <div className="flex items-center gap-3">
                  <PepePortrait
                    src={hero.pepe}
                    size={40}
                    glowColor={index % 2 === 0 ? 'moon' : 'jeet'}
                    className="rounded-full"
                  />
                  <div>
                    <span className="font-mono text-sm font-bold text-white block">
                      {hero.name}
                    </span>
                    <span className={`font-mono text-[9px] font-bold px-1.5 py-0.5 rounded bg-trench-mud border ${hero.color}`}>
                      {hero.type}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <span className="font-staatliches text-xl text-moon-gold block leading-none">
                    +{hero.profit.toFixed(2)} SOL
                  </span>
                  <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold">
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

      {/* 5. WAR PROPAGANDA GALLERY */}
      <section className="mx-auto max-w-7xl w-full px-4 py-12">
        <div className="retro-panel p-8 rounded-2xl relative shadow-2xl">
          <div className="absolute top-[-14px] left-[50%] -translate-x-[50%] bg-white/10 backdrop-blur-md border border-white/20 text-white px-6 py-1 rounded-full font-staatliches text-sm tracking-widest shadow-lg uppercase">
            🎖️ WAR PROPAGANDA 🎖️
          </div>
          <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 mt-2 text-center uppercase">
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
