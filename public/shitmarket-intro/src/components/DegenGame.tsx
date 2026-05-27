/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from "react";
import { soundSynth } from "./SoundSynth";
import { 
  TrendingUp, TrendingDown, Skull, Rocket, Coins, Users, AlertCircle, 
  RefreshCw, Award, Radio, Check, Flame, HelpCircle, ShieldAlert, Sparkles, Terminal
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface TokenBattle {
  id: string;
  name: string;
  symbol: string;
  price: number;
  change24h: number;
  moonPool: number;
  jeetPool: number;
  history: number[];
}

export default function DegenGame({ goBackToIntro, isGodMode }: { goBackToIntro: () => void; isGodMode: boolean }) {
  // Mock coins representing typical meme coins from the trenches
  const [tokens, setTokens] = useState<TokenBattle[]>([
    { id: "pepe", name: "Trench Pepe", symbol: "$PEPE", price: 0.0000042, change24h: 12.4, moonPool: 142.5, jeetPool: 88.2, history: [3.8, 3.9, 4.1, 4.0, 4.3, 4.2] },
    { id: "wif", name: "Soldier Dog", symbol: "$WIF", price: 2.14, change24h: -8.3, moonPool: 512.0, jeetPool: 645.0, history: [2.35, 2.3, 2.2, 2.1, 2.15, 2.14] },
    { id: "bonk", name: "Trench Shovel", symbol: "$BONK", price: 0.000021, change24h: 34.1, moonPool: 890.3, jeetPool: 340.1, history: [1.6, 1.7, 1.9, 1.8, 2.0, 2.1] },
    { id: "jeet", name: "Breadline Skeleton", symbol: "$JEET", price: 0.0000008, change24h: -98.2, moonPool: 12.0, jeetPool: 580.4, history: [4.5, 3.1, 1.2, 0.4, 0.1, 0.08] }
  ]);

  const [selectedToken, setSelectedToken] = useState<string>("pepe");
  const [betSide, setBetSide] = useState<"MOON" | "JEET" | null>(null);
  const [betAmount, setBetAmount] = useState<number>(0.1);
  const [solBalance, setSolBalance] = useState<number>(isGodMode ? 999999 : 10.0);
  const [streak, setStreak] = useState<number>(0);
  const [roundTimer, setRoundTimer] = useState<number>(15);
  const [activeBets, setActiveBets] = useState<{ tokenId: string; side: "MOON" | "JEET"; amount: number }[]>([]);
  const [alerts, setAlerts] = useState<string[]>([
    "🚨 [JEET ALERT] Dev dumped remaining 1% on sandwich slippage",
    "🔥 [BULL INTEL] Giga-chad whale is swapping 200 SOL into Ape Shovels",
    "💀 [WAR COUNCIL] Telegram admin locked community and deleted profile picture"
  ]);
  const [gameLogs, setGameLogs] = useState<string[]>(["Welcome to the War Room, Cadet! Play some wars."]);
  const [showScreenCrack, setShowScreenCrack] = useState<boolean>(false);
  const [showStamp, setShowStamp] = useState<string | null>(null); // "MOON" or "JEET" representing winning stamp
  const [recentWin, setRecentWin] = useState<boolean | null>(null);
  const [isChartTypeLine, setIsChartTypeLine] = useState<boolean>(true);

  const activeToken = tokens.find(t => t.id === selectedToken) || tokens[0];

  // Tick simulation of values & charts
  useEffect(() => {
    const interval = setInterval(() => {
      // Simulate price modifications slightly
      setTokens(prev => prev.map(t => {
        const volatility = t.id === "jeet" ? 0.25 : 0.06;
        const upChance = t.id === "pepe" ? 0.55 : t.id === "jeet" ? 0.22 : 0.48;
        const change = (Math.random() < upChance ? 1 : -1) * (Math.random() * volatility);
        const newPrice = Math.max(t.price * (1 + change), 0.00000001);
        const newHistory = [...t.history.slice(1), parseFloat(newPrice.toFixed(10))];
        
        // Slightly update the bet pools (simulating real other degens in real time!)
        const poolMoons = parseFloat((t.moonPool + Math.random() * 2.5).toFixed(1));
        const poolJeets = parseFloat((t.jeetPool + Math.random() * 2.5).toFixed(1));

        return {
          ...t,
          price: newPrice,
          change24h: parseFloat((t.change24h + change * 100).toFixed(1)),
          history: newHistory,
          moonPool: poolMoons,
          jeetPool: poolJeets
        };
      }));

      // Occasionally add fun jeet tactical alerts
      if (Math.random() < 0.25) {
        const alertCollection = [
          "🐋 [WHALE WATCH] 50 billion Pepe tokens migrated to moon-pool",
          "💀 [DEV DIED] Dev tweeted 'im sleeping' then vanished for 6 hours",
          "🥪 [MEATBALL SUB] Jeet sold entire bag to fund $12.50 dinner",
          "🏹 [CHAD SQUAD] Parachute division deployed over Soldier Dog",
          "🎰 [PARLAY ALERT] Degen hit a 4-leg jeet sweep!",
          "🔒 [GAS WAR] Solana network congested; fees hit 0.0005 SOL"
        ];
        const newAlert = alertCollection[Math.floor(Math.random() * alertCollection.length)];
        setAlerts(prev => [newAlert, ...prev.slice(0, 5)]);
      }
    }, 1500);

    return () => clearInterval(interval);
  }, []);

  // Timer round countdown simulation
  useEffect(() => {
    const timer = setInterval(() => {
      setRoundTimer(prev => {
        if (prev <= 1) {
          // Resolve current battles round!
          resolveRound();
          return 15; // reset timer to 15s
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [activeBets, selectedToken, tokens, solBalance, streak]);

  const resolveRound = () => {
    // Pick the selected token's direction for mock resolution
    const roundTrend = Math.random() < 0.52 ? "MOON" : "JEET"; // Simulate battle outcome
    
    // Play heavier action sounds and vocal announcements
    if (roundTrend === "MOON") {
      soundSynth.playTrumpetVictory();
      // Fast vocal chime
      setTimeout(() => {
        soundSynth.speakNoRug(); // "No Rug!"
      }, 350);
    } else {
      soundSynth.playExplosion();
      setTimeout(() => {
        soundSynth.speakSellIt(); // Skeleton squeal "Sell it!"
      }, 350);
    }

    // Set interactive visual stamp
    setShowStamp(roundTrend);
    setTimeout(() => setShowStamp(null), 3500);

    if (activeBets.length > 0) {
      let totalWinnings = 0;
      let wonAny = false;

      activeBets.forEach((bet) => {
        const target = tokens.find(t => t.id === bet.tokenId);
        if (!target) return;

        if (bet.side === roundTrend) {
          // Won!
          // Calculate mock profit. If won, user gets double back minus 2% fee!
          const winMultiplier = 1.98;
          const payout = bet.amount * winMultiplier;
          totalWinnings += payout;
          wonAny = true;
          
          setGameLogs(prev => [
            `🏆 [VICTORY] You bet ${bet.amount} SOL on ${target.symbol} ${bet.side} and WON +${payout.toFixed(3)} SOL!`,
            ...prev
          ]);
        } else {
          // Lost
          setGameLogs(prev => [
            `💀 [REKT] Your ${bet.amount} SOL bet on ${target.symbol} ${bet.side} was dust-rugged. Slashed!`,
            ...prev
          ]);
        }
      });

      if (wonAny) {
        setSolBalance(prev => parseFloat((prev + totalWinnings).toFixed(3)));
        setStreak(prev => prev + 1);
        setRecentWin(true);
        
        // Fully implemented high accent voice trigger: "SHEEEESH!!"
        soundSynth.speakSheeeesh();
        setTimeout(() => {
          soundSynth.playCoinClink();
        }, 300);
      } else {
        setStreak(0);
        setRecentWin(false);
        setShowScreenCrack(true);

        // Fully implemented mocking voice trigger: "GET REKT, NERD!"
        soundSynth.speakGetRekt();
        setTimeout(() => {
          soundSynth.playCrack();
        }, 200);
        
        setTimeout(() => setShowScreenCrack(false), 2000);
      }
      
      setActiveBets([]);
    } else {
      // Just normal spectator log
      setGameLogs(prev => [
        `⚔️ [TRENCH WAR OVER] Round resolved! ${activeToken.symbol} battled to a ${roundTrend}!`,
        ...prev
      ]);
      // Spectator general reaction speech
      if (Math.random() < 0.5) {
        soundSynth.speakWhat(); // Sarcastic "What?!"
      } else {
        soundSynth.speakNaw();  // "Aw Naw!"
      }
    }
  };

  const handlePlaceBet = () => {
    if (!betSide) {
      setGameLogs(prev => ["⚠️ Select a combat stance (MOON or JEET) first!", ...prev]);
      soundSynth.speakBruh(); // Expressive "Bruhhh..."
      return;
    }
    if (solBalance < betAmount) {
      setGameLogs(prev => ["⚠️ Insufficient SOL! Go search the couch for change or trigger God Mode.", ...prev]);
      soundSynth.speakNaw(); // Expressive "Aw Naw, my boy!"
      return;
    }

    // Trigger sound
    soundSynth.playBonk();

    // Deduct SOL and queue bet
    setSolBalance(prev => parseFloat((prev - betAmount).toFixed(3)));
    setActiveBets(prev => [...prev, { tokenId: selectedToken, side: betSide, amount: betAmount }]);
    
    setGameLogs(prev => [
      `🎰 Placed ${betAmount} SOL on ${activeToken.symbol} ${betSide} Pool! Waiting for battle timer...`,
      ...prev
    ]);
  };

  return (
    <div className="w-full h-full text-on-surface bg-trench-black crt-effect p-2 md:p-4 rounded-lg flex flex-col justify-between border-4 border-mud-brown overflow-y-auto relative">
      
      {/* Retro CRT Animated Scrolling Grid Background */}
      <div className="scrolling-grid-overlay" />
      
      {/* Dynamic Broken Glass Screen Crack Overlay */}
      <AnimatePresence>
        {showScreenCrack && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 pointer-events-none flex items-center justify-center bg-red-950/20"
          >
            <div className="w-full h-full relative">
              {/* Cracking spiderweb lines via SVG */}
              <svg className="absolute inset-0 w-full h-full stroke-red-500 stroke-4" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M50 50 L10 20 M50 50 L90 10 M50 50 L80 85 M50 50 L15 75 M50 50 L5 45 M50 50 L95 60" />
                <path d="M30 35 L40 25 L65 30 L60 60 L40 62 Z" className="fill-none stroke-red-400 stroke-2" />
                <path d="M20 25 L45 10 L85 15 L78 75 L30 80 Z" className="fill-none stroke-red-500 stroke-1" />
              </svg>
              <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 bg-black/95 p-5 border-4 border-red-600 rounded-lg text-center animate-bounce shadow-[0_0_50px_rgba(239,68,68,0.7)] max-w-sm w-full mx-auto">
                <img 
                  src="https://lh3.googleusercontent.com/aida/ADBb0uh7_P5y43z1gEqv_o_zZ6RvxpyP_lR0IomH8Y_y6vN1pT9lC7o5vQ" 
                  alt="GET REKT Outcome"
                  className="w-full h-40 object-contain border-2 border-red-950 rounded mb-3 bg-red-950/20"
                  referrerPolicy="no-referrer"
                />
                <h1 className="font-display text-2xl text-red-500 tracking-wider uppercase">JEET REKT!</h1>
                <p className="font-mono text-yellow-500 text-[10px] mt-1">
                  "Your Solana crumbs are now skeleton coffee funds. Wipe your tears and try again!"
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dynamic Battle Winning Notification Stamp */}
      <AnimatePresence>
        {showStamp && (
          <motion.div 
            initial={{ scale: 3, opacity: 0, rotate: -25 }}
            animate={{ scale: 1, opacity: 1, rotate: -15 }}
            exit={{ scale: 0.3, opacity: 0 }}
            transition={{ type: "spring", damping: 10 }}
            className="absolute top-1/3 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-40 pointer-events-none"
          >
            <div className={`p-8 border-8 rounded-xl font-display text-7xl uppercase tracking-widest text-center shadow-[0_0_80px_rgba(0,0,0,0.9)] rotate-[-15deg] ${
              showStamp === "MOON" 
                ? "bg-black border-lime-500 text-lime-400 shadow-[0_0_40px_rgba(57,255,20,0.6)]" 
                : "bg-black border-red-600 text-red-500 shadow-[0_0_40px_rgba(239,68,68,0.6)]"
            }`}>
              {showStamp === "MOON" ? "🚀 MOONERS WIN!" : "💀 JEETED RED!"}
              <div className="font-mono text-sm tracking-normal font-normal text-gray-400 mt-2">
                {showStamp === "MOON" ? "LOSERS LIQUIDATED" : "PAPER HANDS REWARDED"}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* TOP HEADER STATUS */}
      <div className="flex flex-col md:flex-row justify-between items-center bg-mud-brown border-2 border-sandbag rounded p-3 mb-4 gap-4 z-10">
        <div className="flex items-center gap-3">
          <img 
            src="https://lh3.googleusercontent.com/aida/ADBb0uiW2SvDxYpVSv0cQNEYFR6BiAC2wOC4bGAST1WMLVPLCMMjn4Z_YOyIC2i79CvRMDsLZL-JjakgRQmp8dgDCdNhYZxvIh4NVFETD4f9WPiER0wgh-AUIpLbPnyesmkfLDO7gh4WjBCaaAAd8_uTtbS4WOq3yja01JLR3c63IbZ4vrn4VK455avJefnZcLeAXTWzyGAITpeobkU_7LdcFHnQqQtKxOGGoDxh8GBfYEaxFi32DnEDkPD_QDb7" 
            alt="logo" 
            className="w-10 h-10 object-contain animate-spin-slow bg-black p-1 rounded-full border border-lime-400" 
            referrerPolicy="no-referrer"
          />
          <div>
            <h1 className="font-display text-2xl tracking-wide text-transparent bg-clip-text bg-gradient-to-r from-lime-400 via-yellow-400 to-red-500">
              SHITMARKET.LOL <span className="text-white text-xs font-mono ml-1 px-1.5 py-0.5 bg-black rounded border border-gray-700">WAR-ROOM BETA</span>
            </h1>
            <p className="font-mono text-[10px] text-gray-400">PvP Prediction Arena - Overlord: Chad Bull</p>
          </div>
        </div>

        {/* STATS RACK */}
        <div className="flex flex-wrap items-center gap-4">
          <div className="bg-trench-black/80 px-3 py-1 rounded border border-sandbag flex items-center gap-2">
            <Coins className="w-4 h-4 text-yellow-400 animate-pulse" />
            <div>
              <div className="text-[9px] font-mono text-gray-500 uppercase leading-none">Wallet Bal</div>
              <div className="font-mono text-sm font-bold text-lime-400">{solBalance.toFixed(3)} SOL</div>
            </div>
          </div>

          <div className="bg-trench-black/80 px-3 py-1 rounded border border-sandbag flex items-center gap-2">
            <Flame className="w-4 h-4 text-orange-500" />
            <div>
              <div className="text-[9px] font-mono text-gray-500 uppercase leading-none">Win Streak</div>
              <div className="font-mono text-sm font-bold text-orange-400">{streak} wins</div>
            </div>
          </div>

          <button 
            onClick={goBackToIntro} 
            className="px-3 py-1 bg-red-950 hover:bg-red-900 border border-red-700 text-red-200 font-display uppercase tracking-wider text-xs rounded transition-all"
          >
            ← Replay Intro
          </button>
        </div>
      </div>

      {/* CORE WAR LAYOUT Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 flex-1 items-stretch">
        
        {/* LEFT COLUMN (4 cols): TOKEN REGISTRY */}
        <div className="lg:col-span-3 flex flex-col gap-3 bg-mud-brown/60 p-3 border-2 border-sandbag rounded">
          <div className="flex justify-between items-center border-b border-sandbag pb-2">
            <h3 className="font-display text-lg text-yellow-500 flex items-center gap-1">
              <Terminal className="w-4 h-4" /> TRENDING COMBATANTS
            </h3>
            <span className="text-[9px] font-mono text-gray-500 px-1 py-0.5 bg-black rounded">LIVE</span>
          </div>

          <div className="flex flex-col gap-2 max-h-[350px] lg:max-h-none overflow-y-auto pr-1">
            {tokens.map((tok) => {
              const isSelected = selectedToken === tok.id;
              const priceRising = tok.change24h >= 0;

              return (
                <button
                  key={tok.id}
                  onClick={() => {
                    setSelectedToken(tok.id);
                    soundSynth.playBonk();
                  }}
                  className={`w-full p-2.5 rounded text-left border transition-all flex justify-between items-center ${
                    isSelected 
                      ? "bg-trench-black border-lime-400 shadow-[0_0_10px_rgba(57,255,20,0.2)]" 
                      : "bg-mud-brown/40 border-gray-800 hover:border-sandbag"
                  }`}
                >
                  <div>
                    <div className="font-display text-sm tracking-wide text-white">{tok.name}</div>
                    <div className="font-mono text-xs text-gray-400">{tok.symbol}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-xs font-bold text-yellow-400">
                      ${tok.price.toFixed(tok.id === "wif" ? 2 : 7)}
                    </div>
                    <div className={`font-mono text-[10px] flex items-center justify-end gap-0.5 ${priceRising ? "text-lime-400" : "text-red-500"}`}>
                      {priceRising ? <TrendingUp className="w-2.5 h-2.5" /> : <TrendingDown className="w-2.5 h-2.5" />}
                      {priceRising ? "+" : ""}{tok.change24h}%
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          {/* SIMULATED SPECTATORS WATCHING */}
          <div className="mt-auto bg-black/40 p-2.5 rounded border border-gray-800 text-center">
            <div className="flex items-center justify-center gap-1.5 text-xs text-lime-400 font-bold">
              <Users className="w-3.5 h-3.5 animate-pulse" />
              <span>4,209 Warriors Active</span>
            </div>
            <p className="font-mono text-[9px] text-gray-500 mt-1">Platform rake: 2% of the pot</p>
          </div>
        </div>

        {/* MIDDLE COLUMN (5 cols): LIVE BATTLE ARENA & TICKING BOMB */}
        <div className="lg:col-span-5 flex flex-col gap-3 bg-mud-brown/60 p-3 border-2 border-sandbag rounded justify-between">
          
          {/* Active Banner */}
          <div className="bg-trench-black p-2.5 rounded border-2 border-sandbag flex justify-between items-center">
            <div>
              <div className="text-[10px] font-mono text-gray-400 uppercase">ACTIVE COIN COMBAT</div>
              <h2 className="font-display text-xl text-lime-400 tracking-wider">
                {activeToken.name} ({activeToken.symbol})
              </h2>
            </div>
            {/* Timer Bomb */}
            <div className="text-right flex items-center gap-2">
              <span className="text-[10px] font-mono text-red-500 animate-pulse blink">● ARENA CLOSING</span>
              <div className="bg-red-950/80 px-2.5 py-1 rounded border border-red-600 font-mono text-lg font-bold text-red-400 animate-pulse">
                💣 0:{roundTimer < 10 ? `0${roundTimer}` : roundTimer}
              </div>
            </div>
          </div>

          {/* MOCK CHART WITH FLICKERING CRT LINES */}
          <div className="bg-black/80 h-44 rounded-md border border-sandbag relative p-2 flex flex-col justify-between overflow-hidden">
            <div className="absolute top-1 right-2 z-10 flex gap-2">
              <button 
                onClick={() => { setIsChartTypeLine(true); soundSynth.playBonk(); }}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${isChartTypeLine ? 'bg-lime-400 text-black font-bold' : 'bg-gray-800 text-gray-400'}`}
              >
                Line
              </button>
              <button 
                onClick={() => { setIsChartTypeLine(false); soundSynth.playBonk(); }}
                className={`text-[9px] font-mono px-1.5 py-0.5 rounded ${!isChartTypeLine ? 'bg-red-500 text-white font-bold' : 'bg-gray-800 text-gray-400'}`}
              >
                Crates
              </button>
            </div>

            {/* Simulated Grid lines */}
            <div className="absolute inset-0 grid grid-cols-6 grid-rows-4 pointer-events-none opacity-20">
              {Array.from({ length: 24 }).map((_, i) => (
                <div key={i} className="border-r border-b border-gray-600"></div>
              ))}
            </div>

            {/* Render chart logic */}
            {isChartTypeLine ? (
              <div className="w-full h-28 flex items-end relative px-2">
                {/* SVG path connecting historic prices */}
                <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                  <path
                    d={`M 0 50 L 20 ${60 - (activeToken.history[1] / activeToken.history[0]) * 10} L 40 ${60 - (activeToken.history[2] / activeToken.history[1]) * 15} L 60 ${50 - (activeToken.history[3] / activeToken.history[2]) * 10} L 80 ${45 - (activeToken.history[4] / activeToken.history[3]) * 15} L 100 ${35 - (activeToken.price / activeToken.history[4]) * 20}`}
                    fill="none"
                    stroke={activeToken.change24h >= 0 ? "#2ae500" : "#ff073a"}
                    strokeWidth="4"
                  />
                </svg>
                {/* Visual pulsating dot for current price */}
                <div className="absolute right-0 bottom-1/3 w-3 h-3 bg-lime-400 rounded-full animate-ping opacity-60"></div>
              </div>
            ) : (
              <div className="w-full h-28 flex items-end justify-between px-2 gap-1.5 pt-4">
                {activeToken.history.map((h, idx) => {
                  const barHeight = Math.min(Math.max((h / activeToken.price) * 45, 10), 95);
                  const isUp = idx === 0 ? true : h >= activeToken.history[idx - 1];
                  return (
                    <div key={idx} className="flex-1 flex flex-col items-center justify-end h-full">
                      <div className="text-[7px] font-mono text-gray-600">${h.toFixed(6).slice(-4)}</div>
                      <div 
                        style={{ height: `${barHeight}%` }} 
                        className={`w-full border rounded-t ${isUp ? 'bg-lime-900 border-lime-400' : 'bg-red-950 border-red-500'}`}
                      ></div>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Current combat price tag */}
            <div className="flex justify-between items-center text-[10px] font-mono border-t border-gray-800 pt-1.5 z-10 bg-black/50">
              <span className="text-gray-400">Combat Feed:</span>
              <span className={`font-bold ${activeToken.change24h >= 0 ? "text-lime-400" : "text-red-500"}`}>
                ${activeToken.price.toFixed(activeToken.id === "wif" ? 3 : 8)}
              </span>
            </div>
          </div>

          {/* TWO POOLS MOCK BALANCES */}
          <div className="grid grid-cols-2 gap-3 mb-2">
            <div className="bg-lime-950/20 border-2 border-lime-500/30 p-2.5 rounded text-center">
              <div className="font-display text-xs text-lime-400 flex items-center justify-center gap-1">
                <Rocket className="w-3.5 h-3.5 animate-bounce" /> MOON POOL
              </div>
              <p className="font-mono text-lg font-bold text-lime-400">{activeToken.moonPool.toFixed(1)} SOL</p>
              <div className="w-full bg-black h-1.5 rounded-full overflow-hidden mt-1 bg-gray-900 border border-gray-800">
                <div 
                  className="bg-lime-400 h-full" 
                  style={{ width: `${(activeToken.moonPool / (activeToken.moonPool + activeToken.jeetPool || 1)) * 100}%` }}
                ></div>
              </div>
              <span className="text-[9px] font-mono text-gray-500">Bullish on upswing</span>
            </div>

            <div className="bg-red-950/20 border-2 border-red-500/30 p-2.5 rounded text-center">
              <div className="font-display text-xs text-red-500 flex items-center justify-center gap-1">
                <Skull className="w-3.5 h-3.5" /> JEET POOL
              </div>
              <p className="font-mono text-lg font-bold text-red-500">{activeToken.jeetPool.toFixed(1)} SOL</p>
              <div className="w-full bg-black h-1.5 rounded-full overflow-hidden mt-1 bg-gray-900 border border-gray-800">
                <div 
                  className="bg-red-500 h-full" 
                  style={{ width: `${(activeToken.jeetPool / (activeToken.moonPool + activeToken.jeetPool || 1)) * 100}%` }}
                ></div>
              </div>
              <span className="text-[9px] font-mono text-gray-500">Bearish on rug</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN (4 cols): WEAPONS ARMORY / BET CREATION SLIP */}
        <div className="lg:col-span-4 flex flex-col gap-3 bg-mud-brown/60 p-3 border-2 border-sandbag rounded justify-between">
          <div className="flex flex-col gap-2.5">
            <h3 className="font-display text-lg text-yellow-500 flex items-center gap-1 border-b border-sandbag pb-2 uppercase">
              <Award className="w-4 h-4 text-lime-400" /> STANCE CONFIGURATOR
            </h3>

            {/* CHOOSE COMBAT STANCE */}
            <div className="text-[10px] font-mono text-gray-400">1. PICK YOUR STANCE</div>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => {
                  setBetSide("MOON");
                  soundSynth.playLaserFart();
                }}
                className={`py-2 px-1 rounded font-display tracking-widest text-center border-2 uppercase text-sm ${
                  betSide === "MOON"
                    ? "bg-lime-500 text-black border-lime-400 font-bold shadow-[0_0_15px_#39FF14]"
                    : "bg-black/50 border-gray-800 text-lime-500 hover:border-lime-500/40"
                }`}
              >
                Bet Moon 🚀
              </button>
              <button
                onClick={() => {
                  setBetSide("JEET");
                  soundSynth.playExplosion();
                }}
                className={`py-2 px-1 rounded font-display tracking-widest text-center border-2 uppercase text-sm ${
                  betSide === "JEET"
                    ? "bg-red-600 text-white border-red-500 font-bold shadow-[0_0_15px_#FF073A]"
                    : "bg-black/50 border-gray-800 text-red-500 hover:border-red-500/40"
                }`}
              >
                Bet Jeet 💀
              </button>
            </div>

            {/* CHOOSE SOL AMOUNT */}
            <div className="text-[10px] font-mono text-gray-400 mt-2">2. AMMUNITION (SOL)</div>
            <div className="grid grid-cols-4 gap-1.5">
              {[0.05, 0.1, 0.5, 2.0].map((num) => (
                <button
                  key={num}
                  onClick={() => {
                    setBetAmount(num);
                    soundSynth.playBonk();
                  }}
                  className={`py-1 rounded font-mono text-xs border text-center ${
                    betAmount === num
                      ? "bg-yellow-400 text-black font-extrabold border-yellow-300"
                      : "bg-trench-black border-gray-800 hover:border-sandbag"
                  }`}
                >
                  {num} SOL
                </button>
              ))}
            </div>

            {/* Custom slider */}
            <input 
              type="range" 
              min="0.01" 
              max="5.0" 
              step="0.01" 
              value={betAmount} 
              onChange={(e) => setBetAmount(parseFloat(e.target.value))}
              className="w-full accent-yellow-400 bg-trench-black border border-gray-700 h-2 rounded-lg cursor-pointer mt-1"
            />
            <div className="flex justify-between items-center font-mono text-[10px] text-gray-500 px-1">
              <span>Min: 0.01 SOL</span>
              <span className="text-yellow-400 font-bold">Amt: {betAmount} SOL</span>
              <span>Max: 5.0 SOL</span>
            </div>
          </div>

          {/* LAUNCH BUTTON */}
          <div className="mt-3">
            <button
              onClick={handlePlaceBet}
              className="w-full font-display tracking-widest uppercase text-xl py-3 rounded-md bg-yellow-400 hover:bg-yellow-500 active:translate-y-1 text-black font-extrabold shadow-[0_4px_0_#9A7d00] border border-yellow-300 transition-all flex items-center justify-center gap-2"
            >
              <Sparkles className="w-5 h-5 text-black animate-spin-slow" /> STAKE ON POT!
            </button>
            {activeBets.length > 0 && (
              <div className="mt-2 bg-yellow-950/50 border border-yellow-600/50 p-1.5 rounded text-center">
                <span className="font-mono text-[10px] text-yellow-300 animate-pulse">
                  🎯 In Trench: {activeBets.reduce((acc, b) => acc + b.amount, 0).toFixed(2)} SOL deployed
                </span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* FOOTER SECTION: JEET ALERT COMMUNICATIONS (LEFT) & GAMEPLAY LOG (RIGHT) */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 z-10 select-none">
        {/* Jeet intelligence alerts */}
        <div className="bg-mud-brown border-2 border-sandbag rounded p-3 h-32 flex flex-col justify-between">
          <div className="flex items-center gap-1 border-b border-sandbag pb-1 text-yellow-500">
            <Radio className="w-4 h-4 text-red-500 animate-pulse" />
            <span className="font-display tracking-wide uppercase text-xs">Jeet Communications Radar</span>
          </div>
          <div className="flex-1 overflow-y-auto mt-1 flex flex-col gap-1 pr-1">
            {alerts.map((al, idx) => (
              <div key={idx} className="font-mono text-[10px] text-gray-300 flex items-start gap-1">
                <span className="text-red-500">↳</span>
                <span>{al}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Play log and activities */}
        <div className="bg-mud-brown border-2 border-sandbag rounded p-3 h-32 flex flex-col justify-between">
          <div className="flex items-center gap-1 border-b border-sandbag pb-1 text-yellow-500">
            <Terminal className="w-4 h-4 text-lime-400" />
            <span className="font-display tracking-wide uppercase text-xs">Battle Command Intelligence Log</span>
          </div>
          <div className="flex-1 overflow-y-auto mt-1 flex flex-col gap-1.5 pr-1">
            {gameLogs.map((log, idx) => (
              <div key={idx} className="font-mono text-[10px] text-lime-400/90 leading-tight">
                {log}
              </div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
