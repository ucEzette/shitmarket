'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppState, Room, ChatMessage } from '@/store/useAppState';
import { PixelGasMask, PixelBarbedWire } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { Bomb, Send, ArrowLeft, ShieldAlert, Award, MessageSquare, AlertTriangle, Swords, Flame, Coins, Loader2 } from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import confetti from 'canvas-confetti';

interface MortarProjectile {
  id: number;
  side: 'moon' | 'jeet';
  tx: number;
  ty: number;
  txHalf: number;
  tyPeak: number;
}

interface ExplosionParticles {
  id: number;
  side: 'moon' | 'jeet';
  x: number;
  y: number;
}

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const { rooms, user, chatMessages, placeBet, claimWinnings, addMessage, connectWallet, isTransactionLoading, fetchSingleRoom, fetchRoomChats, sendRoomChat } = useAppState();

  const [selectedSide, setSelectedSide] = useState<'moon' | 'jeet'>('moon');
  const [activeChatTab, setActiveChatTab] = useState<'moon' | 'jeet'>('moon');
  const [stakeAmount, setStakeAmount] = useState<number>(0.1);
  const [chatInput, setChatInput] = useState('');
  const [countdownText, setCountdownText] = useState('00:00:00');
  const [isRoomSettling, setIsRoomSettling] = useState(false);
  const [localShake, setLocalShake] = useState(false);
  const [isChartLoading, setIsChartLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(true);
  const [isChartCollapsed, setIsChartCollapsed] = useState(false);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  
  // Mortar animation states
  const [mortars, setMortars] = useState<MortarProjectile[]>([]);
  const [explosions, setExplosions] = useState<ExplosionParticles[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);

  const room = rooms.find((r) => r.id === roomId);

  // Synchronize room details from indexer API and chain on mount & periodically
  useEffect(() => {
    let active = true;
    setIsLoading(true);
    Promise.all([
      fetchSingleRoom(roomId),
      fetchRoomChats(roomId)
    ]).then(() => {
      if (active) setIsLoading(false);
    }).catch(() => {
      if (active) setIsLoading(false);
    });

    const interval = setInterval(() => {
      fetchSingleRoom(roomId);
    }, 5000);

    return () => {
      active = false;
      clearInterval(interval);
    };
  }, [roomId, fetchSingleRoom]);

  // Poll DexScreener for live token price updating every 5 seconds
  useEffect(() => {
    if (!room || room.status !== 'active') return;

    const fetchLivePrice = async () => {
      try {
        const dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${room.token.address}`;
        const res = await fetch(dsUrl);
        if (res.ok) {
          const json = await res.json();
          const pairs = json?.pairs || [];
          if (pairs.length > 0) {
            const sorted = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
            const bestPair = sorted[0];
            const price = parseFloat(bestPair.priceUsd);
            if (isFinite(price) && price > 0) {
              setLivePrice(price);
            }
          }
        }
      } catch (err) {
        console.warn('Failed to fetch live price inside room details:', err);
      }
    };

    fetchLivePrice();
    const priceInterval = setInterval(fetchLivePrice, 5000);
    return () => clearInterval(priceInterval);
  }, [room?.token?.address, room?.status]);

  // Auto scroll chat list to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChatTab]);

  // Real-time ticking clock for this specific room
  useEffect(() => {
    if (!room) return;

    const timer = setInterval(() => {
      const now = Date.now();
      if (room.status !== 'active') {
        setCountdownText('SETTLED');
        clearInterval(timer);
        return;
      }

      const delta = room.expiry - now;
      if (delta <= 0) {
        setCountdownText('SETTLED');
        setIsRoomSettling(true);
        clearInterval(timer);
        return;
      }

      const hrs = Math.floor(delta / 3600000);
      const mins = Math.floor((delta % 3600000) / 60000);
      const secs = Math.floor((delta % 60000) / 1000);
      const format = (v: number) => String(v).padStart(2, '0');
      setCountdownText(`${format(hrs)}:${format(mins)}:${format(secs)}`);
    }, 1000);

    return () => clearInterval(timer);
  }, [room]);

  if (isLoading && !room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center select-none bg-trench-black scanlines">
        <Loader2 size={48} className="animate-spin text-neon-moon mb-4" />
        <h3 className="font-staatliches text-2xl text-white uppercase tracking-wider">RECONSTRUCTING COURIER INTEL...</h3>
        <p className="font-mono text-xs text-trench-gasmask mt-2 uppercase font-bold tracking-widest animate-pulse">
          Decrypting block records and indexing battlefield sector...
        </p>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center py-24 text-center select-none bg-trench-black">
        <PepePortrait src={PEPE_ASSETS.jeetSkeleton} size={120} glowColor="jeet" animated className="rounded-xl mb-6" />
        <h3 className="font-staatliches text-3xl text-white uppercase tracking-wider">TRENCH RUGGED!</h3>
        <p className="font-mono text-sm text-trench-gasmask mt-2 uppercase max-w-xs font-bold leading-relaxed mb-6">
          This trench sector does not exist or has been collapsed by artillery fire.
        </p>
        <button onClick={() => router.push('/rooms')} className="btn-wood px-6 py-2 rounded">
          RETREAT TO FRONTLINES
        </button>
      </div>
    );
  }

  // Calculate percentages
  const totalPot = room.moonPool + room.jeetPool;
  const moonPercentage = totalPot > 0 ? (room.moonPool / totalPot) * 100 : 50;
  const jeetPercentage = totalPot > 0 ? (room.jeetPool / totalPot) * 100 : 50;

  // Potential payout calculation (plat fee is 1.25%)
  const getPotentialPayout = (side: 'moon' | 'jeet') => {
    const isMoon = side === 'moon';
    const futureWinningPool = (isMoon ? room.moonPool : room.jeetPool) + stakeAmount;
    const futureLosingPool = isMoon ? room.jeetPool : room.moonPool;
    const futureTotalPot = futureWinningPool + futureLosingPool;
    const netPot = futureTotalPot * 0.98;
    const shareRatio = stakeAmount / futureWinningPool;
    const payout = shareRatio * netPot;
    return isNaN(payout) ? 0 : Number(payout.toFixed(4));
  };

  const getMultiplier = (side: 'moon' | 'jeet') => {
    const pool = side === 'moon' ? room.moonPool : room.jeetPool;
    const oppPool = side === 'moon' ? room.jeetPool : room.moonPool;
    if (pool === 0) return 2.0;
    const mult = (pool + oppPool) / pool;
    return isNaN(mult) ? 1.0 : Number(mult.toFixed(2));
  };

  // Find user wagers in this room
  const userBetsInRoom = user ? user.bets.filter((b) => b.roomId === room.id) : [];
  const userTotalBet = userBetsInRoom.reduce((sum, b) => sum + b.amount, 0);
  const userSidesChosen = Array.from(new Set(userBetsInRoom.map((b) => b.side)));
  
  const hasBetOnMoon = userSidesChosen.includes('moon');
  const hasBetOnJeet = userSidesChosen.includes('jeet');

  const handleCharge = () => {
    if (!user || !user.wallet) {
      connectWallet();
      synthSound('bet');
      return;
    }

    if (user.balance < stakeAmount) {
      alert('INSUFFICIENT AMMO SOL IN WALLET!');
      return;
    }

    // Dynamic projectile physics relative values
    const tx = selectedSide === 'moon'
      ? -100 - Math.random() * 200 // Left field target
      : 100 + Math.random() * 200; // Right field target
    const ty = -60 - Math.random() * 120; // Arc peak offset
    const txHalf = tx / 2;
    const tyPeak = ty - 100;

    const newMortar: MortarProjectile = {
      id: Date.now(),
      side: selectedSide,
      tx,
      ty,
      txHalf,
      tyPeak
    };

    // Trigger mortar whistle sound synthesis!
    synthSound('whistle');
    setMortars((prev) => [...prev, newMortar]);
    setLocalShake(true);

    // After flight finishes (800ms)
    setTimeout(() => {
      setLocalShake(false);
      synthSound('explosion');
      
      // Spawn explosion particle
      const newExplosion: ExplosionParticles = {
        id: Date.now(),
        side: selectedSide,
        x: tx,
        y: ty
      };
      setExplosions((prev) => [...prev, newExplosion]);

      // Remove projectile
      setMortars((prev) => prev.filter((m) => m.id !== newMortar.id));

      // Clean up explosion particle after 500ms
      setTimeout(() => {
        setExplosions((prev) => prev.filter((e) => e.id !== newExplosion.id));
      }, 500);
    }, 800);

    placeBet(room.id, selectedSide, stakeAmount);
  };

  const handleClaim = () => {
    if (!user) return;
    claimWinnings(room.id);
    synthSound('victory');
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.8 },
      colors: ['#FFD700', '#39FF14']
    });
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userAddr = user && user.wallet ? `${user.wallet.substring(0, 6)}...${user.wallet.substring(user.wallet.length - 4)}` : 'Recruit';
    
    sendRoomChat(room.id, activeChatTab, userAddr, chatInput.trim());

    setChatInput('');
    synthSound('bet');
  };

  // Filter messages for current room and active chat tab (plus all-channels alerts)
  const activeRoomChats = chatMessages.filter(
    (c) => c.roomId === room.id && (c.side === activeChatTab || c.side === 'all')
  );

  const isSettled = room.status === 'settled';
  const userWon = isSettled && room.winner && userSidesChosen.includes(room.winner as any);
  const userLost = isSettled && room.winner && userSidesChosen.length > 0 && !userSidesChosen.includes(room.winner as any);
  const hasUnclaimed = isSettled && userWon && userBetsInRoom.some((b) => !b.claimed);

  return (
    <div className={`w-full flex-1 flex flex-col select-none relative transition-transform duration-100 ${
      localShake || (userLost && isSettled) ? 'heavy-shake' : ''
    }`}>
      
      {/* 1. Wood buttons style sheet */}
      <style dangerouslySetInnerHTML={{ __html: `
        .wood-btn {
            background-color: #5C3A21;
            border-bottom: 4px solid #3A2512;
            transition: all 0.1s;
        }
        .wood-btn:active {
            border-bottom: 0px solid #3A2512;
            transform: translateY(4px);
        }

        .neon-glow {
            box-shadow: 0 0 15px 2px rgba(57, 255, 20, 0.5);
        }
        
        .jeet-glow {
            box-shadow: 0 0 15px 2px rgba(255, 83, 90, 0.5);
        }

        .heavy-shake {
            animation: heavy-shake 0.8s cubic-bezier(.36,.07,.19,.97) both;
        }

        @keyframes heavy-shake {
            0%, 100% { transform: translate3d(0, 0, 0); }
            10%, 30%, 50%, 70%, 90% { transform: translate3d(-8px, 4px, 0) rotate(-1deg); }
            20%, 40%, 60%, 80% { transform: translate3d(8px, -4px, 0) rotate(1deg); }
        }

        /* Mortar System Styles */
        .mortar-container {
            position: absolute;
            inset: 0;
            pointer-events: none;
            z-index: 20;
            overflow: hidden;
        }

        .mortar {
            position: absolute;
            width: 6px;
            height: 6px;
            border-radius: 50%;
            pointer-events: none;
            animation: mortarArc cubic-bezier(.25,.1,.25,1) forwards 0.8s;
        }

        .mortar-moon {
            background-color: #39ff14;
            box-shadow: 0 0 10px #39ff14, 0 0 20px #39ff14, -10px 10px 20px rgba(57, 255, 20, 0.5);
        }

        .mortar-jeet {
            background-color: #ff535a;
            box-shadow: 0 0 10px #ff535a, 0 0 20px #ff535a, 10px 10px 20px rgba(255, 83, 90, 0.5);
        }

        @keyframes mortarArc {
            0% {
                transform: translate(0, 0) scale(1);
                opacity: 1;
            }
            50% {
                transform: translate(var(--tx-half), var(--ty-peak)) scale(1.8);
            }
            95% {
                transform: translate(var(--tx), var(--ty)) scale(1);
                opacity: 1;
            }
            100% {
                transform: translate(var(--tx), var(--ty)) scale(0);
                opacity: 0;
            }
        }

        .explosion {
            position: absolute;
            border-radius: 50%;
            transform: translate(-50%, -50%);
            animation: explode 0.5s ease-out forwards;
            pointer-events: none;
            mix-blend-mode: screen;
        }

        .explosion-moon {
            background: radial-gradient(circle, rgba(57,255,20,1) 0%, rgba(57,255,20,0) 70%);
        }

        .explosion-jeet {
            background: radial-gradient(circle, rgba(255,83,90,1) 0%, rgba(255,83,90,0) 70%);
        }

        @keyframes explode {
            0% {
                width: 0;
                height: 0;
                opacity: 1;
            }
            100% {
                width: 140px;
                height: 140px;
                opacity: 0;
            }
        }
      ` }} />

      {/* 2. THE SPLIT-SCREEN TRENCH HEADER (Full-Bleed Across Screen) */}
      <section className="relative w-full h-[28vh] sm:h-[40vh] md:h-[48vh] overflow-hidden border-b-4 border-trench-sandbag flex z-10 scanlines" id="battlefield">
        
        {/* Real-time Mortar Container Overlay */}
        <div className="mortar-container" id="mortar-container">
          {mortars.map((m) => (
            <div
              key={m.id}
              className={`mortar ${m.side === 'moon' ? 'mortar-moon' : 'mortar-jeet'}`}
              style={{
                left: '50%',
                bottom: '0px',
                '--tx': `${m.tx}px`,
                '--ty': `${m.ty}px`,
                '--tx-half': `${m.txHalf}px`,
                '--ty-peak': `${m.tyPeak}px`,
              } as React.CSSProperties}
            />
          ))}
          {explosions.map((e) => (
            <div
              key={e.id}
              className={`explosion ${e.side === 'moon' ? 'explosion-moon' : 'explosion-jeet'}`}
              style={{
                left: `calc(50% + ${e.x}px)`,
                bottom: `calc(10px + ${Math.abs(e.y)}px)`,
              }}
            />
          ))}
        </div>

        {/* Left Side: Moon Army (Charging Pepes) */}
        <div className="w-1/2 h-full bg-trench-black relative group overflow-hidden border-r-2 border-dashed border-trench-sandbag/40">
          <div className="absolute inset-0">
            <img 
              alt="Moon Army Charging" 
              className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-700 filter sepia saturate-[350%] hue-rotate-[85deg] contrast-[1.2]" 
              src={PEPE_ASSETS.moonJuice}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-r from-trench-black via-neon-moon/30 to-transparent mix-blend-color opacity-90 pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-r from-trench-black/80 via-transparent to-transparent pointer-events-none"></div>
          
          {/* Moon Army Commander Portrait */}
          <div className="absolute top-2 left-2 md:top-4 md:left-4 border-2 border-dashed border-neon-moon bg-trench-black/85 px-1.5 py-0.5 md:px-3 md:py-1 rotate-[-4deg] shadow-lg flex items-center gap-1.5">
            <PepePortrait src={PEPE_ASSETS.chadBull} size={20} loading="eager" className="rounded-full sm:size-[28px]" />
            <span className="font-staatliches text-neon-moon text-[8px] sm:text-[10px] md:text-base tracking-widest block glow-moon">BULLISH TRENCH</span>
          </div>

          <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 bg-trench-black/90 border border-neon-moon/30 p-1.5 md:p-2.5 rounded shadow-lg min-w-[80px] sm:min-w-[120px]">
            <span className="font-mono text-[7px] sm:text-[9px] text-neon-moon block font-bold uppercase tracking-wider">MOON POT</span>
            <span className="font-staatliches text-xs sm:text-lg md:text-2xl text-white block mt-0.5">{room.moonPool.toFixed(2)} SOL</span>
          </div>
        </div>

        {/* Right Side: Jeet Army (Charging Wojak Skeletons) */}
        <div className="w-1/2 h-full bg-trench-black relative group overflow-hidden">
          <div className="absolute inset-0">
            <img 
              alt="Jeet Skeleton Forces" 
              className="w-full h-full object-cover opacity-75 group-hover:scale-105 transition-transform duration-700 filter sepia saturate-[400%] hue-rotate-[320deg] contrast-[1.2]" 
              src={PEPE_ASSETS.jeetSkeleton}
            />
          </div>
          <div className="absolute inset-0 bg-gradient-to-l from-trench-black via-jeet-red/30 to-transparent mix-blend-color opacity-90 pointer-events-none"></div>
          <div className="absolute inset-0 bg-gradient-to-l from-trench-black/80 via-transparent to-transparent pointer-events-none"></div>

          {/* Jeet Commander Portrait */}
          <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 border-2 border-dashed border-jeet-red bg-trench-black/85 px-1.5 py-0.5 md:px-3 md:py-1 rotate-[4deg] shadow-lg flex items-center gap-1.5">
            <span className="font-staatliches text-jeet-red text-[8px] sm:text-[10px] md:text-base tracking-widest block glow-jeet">BEARISH WASTELAND</span>
            <PepePortrait src={PEPE_ASSETS.neonWojak} size={20} loading="eager" className="rounded-full sm:size-[28px]" />
          </div>

          <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-trench-black/90 border border-jeet-red/30 p-1.5 md:p-2.5 rounded shadow-lg min-w-[80px] sm:min-w-[120px] text-right">
            <span className="font-mono text-[7px] sm:text-[9px] text-jeet-red block font-bold uppercase tracking-wider">JEET POT</span>
            <span className="font-staatliches text-xs sm:text-lg md:text-2xl text-white block mt-0.5">{room.jeetPool.toFixed(2)} SOL</span>
          </div>
        </div>

        {/* Absolute Center Swords Emblem & Active Target Status */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none text-center">
          <div className="bg-trench-mud border-2 sm:border-4 border-trench-sandbag rounded-full w-12 h-12 sm:w-16 sm:h-16 md:w-24 md:h-24 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.9)] relative animate-pulse">
            <div className="absolute inset-1 rounded-full border border-dashed border-trench-gasmask/60 opacity-60"></div>
            <Swords size={18} className="text-white sm:size-[24px] md:size-[36px]" />
          </div>
          <div className="mt-2 md:mt-4 bg-trench-black border-2 border-trench-sandbag px-2 py-0.5 md:px-3.5 md:py-1.5 shadow-2xl rounded">
            <p className="font-mono text-[6px] sm:text-[8px] text-trench-gasmask uppercase font-bold tracking-widest">YOU ARE FIGHTING FOR:</p>
            {userTotalBet > 0 ? (
              <span className={`font-staatliches text-[10px] sm:text-sm md:text-lg block tracking-wider ${
                hasBetOnMoon && hasBetOnJeet
                  ? 'text-moon-gold font-bold'
                  : hasBetOnMoon
                  ? 'text-neon-moon font-bold glow-moon'
                  : 'text-jeet-red font-bold glow-jeet'
              }`}>
                {hasBetOnMoon && hasBetOnJeet
                  ? 'BOTH SIDES'
                  : hasBetOnMoon
                  ? 'MOON ARMY'
                  : 'JEET SQUAD'}
              </span>
            ) : (
              <span className="font-staatliches text-[10px] sm:text-sm md:text-lg text-trench-gasmask font-bold block uppercase tracking-wider">
                OBSERVER
              </span>
            )}
          </div>
        </div>

        {/* Dynamic Double-Bar VS Progress Indicator Overlay */}
        <div className="absolute bottom-0 left-0 w-full h-3 flex">
          <div style={{ width: `${moonPercentage}%` }} className="bg-neon-moon h-full shadow-[inset_0_-2px_10px_#39ff14]" />
          <div style={{ width: `${jeetPercentage}%` }} className="bg-jeet-red h-full shadow-[inset_0_-2px_10px_#ff535a]" />
        </div>
      </section>

      {/* 3. MAIN GRID WRAPPER */}
      <div className="max-w-7xl w-full mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 items-start relative z-10">
        
        {/* Left Column: Briefing & Comms Panel */}
        <div className="lg:col-span-8 flex flex-col gap-8">
          
          {/* Back Navigation Bar */}
          <div className="flex items-center justify-between bg-trench-mud border-2 border-trench-sandbag p-3 rounded">
            <Link href="/rooms" className="inline-flex items-center gap-1.5 text-trench-gasmask hover:text-white font-mono text-xs uppercase font-bold transition-colors">
              <ArrowLeft size={14} /> RETREAT TO WAR TABLE
            </Link>
            <div className="flex items-center gap-1.5">
              <span className="h-2 w-2 rounded-full bg-neon-moon animate-ping" />
              <span className="font-mono text-[10px] text-neon-moon font-bold uppercase tracking-wider">POT LIVE</span>
            </div>
          </div>

          {/* Unified Operation & Stats Section */}
          <div className="bg-trench-black/80 border-b-4 border-trench-sandbag p-6 relative overflow-hidden space-y-6">
            
            {/* Header: Token Info & Total Pot */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-2">
                  <span className="bg-trench-black border border-trench-sandbag text-trench-gasmask px-2.5 py-0.5 font-mono text-[9px] uppercase rounded-sm font-bold">
                    SECTOR #{room.id.substring(0, 4)}
                  </span>
                  <span className="bg-neon-moon/10 border border-neon-moon text-neon-moon px-2.5 py-0.5 font-mono text-[9px] uppercase rounded-sm font-bold animate-pulse">
                    BATTLE LIVE
                  </span>
                </div>
                <h1 className="font-staatliches text-3xl md:text-4xl text-white tracking-wider uppercase flex items-center gap-3">
                  <div className="w-10 h-10 flex items-center justify-center shrink-0">
                    {room.token.icon && room.token.icon.startsWith('http') ? (
                      <img src={room.token.icon} alt={room.token.symbol} className="w-full h-full object-cover rounded-full border-2 border-neon-moon shadow-glow-moon" />
                    ) : (
                      <span className="text-3xl">{room.token.icon || '📊'}</span>
                    )}
                  </div>
                  OPERATION: {room.token.name} (${room.token.symbol})
                  {room.token.chainId && (
                    <span className="ml-3 text-xs bg-gray-800 text-gray-300 px-2 py-1 rounded-full uppercase border border-gray-600">
                      {room.token.chainId}
                    </span>
                  )}
                </h1>
              </div>
              <div className="text-left md:text-right bg-trench-mud border-2 border-trench-sandbag p-3 rounded-lg shadow-lg">
                <p className="font-mono text-[9px] text-trench-gasmask font-bold uppercase tracking-wider">TOTAL POT SIZE</p>
                <p className="font-staatliches text-3xl text-moon-gold flex items-center gap-1 md:justify-end glow-gold leading-none mt-1">
                  <Flame size={22} className="text-moon-gold" />
                  <span>{totalPot.toFixed(2)} SOL</span>
                </p>
              </div>
            </div>

            {/* Degen Briefing */}
            <div className="font-mono text-sm text-trench-gasmask leading-relaxed font-bold uppercase bg-trench-black border border-trench-sandbag p-4 rounded border-l-4 border-l-neon-moon">
              <p>
                INTEL BRIEF: A massive breakout attempt is underway for <span className="text-neon-moon">${room.token.symbol}</span>. 
                Jeet and Moon forces are locked in heavy combat. Will the chart go parabolic, or will it drill to the Earth's core? Stake your Ammo SOL to tilt the battlefield before the bomb drops!
              </p>
            </div>

            {/* Comprehensive Stats Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3 relative z-10">
              <div className="bg-trench-black border border-trench-sandbag p-3 rounded text-center shadow-inner">
                <span className="font-mono text-[9px] text-trench-gasmask block font-bold uppercase">ENTRY PRICE</span>
                <span className="font-staatliches text-lg text-white block mt-0.5">
                  {room.openingPrice !== undefined 
                    ? `$${room.openingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` 
                    : 'UNKNOWN'}
                </span>
              </div>
              <div className="bg-trench-black border border-trench-sandbag p-3 rounded text-center shadow-inner">
                <span className="font-mono text-[9px] text-trench-gasmask block font-bold uppercase">LAST PRICE</span>
                <span className="font-staatliches text-lg text-white block mt-0.5 animate-pulse">
                  {room.status === 'settled' && room.finalTWAP !== undefined
                    ? `$${room.finalTWAP.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
                    : livePrice !== null
                    ? `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
                    : 'ACTIVE'}
                </span>
              </div>
              <div className="bg-trench-mud border border-neon-moon/40 p-3 rounded text-center shadow-glow-moon">
                <span className="font-mono text-[9px] text-neon-moon block font-bold uppercase">MOON POT</span>
                <span className="font-staatliches text-xl text-neon-moon block mt-0.5">{room.moonPool.toFixed(2)} SOL</span>
              </div>
              <div className="bg-trench-mud border border-jeet-red/40 p-3 rounded text-center shadow-glow-jeet">
                <span className="font-mono text-[9px] text-jeet-red block font-bold uppercase">JEET POT</span>
                <span className="font-staatliches text-xl text-jeet-red block mt-0.5">{room.jeetPool.toFixed(2)} SOL</span>
              </div>
              <div className="bg-trench-black border border-trench-sandbag p-3 rounded text-center relative overflow-hidden col-span-2 sm:col-span-1">
                <div className="absolute inset-0 bg-moon-gold/5 animate-pulse" />
                <span className="font-mono text-[9px] text-moon-gold block font-bold uppercase relative z-10">BOMB DROPS IN</span>
                <span className="font-staatliches text-xl text-moon-gold block mt-0.5 tracking-wider flex items-center gap-1 justify-center relative z-10">
                  <Bomb size={16} className="text-moon-gold" />
                  <span>{countdownText}</span>
                </span>
              </div>
            </div>

          </div>

          {/* DexScreener Live Chart */}
          {room.token.chainId && room.token.pairAddress && (
            <div className={`bg-trench-black border-4 border-trench-sandbag rounded-lg shadow-2xl relative overflow-hidden transition-all duration-300 ${
              isChartCollapsed ? 'h-[60px]' : 'h-[500px]'
            }`}>
              <div className="absolute top-2 right-4 z-30">
                <button
                  type="button"
                  onClick={() => setIsChartCollapsed(!isChartCollapsed)}
                  className="bg-trench-mud hover:bg-trench-sandbag border border-trench-sandbag text-neon-moon px-2.5 py-1 rounded font-mono text-[10px] font-bold uppercase tracking-wider transition-all"
                >
                  {isChartCollapsed ? 'EXPAND TERMINAL' : 'COLLAPSE TERMINAL'}
                </button>
              </div>

              <div className="absolute top-[-16px] left-[50%] -translate-x-[50%] bg-trench-sandbag border-2 border-trench-gasmask text-white px-6 py-1 rounded font-staatliches text-sm tracking-widest shadow uppercase z-20">
                LIVE TERMINAL
              </div>

              {!isChartCollapsed && (
                <>
                  {isChartLoading && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center bg-trench-black z-10 animate-pulse">
                      <Loader2 size={32} className="animate-spin text-neon-moon mb-4" />
                      <span className="font-mono text-xs text-trench-gasmask font-bold uppercase tracking-widest">
                        CONNECTING TO DEXSCREENER TERMINAL...
                      </span>
                    </div>
                  )}
                  <iframe
                    className={`w-full h-full mt-4 border-none transition-opacity duration-500 ${isChartLoading ? 'opacity-0' : 'opacity-100'}`}
                    src={`https://dexscreener.com/${room.token.chainId}/${room.token.pairAddress}?embed=1&theme=dark&info=0&trades=0`}
                    title="DexScreener Chart"
                    onLoad={() => setIsChartLoading(false)}
                  ></iframe>
                </>
              )}
            </div>
          )}



          {/* Degen Comms Bandwidth (Bicameral Radio Comms) */}
          <div className="bg-trench-mud border-4 border-trench-sandbag rounded-lg shadow-2xl flex flex-col h-[420px] relative scanlines">
            <div className="absolute top-[-16px] left-[50%] -translate-x-[50%] bg-trench-sandbag border-2 border-trench-gasmask text-white px-6 py-1 rounded font-staatliches text-sm tracking-widest shadow uppercase z-10">
              RADIO BANDWIDTH
            </div>

            {/* Radio feed */}
            <div
              ref={chatScrollRef}
              className="flex-1 overflow-y-auto p-4 space-y-3 font-mono text-xs select-text scrollbar mt-2"
            >
              {activeRoomChats.length > 0 ? (
                activeRoomChats.map((msg, index) => {
                  const isHQ = msg.user.includes('HQ') || msg.user.includes('COMMAND');
                  const bubbleColor = isHQ
                    ? 'bg-yellow-500/10 border-yellow-500 text-yellow-200'
                    : msg.side === 'moon'
                    ? 'bg-neon-moon/5 border-neon-moon/20 text-green-200'
                    : 'bg-jeet-red/5 border-jeet-red/20 text-red-200';

                  return (
                    <div
                      key={index}
                      className={`p-2.5 rounded border shadow-inner flex items-start gap-2 ${bubbleColor}`}
                    >
                      <div className="w-6 h-6 flex-shrink-0 bg-trench-black border border-trench-sandbag rounded flex items-center justify-center font-staatliches text-[10px] text-white">
                        {msg.side === 'moon' ? '🐸' : '💀'}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-center mb-1 text-[10px] opacity-75 font-bold">
                          <span className={isHQ ? 'text-yellow-500 font-bold' : msg.side === 'moon' ? 'text-neon-moon' : 'text-jeet-red'}>
                            {msg.user}
                          </span>
                          <span>
                            {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                          </span>
                        </div>
                        <p className="leading-normal break-words font-bold uppercase text-[11px] font-mono">
                          {msg.message}
                        </p>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center p-4 text-trench-gasmask">
                  <MessageSquare size={32} className="opacity-40 animate-pulse mb-2" />
                  <span className="font-staatliches text-lg uppercase tracking-wide">
                    FREQUENCY QUIET
                  </span>
                  <span className="text-[10px] uppercase font-bold block max-w-xs">
                    No active operations comms intercepted on this link. Transmit to rally!
                  </span>
                </div>
              )}
            </div>

            {/* Chat Send input */}
            <form
              onSubmit={handleSendChat}
              className="p-3 border-t-2 border-trench-sandbag bg-trench-black flex gap-2 rounded-b-lg"
            >
              <input
                type="text"
                placeholder={`BROADCAST TO SQUAD...`}
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                className="flex-1 px-3 py-2 bg-trench-mud border border-trench-sandbag text-white text-xs font-mono rounded focus:border-neon-moon focus:outline-none uppercase placeholder-trench-gasmask/50 font-bold"
              />
              <button
                type="submit"
                className="px-4 py-2 bg-trench-sandbag hover:bg-trench-gasmask text-white rounded transition-colors flex items-center justify-center"
              >
                <Send size={14} />
              </button>
            </form>
          </div>

        </div>

        {/* Right Column: Loading Ammo Faction Crate (Load Ammo) */}
        <div className="lg:col-span-4 relative">
          
          <div className="sticky top-24 bg-trench-mud border-4 border-trench-sandbag p-6 shadow-2xl relative scanlines rounded-lg" id="bet-panel">
            {/* Decorative Corner Screws */}
            <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
            <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
            <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
            <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
            
            <div className="text-center border-b-2 border-trench-sandbag pb-4 mb-5">
              <PepePortrait src={selectedSide === 'moon' ? PEPE_ASSETS.chadBull : PEPE_ASSETS.jeetSkeleton} size={56} glowColor={selectedSide === 'moon' ? 'moon' : 'jeet'} animated className="rounded-full mx-auto mb-3" />
              <h3 className="font-staatliches text-3xl text-white tracking-wide uppercase">Deploy Capital</h3>
              <p className="font-mono text-[9px] text-trench-gasmask font-bold mt-0.5 uppercase tracking-widest">SELECT AMMUNITION YIELD</p>
            </div>

            {isSettled ? (
              // Concluded / Settled State card
              <div className="space-y-4 text-center py-4">
                <div className="bg-trench-black border border-trench-sandbag p-4 rounded text-center">
                  <span className="font-mono text-[9px] text-trench-gasmask block font-bold uppercase">BATTLE OUTCOME</span>
                  <span className={`font-staatliches text-3xl block mt-1 tracking-wider ${
                    room.winner === 'moon' ? 'text-neon-moon glow-moon' : 'text-jeet-red glow-jeet'
                  }`}>
                    {room.winner === 'moon' ? 'MOON ARMY WON' : 'JEET SQUADRON WON'}
                  </span>
                </div>

                {/* Tactical Skirmish Receipt / Evidence Card */}
                <div className="bg-trench-black border border-dashed border-trench-sandbag p-4 rounded text-left font-mono text-[10px] text-trench-gasmask uppercase space-y-2 relative">
                  <div className="absolute top-3 right-3 flex items-center gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-neon-moon animate-pulse" />
                    <span className="text-[7px] text-neon-moon font-bold tracking-wider">VERIFIED ON-CHAIN</span>
                  </div>
                  <h4 className="font-staatliches text-xs text-white tracking-widest border-b border-trench-sandbag pb-1.5 mb-2 flex items-center gap-1 font-bold">
                    🛡️ SKIRMISH RECEIPT & EVIDENCE
                  </h4>
                  <div className="flex justify-between items-center mt-1">
                    <span>SECTOR TARGET:</span>
                    <span className="text-white font-bold">${room.token.symbol}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>ENTRY PRICE:</span>
                    <span className="text-white font-bold">
                      ${room.openingPrice !== undefined ? room.openingPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>EXIT PRICE (SPOT):</span>
                    <span className="text-white font-bold">
                      ${room.finalPrice !== undefined ? room.finalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : 'N/A'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span>TWAP EXIT (EMA):</span>
                    <span className="text-moon-gold font-bold">
                      ${room.twapFinalPrice !== undefined ? room.twapFinalPrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : 'N/A'}
                    </span>
                  </div>
                  <div className="border-t border-dashed border-trench-sandbag pt-2 mt-2 flex justify-between items-center text-[7px] text-trench-gasmask/60">
                    <span>SECTOR KEY:</span>
                    <span className="select-all font-mono font-bold">{room.id.substring(0, 14)}...</span>
                  </div>
                </div>

                {userWon && (
                  <div className="p-4 bg-trench-black border-2 border-moon-gold rounded text-center relative overflow-hidden">
                    <Award size={36} className="text-moon-gold mx-auto mb-2 animate-bounce" />
                    <p className="font-mono text-[10px] text-white font-bold uppercase leading-relaxed">
                      YOUR FORCES DECREED VICTORY. WAR BONDS SECURED!
                    </p>
                    {hasUnclaimed ? (
                      <button
                        onClick={handleClaim}
                        disabled={isTransactionLoading}
                        className="w-full mt-4 py-3 bg-neon-moon hover:bg-green-500 disabled:bg-trench-sandbag disabled:text-trench-gasmask disabled:border-trench-sandbag font-staatliches text-xl text-black rounded border-b-4 border-green-800 shadow-glow-moon font-bold flex items-center justify-center gap-2"
                      >
                        {isTransactionLoading ? (
                          <>
                            <Loader2 className="animate-spin text-black shrink-0" size={20} />
                            <span>CLAIMING BOOTY...</span>
                          </>
                        ) : (
                          <span>CLAIM WAR WINNINGS🏆</span>
                        )}
                      </button>
                    ) : (
                      <div className="mt-4 p-2 bg-trench-mud border border-trench-sandbag rounded font-mono text-[9px] text-moon-gold uppercase font-bold">
                        🎉 Winnings Dispatched to Ammo Wallet!
                      </div>
                    )}
                  </div>
                )}

                {userLost && (
                  <div className="p-4 bg-red-950/40 border border-jeet-red rounded text-center">
                    <p className="font-mono text-[10px] text-jeet-red font-bold uppercase leading-relaxed animate-pulse">
                      YOU GOT EXIT LIQUIDITY STAMPED!
                    </p>
                    <button
                      onClick={() => router.push('/rooms')}
                      className="w-full mt-4 py-2 bg-trench-black hover:bg-trench-sandbag text-white border border-trench-sandbag font-staatliches text-base uppercase rounded font-bold"
                    >
                      RETREAT TO FRONTLINES
                    </button>
                  </div>
                )}

                {!userWon && !userLost && (
                  <div className="p-4 bg-trench-black border border-trench-sandbag rounded text-center">
                    <p className="font-mono text-[10px] text-trench-gasmask uppercase font-bold">
                      Sector closed. You did not participate in this skirmish.
                    </p>
                    <button
                      onClick={() => router.push('/rooms')}
                      className="w-full mt-4 py-2 bg-trench-sandbag hover:bg-trench-gasmask text-white font-staatliches text-base uppercase rounded font-bold"
                    >
                      CHOOSE NEXT TARGET
                    </button>
                  </div>
                )}

              </div>
            ) : room.expiry <= Date.now() ? (
              // Expired but not settled yet (Pending telemetry resolving)
              <div className="space-y-4 text-center py-4 animate-pulse">
                <div className="bg-trench-black border border-trench-sandbag p-4 rounded text-center">
                  <span className="font-mono text-[9px] text-trench-gasmask block font-bold uppercase">BATTLE OUTCOME PENDING</span>
                  <span className="font-staatliches text-2xl block mt-1 tracking-wider text-moon-gold glow-moon uppercase">
                    TELEMETRY RESOLVING
                  </span>
                </div>

                {userBetsInRoom.length > 0 ? (
                  <div className="p-4 bg-trench-black border border-trench-sandbag rounded text-center">
                    <p className="font-mono text-[10px] text-white font-bold uppercase leading-relaxed mb-4">
                      YOU HAVE ACTIVE FORCES IN THIS SECTOR! CHOOSE TO RESOLVE TRENCH VIA DEXSCREENER DATA TO REVEAL THE OUTCOME AND CLAIM BOOTY.
                    </p>
                    <button
                      onClick={handleClaim}
                      disabled={isTransactionLoading}
                      className="w-full py-3 bg-neon-moon hover:bg-green-500 disabled:bg-trench-sandbag disabled:text-trench-gasmask disabled:border-trench-sandbag font-staatliches text-xl text-black rounded border-b-4 border-green-800 shadow-glow-moon font-bold flex items-center justify-center gap-2 uppercase tracking-wider transition-all"
                    >
                      {isTransactionLoading ? (
                        <>
                          <Loader2 className="animate-spin text-black shrink-0" size={20} />
                          <span>RESOLVING DEXSCREENER & SETTLING...</span>
                        </>
                      ) : (
                        <span>RESOLVE & CLAIM🏆</span>
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="p-4 bg-trench-black border border-trench-sandbag rounded text-center">
                    <p className="font-mono text-[10px] text-trench-gasmask uppercase font-bold leading-relaxed mb-4">
                      Sector concluded. Settle now to process telemetry resolution.
                    </p>
                    <button
                      onClick={handleClaim}
                      disabled={isTransactionLoading}
                      className="w-full py-3 bg-trench-sandbag hover:bg-trench-gasmask disabled:bg-trench-black disabled:text-trench-gasmask text-white font-staatliches text-base uppercase rounded font-bold flex items-center justify-center gap-2"
                    >
                      {isTransactionLoading ? (
                        <>
                          <Loader2 className="animate-spin text-white shrink-0" size={16} />
                          <span>RESOLVING DEXSCREENER DATA...</span>
                        </>
                      ) : (
                        <span>RESOLVE TRENCH FOR KEEPER</span>
                      )}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              // Active Faction Selector + Slider controls
              <>
                {/* Faction selector buttons */}
                <div className="flex gap-3 mb-6">
                  <button
                    onClick={() => {
                      setSelectedSide('moon');
                      synthSound('bet');
                    }}
                    className={`flex-1 py-3 border-2 font-staatliches text-lg uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${
                      selectedSide === 'moon'
                        ? 'border-neon-moon bg-neon-moon/10 text-neon-moon shadow-glow-moon font-bold'
                        : 'border-trench-sandbag bg-trench-black text-trench-gasmask hover:text-white hover:border-white'
                    }`}
                  >
                    <span>🚀 MOON</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSide('jeet');
                      synthSound('bet');
                    }}
                    className={`flex-1 py-3 border-2 font-staatliches text-lg uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${
                      selectedSide === 'jeet'
                        ? 'border-jeet-red bg-jeet-red/10 text-jeet-red shadow-glow-jeet font-bold'
                        : 'border-trench-sandbag bg-trench-black text-trench-gasmask hover:text-white hover:border-white'
                    }`}
                  >
                    <span>💀 JEET</span>
                  </button>
                </div>

                {/* Amount selection crate slider */}
                <div className="mb-6 bg-trench-black p-4 border border-trench-sandbag rounded">
                  <div className="flex justify-between items-center mb-3">
                    <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase">PAYLOAD WEIGHT</span>
                    <span className="font-mono text-xs font-bold text-white tracking-wider">{stakeAmount.toFixed(2)} SOL</span>
                  </div>

                  {/* Radix Slider */}
                  <Slider.Root
                    className="relative flex items-center select-none touch-none w-full h-5"
                    value={[stakeAmount]}
                    onValueChange={(val) => setStakeAmount(val[0])}
                    min={0.01}
                    max={5.0}
                    step={0.05}
                  >
                    <Slider.Track className="bg-trench-mud relative grow rounded-full h-2.5 border border-trench-sandbag overflow-hidden">
                      <Slider.Range className={`absolute h-full rounded-full ${
                        selectedSide === 'moon' ? 'bg-neon-moon shadow-glow-moon' : 'bg-jeet-red shadow-glow-jeet'
                      }`} />
                    </Slider.Track>
                    <Slider.Thumb
                      className="block w-5 h-5 bg-moon-gold border-2 border-trench-black rounded-full hover:scale-110 focus:outline-none transition-transform cursor-pointer shadow-md"
                      aria-label="Stake amount"
                    />
                  </Slider.Root>

                  {/* Quick percentage clicks */}
                  <div className="flex gap-2 mt-4">
                    {[0.05, 0.1, 0.5, 1.0, 3.0].map((val) => (
                      <button
                        key={val}
                        onClick={() => {
                          setStakeAmount(val);
                          synthSound('bet');
                        }}
                        className={`flex-1 py-1 text-center font-mono text-[10px] border rounded transition-all font-bold ${
                          stakeAmount === val
                            ? 'bg-moon-gold text-black border-moon-gold font-bold'
                            : 'bg-trench-mud text-trench-gasmask border-trench-sandbag hover:text-white'
                        }`}
                      >
                        {val}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pot statistics and multipliers */}
                <div className="space-y-2 mb-6 font-mono text-xs border-b border-trench-sandbag/40 pb-4">
                  <div className="flex justify-between text-trench-gasmask uppercase font-bold">
                    <span>POT MULTIPLIER</span>
                    <span className="text-white font-bold">{getMultiplier(selectedSide)}x</span>
                  </div>
                  <div className="flex justify-between text-trench-gasmask uppercase font-bold">
                    <span>EXPECTED BOOTY</span>
                    <span className="text-neon-moon font-bold">+{getPotentialPayout(selectedSide).toFixed(2)} SOL</span>
                  </div>
                  <div className="flex justify-between text-trench-gasmask/60 text-[10px] uppercase font-bold">
                    <span>TRENCH MINE FEE</span>
                    <span>0.002 SOL</span>
                  </div>
                </div>

                {/* Glowing Faction Bet confirming clicker */}
                <button
                  onClick={handleCharge}
                  className={`w-full py-4 text-center font-staatliches text-2xl uppercase tracking-widest text-black rounded border-2 active:translate-y-0.5 transition-all relative overflow-hidden group shadow-lg font-bold ${
                    selectedSide === 'moon'
                      ? 'bg-neon-moon border-neon-moon shadow-glow-moon hover:bg-green-500'
                      : 'bg-jeet-red border-jeet-red shadow-glow-jeet hover:bg-red-500'
                  }`}
                >
                  <span className="relative z-10">CONFIRM CHARGE</span>
                  {/* Shimmer overlay block */}
                  <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-white/20 skew-x-[-20deg] group-hover:animate-[shimmer_1s_ease-in-out_infinite]"></div>
                </button>

                <div className="mt-4 flex gap-2.5 items-start text-trench-gasmask leading-tight font-mono text-[9px] uppercase font-bold">
                  <ShieldAlert size={16} className="text-jeet-red shrink-0 mt-0.5" />
                  <p>
                    Bets are locked. Firing shells takes permanent SOL ammo payload. Settles are finalized immediately when countdown drops!
                  </p>
                </div>
              </>
            )}

            {/* 4. RUBBER STAMP OVERLAYS ON SETTLEMENT */}
            {isSettled && (
              <div 
                className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-staatliches text-5xl font-black tracking-widest border-4 uppercase p-3 rotate-[-15deg] backdrop-blur-sm z-40 bg-black/90 pointer-events-none transition-all duration-300 animate-pulse ${
                  userWon
                    ? 'border-neon-moon text-neon-moon shadow-glow-moon'
                    : userLost
                    ? 'border-jeet-red text-jeet-red shadow-glow-jeet'
                    : 'border-trench-sandbag text-white'
                }`}
              >
                {userWon ? 'VICTORY' : userLost ? 'GET REKT' : 'SETTLED'}
              </div>
            )}

          </div>

        </div>

      </div>

      <div className="my-8 max-w-7xl mx-auto w-full px-4">
        <PixelBarbedWire height={16} />
      </div>

    </div>
  );
}
