'use client';

import React, { useState, useEffect } from 'react';
import { ShieldAlert, Radiation, HelpCircle, Lock } from 'lucide-react';
import { PepePortrait, PEPE_ASSETS } from './MemeAssets';
import { synthSound } from './ClientWrapper';

export const ComplianceModal: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const accepted = localStorage.getItem('sm_compliance_accepted') === 'true';
    if (!accepted) {
      setIsOpen(true);
    }
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem('sm_compliance_accepted', 'true');
      setIsOpen(false);
      // Play a click sound if audio is enabled
      if (typeof window !== 'undefined' && (window as any).playDAppSound) {
        (window as any).playDAppSound('bet');
      } else {
        synthSound('bet');
      }
    } catch (err) {
      console.error('Failed to set compliance acceptance:', err);
    }
  };

  if (!mounted || !isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/95 backdrop-blur-md flex items-center justify-center z-[10000] p-4 select-none scanlines">
      <div className="bg-[#0c1809] border-4 border-neon-moon max-w-lg w-full rounded-lg p-6 relative shadow-[0_0_30px_rgba(57,255,20,0.15)] overflow-hidden">
        {/* Glow scanline lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,1)_50%,rgba(0,0,0,1))] bg-[size:100%_4px]"></div>

        {/* Tactical Header */}
        <div className="flex items-center gap-3 border-b-2 border-neon-moon pb-3 mb-4">
          <PepePortrait src={PEPE_ASSETS.apeGeneral} size={48} glowColor="moon" className="rounded-lg shrink-0" />
          <div>
            <h2 className="font-staatliches text-2xl text-neon-moon tracking-widest uppercase leading-none">
              TACTICAL ENGAGEMENT AGREEMENT
            </h2>
            <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold block mt-1">
              PROTOCOL SECURITY & RISK ADVISORY DECK
            </span>
          </div>
        </div>

        {/* Warnings Grid */}
        <div className="space-y-4 font-mono text-[10px] uppercase text-trench-gasmask leading-relaxed">

          <div className="flex gap-2.5 p-3 bg-yellow-950/20 border border-moon-gold/40 rounded">
            <Radiation size={20} className="text-moon-gold shrink-0 animate-pulse" />
            <div>
              <span className="text-moon-gold font-bold block text-[11px] mb-0.5">PVP RISK MATRIX (RUIN WARNING)</span>
              <p className="text-[9px]">
                SHITMARKET prediction pools operate as high-velocity, peer-to-peer battlegrounds. Wagers are non-custodial and final. Volatile memecoins and oracle-verifiable assets fluctuate rapidly; there are no refunds, insurance, or safety nets.
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 p-3 bg-trench-mud border border-trench-sandbag/40 rounded">
            <HelpCircle size={20} className="text-white shrink-0" />
            <div>
              <span className="text-white font-bold block text-[11px] mb-0.5">DECENTRALIZED AS-IS SERVICE</span>
              <p className="text-[9px]">
                The permissionless smart contracts run directly on-chain via multi-chain oracle aggregation (Pyth Network, Chainlink, DexScreener, Birdeye). By deploying ammunition wagers, you accept all network risks, slippage variations, and execution limits.
              </p>
            </div>
          </div>

        </div>

        {/* Confirmation Action */}
        <div className="mt-6 border-t border-trench-sandbag/30 pt-4">
          <button
            onClick={handleAccept}
            className="w-full py-3 bg-neon-moon text-black font-staatliches text-xl rounded uppercase border-b-4 border-trench-black cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all font-extrabold flex items-center justify-center gap-2"
          >
            <span>I ACCEPT THE TERMS & WAIVE ALL RISKS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
