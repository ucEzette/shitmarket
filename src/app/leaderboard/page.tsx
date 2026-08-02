'use client';

import React, { useState, useEffect } from 'react';
import { useAppState } from '@/store/useAppState';
import { PixelPepe, PixelGasMask, PixelBarbedWire } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner, MOON_PEPES, JEET_PEPES } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { Trophy, CalendarClock, Flame, Star, Award, TrendingUp, Sparkles } from 'lucide-react';

// Helper: derive ELO from win rate and total bets (for mock data display)
function deriveElo(winRate: number, totalBets: number): number {
  // Base 1200 + 4 points per % win rate above 50% (capped), adjusted by volume
  const rateBonus = Math.max(0, (winRate - 50)) * 4;
  const volumeBonus = Math.min(totalBets * 5, 200);
  return 1200 + Math.round(rateBonus + volumeBonus);
}

// Helper: convert ELO to class rating
function eloToClass(elo: number): { class: string; color: string; label: string } {
  if (elo >= 1800) return { class: 'S', color: 'text-yellow-300', label: 'LEGENDARY' };
  if (elo >= 1600) return { class: 'A', color: 'text-purple-400', label: 'ELITE' };
  if (elo >= 1400) return { class: 'B', color: 'text-blue-400', label: 'VETERAN' };
  if (elo >= 1200) return { class: 'C', color: 'text-green-400', label: 'REGULAR' };
  return { class: 'D', color: 'text-red-400', label: 'ROOKIE' };
}

