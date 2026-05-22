'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { PixelCrackedHelmet, PixelGasMask, PixelBarbedWire } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { ShieldAlert, Zap, Layers, AlertCircle, HelpCircle, ArrowLeft, ArrowRight } from 'lucide-react';

interface MockParlayLeg {
  id: string;
  token: string;
  side: 'moon' | 'jeet';
  odds: number;
}

export default function ParlaysPage() {
  const [legs, setLegs] = useState<MockParlayLeg[]>([
    { id: '1', token: 'WIFEY', side: 'moon', odds: 1.85 },
    { id: '2', token: 'PEPE5.0', side: 'jeet', odds: 1.95 },
    { id: '3', token: 'JEETSLAYER', side: 'moon', odds: 1.70 }
  ]);

  const [stakeAmount, setStakeAmount] = useState<number>(0.5); // SOL

  const calculateMultiplier = () => {
    return legs.reduce((acc, leg) => acc * leg.odds, 1);
  };

  const calculatePayout = () => {
    return calculateMultiplier() * stakeAmount;
  };

  const handleQuickStake = (val: number) => {
    setStakeAmount(val);
    synthSound('bet');
  };

  return (
    <div className="mx-auto max-w-4xl w-full px-4 py-8 flex-1 flex flex-col select-none">
      
      {/* Back button */}
      <div className="mb-4">
        <Link href="/rooms" className="inline-flex items-center gap-1 text-trench-gasmask hover:text-white font-mono text-xs uppercase font-bold">
          <ArrowLeft size={14} /> Back to War Table
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* Left Column: Interactive Multi-Leg UI Simulator (7 cols) */}
        <div className="lg:col-span-8 bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 relative shadow-lg scanlines">
          
          <div className="absolute top-[-18px] left-[50%] -translate-x-[50%] bg-[#5C5244] border-2 border-[#8B8B7A] text-white px-6 py-1 rounded font-staatliches text-sm tracking-widest shadow uppercase flex items-center gap-1.5 font-bold z-10">
            <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={20} className="rounded-full animate-spin" />
            <span>COMING SOON</span>
          </div>

          <div className="mb-6 mt-4 flex items-center gap-4">
            <PepePortrait src={PEPE_ASSETS.neonWojak} size={52} glowColor="moon" animated className="rounded-lg shrink-0" />
            <div>
              <h2 className="font-staatliches text-4xl text-white tracking-wider flex items-center gap-2 uppercase leading-none">
                MULTIPLY DEGEN: PvP PARLAYS
              </h2>
              <p className="font-mono text-xs text-trench-gasmask uppercase font-bold mt-1.5">
                Assemble multiple prediction room wagers into a single tactical strike. All targets must settle in your favor to claim the aggregated pot multiplier.
              </p>
            </div>
          </div>

          {/* Warning badge */}
          <div className="mb-6 flex gap-2.5 p-3.5 bg-yellow-500/5 border-2 border-dashed border-yellow-500/20 rounded text-trench-gasmask items-center">
            <PepePortrait src={PEPE_ASSETS.jeetSkeleton} size={36} glowColor="jeet" className="rounded-full shrink-0" />
            <div>
              <span className="font-staatliches text-lg text-moon-gold tracking-wide block uppercase leading-none">HIGH LEVERAGE HAZARD ZONE</span>
              <p className="font-mono text-[9px] uppercase font-bold mt-1 leading-normal">
                If a single prediction on your parlay ticket gets rugged or settled against your side, the entire ammunition stake is forfeit to the PvP pool.
              </p>
            </div>
          </div>

          {/* Parlay ticket list builder preview */}
          <div className="space-y-3 bg-trench-black/60 p-4 border border-trench-sandbag rounded-lg shadow-inner mb-6">
            <div className="flex justify-between border-b border-trench-sandbag/40 pb-2 font-mono text-[10px] text-trench-gasmask uppercase font-bold">
              <span>TARGET ROOM</span>
              <span>DEPLOYED DIRECTION</span>
              <span>POT MULTIPLIER</span>
            </div>

            {legs.map((leg) => (
              <div key={leg.id} className="flex justify-between items-center bg-trench-black p-3 border border-trench-sandbag/65 rounded font-mono text-xs font-bold uppercase transition-all hover:scale-102">
                <div className="flex items-center gap-2">
                  <div className="p-0.5 bg-trench-mud border border-trench-sandbag rounded overflow-hidden">
                    <PepePortrait src={leg.side === 'moon' ? PEPE_ASSETS.chadBull : PEPE_ASSETS.jeetSkeleton} size={24} className="rounded" />
                  </div>
                  <div>
                    <span className="text-white block font-bold">${leg.token}</span>
                    <span className="text-[9px] text-trench-gasmask block font-bold">ROOM SECTOR #{leg.id}</span>
                  </div>
                </div>
                <div>
                  <span className={`px-2 py-0.5 rounded text-[10px] border ${
                    leg.side === 'moon' 
                      ? 'bg-neon-moon/10 border-neon-moon text-neon-moon' 
                      : 'bg-jeet-red/10 border-jeet-red text-jeet-red'
                  }`}>
                    {leg.side.toUpperCase()}
                  </span>
                </div>
                <div>
                  <span className="text-moon-gold font-staatliches text-lg">x{leg.odds}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Quick actions for mock legs */}
          <div className="flex justify-between items-center font-mono text-xs font-bold uppercase border-t border-trench-sandbag/40 pt-4 text-trench-gasmask">
            <span>STAKE DIAL:</span>
            <div className="flex gap-2">
              {[0.1, 0.5, 1.0, 2.5].map((val) => (
                <button
                  key={val}
                  onClick={() => handleQuickStake(val)}
                  className={`px-3 py-1 border rounded transition-all ${
                    stakeAmount === val ? 'bg-moon-gold text-black border-moon-gold' : 'bg-trench-black text-trench-gasmask border-trench-sandbag hover:text-white'
                  }`}
                >
                  {val} SOL
                </button>
              ))}
            </div>
          </div>

        </div>

        {/* Right Column: Dynamic Aggregation Console (5 cols) */}
        <div className="lg:col-span-4 bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 relative shadow-lg scanlines flex flex-col justify-between h-[390px] lg:h-[430px]">
          
          <div>
            <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-2 uppercase border-b border-trench-sandbag/40 pb-2">
              <PepePortrait src={PEPE_ASSETS.apeGeneral} size={24} className="rounded-full" />
              SLIP SLATE
            </h3>

            {/* Aggregated details */}
            <div className="space-y-4 font-mono text-xs font-bold uppercase text-trench-gasmask">
              <div className="flex justify-between items-center">
                <span>COMBINED WEIGHTS</span>
                <span className="text-white font-bold">{legs.length} SECTOR LEGS</span>
              </div>
              <div className="flex justify-between items-center">
                <span>AMMO STAKE DEPLOYED</span>
                <span className="text-white font-bold">{stakeAmount} SOL</span>
              </div>
              <div className="flex justify-between items-center border-t border-trench-sandbag/40 pt-3">
                <span>POTENTIATE ODDS</span>
                <span className="text-moon-gold font-staatliches text-2xl tracking-wider">x{calculateMultiplier().toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            {/* Massive Payout Banner */}
            <div className="bg-trench-black p-4 border border-trench-sandbag rounded text-center my-6 shadow-inner">
              <span className="font-mono text-[9px] text-trench-gasmask block uppercase font-bold">POTENTIAL PVP PAYOUT (SOL)</span>
              <span className="font-staatliches text-4xl text-neon-moon tracking-widest glow-moon block mt-1 font-bold">
                {calculatePayout().toFixed(3)} SOL
              </span>
            </div>

            <button
              disabled
              className="w-full py-3.5 bg-trench-sandbag text-trench-gasmask font-staatliches text-xl rounded uppercase border-b-4 border-trench-black cursor-not-allowed flex items-center justify-center gap-1.5"
            >
              <span>DISPATCH CONQUER TICKET 🔒</span>
            </button>
          </div>

        </div>

      </div>

      {/* Degen Quote Banner */}
      <div className="mb-6">
        <DegenQuoteBanner />
      </div>

      <div className="my-8">
        <PixelBarbedWire height={16} />
      </div>

    </div>
  );
}
