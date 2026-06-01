'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAppState, Room, ChatMessage } from '@/store/useAppState';
import { PixelGasMask, PixelBarbedWire } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS } from '@/components/MemeAssets';
import { HeaderPanel } from '@/components/ui/HeaderPanel';
import { synthSound as originalSynthSound } from '@/components/ClientWrapper';
import { 
  Bomb, Send, ArrowLeft, ShieldAlert, Award, MessageSquare, 
  AlertTriangle, Swords, Flame, Coins, Loader2, Sparkles, Users, Radio, Terminal 
} from 'lucide-react';
import * as Slider from '@radix-ui/react-slider';
import confetti from 'canvas-confetti';

// 1. Stable, Static, and Dynamic Memoized DexScreener Iframe Chart Component
// Encapsulates local loading states internally to prevent parent state updates or callback prop changes,
// guaranteeing that the chart remains perfectly stable and never flashes or reloads on periodic state poll updates!
const StableDexChart = React.memo(({ chainId, pairAddress }: { chainId: string; pairAddress: string }) => {
  const [localLoading, setLocalLoading] = useState(true);
  
  // Track the actual active loaded pair to prevent loading empty strings or reloading on parent ticks
  const [activePair, setActivePair] = useState<{ chainId: string; pairAddress: string } | null>(null);

  // Update active pair ONLY when we receive a valid, non-empty pair address!
  useEffect(() => {
    if (chainId && pairAddress && pairAddress !== '') {
      if (!activePair || activePair.pairAddress !== pairAddress || activePair.chainId !== chainId) {
        setActivePair({ chainId, pairAddress });
        setLocalLoading(true);
      }
    }
  }, [chainId, pairAddress, activePair]);

  // If we don't have a valid active pair yet, show a loader
  if (!activePair) {
    return (
      <div className="w-full h-full flex flex-col items-center justify-center bg-[#070c04] pt-12 z-10 animate-pulse">
        <Loader2 size={32} className="animate-spin text-neon-moon mb-4" />
        <span className="font-mono text-xs text-trench-gasmask font-bold uppercase tracking-widest">
          WAITING FOR MARKET TELEMETRY...
        </span>
      </div>
    );
  }

  return (
    <div className="w-full h-full relative">
      {localLoading && (
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#070c04] z-10 animate-pulse pt-12">
          <Loader2 size={32} className="animate-spin text-neon-moon mb-4" />
          <span className="font-mono text-xs text-trench-gasmask font-bold uppercase tracking-widest">
            CONNECTING TO DEXSCREENER TERMINAL...
          </span>
        </div>
      )}
      <iframe
        className="w-full h-full border-none"
        src={`https://dexscreener.com/${activePair.chainId}/${activePair.pairAddress}?embed=1&theme=dark&info=0&trades=0`}
        title="DexScreener Chart"
        onLoad={() => setLocalLoading(false)}
      ></iframe>
    </div>
  );
}, (prevProps, nextProps) => {
  // Memoization rule: only re-render if the room actually changes to a different valid pair address
  // If nextProps has an empty pairAddress (due to polling reset), we completely ignore it and preserve our current view!
  if (!nextProps.pairAddress || nextProps.pairAddress === '') {
    return true; 
  }
  return prevProps.chainId === nextProps.chainId && prevProps.pairAddress === nextProps.pairAddress;
});

StableDexChart.displayName = 'StableDexChart';

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

const formatDuration = (mins: number) => {
  if (mins >= 525600) return `${Math.round(mins / 525600)} YEAR${Math.round(mins / 525600) > 1 ? 'S' : ''}`;
  if (mins >= 43200) return `${Math.round(mins / 43200)} MONTH${Math.round(mins / 43200) > 1 ? 'S' : ''}`;
  if (mins >= 10080) return `${Math.round(mins / 10080)} WEEK${Math.round(mins / 10080) > 1 ? 'S' : ''}`;
  if (mins >= 1440) return `${Math.round(mins / 1440)} DAY${Math.round(mins / 1440) > 1 ? 'S' : ''}`;
  if (mins >= 60) return `${Math.round(mins / 60)} HOUR${Math.round(mins / 60) > 1 ? 'S' : ''}`;
  return `${mins} MINS`;
};