export default function LeaderboardPage() {
  const { leaderboard } = useAppState();
  const [activeTab, setActiveTab] = useState<'moon' | 'jeet'>('moon');
  const [seasonTimeLeft, setSeasonTimeLeft] = useState('');

  // Ticking Season Clock
  useEffect(() => {
    const calculateTime = () => {
      // Hardcode a dynamic countdown to the end of the week for season
      const now = new Date();
      const nextSunday = new Date();
      nextSunday.setDate(now.getDate() + ((7 - now.getDay()) % 7));
      nextSunday.setHours(23, 59, 59, 999);
      
      const diff = nextSunday.getTime() - now.getTime();
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const mins = Math.floor((diff % 3600000) / 60000);
      const secs = Math.floor((diff % 60000) / 1000);

      setSeasonTimeLeft(`${days}D ${hours}H ${mins}M ${secs}S`);
    };

    calculateTime();
    const interval = setInterval(calculateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const activeLeaders = activeTab === 'moon' ? (leaderboard?.moon || []) : (leaderboard?.jeet || []);

  // Podium Soldiers
  const podium1st = activeLeaders[0] || { name: 'Recruit', profit: 0, winRate: 0, streak: 0 };
  const podium2nd = activeLeaders[1] || { name: 'Recruit', profit: 0, winRate: 0, streak: 0 };
  const podium3rd = activeLeaders[2] || { name: 'Recruit', profit: 0, winRate: 0, streak: 0 };

  const handleTabChange = (tab: 'moon' | 'jeet') => {
    setActiveTab(tab);
    synthSound('bet');
  };

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8 flex-1 flex flex-col select-none text-slate-800 dark:text-white transition-colors duration-200">
      
      {/* 1. SEASON TIMELINE HEADER BANNER */}
      <div className="bg-white dark:bg-trench-black border-2 border-cyan-200 dark:border-4 dark:border-trench-sandbag rounded-xl p-5 mb-8 flex flex-col md:flex-row justify-between items-center gap-4 relative shadow-md dark:shadow-lg dark:scanlines text-slate-800 dark:text-white">
        <div className="flex items-center gap-3">
          <PepePortrait src={PEPE_ASSETS.apeGeneral} size={48} glowColor="gold" animated className="rounded-lg shrink-0" />
          <div>
            <h2 className="font-staatliches text-2xl text-[#0A1A2A] dark:text-white tracking-wider uppercase leading-none">
              SEASON 1 SECTOR CONQUEST
            </h2>
            <p className="font-mono text-[10px] text-slate-500 dark:text-trench-gasmask uppercase mt-1 font-bold">
              The supreme degen commanders on the front lines. Rewards distributed every Sunday.
            </p>
          </div>
        </div>

        {/* Flashing Season Countdown */}
        <div className="bg-cyan-50 dark:bg-trench-mud border border-cyan-200 dark:border-trench-sandbag/80 rounded-lg px-4 py-1.5 text-center min-w-[200px]">
          <span className="font-mono text-[9px] text-slate-500 dark:text-trench-gasmask block uppercase font-bold">
            TIME TO ARBITRAGE RESET:
          </span>
          <span className="font-staatliches text-xl text-[#C62828] dark:text-jeet-red tracking-wider dark:glow-jeet animate-pulse font-bold block">
            {seasonTimeLeft}
          </span>
        </div>
      </div>

      {/* 2. THE TACTICAL PODIUM */}
      <div className="bg-white/90 dark:bg-trench-mud/40 border-2 border-cyan-200 dark:border-4 dark:border-trench-sandbag rounded-xl p-6 mb-8 relative shadow-md dark:shadow-lg overflow-hidden dark:scanlines flex flex-col items-center text-slate-800 dark:text-white">
        
        {/* Glowing visual indicators */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-cyan-100/30 dark:from-trench-mud/30 via-transparent to-transparent pointer-events-none" />

        <h3 className="font-staatliches text-3xl text-[#0A1A2A] dark:text-white tracking-widest uppercase mb-10 text-center flex items-center justify-center gap-2">
          <Trophy className="text-amber-600 dark:text-moon-gold animate-spin" size={24} />
          TOP TRADERS
          <Trophy className="text-amber-600 dark:text-moon-gold animate-spin" size={24} />
        </h3>

        {/* 3 Steps Podium Construction */}
        <div className="w-full max-w-2xl flex items-end justify-center gap-2 sm:gap-4 mt-12 mb-6">
          
          {/* 2ND PLACE PODIUM (Left, Medium) */}
          <div className="flex-1 flex flex-col items-center">
            
            {/* Trooper details */}
            <div className="text-center mb-3">
              <span className="font-mono text-[10px] sm:text-xs font-bold text-slate-900 dark:text-white block truncate max-w-[70px] sm:max-w-none">
                {podium2nd.name}
              </span>
              <span className="font-staatliches text-[10px] sm:text-sm text-amber-700 dark:text-moon-gold block leading-none mt-0.5">
                +{podium2nd.profit.toFixed(2)} SOL
              </span>
            </div>

            {/* Visual character token */}
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-cyan-100 dark:bg-trench-black border-2 border-cyan-200 dark:border-trench-sandbag rounded-full flex items-center justify-center relative mb-1.5 shadow-inner scale-95 overflow-hidden">
              <PepePortrait src={PEPE_ASSETS.diamondHands} className="w-full h-full rounded-full border-0" />
              <span className="absolute -top-1.5 -right-1.5 bg-[#C0C0C0] text-black font-staatliches text-[6px] sm:text-[8px] px-1 rounded-sm border border-black z-10 font-bold uppercase">
                SILVER
              </span>
            </div>

            {/* Supply Crate step */}
            <div className="w-full h-16 sm:h-24 bg-cyan-50 dark:bg-trench-mud border-2 border-cyan-300 dark:border-4 dark:border-trench-sandbag flex flex-col justify-center items-center rounded-t-lg shadow-md relative">
              <span className="absolute inset-0 border border-black/10 dark:border-black/40 pointer-events-none" />
              <span className="font-staatliches text-2xl sm:text-4xl text-slate-400 dark:text-trench-gasmask font-black">2ND</span>
              <span className="font-mono text-[6px] sm:text-[8px] text-slate-500 dark:text-trench-gasmask uppercase font-bold -mt-1 text-center px-0.5">
                WR: {podium2nd.winRate}%<span className="hidden sm:inline"> | ELO: {podium2nd.elo || 1200}</span>
              </span>
            </div>
          </div>

          {/* 1ST PLACE PODIUM (Center, Tallest) */}
          <div className="flex-1 flex flex-col items-center">
            
            {/* Trooper details */}
            <div className="text-center mb-3 relative">
              <div className="absolute -top-6 sm:-top-7 left-[50%] -translate-x-[50%] animate-bounce">
                <Sparkles className="text-amber-600 dark:text-moon-gold animate-spin w-4 h-4 sm:w-5 sm:h-5" />
              </div>
              <span className="font-mono text-xs sm:text-sm font-bold text-slate-900 dark:text-white block truncate max-w-[70px] sm:max-w-none">
                {podium1st.name}
              </span>
              <span className="font-staatliches text-xs sm:text-lg text-[#00796B] dark:text-neon-moon block leading-none mt-0.5 dark:glow-moon font-bold">
                +{podium1st.profit.toFixed(2)} SOL
              </span>
            </div>

            {/* Visual character token */}
            <div className="w-12 h-12 sm:w-16 sm:h-16 bg-cyan-100 dark:bg-trench-black border-4 border-[#00796B] dark:border-neon-moon rounded-full flex items-center justify-center relative mb-2 shadow-lg dark:shadow-[0_0_20px_#16A34A] scale-110 overflow-hidden">
              <PepePortrait src={PEPE_ASSETS.chadBull} className="w-full h-full rounded-full border-0" />
              <span className="absolute -top-2.5 -right-2 bg-amber-500 dark:bg-moon-gold text-black font-staatliches text-[8px] sm:text-[10px] px-1 sm:px-1.5 py-0.5 rounded border border-black z-10 font-bold uppercase dark:shadow-glow-gold animate-pulse">
                SUPREME
              </span>
            </div>

            {/* Supply Crate step */}
            <div className="w-full h-24 sm:h-32 bg-cyan-100 dark:bg-trench-mud border-2 border-teal-600 dark:border-4 dark:border-neon-moon/70 flex flex-col justify-center items-center rounded-t-lg shadow-md relative">
              <span className="absolute inset-0 border border-black/10 dark:border-black/40 pointer-events-none" />
              <span className="font-staatliches text-3xl sm:text-5xl text-[#00796B] dark:text-neon-moon font-black dark:glow-moon">1ST</span>
              <span className="font-mono text-[7px] sm:text-[9px] text-[#00796B] dark:text-neon-moon uppercase font-bold -mt-1 tracking-wider dark:glow-moon text-center px-0.5">
                WR: {podium1st.winRate}%<span className="hidden sm:inline"> | ELO: {podium1st.elo || 1200}</span>
              </span>
            </div>
          </div>

          {/* 3RD PLACE PODIUM (Right, Shortest) */}
          <div className="flex-1 flex flex-col items-center">
            
            {/* Trooper details */}
            <div className="text-center mb-3">
              <span className="font-mono text-[10px] sm:text-xs font-bold text-slate-900 dark:text-white block truncate max-w-[70px] sm:max-w-none">
                {podium3rd.name}
              </span>
              <span className="font-staatliches text-[10px] sm:text-sm text-amber-700 dark:text-moon-gold block leading-none mt-0.5">
                +{podium3rd.profit.toFixed(2)} SOL
              </span>
            </div>

            {/* Visual character token */}
            <div className="w-9 h-9 sm:w-12 sm:h-12 bg-cyan-100 dark:bg-trench-black border-2 border-cyan-200 dark:border-trench-sandbag rounded-full flex items-center justify-center relative mb-1.5 shadow-inner scale-90 overflow-hidden">
              <PepePortrait src={PEPE_ASSETS.neonWojak} className="w-full h-full rounded-full border-0" />
              <span className="absolute -top-1.5 -right-1.5 bg-[#CD7F32] text-black font-staatliches text-[6px] sm:text-[8px] px-1 rounded-sm border border-black z-10 font-bold uppercase">
                BRONZE
              </span>
            </div>

            {/* Supply Crate step */}
            <div className="w-full h-12 sm:h-18 bg-cyan-50 dark:bg-trench-mud border-2 border-cyan-300 dark:border-4 dark:border-trench-sandbag flex flex-col justify-center items-center rounded-t-lg shadow-md relative">
              <span className="absolute inset-0 border border-black/10 dark:border-black/40 pointer-events-none" />
              <span className="font-staatliches text-2xl sm:text-4xl text-slate-400 dark:text-trench-gasmask font-black">3RD</span>
              <span className="font-mono text-[6px] sm:text-[8px] text-slate-500 dark:text-trench-gasmask uppercase font-bold -mt-1 text-center px-0.5">
                WR: {podium3rd.winRate}%<span className="hidden sm:inline"> | ELO: {podium3rd.elo || 1200}</span>
              </span>
            </div>
          </div>

        </div>

      </div>

      {/* 3. TACTICAL TABS SELECTION */}
      <div className="grid grid-cols-2 border-2 border-cyan-200 dark:border-trench-sandbag rounded-xl p-1 mb-6 bg-white dark:bg-trench-black max-w-md mx-auto shadow-sm">
        <button
          onClick={() => handleTabChange('moon')}
          className={`py-2.5 font-staatliches text-lg tracking-wider transition-all rounded-lg uppercase ${
            activeTab === 'moon'
              ? 'bg-teal-50 dark:bg-trench-sandbag text-[#00796B] dark:text-neon-moon font-bold dark:glow-moon'
              : 'text-slate-500 dark:text-trench-gasmask hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          BULLS (MOON)
        </button>
        <button
          onClick={() => handleTabChange('jeet')}
          className={`py-2.5 font-staatliches text-lg tracking-wider transition-all rounded-lg uppercase ${
            activeTab === 'jeet'
              ? 'bg-red-50 dark:bg-trench-sandbag text-[#C62828] dark:text-jeet-red font-bold dark:glow-jeet'
              : 'text-slate-500 dark:text-trench-gasmask hover:text-slate-900 dark:hover:text-white'
          }`}
        >
          BEARS (JEET)
        </button>
      </div>

      {/* 4. THE RANKINGS TABLE */}
      <div className="bg-white dark:bg-trench-mud border-2 border-cyan-200 dark:border-4 dark:border-trench-sandbag rounded-2xl overflow-hidden shadow-md dark:shadow-lg relative dark:scanlines text-slate-800 dark:text-white">
        {/* Table layout */}
        <div className="overflow-x-auto">
          <table className="w-full border-collapse font-mono text-xs select-text text-left">
            <thead>
              <tr className="bg-cyan-50 dark:bg-trench-black text-slate-600 dark:text-trench-gasmask border-b-2 border-cyan-200 dark:border-trench-sandbag uppercase font-bold">
                <th className="py-3.5 px-4 font-staatliches text-base tracking-wider text-slate-900 dark:text-white">RANK</th>
                <th className="py-3.5 px-4 font-staatliches text-base tracking-wider text-slate-900 dark:text-white">TRADER</th>
                <th className="py-3.5 px-4 font-staatliches text-base tracking-wider text-slate-900 dark:text-white text-right hidden sm:table-cell">ELO RATING</th>
                <th className="py-3.5 px-4 font-staatliches text-base tracking-wider text-slate-900 dark:text-white text-right">NET PROFIT</th>
                <th className="py-3.5 px-4 font-staatliches text-base tracking-wider text-slate-900 dark:text-white text-right">WIN RATE</th>
                <th className="py-3.5 px-4 font-staatliches text-base tracking-wider text-slate-900 dark:text-white text-right hidden sm:table-cell">RECORD (W/L)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-cyan-100 dark:divide-trench-sandbag/40">
              {activeLeaders.map((leader, index) => {
                const isTop3 = index < 3;
                const elo = leader.elo ?? deriveElo(leader.winRate, index + 5);
                const classInfo = eloToClass(elo);

                return (
                  <tr
                    key={index}
                    className="hover:bg-cyan-50/60 dark:hover:bg-trench-black/45 transition-colors font-bold uppercase text-slate-800 dark:text-white"
                  >
                    {/* Rank */}
                    <td className="py-4 px-4">
                      <span className={`font-staatliches text-xl ${
                        index === 0
                          ? 'text-amber-600 dark:text-moon-gold dark:glow-gold'
                          : index === 1
                          ? 'text-slate-700 dark:text-white'
                          : index === 2
                          ? 'text-slate-500 dark:text-trench-gasmask'
                          : 'text-slate-400 dark:text-trench-gasmask/50'
                      }`}>
                        #{index + 1}
                      </span>
                    </td>

                    {/* Soldier Name + Trench Class */}
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <PepePortrait
                          src={activeTab === 'moon' ? MOON_PEPES[index % MOON_PEPES.length] : JEET_PEPES[index % JEET_PEPES.length]}
                          size={28}
                          glowColor={isTop3 ? (activeTab === 'moon' ? 'moon' : 'jeet') : 'none'}
                          className="rounded-full shrink-0"
                        />
                        <div>
                          <span className="font-bold text-slate-900 dark:text-white block">
                            {leader.name}
                          </span>
                          <span className={`font-mono text-[9px] ${classInfo.color} font-bold`}>
                            {classInfo.label} [{classInfo.class}]
                          </span>
                        </div>
                      </div>
                    </td>

                    {/* ELO Rating */}
                    <td className="py-4 px-4 text-right hidden sm:table-cell">
                      <span className={`font-staatliches text-lg ${classInfo.color} block leading-none`}>
                        {elo}
                      </span>
                    </td>

                    {/* Profit */}
                    <td className="py-4 px-4 text-right">
                      <span className="font-staatliches text-lg text-amber-700 dark:text-moon-gold dark:glow-gold block leading-none">
                        +{leader.profit.toFixed(2)} SOL
                      </span>
                    </td>

                    {/* Accuracy winRate */}
                    <td className="py-4 px-4 text-right">
                      <div className="text-right">
                        <span className="text-slate-900 dark:text-white font-bold block">{leader.winRate}%</span>
                        <span className="font-mono text-[8px] text-slate-500 dark:text-trench-gasmask font-bold">
                          {activeTab === 'moon' ? 'BULL SIGNALS' : 'SNIPES'}
                        </span>
                      </div>
                    </td>

                    {/* Win Streak */}
                    <td className="py-4 px-4 text-right hidden sm:table-cell">
                      <span className="font-staatliches text-base text-[#00796B] dark:text-neon-moon dark:glow-moon font-bold">
                        {leader.wins || 0}W - {leader.losses || 0}L
                      </span>
                    </td>

                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Degen Quote Banner */}
      <div className="mb-8">
        <DegenQuoteBanner />
      </div>

      <div className="my-8">
        <PixelBarbedWire height={16} />
      </div>

    </div>
  );
}
