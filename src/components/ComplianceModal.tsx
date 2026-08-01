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
    <div className="fixed inset-0 bg-slate-900/40 dark:bg-black/95 backdrop-blur-md flex items-center justify-center z-[10000] p-4 select-none dark:scanlines">
      <div className="bg-white dark:bg-[#0c1809] border-2 border-teal-600 dark:border-4 dark:border-neon-moon max-w-lg w-full rounded-xl p-6 relative shadow-2xl dark:shadow-[0_0_30px_rgba(57,255,20,0.15)] overflow-hidden text-slate-800 dark:text-white transition-colors duration-200">
        {/* Glow scanline lines */}
        <div className="absolute inset-0 pointer-events-none opacity-[0.03] bg-[linear-gradient(to_bottom,rgba(255,255,255,0),rgba(255,255,255,0)_50%,rgba(0,0,0,1)_50%,rgba(0,0,0,1))] bg-[size:100%_4px]"></div>

        {/* Header */}
        <div className="flex items-center gap-3 border-b-2 border-teal-600 dark:border-neon-moon pb-3 mb-4">
          <PepePortrait src={PEPE_ASSETS.apeGeneral} size={48} glowColor="moon" className="rounded-lg shrink-0" />
          <div>
            <h2 className="font-staatliches text-2xl text-teal-700 dark:text-neon-moon tracking-widest uppercase leading-none">
              PROTOCOL DISCLAIMER & RISK WARNING
            </h2>
            <span className="font-mono text-[9px] text-slate-500 dark:text-trench-gasmask uppercase font-bold block mt-1">
              PLEASE READ BEFORE TRADING ON-CHAIN
            </span>
          </div>
        </div>

        {/* Warnings Grid */}
        <div className="space-y-4 font-mono text-[10px] uppercase text-slate-700 dark:text-trench-gasmask leading-relaxed">

          <div className="flex gap-2.5 p-3 bg-amber-50 dark:bg-yellow-950/20 border border-amber-300 dark:border-moon-gold/40 rounded-lg">
            <Radiation size={20} className="text-amber-600 dark:text-moon-gold shrink-0 animate-pulse" />
            <div>
              <span className="text-amber-800 dark:text-moon-gold font-bold block text-[11px] mb-0.5">HIGH RISK PREDICTION POOLS</span>
              <p className="text-[9px]">
                SHITMARKET prediction pools operate as non-custodial, peer-to-peer prediction markets. Wagers are final once executed on-chain. Volatile memecoins fluctuate rapidly; there are no refunds, insurance, or safety nets.
              </p>
            </div>
          </div>

          <div className="flex gap-2.5 p-3 bg-cyan-50 dark:bg-trench-mud border border-cyan-200 dark:border-trench-sandbag/40 rounded-lg">
            <HelpCircle size={20} className="text-slate-800 dark:text-white shrink-0" />
            <div>
              <span className="text-slate-900 dark:text-white font-bold block text-[11px] mb-0.5">DECENTRALIZED ORACLE RESOLUTION</span>
              <p className="text-[9px]">
                Smart contracts run directly on-chain using automated price feeds and oracle nodes (Pyth, Chainlink, DexScreener). By placing wagers, you accept all network risks, slippage, and execution rules.
              </p>
            </div>
          </div>

        </div>

        {/* Confirmation Action */}
        <div className="mt-6 border-t border-cyan-200 dark:border-trench-sandbag/30 pt-4">
          <button
            onClick={handleAccept}
            className="w-full py-3 bg-[#00796B] dark:bg-neon-moon text-white dark:text-black font-staatliches text-xl rounded-lg uppercase cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all font-extrabold flex items-center justify-center gap-2 shadow-md"
          >
            <span>I UNDERSTAND & ACCEPT RISKS</span>
          </button>
        </div>
      </div>
    </div>
  );
};