export default function RoomDetailPage() {
  const params = useParams();
  const router = useRouter();
  const roomId = params.id as string;

  const { 
    rooms, user, chatMessages, placeBet, claimWinnings, 
    addMessage, connectWallet, isTransactionLoading, 
    fetchSingleRoom, fetchRoomChats, sendRoomChat,
    placeLimitOrder, cancelLimitOrder, checkLimitOrders, limitOrders
  } = useAppState();

  const room = rooms.find((r) => r.id === roomId);

  // Bulletproof safety parsers for all numeric room fields
  const moonPoolSafe = typeof room?.moonPool === 'number' ? room.moonPool : parseFloat(room?.moonPool as any) || 0;
  const jeetPoolSafe = typeof room?.jeetPool === 'number' ? room.jeetPool : parseFloat(room?.jeetPool as any) || 0;
  const totalPotSafe = moonPoolSafe + jeetPoolSafe;
  const moonPercentageSafe = totalPotSafe > 0 ? (moonPoolSafe / totalPotSafe) * 100 : 50;
  const jeetPercentageSafe = totalPotSafe > 0 ? (jeetPoolSafe / totalPotSafe) * 100 : 50;

  const openingPriceSafe = typeof room?.openingPrice === 'number' ? room.openingPrice : room?.openingPrice ? parseFloat(room.openingPrice as any) || 0 : undefined;
  const finalPriceSafe = typeof room?.finalPrice === 'number' ? room.finalPrice : room?.finalPrice ? parseFloat(room.finalPrice as any) || 0 : undefined;
  const twapFinalPriceSafe = typeof room?.twapFinalPrice === 'number' ? room.twapFinalPrice : room?.twapFinalPrice ? parseFloat(room.twapFinalPrice as any) || 0 : undefined;
  const durationSafe = typeof room?.duration === 'number' ? room.duration : room?.duration ? parseFloat(room.duration as any) || 0 : undefined;
  const expirySafe = typeof room?.expiry === 'number' ? room.expiry : room?.expiry ? parseFloat(room.expiry as any) || 0 : 0;

  const [selectedSide, setSelectedSide] = useState<'moon' | 'jeet'>('moon');
  const [activeChatTab, setActiveChatTab] = useState<'moon' | 'jeet'>('moon');
  const [stakeAmount, setStakeAmount] = useState<number>(0.1);
  const [chatInput, setChatInput] = useState('');
  const [countdownText, setCountdownText] = useState('00:00:00');
  const [isRoomSettling, setIsRoomSettling] = useState(false);
  const [localShake, setLocalShake] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [livePrice, setLivePrice] = useState<number | null>(null);
  const [isMuted, setIsMuted] = useState(false);
  const [orderType, setOrderType] = useState<'market' | 'limit'>('market');
  const [limitPrice, setLimitPrice] = useState<string>('');

  // Initialize limit price dynamically to live/opening price
  useEffect(() => {
    if (limitPrice === '' && (livePrice || openingPriceSafe)) {
      const price = livePrice || openingPriceSafe || 0;
      setLimitPrice(price.toString());
    }
  }, [livePrice, openingPriceSafe, limitPrice]);

  const synthSound = (type: 'bet' | 'explosion' | 'whistle' | 'victory' | 'defeat' | 'degen') => {
    if (!isMuted) {
      originalSynthSound(type);
    }
  };
  
  // Mortar animation states
  const [mortars, setMortars] = useState<MortarProjectile[]>([]);
  const [explosions, setExplosions] = useState<ExplosionParticles[]>([]);
  const chatScrollRef = useRef<HTMLDivElement>(null);
  const battleLogScrollRef = useRef<HTMLDivElement>(null);

  // Top 10 Trending Meme Tokens Data for continuous marquee tape
  const top10Tokens = [
    { name: "TRENCH PEPE", symbol: "PEPE", price: "$0.00000864", change: "+101.4%" },
    { name: "SOLDIER DOG", symbol: "WIF", price: "$0.9420", change: "-77.8%" },
    { name: "TRENCH SHOVEL", symbol: "BONK", price: "$0.00001380", change: "+5.6%" },
    { name: "BREADLINE SKELETON", symbol: "JEET", price: "$0.00000001", change: "-1456%" },
    { name: "POPCAT TRUCKER", symbol: "POPCAT", price: "$1.2400", change: "+14.8%" },
    { name: "BOOK OF MEME", symbol: "BOME", price: "$0.008450", change: "-12.3%" },
    { name: "CAT IN WORLD", symbol: "MEW", price: "$0.005120", change: "+22.4%" },
    { name: "SLERF LAZY", symbol: "SLERF", price: "$0.2150", change: "-8.7%" },
    { name: "WODGE SOLDIER", symbol: "WODGE", price: "$0.000450", change: "+156.4%" },
    { name: "CHAD BULL", symbol: "CHAD", price: "$0.04560", change: "+342.1%" }
  ];

  // Tactical custom command/battle log entries
  const [battleLogs, setBattleLogs] = useState<string[]>([
    "[SYSTEM ONLINE] Battle arena telemetry initialized.",
    "[CHAD SQUAD] Parachute division waiting for deployment orders."
  ]);

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
      fetchRoomChats(roomId);
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
        let dsUrl = `https://api.dexscreener.com/latest/dex/tokens/${room.token.address}`;
        if (room.token.pairAddress && room.token.chainId) {
          dsUrl = `https://api.dexscreener.com/latest/dex/pairs/${room.token.chainId}/${room.token.pairAddress}`;
        }
        const res = await fetch(dsUrl);
        if (res.ok) {
          const json = await res.json();
          let pairs = json?.pairs || [];
          if (json?.pair) {
            pairs = [json.pair];
          }
          if (pairs.length > 0) {
            const sorted = pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
            const bestPair = sorted[0];
            const price = parseFloat(bestPair.priceUsd);
            if (isFinite(price) && price > 0) {
              setLivePrice(price);
              checkLimitOrders(room.id, price);
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
  }, [room?.token?.address, room?.token?.pairAddress, room?.token?.chainId, room?.status, checkLimitOrders, room?.id]);

  // Auto scroll chat list to bottom
  useEffect(() => {
    if (chatScrollRef.current) {
      chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
    }
  }, [chatMessages, activeChatTab]);

  // Auto scroll battle logs to bottom
  useEffect(() => {
    if (battleLogScrollRef.current) {
      battleLogScrollRef.current.scrollTop = battleLogScrollRef.current.scrollHeight;
    }
  }, [battleLogs]);

  // Real-time ticking clock for this specific room
  useEffect(() => {
    if (!room) return;

    if (room.status === 'pending') {
      setCountdownText('PENDING TRIGGER');
      return;
    }

    const timer = setInterval(() => {
      const now = Date.now();
      if (room.status !== 'active') {
        setCountdownText('SETTLED');
        clearInterval(timer);
        return;
      }

      const delta = expirySafe - now;
      if (isNaN(delta) || delta <= 0) {
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
        <button onClick={() => router.push('/rooms')} className="retro-btn retro-btn-neutral px-6 py-2 rounded">
          RETREAT TO FRONTLINES
        </button>
      </div>
    );
  }



  // Potential payout calculation (plat fee is 1.25%)
  const getPotentialPayout = (side: 'moon' | 'jeet') => {
    const isMoon = side === 'moon';
    const futureWinningPool = (isMoon ? moonPoolSafe : jeetPoolSafe) + stakeAmount;
    const futureLosingPool = isMoon ? jeetPoolSafe : moonPoolSafe;
    const futureTotalPot = futureWinningPool + futureLosingPool;
    const netPot = futureTotalPot * 0.98;
    const shareRatio = stakeAmount / futureWinningPool;
    const payout = shareRatio * netPot;
    return isNaN(payout) ? 0 : Number(payout.toFixed(4));
  };

  const getMultiplier = (side: 'moon' | 'jeet') => {
    const pool = side === 'moon' ? moonPoolSafe : jeetPoolSafe;
    const oppPool = side === 'moon' ? jeetPoolSafe : moonPoolSafe;
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

    if (orderType === 'limit') {
      const limitPriceNum = parseFloat(limitPrice) || 0;
      if (limitPriceNum <= 0) {
        alert('ENTER A VALID TARGET LIMIT PRICE!');
        return;
      }
      placeLimitOrder(room.id, selectedSide, stakeAmount, limitPriceNum);
      synthSound('bet');
      setBattleLogs((prev) => [
        ...prev,
        `[LIMIT ORDER QUEUED] Queued ${stakeAmount.toFixed(2)} SOL limit order on ${selectedSide.toUpperCase()} at $${limitPriceNum.toFixed(6)}!`
      ]);
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

    // Append to battle logs
    const newLog = `[ARTILLERY SHELL] Fired ${stakeAmount.toFixed(2)} SOL ammo payload on ${selectedSide.toUpperCase()} side!`;
    setBattleLogs((prev) => [...prev, newLog]);

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

      // Append hit confirmation to logs
      setBattleLogs((prev) => [...prev, `[IMPACT CONFIRMED] Shell detonated on opposing faction trenches!`]);
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
      colors: ['#FFD700', '#16A34A']
    });
    setBattleLogs((prev) => [...prev, `[BOOTY DISPATCHED] User claimed on-chain winnings/refund!`]);
  };

  const handleSendChat = (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    // Restrict broadcasting to active bettors inside this room sector only
    if (!user || !user.wallet || userBetsInRoom.length === 0) {
      alert("SIGNAL INTRUSION DETECTED: BROADCAST DENIED! ONLY ENLISTED SOLDIER BECTORS WHO HAVE STAKED SOL ON A SIDE IN THIS SECTOR TRENCH ARE AUTHORIZED TO TRANSMIT RADIO SIGNALS.");
      return;
    }

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
  const isDrawOrVoid = isSettled && (!room.winner || room.winner === 'draw');
  const userWon = isSettled && room.winner && room.winner !== 'draw' && userSidesChosen.includes(room.winner as any);
  const userLost = isSettled && room.winner && room.winner !== 'draw' && userSidesChosen.length > 0 && !userSidesChosen.includes(room.winner as any);
  const hasUnclaimed = isSettled && (userWon || (isDrawOrVoid && userBetsInRoom.length > 0)) && userBetsInRoom.some((b) => !b.claimed);

  return (
    <div className={`w-full flex-1 flex flex-col select-none relative overflow-x-hidden transition-transform duration-100 bg-transparent min-h-screen text-white font-mono ${
      localShake ? 'animate-[shake_0.5s_ease-in-out]' : ''
    }`}>
      
      {/* Dynamic inline style sheets */}
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

        /* Continuous scrolling tape marquee animation */
        @keyframes marquee {
            0% { transform: translate3d(0, 0, 0); }
            100% { transform: translate3d(-50%, 0, 0); }
        }
        .animate-marquee {
            animation: marquee 35s linear infinite;
        }

        /* Diagonal stripes/hatch pattern background */
        .hatch-pattern {
            background-image: repeating-linear-gradient(45deg, rgba(0,0,0,0.08), rgba(0,0,0,0.08) 6px, transparent 6px, transparent 12px);
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
            background-color: #16a34a;
            box-shadow: 0 0 10px #16a34a, 0 0 20px #16a34a, -10px 10px 20px rgba(57, 255, 20, 0.5);
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

        @keyframes radar-sweep {
            0% { transform: translateY(-100%); }
            100% { transform: translateY(380px); }
        }
        .radar-sweep-line {
            animation: radar-sweep 6s linear infinite;
        }
      ` }} />

      {/* 1. AUTO-SCROLLING HORIZONTAL TREND SLIDER */}
      <div className="w-full bg-[#050803] border-b border-[#193012] py-2.5 overflow-hidden font-mono relative z-20 shadow-inner">
        <div className="flex animate-marquee whitespace-nowrap gap-8 min-w-full">
          {Array.from({ length: 2 }).map((_, loopIdx) => (
            <div key={loopIdx} className="flex gap-8 items-center shrink-0">
              {top10Tokens.map((tok, idx) => {
                const isPositive = tok.change.startsWith('+');
                const badgeColor = isPositive ? 'text-[#16a34a] glow-moon' : 'text-[#ff535a] glow-jeet';
                const arrow = isPositive ? '↗' : '↘';
                return (
                  <div key={`${loopIdx}-${idx}`} className="flex items-center gap-2.5 bg-black/50 border border-[#172c12] px-3.5 py-1.5 rounded-md text-xs select-none">
                    <span className="font-staatliches tracking-wider text-white uppercase">{tok.name}</span>
                    <span className="text-[10px] text-trench-gasmask font-bold">(${tok.symbol})</span>
                    <span className="text-yellow-500 font-bold ml-1">{tok.price}</span>
                    <span className={`font-extrabold ml-1.5 ${badgeColor}`}>{arrow} {tok.change}</span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Top Navigation Bar */}
      <div className="w-full px-2 sm:px-4 md:px-6 pt-4 pb-2 z-20 relative bg-[#020501]">
        <HeaderPanel backHref="/rooms" missionHref="/?play_intro=true" title="WAR ROOM" countdown={countdownText} />
      </div>

      {/* 2. THE SPLIT-SCREEN TRENCH HEADER (Full-Bleed Across Screen) */}
      <section className="relative w-full min-h-[220px] sm:min-h-[280px] h-[30vh] sm:h-[35vh] md:h-[38vh] overflow-hidden border-b-4 border-trench-sandbag flex z-10 scanlines bg-[#020501]" id="battlefield">
        
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
          <div className="absolute top-2 left-2 md:top-4 md:left-4 border-2 border-dashed border-neon-moon bg-trench-black/85 px-1.5 py-0.5 md:px-3 md:py-1 rotate-[-4deg] shadow-lg flex items-center gap-1.5 z-10">
            <PepePortrait src={PEPE_ASSETS.chadBull} size={20} loading="eager" className="rounded-full sm:size-[28px]" />
            <span className="font-staatliches text-neon-moon text-[8px] sm:text-[10px] md:text-base tracking-widest block glow-moon">BULLISH TRENCH</span>
          </div>

          <div className="absolute bottom-2 left-2 md:bottom-4 md:left-4 bg-trench-black/90 border border-neon-moon/30 p-1.5 md:p-2.5 rounded shadow-lg min-w-[80px] sm:min-w-[120px] z-10">
            <span className="font-mono text-[7px] sm:text-[9px] text-neon-moon block font-bold uppercase tracking-wider">MOON POT</span>
            <span className="font-staatliches text-xs sm:text-lg md:text-2xl text-white block mt-0.5">{moonPoolSafe.toFixed(2)} SOL</span>
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
          <div className="absolute bottom-2 right-2 md:bottom-4 md:right-4 border-2 border-dashed border-jeet-red bg-trench-black/85 px-1.5 py-0.5 md:px-3 md:py-1 rotate-[4deg] shadow-lg flex items-center gap-1.5 z-10">
            <span className="font-staatliches text-jeet-red text-[8px] sm:text-[10px] md:text-base tracking-widest block glow-jeet">BEARISH WASTELAND</span>
            <PepePortrait src={PEPE_ASSETS.neonWojak} size={20} loading="eager" className="rounded-full sm:size-[28px]" />
          </div>

          <div className="absolute top-2 right-2 md:top-4 md:right-4 bg-trench-black/90 border border-jeet-red/30 p-1.5 md:p-2.5 rounded shadow-lg min-w-[80px] sm:min-w-[120px] text-right z-10">
            <span className="font-mono text-[7px] sm:text-[9px] text-jeet-red block font-bold uppercase tracking-wider">JEET POT</span>
            <span className="font-staatliches text-xs sm:text-lg md:text-2xl text-white block mt-0.5">{jeetPoolSafe.toFixed(2)} SOL</span>
          </div>
        </div>

        {/* Absolute Center Swords Emblem & Active Target Status */}
        <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-30 flex flex-col items-center pointer-events-none text-center">
          <div className="bg-trench-mud border-2 sm:border-4 border-trench-sandbag rounded-full w-12 h-12 sm:w-16 sm:h-16 md:w-20 md:h-20 flex items-center justify-center shadow-[0_0_30px_rgba(0,0,0,0.9)] relative animate-pulse">
            <div className="absolute inset-1 rounded-full border border-dashed border-trench-gasmask/60 opacity-60"></div>
            <Swords size={18} className="text-white sm:size-[24px] md:size-[30px]" />
          </div>
          <div className="mt-2 md:mt-4 bg-trench-black border-2 border-trench-sandbag px-2 py-0.5 md:px-3.5 md:py-1.5 shadow-2xl rounded">
            <p className="font-mono text-[6px] sm:text-[8px] text-trench-gasmask uppercase font-bold tracking-widest">YOU ARE FIGHTING FOR:</p>
            {userTotalBet > 0 ? (
              <span className={`font-staatliches text-[10px] sm:text-sm md:text-lg block tracking-wider ${
                hasBetOnMoon && hasBetOnJeet
                  ? 'text-moon-gold font-bold glow-gold animate-pulse'
                  : hasBetOnMoon
                  ? 'text-neon-moon font-bold glow-moon'
                  : 'text-jeet-red font-bold glow-jeet'
              }`}>
                {hasBetOnMoon && hasBetOnJeet
                  ? 'HEDGE LORD 👑'
                  : hasBetOnMoon
                  ? 'MOON ARMY 🚀'
                  : 'JEET SQUAD 💀'}
              </span>
            ) : (
              <span className="font-staatliches text-[10px] sm:text-sm md:text-lg text-trench-gasmask font-bold block uppercase tracking-wider">
                OBSERVER 🕵️
              </span>
            )}
          </div>
        </div>

        {/* Sounds Toggle Button */}
        <button
          type="button"
          onClick={() => {
            setIsMuted(!isMuted);
            if (isMuted) {
              synthSound('bet');
            }
          }}
          className="absolute top-2 left-1/2 -translate-x-1/2 z-40 bg-trench-black/85 hover:bg-trench-sandbag border border-trench-sandbag text-[8px] sm:text-[10px] uppercase px-2 py-0.5 sm:px-2.5 sm:py-1 rounded font-mono font-bold tracking-widest transition-colors flex items-center gap-1 text-white shadow-lg pointer-events-auto whitespace-nowrap"
        >
          <span>{isMuted ? '🔇 SOUNDS MUTED' : '🔊 SOUNDS PLAYING'}</span>
        </button>

        {/* Dynamic Double-Bar VS Progress Indicator Overlay */}
        <div className="absolute bottom-0 left-0 w-full h-3 flex">
          <div style={{ width: `${moonPercentageSafe}%` }} className="bg-neon-moon h-full shadow-[inset_0_-2px_10px_#16a34a]" />
          <div style={{ width: `${jeetPercentageSafe}%` }} className="bg-jeet-red h-full shadow-[inset_0_-2px_10px_#ff535a]" />
        </div>
      </section>

      {/* 2. MAIN GRID WRAPPER (2-column layout - Active Combat lg:col-span-9, Stance Configurator lg:col-span-3) */}
      <main className="max-w-none w-full px-2 sm:px-4 md:px-6 py-6 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start relative z-10 flex-1">
        
        {/* COLUMN 1: ACTIVE COIN COMBAT (lg:col-span-9) */}
        <section className="lg:col-span-9 flex flex-col gap-6 min-w-0 w-full overflow-hidden">

          {/* Toggle buttons for Chart view */}
          <div className="flex justify-end gap-2 font-mono text-[10px]">
            <button className="px-3.5 py-1 bg-neon-moon text-black font-bold rounded uppercase tracking-wider border border-neon-moon">
              Line
            </button>
            <button className="px-3.5 py-1 bg-transparent text-trench-gasmask border border-trench-sandbag rounded uppercase tracking-wider hover:text-white transition-colors">
              Crates
            </button>
          </div>

          {/* Stable and Static DexScreener Chart Terminal with Militarized Console Shell Frame (Permanently Flicker-Free) */}
          {room.token.chainId && (
            <div className="bg-[#050803] border-4 border-trench-sandbag rounded-xl shadow-2xl relative overflow-hidden h-[320px] sm:h-[410px] flex flex-col justify-between z-10 scanlines">
              
              {/* Steel Console Top Header Bar */}
              <div className="w-full bg-[#0d140a] border-b border-[#2c3d25] px-3.5 py-2 flex flex-wrap items-center justify-between gap-2 font-mono text-[9px] text-trench-gasmask uppercase font-bold relative select-none">
                {/* corner rivets */}
                <div className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
                <div className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
                
                <div className="flex items-center gap-2 pl-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#16a34a] shadow-[0_0_8px_#16a34a]" />
                  <span className="text-white tracking-widest font-staatliches text-xs">CRT RADAR CONSOLE</span>
                </div>
                
                {/* System status LEDs */}
                <div className="flex items-center gap-3 pr-4">
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-[#16a34a] shadow-[0_0_6px_#16a34a]" />
                    <span>SYS ON</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-yellow-500 shadow-[0_0_6px_#f59e0b] animate-ping" />
                    <span>DEX SYNC</span>
                  </div>
                </div>
              </div>

              {/* Interactive Iframe CRT Panel Overlay Container */}
              <div className="w-full flex-1 relative bg-black overflow-hidden group">
                
                {/* 1. Vertical Sweep Radar Overlay */}
                <div className="radar-sweep-line absolute left-0 right-0 h-[2px] bg-neon-moon/20 shadow-[0_0_10px_#16a34a] z-10 pointer-events-none" />

                {/* 2. Glass Reflection Glare Overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/5 to-transparent pointer-events-none z-10" />

                {/* 3. CRT Scanline Grid Overlay */}
                <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.15)_50%)] bg-[size:100%_4px] opacity-25 z-10" />

                {/* 4. Steel Overlay Inner Shadows */}
                <div className="absolute inset-0 border border-white/5 pointer-events-none z-10 shadow-[inset_0_0_15px_rgba(0,0,0,0.95)]" />

                {/* Memoized Stable chart iframe. Specifying a unique React Key forces React to reuse 
                    the existing DOM node instead of rebuilding it on parent wagers state updates,
                    completely resolving any iframe flashing/flickering! */}
                <StableDexChart 
                  key={`dexscreener-${room.id}`}
                  chainId={room.token.chainId}
                  pairAddress={room.token.pairAddress || ''}
                />
              </div>

              {/* Steel Console Bottom Panel */}
              <div className="w-full bg-[#0d140a] border-t border-[#2c3d25] px-3.5 py-1.5 flex flex-wrap items-center justify-between gap-1 font-mono text-[8px] text-trench-gasmask uppercase font-bold relative select-none">
                <div className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
                <div className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
                
                <span className="pl-4">INDEXER ADDR: {room.token.pairAddress ? room.token.pairAddress.substring(0, 16) : 'WAITING'}...</span>
                <span className="pr-4 text-neon-moon">CHANNEL SECURE</span>
              </div>
            </div>
          )}

          {/* 🛡️ TARGET AREA TELEMETRY & COIN INTEL BRIEFING */}
          <div className="bg-trench-black border-2 border-trench-sandbag p-4 rounded-lg font-mono text-xs shadow-2xl relative space-y-4">
            <div className="flex items-center gap-1.5 text-yellow-500 font-staatliches text-sm font-bold uppercase border-b border-trench-sandbag pb-2">
              <Terminal className="w-4 h-4 text-yellow-500 animate-pulse" />
              <span>🛡️ TARGET AREA TELEMETRY & COIN BRIEFING</span>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="bg-trench-mud border border-[#1d3515] p-2.5 rounded overflow-hidden">
                <span className="text-trench-gasmask uppercase text-[9px] font-bold block">TOKEN NETWORK</span>
                <span className="text-white font-staatliches text-base block mt-0.5 uppercase tracking-wide truncate">
                  {room.token.chainId === 'solana' ? 'Solana Mainnet' : room.token.chainId ? `${room.token.chainId} Net` : 'Solana Network'}
                </span>
              </div>

              <div className="bg-trench-mud border border-[#1d3515] p-2.5 rounded">
                <span className="text-trench-gasmask uppercase text-[9px] font-bold block">ENTRY PRICE (POOL)</span>
                <span className="text-yellow-500 font-staatliches text-base block mt-0.5">
                  {room.status === 'pending' 
                    ? 'PENDING TRIGGER' 
                    : openingPriceSafe !== undefined 
                      ? `$${openingPriceSafe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` 
                      : 'N/A'}
                </span>
              </div>

              <div className="bg-trench-mud border border-[#1d3515] p-2.5 rounded">
                <span className="text-trench-gasmask uppercase text-[9px] font-bold block">LAST PRICE (REALTIME)</span>
                <span className="text-neon-moon font-staatliches text-base block mt-0.5 glow-moon animate-pulse">
                  {livePrice !== null 
                    ? `$${livePrice.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}` 
                    : openingPriceSafe !== undefined 
                      ? `$${openingPriceSafe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 })}`
                      : 'N/A'}
                </span>
              </div>

              <div className="bg-trench-mud border border-[#1d3515] p-2.5 rounded">
                <span className="text-trench-gasmask uppercase text-[9px] font-bold block">ROOM DURATION</span>
                <span className="text-white font-staatliches text-base block mt-0.5">
                  {durationSafe 
                    ? (durationSafe >= 60 
                        ? `${durationSafe.toLocaleString()} MINS (${formatDuration(durationSafe)})` 
                        : `${durationSafe} MINS`) 
                    : '60 MINS'}
                </span>
              </div>
            </div>

            {/* Coin Briefing Text */}
            <div className="bg-[#050803] border border-trench-sandbag/40 p-3 rounded font-mono text-[10px] text-gray-300 leading-relaxed uppercase border-l-4 border-l-neon-moon">
              <div className="flex flex-wrap items-center gap-2 mb-2 pb-2 border-b border-trench-sandbag/35">
                <span className="text-neon-moon font-bold">COIN INTEL BRIEF:</span>
                <span className="text-trench-gasmask">MINT ADDR:</span>
                <span className="text-white bg-trench-mud px-1.5 py-0.5 rounded font-mono text-[9px] border border-trench-sandbag/30 flex items-center gap-1 select-all break-all max-w-full min-w-0">
                  <span className="truncate min-w-0">{room.token.address}</span>
                  <button 
                    onClick={(e) => {
                      e.stopPropagation();
                      navigator.clipboard.writeText(room.token.address);
                      alert("CONTRACT ADDRESS COPIED TO CLIPBOARD!");
                    }}
                    className="text-neon-moon hover:text-white ml-1 font-bold font-staatliches text-[10px] tracking-wider uppercase bg-trench-black border border-neon-moon/40 px-1 rounded active:scale-95 transition-transform"
                  >
                    [COPY]
                  </button>
                </span>
              </div>
              {room.token.symbol === 'PEPE' ? (
                <span>🐸 Pepe the frog, standard infantry memecoin. Plunged into the bearish mud after local high listings, currently fighting for bullish recovery inside the SOL arena. Highly volatile.</span>
              ) : room.token.symbol === 'WIF' ? (
                <span>🐕 Soldier Dogwifhat, holding the line with a standard-issue wool cap. Defending the bullish support trench with high-morale community reinforcement.</span>
              ) : room.token.symbol === 'JEET' ? (
                <span>💀 Breadline Skeleton. Dev rugged early on, leaving the jeets to pick up the pieces. Volatility is critical, expect sudden explosive action.</span>
              ) : (
                <span>📊 Operation targeting ${room.token.symbol} (${room.token.name}). Active token index synced in real time via DEXSCREENER. Factions are competing to influence the TWAP before deployment countdown expires.</span>
              )}
            </div>
          </div>

          {/* Split Pool boxes at bottom of Center column */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            
            {/* Moon Pool Box */}
            <div className="bg-trench-mud border-2 border-neon-moon/40 p-4 rounded-xl text-center shadow-glow-moon flex flex-col justify-between">
              <div>
                <span className="font-mono text-[9px] text-neon-moon block font-bold uppercase tracking-wider">🚀 MOON POOL</span>
                <span className="font-staatliches text-2xl sm:text-3xl text-neon-moon block mt-1 leading-none">
                  {moonPoolSafe.toFixed(1)} SOL
                </span>
              </div>
              <div className="mt-3 w-full bg-trench-black rounded-full h-2.5 border border-trench-sandbag overflow-hidden">
                <div style={{ width: `${moonPercentageSafe}%` }} className="bg-neon-moon h-full shadow-[0_0_10px_#16a34a]" />
              </div>
              <span className="font-mono text-[8px] text-trench-gasmask block font-bold uppercase mt-2">Bullish on upswing</span>
            </div>

            {/* Jeet Pool Box */}
            <div className="bg-trench-mud border-2 border-jeet-red/40 p-4 rounded-xl text-center shadow-glow-jeet flex flex-col justify-between">
              <div>
                <span className="font-mono text-[9px] text-jeet-red block font-bold uppercase tracking-wider">💀 JEET POOL</span>
                <span className="font-staatliches text-2xl sm:text-3xl text-jeet-red block mt-1 leading-none">
                  {jeetPoolSafe.toFixed(1)} SOL
                </span>
              </div>
              <div className="mt-3 w-full bg-trench-black rounded-full h-2.5 border border-trench-sandbag overflow-hidden">
                <div style={{ width: `${jeetPercentageSafe}%` }} className="bg-jeet-red h-full shadow-[0_0_10px_#ff535a]" />
              </div>
              <span className="font-mono text-[8px] text-trench-gasmask block font-bold uppercase mt-2">Bearish on rug</span>
            </div>

          </div>

        </section>

        {/* COLUMN 2: STANCE CONFIGURATOR (lg:col-span-3) */}
        <section className="lg:col-span-3 retro-panel p-5 shadow-2xl relative scanlines rounded-xl min-w-0 w-full overflow-hidden" id="bet-panel">
          {/* Decorative Corner Screws */}
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
          <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
          <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
          
          <div className="text-center border-b-2 border-trench-sandbag pb-4 mb-5">
            <span className="font-staatliches text-sm text-yellow-500 block uppercase tracking-wider text-left mb-2">🛡️ STANCE CONFIGURATOR</span>
            
            {/* Displaying requested images (moonJuice for moon and jeetSkeleton for jeet) */}
            <PepePortrait 
              src={selectedSide === 'moon' ? PEPE_ASSETS.moonJuice : PEPE_ASSETS.jeetSkeleton} 
              size={56} 
              glowColor={selectedSide === 'moon' ? 'moon' : 'jeet'} 
              animated 
              className="rounded-full mx-auto mb-3" 
            />
            
            <h3 className="font-staatliches text-2xl text-white tracking-wide uppercase">Deploy Capital</h3>
            <p className="font-mono text-[9px] text-trench-gasmask font-bold mt-0.5 uppercase tracking-widest">SELECT AMMUNITION YIELD</p>
          </div>

          {/* Win Streak Indicator inside the Stance Configurator sidebar (Wallet Balance removed) */}
          <div className="mb-5 text-[9px] font-mono uppercase font-bold text-center">
            <div className="bg-black/60 border border-[#1d3515] p-2.5 rounded">
              <div className="text-yellow-500 flex items-center justify-center gap-1">
                <Flame className="w-3.5 h-3.5 text-red-500 animate-pulse" /> Win Streak
              </div>
              <div className="text-red-500 font-staatliches text-sm sm:text-base mt-0.5">
                {user?.stats?.winStreak !== undefined ? `${user.stats.winStreak} wins` : '0 wins'}
              </div>
            </div>
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
                  🛡️ EVIDENCE RECEIPT
                </h4>
                <div className="flex justify-between items-center mt-1">
                  <span>TARGET Symbol:</span>
                  <span className="text-white font-bold">${room.token.symbol}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span>ENTRY PRICE:</span>
                  <span className="text-white font-bold">
                    ${openingPriceSafe !== undefined ? openingPriceSafe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>EXIT PRICE (SPOT):</span>
                  <span className="text-white font-bold">
                    ${finalPriceSafe !== undefined ? finalPriceSafe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span>TWAP EXIT (EMA):</span>
                  <span className="text-moon-gold font-bold">
                    ${twapFinalPriceSafe !== undefined ? twapFinalPriceSafe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 8 }) : 'N/A'}
                  </span>
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

              {isDrawOrVoid && userBetsInRoom.length > 0 && (
                <div className="p-4 bg-trench-black border-2 border-yellow-500 rounded text-center relative overflow-hidden">
                  <div className="absolute inset-0 bg-yellow-500/5 animate-pulse" />
                  <ShieldAlert size={36} className="text-yellow-500 mx-auto mb-2 animate-bounce" />
                  <p className="font-mono text-[10px] text-white font-bold uppercase leading-relaxed relative z-10">
                    {room.moonPool === 0 || room.jeetPool === 0
                      ? "ONE-SIDED SKIRMISH: NO OPPOSING FORCES ENGAGED. SECURING FULL STAKE REFUND!"
                      : "BATTLE CONCLUDED IN A DRAW! RECOVERING WAR FUNDS!"}
                  </p>
                  {hasUnclaimed ? (
                    <button
                      onClick={handleClaim}
                      disabled={isTransactionLoading}
                      className="w-full mt-4 py-3 bg-yellow-500 hover:bg-yellow-400 disabled:bg-trench-sandbag disabled:text-trench-gasmask disabled:border-trench-sandbag font-staatliches text-xl text-black rounded border-b-4 border-yellow-800 shadow-glow-yellow font-bold flex items-center justify-center gap-2 relative z-10"
                    >
                      {isTransactionLoading ? (
                        <>
                          <Loader2 className="animate-spin text-black shrink-0" size={20} />
                          <span>RETRIEVING SOL...</span>
                        </>
                      ) : (
                        <span>CLAIM FULL REFUND 💰</span>
                      )}
                    </button>
                  ) : (
                    <div className="mt-4 p-2 bg-trench-mud border border-trench-sandbag rounded font-mono text-[9px] text-yellow-500 uppercase font-bold relative z-10">
                      🎉 Funds Safely Recovered to Ammo Wallet!
                    </div>
                  )}
                </div>
              )}

              {!userWon && !userLost && (!isDrawOrVoid || userBetsInRoom.length === 0) && (
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
          ) : room.status === 'pending' ? (
            // Pending Limit seeded Room state
            <div className="space-y-4 text-center py-4">
              <div className="bg-trench-black border-2 border-yellow-500 rounded p-4 text-center relative overflow-hidden">
                <div className="absolute inset-0 bg-yellow-500/5 animate-pulse" />
                <ShieldAlert size={36} className="text-yellow-500 mx-auto mb-2 animate-bounce" />
                <span className="font-mono text-[9px] text-trench-gasmask block font-bold uppercase">ARENA SECTOR LOCKED</span>
                <span className="font-staatliches text-2xl block mt-1 tracking-wider text-yellow-500 glow-moon uppercase">
                  WAITING FOR TRIGGER
                </span>
                <p className="font-mono text-[10px] text-white/80 uppercase leading-relaxed mt-3">
                  This skirmish arena is seeded with a limit order. Standard market bets are disabled until the spot price reaches the limit trigger threshold.
                </p>
                <div className="mt-4 p-2 bg-trench-mud border border-trench-sandbag rounded font-mono text-[9px] text-yellow-500 uppercase font-bold relative z-10">
                  📢 Standing by for automated Keeper detonation...
                </div>
              </div>
            </div>
          ) : (
            // Active Faction Selector + Slider controls
            <>
              {/* 1. PICK YOUR STANCE */}
              <div className="mb-4">
                <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase block mb-2">1. PICK YOUR STANCE</span>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setSelectedSide('moon');
                      synthSound('bet');
                    }}
                    className={`flex-1 py-3 font-staatliches text-xl uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${
                      selectedSide === 'moon'
                        ? 'retro-btn retro-btn-moon text-black shadow-glow-moon font-bold animate-pulse'
                        : 'retro-btn bg-black border border-trench-sandbag text-trench-gasmask opacity-70 hover:opacity-100 hover:text-white'
                    }`}
                  >
                    <span>BET MOON 🚀</span>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedSide('jeet');
                      synthSound('bet');
                    }}
                    className={`flex-1 py-3 font-staatliches text-xl uppercase tracking-wider rounded transition-all flex items-center justify-center gap-1.5 ${
                      selectedSide === 'jeet'
                        ? 'retro-btn retro-btn-jeet text-white shadow-glow-jeet font-bold animate-pulse'
                        : 'retro-btn bg-black border border-trench-sandbag text-trench-gasmask opacity-70 hover:opacity-100 hover:text-white'
                    }`}
                  >
                    <span>BET JEET 💀</span>
                  </button>
                </div>
              </div>

              {/* 2. ORDER TYPE SELECTOR */}
              <div className="mb-4">
                <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase block mb-2">2. ORDER TYPE</span>
                <div className="grid grid-cols-2 gap-2 bg-trench-black p-1 border border-trench-sandbag rounded">
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType('market');
                      synthSound('bet');
                    }}
                    className={`py-1.5 font-staatliches text-xs tracking-wider uppercase rounded transition-all ${
                      orderType === 'market'
                        ? 'bg-[#16A34A] text-white font-bold shadow-glow-moon'
                        : 'text-trench-gasmask hover:text-white'
                    }`}
                  >
                    Market ⚡
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOrderType('limit');
                      synthSound('bet');
                    }}
                    className={`py-1.5 font-staatliches text-xs tracking-wider uppercase rounded transition-all ${
                      orderType === 'limit'
                        ? 'bg-moon-gold text-black font-bold shadow-glow-gold'
                        : 'text-trench-gasmask hover:text-white'
                    }`}
                  >
                    Limit 🎯
                  </button>
                </div>
              </div>

              {orderType === 'limit' && (
                <div className="mb-4 bg-trench-black p-3 border border-trench-sandbag rounded space-y-2">
                  <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase block">
                    🎯 TARGET LIMIT PRICE (USD)
                  </span>
                  <div className="relative flex items-center bg-trench-black border border-trench-sandbag rounded focus-within:border-neon-moon transition-all">
                    <input
                      type="number"
                      step="any"
                      required
                      placeholder="Limit Price (USD)"
                      value={limitPrice}
                      onChange={(e) => {
                        setLimitPrice(e.target.value);
                      }}
                      className="w-full bg-transparent px-3 py-2 text-white font-mono text-xs focus:outline-none"
                    />
                    <span className="absolute right-3 font-mono text-[8px] text-trench-gasmask font-bold tracking-wider uppercase">
                      USD
                    </span>
                  </div>

                  {/* Percentage Offsets */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-1 sm:gap-2">
                    {[-10, -5, 5, 10].map((pct) => {
                      const currentSpotPrice = livePrice || room?.openingPrice || 0;
                      const computedOffset = currentSpotPrice * (1 + pct / 100);
                      const sign = pct > 0 ? '+' : '';
                      return (
                        <button
                          key={pct}
                          type="button"
                          onClick={() => {
                            setLimitPrice(computedOffset.toFixed(8));
                            synthSound('bet');
                          }}
                          className="py-1 text-center font-mono text-[8px] font-bold border border-trench-sandbag/60 bg-trench-mud rounded text-trench-gasmask hover:text-white hover:border-gray-500 transition-colors"
                        >
                          {sign}{pct}%
                        </button>
                      );
                    })}
                  </div>
                  <span className="font-mono text-[8px] text-trench-gasmask uppercase font-bold leading-tight block">
                    *TACTICAL bet WILL DETONATE WHEN spot PRICE CROSSES YOUR TARGET.
                  </span>
                </div>
              )}

              {/* 3. AMMUNITION (SOL) Preset Selector Slots */}
              <div className="mb-6 bg-trench-black p-4 border border-trench-sandbag rounded">
                <div className="flex justify-between items-center mb-3 border-b border-trench-sandbag/40 pb-2">
                  <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase">3. AMMUNITION (SOL)</span>
                </div>

                {/* Preset slots layout matching mockup */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
                  {[0.05, 0.1, 0.5, 1.0].map((val) => {
                    const isSelected = stakeAmount === val;
                    return (
                      <button
                        key={val}
                        onClick={() => {
                          setStakeAmount(val);
                          synthSound('bet');
                        }}
                        className={`py-2 text-center font-mono text-xs border rounded transition-all font-bold ${
                          isSelected
                            ? 'bg-yellow-400 text-black border-yellow-500 font-bold shadow-[0_0_8px_rgba(251,191,36,0.6)]'
                            : 'bg-trench-mud text-trench-gasmask border-trench-sandbag hover:text-white'
                        }`}
                      >
                        {val} SOL
                      </button>
                    );
                  })}
                </div>

                {/* Radix Slider */}
                <Slider.Root
                  className="relative flex items-center select-none touch-none w-full h-5 cursor-pointer"
                  value={[stakeAmount]}
                  onValueChange={(val) => setStakeAmount(val[0])}
                  min={0.01}
                  max={5.0}
                  step={0.05}
                >
                  <Slider.Track className="bg-trench-mud relative grow rounded-full h-2 border border-trench-sandbag overflow-hidden">
                    <Slider.Range className={`absolute h-full rounded-full ${
                      selectedSide === 'moon' ? 'bg-neon-moon shadow-glow-moon' : 'bg-jeet-red shadow-glow-jeet'
                    }`} />
                  </Slider.Track>
                  <Slider.Thumb
                    className="block w-4 h-4 bg-yellow-400 border border-yellow-600 rounded-full hover:scale-110 focus:outline-none transition-transform cursor-pointer shadow-md"
                    aria-label="Stake amount"
                  />
                </Slider.Root>

                {/* Range text below slider matching mockup */}
                <div className="flex justify-between items-center mt-3 font-mono text-[9px] text-trench-gasmask uppercase font-bold">
                  <span>Min: 0.01 SOL</span>
                  <span className="text-yellow-400">Amt: {stakeAmount.toFixed(2)} SOL</span>
                  <span>Max: 5.0 SOL</span>
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

              {/* Glowing Faction Bet confirming Yellow tactical hatch button matching mockup */}
              <button
                onClick={handleCharge}
                disabled={isTransactionLoading}
                className="w-full py-4 text-center font-staatliches text-2xl uppercase tracking-widest text-black rounded border-2 border-yellow-300 border-b-4 border-yellow-700 bg-yellow-400 hover:bg-yellow-500 active:translate-y-0.5 transition-all relative overflow-hidden group shadow-lg font-bold flex items-center justify-center gap-2 shadow-[0_0_15px_rgba(251,191,36,0.3)] disabled:bg-trench-sandbag disabled:border-trench-sandbag disabled:text-trench-gasmask hatch-pattern"
              >
                {isTransactionLoading ? (
                  <Loader2 className="animate-spin text-black shrink-0" size={20} />
                ) : (
                  <span className="relative z-10 flex items-center gap-1.5 justify-center font-bold">
                    <Sparkles size={20} className="text-black shrink-0 animate-pulse" />
                    {orderType === 'limit' ? 'QUEUE TACTICAL LIMIT ORDER 🎯' : 'STAKE ON POT!'}
                  </span>
                )}
                {/* Shimmer overlay block */}
                <div className="absolute top-0 -left-[100%] w-1/2 h-full bg-white/20 skew-x-[-20deg] group-hover:animate-[shimmer_1s_ease-in-out_infinite]"></div>
              </button>

              <div className="mt-4 flex gap-2.5 items-start text-trench-gasmask leading-tight font-mono text-[9px] uppercase font-bold">
                <ShieldAlert size={16} className="text-jeet-red shrink-0 mt-0.5" />
                <p>
                  {orderType === 'limit'
                    ? 'Limit orders will queue locally and detonate immediately on-chain when the live price criteria matches.'
                    : 'Bets are locked. Firing shells takes permanent SOL ammo payload. Finalized on countdown expiry!'}
                </p>
              </div>
            </>
          )}

          {/* 4. RUBBER STAMP OVERLAYS ON SETTLEMENT */}
          {isSettled && (
            <div 
              className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 font-staatliches text-3xl sm:text-5xl font-black tracking-widest border-2 sm:border-4 uppercase p-2 sm:p-3 rotate-[-15deg] backdrop-blur-sm z-40 bg-black/90 pointer-events-none transition-all duration-300 animate-pulse whitespace-nowrap ${
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

        </section>

        {/* ACTIVE TACTICAL LIMIT ORDERS */}
        <div className="lg:col-span-12 bg-[#050803] border-4 border-trench-sandbag p-5 rounded-lg shadow-2xl relative scanlines min-w-0 w-full overflow-hidden">
          {/* Decorative Corner Screws */}
          <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
          <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
          <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
          <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>

          <div className="flex items-center gap-1.5 text-yellow-500 font-staatliches text-lg font-bold uppercase border-b border-trench-sandbag/40 pb-2 mb-4">
            <Terminal className="w-5 h-5 text-yellow-500 animate-pulse" />
            <span>🎯 ACTIVE TACTICAL LIMIT ORDERS BOOK ({(Array.isArray(limitOrders) ? limitOrders : []).filter(o => o.roomId === room.id && o.status === 'pending').length})</span>
          </div>

          {(Array.isArray(limitOrders) ? limitOrders : []).filter(o => o.roomId === room.id && o.status === 'pending').length > 0 ? (
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left font-mono text-xs uppercase">
                <thead>
                  <tr className="border-b border-trench-sandbag/45 text-trench-gasmask text-[10px] font-bold">
                    <th className="py-2.5 px-3">SIDE</th>
                    <th className="py-2.5 px-3">AMOUNT (SOL)</th>
                    <th className="py-2.5 px-3">LIMIT TARGET (USD)</th>
                    <th className="py-2.5 px-3">CURRENT SPOT (USD)</th>
                    <th className="py-2.5 px-3">TRIGGER CONDITION</th>
                    <th className="py-2.5 px-3 text-center">ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {Array.isArray(limitOrders) && limitOrders
                    .filter(o => o.roomId === room.id && o.status === 'pending')
                    .map((order) => {
                      const limitPriceSafe = typeof order.limitPrice === 'number' ? order.limitPrice : parseFloat(order.limitPrice as any) || 0;
                      const amountSafe = typeof order.amount === 'number' ? order.amount : parseFloat(order.amount as any) || 0;
                      const currentSpotPrice = livePrice || openingPriceSafe || 0;
                      const currentSpotPriceSafe = typeof currentSpotPrice === 'number' ? currentSpotPrice : parseFloat(currentSpotPrice as any) || 0;
                      const triggerText = order.triggerDirection === 'below' 
                        ? `SPOT <= $${limitPriceSafe.toFixed(6)}` 
                        : `SPOT >= $${limitPriceSafe.toFixed(6)}`;
                      return (
                        <tr key={order.id} className="border-b border-trench-sandbag/20 hover:bg-trench-mud/30 transition-colors">
                          <td className="py-3 px-3 font-bold">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-staatliches ${
                              order.side === 'moon' 
                                ? 'bg-neon-moon/10 text-[#16A34A] border border-neon-moon/30 shadow-glow-moon' 
                                : 'bg-jeet-red/10 text-jeet-red border border-jeet-red/30 shadow-glow-jeet'
                            }`}>
                              {order.side === 'moon' ? 'MOON 🚀' : 'JEET 💀'}
                            </span>
                          </td>
                          <td className="py-3 px-3 text-white font-bold">{amountSafe.toFixed(2)} SOL</td>
                          <td className="py-3 px-3 text-moon-gold font-bold">${limitPriceSafe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 })}</td>
                          <td className="py-3 px-3 text-gray-300 font-bold">
                            ${currentSpotPriceSafe ? currentSpotPriceSafe.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) : 'N/A'}
                          </td>
                          <td className="py-3 px-3 text-trench-gasmask font-bold font-mono text-[10px]">{triggerText}</td>
                          <td className="py-3 px-3 text-center">
                            <button
                              onClick={() => {
                                cancelLimitOrder(order.id);
                                synthSound('bet');
                                setBattleLogs((prev) => [
                                  ...prev,
                                  `[ORDER ABORTED] limit order of ${amountSafe.toFixed(2)} SOL at $${limitPriceSafe.toFixed(6)} successfully cancelled.`
                                ]);
                              }}
                              className="px-2.5 py-1 bg-red-950/60 hover:bg-red-800 text-jeet-red hover:text-white border border-jeet-red/40 rounded font-staatliches text-[11px] uppercase tracking-wider font-bold transition-all active:scale-95"
                            >
                              [ABORT ORDER]
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-6 text-trench-gasmask font-mono text-xs font-bold uppercase leading-relaxed">
              📢 NO ACTIVE TACTICAL LIMIT ORDERS QUEUED IN THIS TRENCH SECTOR.
              <p className="text-[10px] font-normal text-trench-gasmask/60 mt-1">
                Use the Stance Configurator to deploy conditional orders to buy dips or spikes.
              </p>
            </div>
          )}
        </div>

      </main>

      {/* 3. BOTTOM LOGS PANEL (tactical radar feed bars side-by-side) */}
      <footer className="max-w-none w-full px-2 sm:px-4 md:px-6 py-2 grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6 relative z-10 mb-8 font-mono text-[10px]">
        
        {/* Left Bottom Bar: Jeet Communications Radar (Chat and system announcements integrated live) */}
        <div className="retro-panel p-2 sm:p-3 h-52 flex flex-col justify-between relative scanlines rounded-xl min-w-0 w-full overflow-hidden">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-1.5 sm:gap-0 border-b border-trench-sandbag pb-1.5 mb-2 font-mono">
            <div className="flex items-center gap-1.5 text-yellow-500 font-staatliches text-xs sm:text-sm font-bold uppercase">
              <Radio className="w-3 h-3 sm:w-4 sm:h-4 text-yellow-500 animate-pulse shrink-0" />
              <span className="truncate">((o)) COMMS RADAR</span>
            </div>
            
            {/* Dialogue faction filter tabs */}
            <div className="flex gap-1.5 sm:gap-2 text-[8px] uppercase shrink-0">
              <button 
                onClick={() => {
                  setActiveChatTab('moon');
                  synthSound('bet');
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded border ${
                  activeChatTab === 'moon' 
                    ? 'bg-neon-moon border-neon-moon text-black font-bold' 
                    : 'border-trench-sandbag text-trench-gasmask hover:text-white'
                }`}
              >
                Moon
              </button>
              <button 
                onClick={() => {
                  setActiveChatTab('jeet');
                  synthSound('bet');
                }}
                className={`px-1.5 sm:px-2 py-0.5 rounded border ${
                  activeChatTab === 'jeet' 
                    ? 'bg-jeet-red border-jeet-red text-white font-bold' 
                    : 'border-trench-sandbag text-trench-gasmask hover:text-white'
                }`}
              >
                Jeet
              </button>
            </div>
          </div>

          <div
            ref={chatScrollRef}
            className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] select-text scrollbar"
          >
            {/* Always seed a static system status entry at the top */}
            <div className="flex gap-1.5 items-start text-neon-moon font-bold uppercase">
              <span>📡</span>
              <span>[RADAR LOG] Scanning decentralized sector {room.token.symbol} for combat activities...</span>
            </div>
            <div className="flex gap-1.5 items-start text-jeet-red font-bold animate-pulse uppercase">
              <span>⚠️</span>
              <span>[GAS WAR] Solana network congested; base fee calculated dynamically.</span>
            </div>

            {activeRoomChats.length > 0 ? (
              activeRoomChats.map((msg, index) => {
                const isHQ = msg.user.includes('HQ') || msg.user.includes('COMMAND');
                const bubbleColor = isHQ
                  ? 'text-yellow-500'
                  : msg.side === 'moon'
                  ? 'text-[#16A34A]'
                  : 'text-[#ff535a]';

                return (
                  <div
                    key={index}
                    className="flex gap-1.5 items-start font-bold uppercase leading-tight"
                  >
                    <span>📡</span>
                    <span>
                      <span className={`${bubbleColor} font-bold mr-1.5`}>[{msg.user}]</span>
                      <span className="text-gray-300">{msg.message}</span>
                    </span>
                  </div>
                );
              })
            ) : (
              <div className="flex gap-1.5 items-start text-gray-500 font-bold uppercase">
                <span>📡</span>
                <span>[RADAR LOG] Waiting for user chat broadcasts on this channel...</span>
              </div>
            )}
          </div>

          {/* Inline Chat Send Input */}
          <form
            onSubmit={handleSendChat}
            className="mt-2 pt-2 border-t border-trench-sandbag flex gap-2"
          >
            <input
              type="text"
              placeholder={`SEND BROADCAST MESSAGE TO ${activeChatTab.toUpperCase()} SQUAD...`}
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              className="flex-1 min-w-0 px-3 py-1 bg-trench-black border border-trench-sandbag text-white text-[10px] font-mono rounded focus:border-neon-moon focus:outline-none uppercase placeholder-trench-gasmask/50 font-bold"
            />
            <button
              type="submit"
              className="px-3 py-1 bg-trench-sandbag hover:bg-trench-gasmask text-white rounded transition-colors flex items-center justify-center"
            >
              <Send size={10} />
            </button>
          </form>
        </div>

        {/* Right Bottom Bar: Battle Command Intelligence Log (Live feed of actions) */}
        <div className="retro-panel p-2 sm:p-3 h-52 flex flex-col justify-between relative scanlines rounded-xl min-w-0 w-full overflow-hidden">
          <div className="flex items-center gap-1.5 text-yellow-500 font-staatliches text-sm border-b border-trench-sandbag pb-1.5 mb-2 font-bold uppercase">
            <Terminal className="w-4 h-4 text-yellow-500" />
            <span>&gt;_ BATTLE COMMAND INTELLIGENCE LOG</span>
          </div>

          <div 
            ref={battleLogScrollRef}
            className="flex-1 overflow-y-auto space-y-2 pr-1 font-mono text-[10px] text-lime-400 select-text leading-tight scrollbar"
          >
            {battleLogs.map((log, index) => (
              <div key={index} className="flex gap-1.5 items-start font-bold uppercase">
                <span>⚔️</span>
                <span>{log}</span>
              </div>
            ))}
            
            {/* Conditional Room Status Logs */}
            {isSettled ? (
              <div className="flex gap-1.5 items-start text-yellow-400 font-bold uppercase">
                <span>⚔️</span>
                <span>[BATTLE OVER] Arena resolved. Faction {room.winner?.toUpperCase()} emerged victorious!</span>
              </div>
            ) : room.expiry <= Date.now() ? (
              <div className="flex gap-1.5 items-start text-yellow-500 font-bold uppercase animate-pulse">
                <span>⚔️</span>
                <span>[EXPIRY REACHED] Arena expired. Resolving block oracle parameters...</span>
              </div>
            ) : (
              <div className="flex gap-1.5 items-start text-gray-500 font-bold uppercase animate-pulse">
                <span>⚔️</span>
                <span>[TRENCH ACTIVE] Combatants locked in duel. Awaiting block resolution timers.</span>
              </div>
            )}
          </div>
        </div>

      </footer>

      <div className="my-8 max-w-7xl mx-auto w-full px-4">
        <PixelBarbedWire height={16} />
      </div>

    </div>
  );
}
