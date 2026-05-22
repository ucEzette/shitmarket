'use client';

import React, { useState } from 'react';
import { useAppState } from '@/store/useAppState';
import {
  MedalFirstBlood,
  MedalMoonMillionaire,
  MedalSerialJeeter,
  MedalTrenchVet,
  PixelGasMask,
  PixelCrackedHelmet,
  PixelBarbedWire
} from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, Award, Zap, TrendingUp, TrendingDown, RefreshCw, X, Play } from 'lucide-react';

export default function ProfilePage() {
  const { user, connectWallet } = useAppState();
  const [replayBet, setReplayBet] = useState<{
    token: string;
    side: 'moon' | 'jeet';
    amount: number;
    result: 'win' | 'loss';
  } | null>(null);

  const handleReplayClick = (bet: any, outcome: 'win' | 'loss') => {
    synthSound('bet');
    setReplayBet({
      token: bet.roomId === '5' ? '$WOJAK' : '$WIFEY',
      side: bet.side,
      amount: bet.amount,
      result: outcome
    });

    // Synthesize sound effects based on outcome
    setTimeout(() => {
      if (outcome === 'win') {
        synthSound('victory');
      } else {
        synthSound('defeat');
      }
    }, 800);
  };

  // ── ELO helpers ──────────────────────────────────────────────
  function deriveEloFromStats(stats: {
    wins: number; losses: number; totalBets: number; winStreak: number;
  }): number {
    if (stats.totalBets === 0) return 1200;
    const winRate = stats.wins / stats.totalBets;
    // Simulated ELO: base 1200 + winRate delta + streak bonus
    const base = 1200 + Math.round((winRate - 0.5) * 600);
    const streakBonus = Math.min(stats.winStreak * 15, 150);
    const volumePenalty = Math.min(stats.totalBets, 50); // small stability adjustment
    return Math.max(100, base + streakBonus + volumePenalty);
  }

  function eloToClass(elo: number): { cls: string; color: string; label: string } {
    if (elo >= 1800) return { cls: 'S', color: 'text-yellow-300', label: 'LEGENDARY' };
    if (elo >= 1600) return { cls: 'A', color: 'text-purple-400', label: 'ELITE' };
    if (elo >= 1400) return { cls: 'B', color: 'text-blue-400', label: 'VETERAN' };
    if (elo >= 1200) return { cls: 'C', color: 'text-green-400', label: 'REGULAR' };
    return { cls: 'D', color: 'text-red-400', label: 'ROOKIE' };
  }
  // ──────────────────────────────────────────────────────────────

  // Safe checks for user details
  const walletConnected = user && user.wallet;
  const achievements = user?.achievements || [];
  const stats = user?.stats || {
    totalBets: 0,
    wins: 0,
    losses: 0,
    profit: 0,
    winStreak: 0,
    longestWinStreak: 0,
    biggestBet: 0
  };
  const userElo = deriveEloFromStats(stats);
  const userClass = eloToClass(userElo);

  // Deterministic avatar gradient based on address hash
  const getAvatarBg = () => {
    if (!walletConnected) return 'from-[#3A2512] to-[#1E120A]';
    const address = user.wallet || '';
    let hash = 0;
    for (let i = 0; i < address.length; i++) {
      hash = address.charCodeAt(i) + ((hash << 5) - hash);
    }
    const colors = [
      'from-[#2E6F10] to-[#091F02]', // Forest Green
      'from-[#8B0A26] to-[#2B0008]', // Crimson Red
      'from-[#3A2512] to-[#1E120A]', // Heavy Mud
      'from-[#1E3A8A] to-[#172554]', // Deep Navy
      'from-[#581C87] to-[#3B0764]'  // Royal Purple
    ];
    return colors[Math.abs(hash) % colors.length];
  };

  const winRate = stats.totalBets > 0 ? ((stats.wins / stats.totalBets) * 100).toFixed(0) : '0';

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8 flex-1 flex flex-col select-none">
      
      {/* 1. DISCONNECTED OVERLAY CARD */}
      {!walletConnected ? (
        <div className="bg-trench-mud p-8 border-4 border-dashed border-trench-sandbag rounded-lg shadow-2xl text-center max-w-xl mx-auto py-16 scanlines">
          <div className="relative mb-6 flex justify-center">
            <div className="absolute inset-0 bg-jeet-red/10 rounded-full blur-xl animate-pulse" />
            <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={120} glowColor="jeet" animated className="rounded-xl relative z-10" />
          </div>
          <h2 className="font-staatliches text-4xl text-white tracking-wider uppercase mb-2">
            TRENCH PASS SIGN IN
          </h2>
          <p className="font-mono text-xs text-trench-gasmask uppercase max-w-md mx-auto leading-relaxed mb-8 font-bold">
            Secure a military soldier ID to record your predictive victories, track win ratios, unlock iron badges, and manage your ammunition SOL.
          </p>
          <button
            onClick={() => {
              connectWallet();
              synthSound('bet');
            }}
            className="w-full max-w-xs py-4 font-staatliches text-2xl uppercase tracking-wider text-white bg-jeet-red hover:bg-red-700 rounded border-b-4 border-red-950 shadow-glow-jeet active:translate-y-1 transition-all flex items-center justify-center gap-2"
          >
            <PepePortrait src={PEPE_ASSETS.neonWojak} size={28} className="rounded-full" />
            <span>DEPLOY SANDBOX PASSPORT</span>
          </button>
        </div>
      ) : (
        /* 2. CONNECTED PROFILE CONTENT */
        <div className="space-y-8 animate-fadeIn">
          
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left Column: Soldier Passport ID Card (5 cols) */}
            <div className="lg:col-span-5 bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 flex flex-col justify-between relative shadow-lg scanlines">
              {/* Clipboard corner details */}
              <div className="absolute top-2 right-2 font-mono text-[8px] text-trench-gasmask/50 uppercase font-bold">
                HQ-DOCS #8420-AA
              </div>

              <div>
                <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-1.5 uppercase">
                  <PixelCrackedHelmet size={20} />
                  SOLDIER PORTRAIT
                </h3>

                {/* Passport Card details */}
                <div className="flex gap-4 items-start">
                  
                  {/* Deterministic Pixel Avatar — now uses real pixel art */}
                  <div className={`w-28 h-28 bg-gradient-to-br ${getAvatarBg()} border-4 border-trench-sandbag rounded flex items-center justify-center relative shadow-inner overflow-hidden shrink-0 group`}>
                    <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[size:100%_4px] pointer-events-none" />
                    <img src={PEPE_ASSETS.chadBull} alt="Commander Avatar" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                  </div>

                  <div className="space-y-2">
                    <span className="font-mono text-[9px] text-neon-moon font-bold bg-neon-moon/10 px-2 py-0.5 border border-neon-moon/30 rounded uppercase tracking-wider">
                      COMMAND SQUAD ACTIVE
                    </span>
                    <h4 className="font-staatliches text-2xl text-white tracking-wide break-all leading-none mt-1">
                      COMMANDER_{user.wallet!.substring(0, 6)}
                    </h4>
                    <p className="font-mono text-[10px] text-trench-gasmask break-all uppercase leading-tight font-bold">
                      {user.wallet}
                    </p>
                    <p className="font-mono text-xs text-moon-gold font-bold">
                      Balance: {user.balance.toFixed(2)} Ammo SOL
                    </p>
                  </div>
                </div>

                {/* Gritty Rating Badge with ELO */}
                <div className="mt-8 bg-trench-black border-2 border-trench-sandbag p-4 rounded flex items-center justify-between gap-4 shadow-inner">
                  <div>
                    <span className="font-staatliches text-lg text-white tracking-wide block uppercase leading-none">
                      TRENCH CLASSIFICATION
                    </span>
                    <span className={`font-mono text-[10px] ${userClass.color} uppercase font-bold`}>
                      {userClass.label} — ELO {userElo}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <span className={`font-staatliches text-xl ${userClass.color} block leading-tight`}>
                        {userElo}
                      </span>
                      <span className="font-mono text-[7px] text-trench-gasmask uppercase font-bold leading-tight">
                        ELO
                      </span>
                    </div>
                    <div className="bg-trench-mud border-4 border-trench-sandbag rounded p-1.5 h-16 w-16 flex flex-col items-center justify-center relative">
                      <span className="absolute inset-0 border border-black/40 rounded-sm pointer-events-none" />
                      <span className={`font-staatliches text-3xl ${userClass.color} leading-none font-black shadow-inner`}>
                        {user.trenchScore}
                      </span>
                      <span className="font-mono text-[7px] text-trench-gasmask uppercase font-bold leading-none -mt-0.5">
                        CLASS
                      </span>
                    </div>
                  </div>
                </div>

              </div>

              <div className="mt-6 border-t border-trench-sandbag/40 pt-4 text-center">
                <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold tracking-widest block">
                  FRONT PASS APPROVED FOR PvP ARENA
                </span>
              </div>
            </div>

            {/* Right Column: Statistics Grid (7 cols) */}
            <div className="lg:col-span-7 bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 flex flex-col justify-between relative shadow-lg scanlines">
              
              <div>
                <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-1.5 uppercase">
                  <Award className="text-moon-gold" />
                  COMBAT ENGAGEMENT REPORT
                </h3>

                {/* Grid of stats */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  
                  <div className="bg-trench-black border border-trench-sandbag rounded p-3 text-center">
                    <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">TOTAL BATTLES</span>
                    <span className="font-staatliches text-2xl text-white block">{stats.totalBets}</span>
                  </div>

                  <div className="bg-trench-black border border-trench-sandbag rounded p-3 text-center">
                    <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">TACTICAL WINS</span>
                    <span className="font-staatliches text-2xl text-neon-moon block glow-moon">{stats.wins}</span>
                  </div>

                  <div className="bg-trench-black border border-trench-sandbag rounded p-3 text-center">
                    <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">WAR DEFEATS</span>
                    <span className="font-staatliches text-2xl text-jeet-red block glow-jeet">{stats.losses}</span>
                  </div>

                  <div className="bg-trench-black border border-trench-sandbag rounded p-3 text-center">
                    <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">ACCURACY RATE</span>
                    <span className="font-staatliches text-2xl text-white block">{winRate}%</span>
                  </div>

                  <div className="bg-trench-black border border-trench-sandbag rounded p-3 text-center">
                    <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">CUMULATIVE PROFIT</span>
                    <span className={`font-staatliches text-2xl block ${stats.profit >= 0 ? 'text-neon-moon glow-moon' : 'text-jeet-red glow-jeet'}`}>
                      {stats.profit >= 0 ? '+' : ''}{stats.profit.toFixed(2)} SOL
                    </span>
                  </div>

                  <div className="bg-trench-black border border-trench-sandbag rounded p-3 text-center">
                    <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold block">MAX AMMO LOADED</span>
                    <span className="font-staatliches text-2xl text-moon-gold block glow-gold">{stats.biggestBet.toFixed(2)} SOL</span>
                  </div>

                </div>

                {/* Win streak tracker */}
                <div className="mt-6 bg-trench-black border border-trench-sandbag rounded p-3.5 flex justify-around items-center">
                  <div className="text-center">
                    <span className="font-mono text-[8px] text-trench-gasmask block uppercase font-bold">CURRENT STREAK</span>
                    <span className="font-staatliches text-xl text-neon-moon block glow-moon">
                      {stats.winStreak} WINS
                    </span>
                  </div>
                  <div className="h-8 w-px bg-trench-sandbag" />
                  <div className="text-center">
                    <span className="font-mono text-[8px] text-trench-gasmask block uppercase font-bold">LONGEST WIN STREAK</span>
                    <span className="font-staatliches text-xl text-moon-gold block glow-gold">
                      {stats.longestWinStreak} WINS
                    </span>
                  </div>
                </div>

              </div>

              <div className="mt-6 flex items-center gap-2 p-2.5 bg-yellow-500/5 border border-yellow-500/20 rounded text-trench-gasmask">
                <ShieldCheck size={16} className="text-moon-gold" />
                <p className="font-mono text-[8px] uppercase leading-tight font-bold">
                  Passport authenticated on chain sandbox node. Operational logs are backed up via decentral secure storage.
                </p>
              </div>

            </div>

          </div>

          {/* 3. ACHIEVEMENT MEDALS (Row of custom pixel art medals) */}
          <div className="bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 relative shadow-lg scanlines">
            <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-1.5 uppercase">
              <Award className="text-moon-gold animate-bounce" />
              FRONT LINE CAMPAIGN MEDALS
            </h3>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
              
              {/* Medal 1: First Blood */}
              <div className="bg-trench-black border border-trench-sandbag rounded p-4 flex flex-col items-center text-center shadow-inner relative group">
                <MedalFirstBlood size={52} locked={!achievements.includes('first_blood')} />
                <span className="font-staatliches text-lg text-white tracking-wide uppercase mt-3">FIRST BLOOD</span>
                <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold mt-1">
                  Place a wager on any active trench room.
                </span>
                {!achievements.includes('first_blood') && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded">
                    <span className="font-staatliches text-sm text-jeet-red tracking-wider font-bold">LOCKED</span>
                  </div>
                )}
              </div>

              {/* Medal 2: Moon Millionaire */}
              <div className="bg-trench-black border border-trench-sandbag rounded p-4 flex flex-col items-center text-center shadow-inner relative group">
                <MedalMoonMillionaire size={52} locked={!achievements.includes('moon_millionaire')} />
                <span className="font-staatliches text-lg text-white tracking-wide uppercase mt-3">MOON MILLIONAIRE</span>
                <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold mt-1">
                  Deploy ≥ 1.0 Ammo SOL on a single target.
                </span>
                {!achievements.includes('moon_millionaire') && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded">
                    <span className="font-staatliches text-sm text-jeet-red tracking-wider font-bold">LOCKED</span>
                  </div>
                )}
              </div>

              {/* Medal 3: Serial Jeeter */}
              <div className="bg-trench-black border border-trench-sandbag rounded p-4 flex flex-col items-center text-center shadow-inner relative group">
                <MedalSerialJeeter size={52} locked={!achievements.includes('serial_jeeter')} />
                <span className="font-staatliches text-lg text-white tracking-wide uppercase mt-3">SERIAL JEETER</span>
                <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold mt-1">
                  Fight for the Jeet (Dump) army side.
                </span>
                {!achievements.includes('serial_jeeter') && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded">
                    <span className="font-staatliches text-sm text-jeet-red tracking-wider font-bold">LOCKED</span>
                  </div>
                )}
              </div>

              {/* Medal 4: 3-Win Streak (Trench Vet) */}
              <div className="bg-trench-black border border-trench-sandbag rounded p-4 flex flex-col items-center text-center shadow-inner relative group">
                <MedalTrenchVet size={52} locked={!achievements.includes('win_streak_3')} />
                <span className="font-staatliches text-lg text-white tracking-wide uppercase mt-3">TRENCH VET</span>
                <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold mt-1">
                  Secure a win streak of 3 consecutive battles.
                </span>
                {!achievements.includes('win_streak_3') && (
                  <div className="absolute inset-0 bg-black/60 backdrop-blur-[1px] flex items-center justify-center rounded">
                    <span className="font-staatliches text-sm text-jeet-red tracking-wider font-bold">LOCKED</span>
                  </div>
                )}
              </div>

            </div>
          </div>

          {/* 4. RECENT BET HISTORY */}
          <div className="bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 relative shadow-lg scanlines">
            <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-1.5 uppercase">
              <Zap className="text-neon-moon animate-pulse" />
              BATTLE LOGS
            </h3>

            {user.bets.length > 0 ? (
              <div className="space-y-3 font-mono text-xs">
                {user.bets.map((bet, idx) => {
                  // Find room details if available
                  const bRoom = useAppState.getState().rooms.find((r) => r.id === bet.roomId);
                  const tokenSym = bRoom ? bRoom.token.symbol : 'UNKNOWN';
                  const roomActive = bRoom ? bRoom.status === 'active' : false;
                  
                  let outcome: 'active' | 'win' | 'loss' = 'active';
                  if (bRoom && bRoom.status === 'settled') {
                    outcome = bRoom.winner === bet.side ? 'win' : 'loss';
                  }

                  return (
                    <div
                      key={idx}
                      className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-3 bg-trench-black border border-trench-sandbag rounded shadow-inner"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full ${roomActive ? 'bg-yellow-500 animate-ping' : outcome === 'win' ? 'bg-neon-moon' : 'bg-jeet-red'}`} />
                        <div>
                          <span className="font-bold text-white block uppercase text-[11px]">
                            {bet.amount.toFixed(2)} SOL ON ${tokenSym}
                          </span>
                          <span className="font-bold text-[9px] text-trench-gasmask uppercase tracking-wider block mt-0.5">
                            BET SIDE: <span className={bet.side === 'moon' ? 'text-neon-moon' : 'text-jeet-red'}>{bet.side.toUpperCase()}</span>
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-left md:text-right">
                          {roomActive ? (
                            <span className="text-yellow-500 font-bold uppercase text-[10px] px-2 py-0.5 bg-yellow-500/5 border border-yellow-500/20 rounded">
                              UNDER SIEGE (ACTIVE)
                            </span>
                          ) : outcome === 'win' ? (
                            <span className="text-neon-moon font-bold uppercase text-[10px] px-2 py-0.5 bg-neon-moon/5 border border-neon-moon/20 rounded">
                              DECREED: WON BATTLE 🎉
                            </span>
                          ) : (
                            <span className="text-jeet-red font-bold uppercase text-[10px] px-2 py-0.5 bg-jeet-red/5 border border-jeet-red/20 rounded">
                              DECREED: ELIMINATED (REKT) 💀
                            </span>
                          )}
                        </div>

                        {!roomActive && (
                          <button
                            onClick={() => handleReplayClick(bet, outcome as 'win' | 'loss')}
                            className="btn-wood py-1.5 px-3 rounded font-staatliches text-xs tracking-wider uppercase flex items-center gap-1"
                          >
                            <Play size={10} className="fill-current" />
                            REPLAY
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="bg-trench-black border border-trench-sandbag rounded p-8 text-center text-trench-gasmask shadow-inner">
                <span className="font-staatliches text-xl uppercase tracking-wide block">
                  NO COMBAT MISSIONS RECORDED
                </span>
                <span className="font-mono text-[10px] uppercase font-bold mt-1 block">
                  Your battle history log is empty. Enlist in active trenches from the War Table.
                </span>
              </div>
            )}
          </div>

          {/* Degen Quote at bottom */}
          <div className="mt-4">
            <DegenQuoteBanner />
          </div>

        </div>
      )}

      {/* 5. MICRO REPLAY CHART POP-UP MODAL */}
      <AnimatePresence>
        {replayBet && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className={`w-full max-w-md bg-trench-mud border-4 rounded-lg p-6 shadow-2xl relative scanlines ${
                replayBet.result === 'win' ? 'border-neon-moon shadow-glow-moon' : 'border-jeet-red shadow-glow-jeet'
              }`}
            >
              <button
                onClick={() => setReplayBet(null)}
                className="absolute top-3 right-3 text-trench-gasmask hover:text-white"
              >
                <X size={20} />
              </button>

              <div className="text-center mb-6">
                <h3 className="font-staatliches text-3xl text-white tracking-wider">
                  MISSION OUTCOME REPLAY
                </h3>
                <p className="font-mono text-xs text-trench-gasmask uppercase font-bold mt-1">
                  RECONSTRUCTION OF BLOCK STATE WAGER
                </p>
              </div>

              {/* Graphical Simulation of Pump/Dump */}
              <div className="h-44 bg-trench-black border-2 border-trench-sandbag rounded relative overflow-hidden mb-6 flex flex-col justify-between p-3 shadow-inner">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,#5c52441a_1px,transparent_1px),linear-gradient(to_bottom,#5c52441a_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />
                
                {/* Floating ticker details */}
                <div className="flex justify-between items-center relative z-10 font-mono text-[9px] text-trench-gasmask font-bold">
                  <span>WAGER: {replayBet.amount.toFixed(2)} SOL</span>
                  <span>PAIR: {replayBet.token}/SOL</span>
                </div>

                {/* SVG path pump/dump animations */}
                <svg className="absolute inset-0 h-full w-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
                  {replayBet.result === 'win' ? (
                    /* Massive Pump */
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.5, ease: 'easeInOut' }}
                      d="M 0 80 Q 25 75, 50 60 T 75 50 T 100 15"
                      fill="none"
                      stroke="#39FF14"
                      strokeWidth="3.5"
                      className="shadow-glow-moon-strong"
                    />
                  ) : (
                    /* Horrendous Dump */
                    <motion.path
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1.5, ease: 'easeInOut' }}
                      d="M 0 20 Q 25 35, 50 45 T 75 50 T 100 90"
                      fill="none"
                      stroke="#FF073A"
                      strokeWidth="3.5"
                      className="shadow-glow-jeet-strong"
                    />
                  )}
                </svg>

                {/* Animated Explosive nodes */}
                <div className="relative z-10 flex justify-end">
                  {replayBet.result === 'win' ? (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ delay: 1.2, duration: 0.5 }}
                      className="font-staatliches text-lg text-neon-moon bg-trench-black px-2 py-0.5 border border-neon-moon rounded glow-moon font-bold flex items-center gap-1"
                    >
                      <TrendingUp size={14} /> PUMP WINNER!
                    </motion.span>
                  ) : (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: [1, 1.2, 1] }}
                      transition={{ delay: 1.2, duration: 0.5 }}
                      className="font-staatliches text-lg text-jeet-red bg-trench-black px-2 py-0.5 border border-jeet-red rounded glow-jeet font-bold flex items-center gap-1"
                    >
                      <TrendingDown size={14} /> DUMP RUGGED!
                    </motion.span>
                  )}
                </div>

                <div className="flex justify-between items-center relative z-10 font-mono text-[8px] text-trench-gasmask font-bold">
                  <span>0m (WAGER)</span>
                  <span>BLOCK SETTLE (100%)</span>
                </div>
              </div>

              {/* Details card */}
              <div className="bg-trench-black border border-trench-sandbag p-4 rounded text-center mb-6">
                <span className="font-mono text-xs text-trench-gasmask block uppercase font-bold">
                  BATTLE RECONSTRUCTION OUTCOME
                </span>
                <span className={`font-staatliches text-2xl block uppercase mt-1 ${replayBet.result === 'win' ? 'text-neon-moon' : 'text-jeet-red'}`}>
                  {replayBet.result === 'win' ? 'VICTORY • 2% TAX APPLIED' : 'ELIMINATED • EXIT LIQUIDITY'}
                </span>
                <p className="font-mono text-[10px] text-trench-gasmask uppercase mt-2 leading-tight font-bold">
                  Commander chose the <span className={replayBet.side === 'moon' ? 'text-neon-moon font-bold' : 'text-jeet-red font-bold'}>{replayBet.side.toUpperCase()}</span> side. Action successfully executed and logged on chain.
                </p>
              </div>

              <button
                onClick={() => setReplayBet(null)}
                className="w-full py-2.5 btn-wood text-lg uppercase rounded"
              >
                DISMISS COMMAND LOG
              </button>

            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="my-8">
        <PixelBarbedWire height={16} />
      </div>

    </div>
  );
}
