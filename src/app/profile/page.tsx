'use client';

import React, { useState } from 'react';
import { useAppState, formatCashtag } from '@/store/useAppState';
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
import { ShieldCheck, Award, Zap, TrendingUp, TrendingDown, RefreshCw, X, Play, Edit2, Camera, AlertTriangle, Save, Loader2, Copy, Check, Users, Coins, ExternalLink } from 'lucide-react';

export default function ProfilePage() {
  const { user, connectWallet, updateProfile, claimReferralRewardsOnChain, showAlert } = useAppState();
  const [replayBet, setReplayBet] = useState<{
    token: string;
    side: 'moon' | 'jeet';
    amount: number;
    result: 'win' | 'loss';
  } | null>(null);

  // --- Profile Edit State ---
  const [isEditing, setIsEditing] = useState(false);
  const [editUsername, setEditUsername] = useState('');
  const [editAvatar, setEditAvatar] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [editError, setEditError] = useState('');
  
  // --- Referral State ---
  const [copiedLink, setCopiedLink] = useState(false);
  const [isClaiming, setIsClaiming] = useState(false);

  React.useEffect(() => {
    if (typeof window !== 'undefined' && window.location.search.includes('mock_wallet=true')) {
      const state = useAppState.getState();
      if (!state.user || !state.user.wallet) {
        state.setWalletAddress("5qb94vvR5sTkwC1vjXFp5A7Wc6E98L92yHqS2z7rF8K2");
      }
    }
  }, []);

  React.useEffect(() => {
    if (user && !isEditing) {
      setEditUsername(user.username || '');
      setEditAvatar(user.avatarUrl || '');
    }
  }, [user, isEditing]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      setEditError('IMAGE TOO LARGE (MAX 2MB)');
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      setEditAvatar(event.target?.result as string);
      setEditError('');
    };
    reader.readAsDataURL(file);
  };

  const handleSaveProfile = async () => {
    setIsSaving(true);
    setEditError('');
    
    // Client-side username (callsign) validation
    const callsign = editUsername.trim();
    if (!callsign) {
      setEditError('CALLSIGN CANNOT BE EMPTY');
      synthSound('defeat');
      setIsSaving(false);
      return;
    }
    if (callsign.length < 3 || callsign.length > 15) {
      setEditError('CALLSIGN MUST BE 3-15 CHARACTERS');
      synthSound('defeat');
      setIsSaving(false);
      return;
    }
    if (!/^[a-zA-Z0-9_]+$/.test(callsign)) {
      setEditError('CALLSIGN MUST BE ALPHANUMERIC & UNDERSCORES ONLY');
      synthSound('defeat');
      setIsSaving(false);
      return;
    }

    try {
      const res = await updateProfile(callsign, editAvatar);
      if (res.success) {
        setIsEditing(false);
        synthSound('bet');
      } else {
        setEditError(res.error || 'FAILED TO UPDATE');
        synthSound('defeat');
      }
    } catch (err) {
      setEditError('NETWORK ERROR');
      synthSound('defeat');
    }
    setIsSaving(false);
  };

  const handleCopyLink = () => {
    const refCode = user?.referralCode || (user?.wallet ? user.wallet.slice(0, 6) + '9999' : 'recruit');
    const link = `${window.location.origin}/rooms?ref=${refCode}`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(link).catch((err) => {
        console.error("Clipboard copy failed, using fallback:", err);
        fallbackCopyText(link);
      });
    } else {
      fallbackCopyText(link);
    }
    setCopiedLink(true);
    synthSound('bet');
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const fallbackCopyText = (text: string) => {
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.top = "0";
    textArea.style.left = "0";
    textArea.style.position = "fixed";
    document.body.appendChild(textArea);
    textArea.focus();
    textArea.select();
    try {
      document.execCommand('copy');
    } catch (err) {
      console.error('Fallback copy method failed:', err);
    }
    document.body.removeChild(textArea);
  };


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
              <div className="absolute top-2 right-2 font-mono text-[8px] text-trench-gasmask/50 uppercase font-bold flex items-center gap-2">
                HQ-DOCS #8420-AA
                <button onClick={() => { setIsEditing(!isEditing); setEditError(''); }} className="text-neon-moon hover:text-white transition-colors bg-neon-moon/10 px-1.5 py-0.5 rounded flex items-center gap-1 border border-neon-moon/30">
                  {isEditing ? <X size={10} /> : <Edit2 size={10} />} {isEditing ? 'CANCEL' : 'EDIT'}
                </button>
              </div>

              <div>
                <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-1.5 uppercase">
                  <PixelCrackedHelmet size={20} />
                  SOLDIER PORTRAIT
                </h3>

                {/* Passport Card details */}
                <div className="flex flex-col gap-4">
                  <div className="flex flex-col sm:flex-row gap-4 items-center sm:items-start text-center sm:text-left">
                    <div className={`w-28 h-28 bg-gradient-to-br ${getAvatarBg()} border-4 border-trench-sandbag rounded flex items-center justify-center relative shadow-inner overflow-hidden shrink-0 group`}>
                      <div className="absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.35)_50%)] bg-[size:100%_4px] pointer-events-none z-10" />
                      <img src={isEditing ? (editAvatar || PEPE_ASSETS.fewUnderstand) : (user.avatarUrl || PEPE_ASSETS.chadBull)} alt="Commander Avatar" className="w-full h-full object-cover relative z-0 group-hover:scale-110 transition-transform duration-300" />
                    </div>

                    <div className="space-y-2 flex-1 min-w-0 w-full flex flex-col items-center sm:items-start">
                      <span className="font-mono text-[9px] text-neon-moon font-bold bg-neon-moon/10 px-2 py-0.5 border border-neon-moon/30 rounded uppercase tracking-wider inline-block">
                        COMMAND SQUAD ACTIVE
                      </span>
                      {isEditing ? (
                        <input
                          type="text"
                          value={editUsername}
                          onChange={(e) => setEditUsername(e.target.value)}
                          maxLength={30}
                          placeholder="ENTER CALLSIGN"
                          className="w-full bg-trench-black border border-trench-sandbag text-white font-staatliches text-xl px-2 py-1 outline-none focus:border-neon-moon mt-1 text-center sm:text-left"
                        />
                      ) : (
                        <h4 className="font-staatliches text-2xl text-white tracking-wide truncate leading-none mt-1 w-full text-center sm:text-left" title={user.username || `COMMANDER_${user.wallet!.substring(0, 6)}`}>
                          {user.username || `COMMANDER_${user.wallet!.substring(0, 6)}`}
                        </h4>
                      )}
                      <p className="font-mono text-[10px] text-trench-gasmask truncate uppercase leading-tight font-bold w-full text-center sm:text-left">
                        {user.wallet}
                      </p>
                      <p className="font-mono text-xs text-moon-gold font-bold w-full text-center sm:text-left">
                        Balance: {user.balance.toFixed(2)} Ammo SOL
                      </p>
                    </div>
                  </div>

                  {/* Edit Controls */}
                  <AnimatePresence>
                    {isEditing && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                        <div className="mt-4 border-t border-trench-sandbag/40 pt-4">
                          <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold mb-2 block">SELECT AVATAR PRESET</span>
                          <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
                            {[PEPE_ASSETS.chadBull, PEPE_ASSETS.apeGeneral, PEPE_ASSETS.diamondHands, PEPE_ASSETS.neonWojak, PEPE_ASSETS.jeetSkeleton, PEPE_ASSETS.fewUnderstand].map((preset, idx) => (
                              <button key={idx} onClick={() => setEditAvatar(preset)} className={`w-12 h-12 shrink-0 border-2 rounded overflow-hidden ${editAvatar === preset ? 'border-neon-moon shadow-glow-moon' : 'border-trench-sandbag hover:border-white/50'} transition-all`}>
                                <img src={preset} className="w-full h-full object-cover" />
                              </button>
                            ))}
                          </div>
                          
                          <div className="mt-3 flex items-center gap-3">
                            <label className="flex-1 cursor-pointer bg-trench-black hover:bg-[#1a1c23] border border-dashed border-trench-sandbag text-trench-gasmask hover:text-white font-mono text-[10px] uppercase font-bold py-2 text-center rounded transition-colors flex justify-center items-center gap-2">
                              <Camera size={14} /> UPLOAD CUSTOM AVI
                              <input type="file" accept="image/png, image/jpeg, image/gif, image/webp" className="hidden" onChange={handleFileUpload} />
                            </label>
                          </div>

                          {editError && (
                            <div className="mt-3 font-mono text-[11px] text-jeet-red bg-trench-black border-2 border-jeet-red p-3 rounded shadow-[0_0_12px_rgba(255,7,58,0.25)] text-left relative overflow-hidden scanlines">
                              <div className="absolute top-0 left-0 right-0 h-[2px] bg-jeet-red/35" />
                              <div className="flex items-center gap-2 text-jeet-red font-bold mb-1.5 uppercase tracking-widest text-[10px]">
                                <AlertTriangle size={12} className="animate-pulse shrink-0" />
                                <span>[COMMAND_ERROR] ACCESS DENIED</span>
                              </div>
                              <div className="text-white/90 uppercase leading-relaxed font-bold">
                                &gt; ERROR: {editError}
                                <span className="animate-pulse">_</span>
                              </div>
                            </div>
                          )}

                          <button onClick={handleSaveProfile} disabled={isSaving} className="mt-4 w-full bg-neon-moon/20 hover:bg-neon-moon/40 border border-neon-moon text-neon-moon py-2 font-staatliches text-lg uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2">
                            {isSaving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />} SAVE RECRUIT ID
                          </button>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
                  
                  let outcome: 'active' | 'win' | 'loss' | 'pending' | 'cancelled' = 'active';
                  if (bRoom) {
                    if (bRoom.status === 'pending') {
                      outcome = 'pending';
                    } else if (bRoom.status === 'cancelled') {
                      outcome = 'cancelled';
                    } else if (bRoom.status === 'settled') {
                      outcome = bRoom.winner === bet.side ? 'win' : 'loss';
                    }
                  }

                  return (
                    <div
                      key={idx}
                      className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 p-3 bg-trench-black border border-trench-sandbag rounded shadow-inner"
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-3 h-3 rounded-full shrink-0 ${
                          roomActive 
                            ? 'bg-yellow-500 animate-ping' 
                            : outcome === 'pending'
                            ? 'bg-yellow-500 animate-pulse'
                            : outcome === 'cancelled'
                            ? 'bg-gray-500'
                            : outcome === 'win' 
                            ? 'bg-neon-moon shadow-glow-moon' 
                            : 'bg-jeet-red shadow-glow-jeet'
                        }`} />
                        <div>
                          <span className="font-bold text-white block uppercase text-[11px]">
                            {bet.amount.toFixed(2)} SOL ON {formatCashtag(tokenSym)}
                            {bRoom && (
                              <span className="text-trench-gasmask text-[9px] lowercase font-normal ml-2">
                                ({bRoom.duration} mins round)
                              </span>
                            )}
                          </span>
                          <div className="flex flex-wrap gap-x-4 gap-y-0.5 mt-1 font-mono text-[9px] text-trench-gasmask font-bold uppercase tracking-wider">
                            <span>
                              SIDE: <span className={bet.side === 'moon' ? 'text-neon-moon' : 'text-jeet-red'}>{bet.side.toUpperCase()}</span>
                            </span>
                            <span>
                              DATE: {new Date(bet.timestamp).toLocaleString()}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="text-left md:text-right flex flex-col items-start md:items-end gap-1">
                          {roomActive ? (
                            <span className="text-yellow-500 font-bold uppercase text-[10px] px-2 py-0.5 bg-yellow-500/5 border border-yellow-500/20 rounded">
                              UNDER SIEGE (ACTIVE)
                            </span>
                          ) : outcome === 'pending' ? (
                            <span className="text-yellow-500 font-bold uppercase text-[10px] px-2 py-0.5 bg-yellow-500/5 border border-yellow-500/20 rounded">
                              PENDING TRIGGER
                            </span>
                          ) : outcome === 'cancelled' ? (
                            <span className="text-gray-400 font-bold uppercase text-[10px] px-2 py-0.5 bg-gray-500/5 border border-gray-500/20 rounded">
                              CANCELLED / REFUNDED
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
                          
                          {bet.txSig && (
                            <a 
                              href={bet.txSig 
                                ? (typeof window !== 'undefined' && window.location.hostname === 'localhost') 
                                  ? `https://explorer.solana.com/tx/${bet.txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899` 
                                  : `https://solscan.io/tx/${bet.txSig}?cluster=devnet`
                                : '#'
                              } 
                              target="_blank" 
                              rel="noreferrer" 
                              className="text-neon-moon hover:text-white border border-neon-moon/30 hover:border-neon-moon bg-neon-moon/5 px-2 py-0.5 rounded text-[9px] uppercase font-bold tracking-wide flex items-center gap-1 mt-1.5 transition-all"
                            >
                              <span>TX EXPLORER</span>
                              <ExternalLink size={10} />
                            </a>
                          )}
                        </div>

                        {!roomActive && outcome !== 'pending' && outcome !== 'cancelled' && (
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

          {/* 5. TRENCH REFERRAL HQ */}
          <div className="bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 relative shadow-lg scanlines mt-8">
            <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-1.5 uppercase">
              <Users className="text-neon-moon animate-pulse" />
              TRENCH REFERRAL HQ
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Left side: Link and Metrics */}
              <div className="space-y-6">
                <div className={`bg-trench-black border rounded p-5 shadow-inner relative overflow-hidden transition-all duration-300 ${
                  copiedLink 
                    ? 'border-neon-moon bg-neon-moon/5 shadow-[0_0_20px_rgba(57,255,20,0.2)]' 
                    : 'border-trench-sandbag'
                }`}>
                  <div className="absolute top-0 right-0 p-2 opacity-10">
                    <Users size={64} />
                  </div>
                  <span className="font-mono text-[10px] text-trench-gasmask block uppercase font-bold mb-2">
                    YOUR UNIQUE INVITATION CODE
                  </span>
                  
                  <div className="flex flex-col sm:flex-row gap-3">
                    <div className="flex-1 bg-trench-mud border-2 border-trench-sandbag rounded px-3 py-2 font-mono text-xs text-white truncate shadow-inner flex items-center">
                      {typeof window !== 'undefined' ? window.location.origin : ''}/rooms?ref={user?.referralCode || (user?.wallet ? user.wallet.slice(0, 6) + '9999' : 'recruit')}
                    </div>
                    <button 
                      onClick={handleCopyLink}
                      className={`shrink-0 py-2 px-4 font-staatliches text-lg uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 border-b-4 active:translate-y-1 ${
                        copiedLink 
                          ? 'bg-neon-moon text-trench-black border-neon-moon/50 shadow-glow-moon' 
                          : 'bg-jeet-red hover:bg-red-700 text-white border-red-950 shadow-glow-jeet'
                      }`}
                    >
                      {copiedLink ? <><Check size={16} /> COPIED</> : <><Copy size={16} /> COPY LINK</>}
                    </button>
                  </div>
                  <p className="font-mono text-[9px] text-neon-moon uppercase font-bold mt-3 max-w-[250px] leading-relaxed">
                    Earn 0.1% ammo SOL on every mission deployed by your enlisted recruits. Paid automatically on-chain.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-trench-black border border-trench-sandbag rounded p-4 text-center shadow-inner">
                    <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold block">ENLISTED RECRUITS</span>
                    <span className="font-staatliches text-3xl text-white block mt-1 glow-white">{user.referralsCount || 0}</span>
                  </div>
                  <div className="bg-trench-black border border-trench-sandbag rounded p-4 text-center shadow-inner">
                    <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold block">COMMISSION (SOL)</span>
                    <span className="font-staatliches text-3xl text-moon-gold block mt-1 glow-gold">
                      {((Number(user.referralEarnings) || 0) / 1e9).toFixed(3)}
                    </span>
                  </div>
                </div>

                <div className="bg-trench-black border border-trench-sandbag rounded p-5 shadow-inner relative overflow-hidden flex flex-col sm:flex-row justify-between items-center gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    <span className="font-mono text-[9px] text-trench-gasmask block uppercase font-bold mb-1">
                      UNCLAIMED REFERRAL SPOILS
                    </span>
                    <div className="flex items-baseline gap-1.5">
                      <span className="font-staatliches text-3xl text-neon-moon glow-moon">
                        {(user.unclaimedReferralRewards || 0).toFixed(4)}
                      </span>
                      <span className="font-mono text-[10px] text-trench-gasmask font-bold uppercase">
                        SOL
                      </span>
                    </div>
                    <p className="font-mono text-[8px] text-trench-gasmask uppercase font-bold mt-1.5 leading-tight">
                      Accrued commissions are held in the on-chain vault. Click claim to transfer them directly to your wallet.
                    </p>
                  </div>

                  <button
                    onClick={async (e) => {
                      const unclaimedAmt = user.unclaimedReferralRewards || 0;
                      if (unclaimedAmt <= 0) {
                        synthSound('defeat');
                        const rect = e.currentTarget.getBoundingClientRect();
                        showAlert("NO UNCLAIMED COMMISSIONS TO RETRIEVE!", 'warning', 'CLAIM DENIED', undefined, rect);
                        return;
                      }
                      setIsClaiming(true);
                      synthSound('bet');
                      try {
                        await claimReferralRewardsOnChain();
                        synthSound('victory');
                      } catch (err) {
                        synthSound('defeat');
                      } finally {
                        setIsClaiming(false);
                      }
                    }}
                    disabled={isClaiming || (user.unclaimedReferralRewards || 0) <= 0}
                    className={`w-full sm:w-auto shrink-0 py-3 px-5 font-staatliches text-lg uppercase tracking-wider rounded transition-all flex items-center justify-center gap-2 border-b-4 active:translate-y-1 ${
                      (user.unclaimedReferralRewards || 0) > 0
                        ? 'bg-neon-moon text-trench-black border-neon-moon/50 hover:bg-[#34e213] shadow-glow-moon'
                        : 'bg-[#1a1c23] text-trench-gasmask border-trench-black cursor-not-allowed'
                    }`}
                  >
                    {isClaiming ? (
                      <>
                        <Loader2 size={16} className="animate-spin" />
                        <span>CLAIMING...</span>
                      </>
                    ) : (
                      <>
                        <Coins size={16} />
                        <span>CLAIM REWARDS</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Right side: Ledger */}
              <div className="bg-trench-black border border-trench-sandbag rounded flex flex-col shadow-inner overflow-hidden max-h-[300px]">
                <div className="border-b border-trench-sandbag p-3 bg-trench-mud/50">
                  <span className="font-mono text-[10px] text-trench-gasmask uppercase font-bold flex items-center gap-1.5">
                    <Coins size={12} className="text-moon-gold" />
                    RECENT COMMISSION PAYOUTS
                  </span>
                </div>
                
                <div className="flex-1 overflow-y-auto p-3 space-y-2">
                  {user.referralPayouts && user.referralPayouts.length > 0 ? (
                    user.referralPayouts.map((p, idx) => {
                      const inviteeFormatted = p.invitee 
                        ? `${p.invitee.substring(0, 6)}...${p.invitee.substring(p.invitee.length - 4)}` 
                        : 'UNKNOWN_RECRUIT';
                      const betSol = ((Number(p.betAmount) || 0) / 1e9).toFixed(2);
                      const rewardSol = ((Number(p.rewardAmount) || 0) / 1e9).toFixed(4);
                      const formattedDate = (() => {
                        if (!p.createdAt) return 'TBD';
                        const d = new Date(p.createdAt);
                        if (isNaN(d.getTime())) return 'TBD';
                        return d.toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        });
                      })();
                      const isLocal = typeof window !== 'undefined' && window.location.hostname === 'localhost';
                      const txUrl = p.txSig 
                        ? isLocal 
                          ? `https://explorer.solana.com/tx/${p.txSig}?cluster=custom&customUrl=http%3A%2F%2Flocalhost%3A8899` 
                          : `https://solscan.io/tx/${p.txSig}?cluster=devnet`
                        : '#';

                      return (
                        <div key={idx} className="flex flex-col sm:flex-row justify-between items-start sm:items-center bg-trench-mud border border-trench-sandbag p-3 rounded font-mono text-[11px] gap-2 hover:border-neon-moon/50 transition-all hover:bg-trench-black/30">
                          <div className="space-y-1">
                            <div className="flex items-center gap-1.5">
                              <span className="text-white font-bold tracking-wider">{inviteeFormatted}</span>
                              <span className="text-[9px] text-neon-moon bg-neon-moon/10 px-1.5 py-0.2 border border-neon-moon/20 rounded font-bold uppercase">
                                RECRUIT
                              </span>
                            </div>
                            <div className="text-trench-gasmask text-[9px] uppercase font-semibold">
                              WAGER SIZE: <span className="text-white font-bold">{betSol} SOL</span>
                            </div>
                            <div className="text-[9px] text-trench-gasmask">
                              {formattedDate}
                            </div>
                          </div>
                          
                          <div className="text-right w-full sm:w-auto flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 border-trench-sandbag/30 pt-2 sm:pt-0 mt-1 sm:mt-0">
                            <div>
                              <span className="text-neon-moon font-bold text-xs block glow-moon">+{rewardSol} SOL</span>
                              <span className="text-[8px] text-trench-gasmask uppercase font-bold block leading-none mt-0.5">0.1% PAYOUT</span>
                            </div>
                            {p.txSig && (
                              <a 
                                href={txUrl} 
                                target="_blank" 
                                rel="noreferrer" 
                                className="text-neon-moon hover:text-white underline text-[9px] uppercase font-bold tracking-wide sm:mt-1.5 flex items-center gap-1"
                              >
                                <span>EXPLORER</span>
                                <ExternalLink size={10} />
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="flex flex-col items-center justify-center h-full text-center p-4">
                      <span className="font-staatliches text-lg text-trench-gasmask uppercase">NO PAYOUTS YET</span>
                      <span className="font-mono text-[9px] text-trench-gasmask/50 uppercase font-bold mt-1">
                        Distribute your invite code to start earning.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
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
                      stroke="#16A34A"
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
                  {replayBet.result === 'win' ? 'VICTORY • 1.25% TAX APPLIED' : 'ELIMINATED • EXIT LIQUIDITY'}
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
