'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppState, Room } from '@/store/useAppState';
import { PixelShovel, PixelGasMask, PixelCrackedHelmet } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { ShieldCheck, CalendarRange, Info, Clock, AlertTriangle, Radio, Loader2, Coins } from 'lucide-react';

const MOCK_TOKENS = [
  { name: 'Jeet Repellent Coin', symbol: 'REPENT', icon: '🧴' },
  { name: 'Slippage Slayer Ultimate', symbol: 'SLIP', icon: '⚔️' },
  { name: 'Giga Chad Premium Token', symbol: 'CHADG', icon: '🗿' },
  { name: 'Honeypot Immune Safe', symbol: 'IMMUNE', icon: '🛡️' },
  { name: 'Slerf Lazy Sloth V2', symbol: 'SLERF2', icon: '🦥' },
  { name: 'Pump and Never Dump', symbol: 'PAND', icon: '🐼' }
];

export default function CreateRoomPage() {
  const router = useRouter();
  const { createRoom, user, connectWallet, placeBet, isTransactionLoading, wallet } = useAppState();

  // Form State
  const [contractAddress, setContractAddress] = useState('');
  const [duration, setDuration] = useState<number>(15);
  const [seedSide, setSeedSide] = useState<'none' | 'moon' | 'jeet'>('none');
  const [seedAmount, setSeedAmount] = useState<number>(0.1);

  // Scanner Loading and Results
  const [scanning, setScanning] = useState(false);
  const [tokenInfo, setTokenInfo] = useState<{
    name: string;
    symbol: string;
    icon: string;
    liquidity: string;
    priceUsd: string;
    fdv: string;
    volume24h: string;
    rawLiquidity?: number;
    rawFdv?: number;
    chainId?: string;
    pairAddress?: string;
  } | null>(null);

  const handleScan = async () => {
    if (!contractAddress.trim()) {
      alert('ENTER A VALID TOKEN CONTRACT ADDRESS!');
      return;
    }

    setScanning(true);
    synthSound('bet');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    try {
      const res = await fetch(`https://api.dexscreener.com/latest/dex/search?q=${contractAddress.trim()}`, {
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      const data = await res.json();
      
      if (data && data.pairs && data.pairs.length > 0) {
        // Find best match (sort by liquidity descending)
        const sortedPairs = data.pairs.sort((a: any, b: any) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0));
        const pair = sortedPairs[0];
        
        let ageStr = 'Unknown';
        if (pair.pairCreatedAt) {
          const ageMs = Date.now() - pair.pairCreatedAt;
          const ageHours = Math.floor(ageMs / 3600000);
          const ageMins = Math.floor((ageMs % 3600000) / 60000);
          ageStr = `${ageHours}h ${ageMins}m ago`;
        }
        
        const formatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0
        });
        
        const priceFormatter = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          minimumFractionDigits: 2,
          maximumFractionDigits: 6
        });

        // Validate via indexer API to verify age and market cap constraints
        const indexerApi = process.env.NEXT_PUBLIC_INDEXER_API_URL || 'http://localhost:3001';
        try {
          const valRes = await fetch(`${indexerApi}/api/rooms/validate?mint=${contractAddress.trim()}`);
          if (valRes.ok) {
            const valData = await valRes.json();
            if (!valData.valid) {
              alert(`TOKEN SECURITY SCREENING FAILED: ${valData.reason}`);
              setTokenInfo(null);
              return;
            }
          }
        } catch (valErr) {
          console.warn("Could not reach validation server, proceeding with caution...", valErr);
        }

        setTokenInfo({
          name: pair.baseToken.name,
          symbol: pair.baseToken.symbol,
          icon: pair.info?.imageUrl ? pair.info.imageUrl : '📊',
          liquidity: pair.liquidity?.usd ? `${formatter.format(pair.liquidity.usd)}` : 'UNKNOWN',
          priceUsd: pair.priceUsd ? priceFormatter.format(parseFloat(pair.priceUsd)) : 'UNKNOWN',
          fdv: pair.fdv ? formatter.format(pair.fdv) : 'UNKNOWN',
          volume24h: pair.volume?.h24 ? formatter.format(pair.volume.h24) : 'UNKNOWN',
          rawLiquidity: pair.liquidity?.usd,
          rawFdv: pair.fdv,
          chainId: pair.chainId,
          pairAddress: pair.pairAddress
        });
        
        synthSound('victory');
      } else {
        alert('NO PAIRS FOUND ON DEXSCREENER FOR THIS ADDRESS!');
      }
    } catch (e: any) {
      clearTimeout(timeoutId);
      console.error(e);
      if (e.name === 'AbortError') {
        alert('API SCAN TIMED OUT. SECURE SATELLITE CONNECTION AND TRY AGAIN!');
      } else {
        alert('ERROR FETCHING FROM DEXSCREENER!');
      }
    } finally {
      setScanning(false);
    }
  };

  const handleLaunch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tokenInfo) {
      alert('MUST SCAN A VALID TOKENS CONTRACT FIRST!');
      return;
    }

    // Connect wallet if trying to launch
    if (!wallet || !wallet.publicKey) {
      alert('PLEASE CONNECT YOUR SOLANA WALLET TO DEPLOY THIS ARENA!');
      connectWallet();
      return;
    }

    // Deduct user seed amount if applicable
    if (seedSide !== 'none' && user) {
      if (user.balance < seedAmount) {
        alert('INSUFFICIENT AMMO SOL TO SEED THIS ROOM!');
        return;
      }
    }

    // Build the room
    const generatedId = String(Date.now());
    const moonSeed = seedSide === 'moon' ? seedAmount : 0;
    const jeetSeed = seedSide === 'jeet' ? seedAmount : 0;

    const newRoom: Room = {
      id: generatedId,
      token: {
        address: contractAddress,
        name: tokenInfo.name,
        symbol: tokenInfo.symbol,
        icon: tokenInfo.icon,
        liquidity: tokenInfo.rawLiquidity,
        marketCap: tokenInfo.rawFdv,
        chainId: tokenInfo.chainId,
        pairAddress: tokenInfo.pairAddress
      },
      creator: user && user.wallet ? `${user.wallet.substring(0, 6)}...${user.wallet.substring(user.wallet.length-4)}` : 'AnonCommander',
      moonPool: moonSeed > 0 ? moonSeed : 0.05, // default basic seed pools if none
      jeetPool: jeetSeed > 0 ? jeetSeed : 0.05,
      expiry: Date.now() + duration * 60000,
      status: 'active',
      createdAt: Date.now(),
      duration: duration as any
    };

    try {
      // First create the room on-chain (or sync if it already exists)
      const res = await createRoom(newRoom);
      
      // If they seeded and it's a brand new room, place the bet
      if (res && !res.alreadyExists && seedSide !== 'none') {
        try {
          await placeBet(res.roomPda, seedSide, seedAmount);
        } catch (betErr) {
          console.error("Initial seeding bet failed, but room was created:", betErr);
        }
      }
      
      synthSound('explosion');
      if (res && res.alreadyExists) {
        alert("COMMAND HQ DETECTED THAT A PREDICTION ARENA ALREADY EXISTS FOR THIS TOKEN! REDIRECTING YOU TO THE ON-CHAIN ARENA...");
      }
      
      if (res && res.roomPda) {
        router.push(`/room/${res.roomPda}`);
      } else {
        router.push('/rooms');
      }
    } catch (err: any) {
      console.error("Launch Arena transaction failed:", err);
    }
  };

  return (
    <div className="mx-auto max-w-2xl w-full px-4 py-8 flex-1 flex flex-col items-center select-none">
      
      {/* military clipboard frame */}
      <div className="w-full bg-trench-mud p-6 md:p-8 border-4 border-trench-sandbag rounded-lg shadow-2xl relative scanlines">
        
        {/* Metal clipboard clip */}
        <div className="absolute top-[-18px] left-[50%] -translate-x-[50%] bg-[#5C5244] border-2 border-[#8B8B7A] text-white px-8 py-1 rounded font-staatliches text-base tracking-widest shadow-md uppercase flex items-center gap-2">
          <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={24} className="rounded-full" />
          <span>DEPLOYMENT CLIPBOARD</span>
        </div>

        <div className="text-center mb-8 mt-4">
          <PepePortrait src={PEPE_ASSETS.cryptoBunker} size={80} glowColor="moon" animated className="rounded-lg mx-auto mb-4" />
          <h2 className="font-staatliches text-4xl text-white tracking-wider flex items-center justify-center gap-2 stencil-shadow">
            <Radio className="text-neon-moon animate-pulse" size={24} />
            LAUNCH ARENA
          </h2>
          <p className="font-mono text-xs text-trench-gasmask uppercase font-bold mt-1 max-w-sm mx-auto leading-relaxed">
            Dig a new prediction trench by pasting a token contract. Platform automatically performs safety screening.
          </p>
        </div>

        <form onSubmit={handleLaunch} className="space-y-6">
          
          {/* 1. Contract Address Input */}
          <div className="space-y-2">
            <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
              Token Contract Address (Solana/Token):
            </label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                required
                placeholder="PASTE TOKEN CONTRACT ADDRESS TO SCAN..."
                value={contractAddress}
                onChange={(e) => {
                  setContractAddress(e.target.value);
                  setTokenInfo(null); // Reset scanned info if they change text
                }}
                className="flex-1 px-3 py-2.5 bg-trench-black border-2 border-trench-sandbag text-white font-mono text-xs placeholder-trench-gasmask/60 rounded focus:border-neon-moon focus:outline-none uppercase tracking-widest font-bold"
              />
              <button
                type="button"
                onClick={handleScan}
                disabled={scanning || !contractAddress.trim()}
                className="px-5 bg-trench-sandbag hover:bg-trench-gasmask font-staatliches text-lg text-white border border-trench-sandbag/80 active:translate-y-0.5 rounded transition-all flex items-center justify-center gap-1.5 shrink-0"
              >
                {scanning ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-neon-moon" />
                    <span>SCANNING</span>
                  </>
                ) : (
                  <span>SCAN TARGET</span>
                )}
              </button>
            </div>
          </div>

          {/* 2. SCAN OUTCOME DASHBOARD */}
          {tokenInfo && (
            <div className="bg-trench-black p-4 border border-trench-sandbag rounded shadow-inner space-y-4 animate-fadeIn">
              
              {/* Loaded Token header */}
              <div className="flex items-center gap-3.5 border-b border-trench-sandbag/40 pb-3">
                <div className="w-12 h-12 bg-trench-black rounded-full border-2 border-neon-moon flex items-center justify-center text-2xl overflow-hidden shrink-0">
                  {tokenInfo.icon.startsWith('http') ? (
                    <img src={tokenInfo.icon} alt={tokenInfo.symbol} className="w-full h-full object-cover" />
                  ) : (
                    tokenInfo.icon
                  )}
                </div>
                <div>
                  <h4 className="font-staatliches text-2xl text-neon-moon tracking-wide">
                    {tokenInfo.name} (${tokenInfo.symbol})
                  </h4>
                  <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase">
                    TARGET VALIDATED SUCCESSFULLY
                  </span>
                </div>
              </div>

              {/* Financial Metrics Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                
                <div className="bg-trench-mud/50 border border-neon-moon/30 rounded p-2.5 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-neon-moon shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] text-trench-gasmask block font-bold">PRICE</span>
                    <span className="font-mono text-[10px] text-white font-bold truncate block">{tokenInfo.priceUsd}</span>
                  </div>
                </div>

                <div className="bg-trench-mud/50 border border-neon-moon/30 rounded p-2.5 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-neon-moon shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] text-trench-gasmask block font-bold">LIQUIDITY</span>
                    <span className="font-mono text-[10px] text-white font-bold truncate block">{tokenInfo.liquidity}</span>
                  </div>
                </div>

                <div className="bg-trench-mud/50 border border-neon-moon/30 rounded p-2.5 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-neon-moon shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] text-trench-gasmask block font-bold">24H VOL</span>
                    <span className="font-mono text-[10px] text-white font-bold truncate block">{tokenInfo.volume24h}</span>
                  </div>
                </div>

                <div className="bg-trench-mud/50 border border-neon-moon/30 rounded p-2.5 flex items-center gap-2">
                  <ShieldCheck size={18} className="text-neon-moon shrink-0" />
                  <div className="min-w-0">
                    <span className="font-mono text-[8px] text-trench-gasmask block font-bold">FDV</span>
                    <span className="font-mono text-[10px] text-white font-bold truncate block">{tokenInfo.fdv}</span>
                  </div>
                </div>

              </div>
            </div>
          )}

          {/* 3. Duration Selector */}
          <div className="space-y-2">
            <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
              Battle Duration Option:
            </label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { time: 5, label: 'SKIRMISH', desc: '5 min' },
                { time: 15, label: 'OPERATION', desc: '15 min' },
                { time: 30, label: 'BLITZ', desc: '30 min' },
                { time: 60, label: 'SIEGE', desc: '60 min' }
              ].map((opt) => (
                <div
                  key={opt.time}
                  onClick={() => {
                    setDuration(opt.time);
                    synthSound('bet');
                  }}
                  className={`bg-trench-black p-3.5 border-2 rounded text-center cursor-pointer transition-all hover:scale-102 flex flex-col justify-center ${
                    duration === opt.time
                      ? 'border-neon-moon bg-neon-moon/5 shadow-glow-moon'
                      : 'border-trench-sandbag text-trench-gasmask hover:text-white'
                  }`}
                >
                  <Clock size={16} className="mx-auto mb-1 text-inherit" />
                  <span className="font-staatliches text-lg block leading-none">{opt.time} MINS</span>
                  <span className="font-mono text-[8px] font-bold uppercase tracking-wider block mt-1">{opt.label}</span>
                </div>
              ))}
            </div>
            
            {/* Custom Duration Input */}
            <div className="flex items-center gap-2 mt-2">
              <span className="font-mono text-xs text-trench-gasmask font-bold">CUSTOM:</span>
              <div className="relative flex-1">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={duration}
                  onChange={(e) => setDuration(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full bg-trench-black/50 border border-trench-sandbag rounded px-3 py-2 text-white font-mono text-sm focus:outline-none focus:border-neon-moon"
                  placeholder="Minutes"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 font-mono text-[10px] text-trench-gasmask">
                  MINUTES
                </span>
              </div>
            </div>
          </div>

          {/* 4. Optional Initial Seed Stake */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <label className="block font-mono text-xs font-bold text-white uppercase tracking-wider">
                Initial Seeding Ammo (Optional):
              </label>
              {seedSide !== 'none' && (
                <span className="font-mono text-xs text-moon-gold font-bold">{seedAmount} SOL</span>
              )}
            </div>
            <div className="grid grid-cols-3 gap-2 bg-trench-black p-1 border border-trench-sandbag rounded">
              <button
                type="button"
                onClick={() => setSeedSide('none')}
                className={`py-1.5 font-staatliches text-xs tracking-wider uppercase rounded transition-all ${
                  seedSide === 'none' ? 'bg-trench-sandbag text-white font-bold' : 'text-trench-gasmask'
                }`}
              >
                Zero Seeding
              </button>
              <button
                type="button"
                onClick={() => setSeedSide('moon')}
                className={`py-1.5 font-staatliches text-xs tracking-wider uppercase rounded transition-all ${
                  seedSide === 'moon' ? 'bg-neon-moon text-black font-bold' : 'text-trench-gasmask'
                }`}
              >
                Seed Moon
              </button>
              <button
                type="button"
                onClick={() => setSeedSide('jeet')}
                className={`py-1.5 font-staatliches text-xs tracking-wider uppercase rounded transition-all ${
                  seedSide === 'jeet' ? 'bg-jeet-red text-white font-bold' : 'text-trench-gasmask'
                }`}
              >
                Seed Jeet
              </button>
            </div>

            {seedSide !== 'none' && (
              <div className="pt-2 bg-trench-black border border-trench-sandbag rounded p-3 space-y-3">

                <input
                  type="range"
                  min="0.05"
                  max="2.0"
                  step="0.05"
                  value={seedAmount}
                  onChange={(e) => setSeedAmount(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-trench-mud rounded-lg appearance-none cursor-pointer accent-neon-moon"
                />
                <div className="flex gap-2">
                  {[0.05, 0.1, 0.5, 1.0, 2.0].map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setSeedAmount(v)}
                      className={`flex-1 py-0.5 text-center font-mono text-[10px] rounded border ${
                        seedAmount === v
                          ? 'bg-moon-gold text-black border-moon-gold'
                          : 'bg-trench-black text-trench-gasmask border-trench-sandbag'
                      }`}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 5. Launch CTA Trigger */}
          <button
            type="submit"
            disabled={isTransactionLoading || scanning}
            className="w-full mt-8 py-3.5 bg-neon-moon hover:bg-green-500 disabled:bg-trench-sandbag disabled:text-trench-gasmask disabled:border-trench-sandbag disabled:shadow-none disabled:cursor-not-allowed font-staatliches text-2xl text-black border-b-4 border-green-800 shadow-glow-moon active:translate-y-1 transition-all rounded uppercase flex items-center justify-center gap-2 font-bold"
          >
            {isTransactionLoading ? (
              <>
                <Loader2 className="animate-spin text-black shrink-0" size={24} />
                <span>LAUNCHING TRENCH ON-CHAIN...</span>
              </>
            ) : (
              <>
                <PepePortrait src={PEPE_ASSETS.diamondHands} size={32} className="rounded-full" />
                <span>LAUNCH ARENA 💣</span>
              </>
            )}
          </button>

        </form>

        <div className="mt-6 border-t-2 border-trench-sandbag/45 pt-4 flex gap-2 items-start text-trench-gasmask">
          <PepePortrait src={PEPE_ASSETS.apeGeneral} size={32} glowColor="gold" className="rounded shrink-0" />
          <p className="font-mono text-[9px] uppercase leading-tight font-bold">
            Notice: Seeding immediately locks your specified Ammo SOL into the battlefield pot. Plat takes exactly 2.0% upon final settlement clock detonation. Play hard.
          </p>
        </div>

        {/* Degen Quote at bottom */}
        <div className="mt-4">
          <DegenQuoteBanner />
        </div>

      </div>

    </div>
  );
}
