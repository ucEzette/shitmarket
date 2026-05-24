'use client';

import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { ArrowLeft, ShieldAlert, Award, Swords, Flame, Coins, ShieldCheck, HelpCircle } from 'lucide-react';

export default function RulesPage() {
  const router = useRouter();

  const rules = [
    {
      title: '1. PREEDICTIVE COMBAT ARENAS (ROOMS)',
      icon: Swords,
      color: 'border-neon-moon/40 text-neon-moon bg-neon-moon/5',
      desc: 'Commanders construct prediction arenas by scanning and pasting any active Solana token contract address from DexScreener. Each room represents a localized PvP battlefield sector.'
    },
    {
      title: '2. INITIAL SEEDING (*REQUIRED)',
      icon: Flame,
      color: 'border-jeet-red/40 text-jeet-red bg-jeet-red/5',
      desc: 'Zero seeding of arenas is strictly rejected by HQ. Every arena deployment requires an initial seeding stake (minimum 0.01 SOL) to secure either the Moon or Jeet trenches. You must back your sector.'
    },
    {
      title: '3. SELECT ARMY & DEPLOY wagers',
      icon: HelpCircle,
      color: 'border-moon-gold/40 text-moon-gold bg-moon-gold/5',
      desc: 'Wagers are executed P2P. Bet on the token price pumping (Moon Army) or dumping (Jeet Squadron) within customized countdown limits. You never hold the actual tokens, only predictive war bonds.'
    },
    {
      title: '4. THE TWAP SETTLEMENT BOMB',
      icon: ShieldCheck,
      color: 'border-white/20 text-white bg-white/5',
      desc: 'Once the countdown detonates (from 5 minutes up to 1 year), the arena locks. Winnings are settled automatically via decentralized keepers utilizing high-fidelity DexScreener spot price EMA/TWAP smoothing to verify the victor.'
    },
    {
      title: '5. FEE STRUCTURE & TAXATION',
      icon: Coins,
      color: 'border-neon-moon/40 text-neon-moon bg-neon-moon/5',
      desc: 'A flat 1.25% platform fee is captured from the total room pot upon final settlement. Inviter commanders automatically receive a 0.1% on-chain referral rebate commission routed directly to their Ammo wallets on every recruit bet.'
    }
  ];

  return (
    <div className="mx-auto max-w-4xl w-full px-4 py-8 flex-1 flex flex-col select-none animate-fadeIn scanlines">
      
      {/* Navigation Header */}
      <div className="flex items-center justify-between bg-trench-mud border-2 border-trench-sandbag p-4 rounded-lg shadow-md mb-8">
        <Link 
          href="/" 
          onClick={() => synthSound('bet')}
          className="inline-flex items-center gap-1.5 text-trench-gasmask hover:text-white font-mono text-xs uppercase font-bold transition-colors"
        >
          <ArrowLeft size={14} /> RETREAT TO HOME BASE
        </Link>
        <span className="font-staatliches text-lg text-neon-moon tracking-widest glow-moon uppercase">
          ⚔️ WAR OPERATIONS PROTOCOLS
        </span>
      </div>

      {/* Main Blueprint Panel */}
      <div className="bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 md:p-8 relative shadow-2xl relative overflow-hidden">
        {/* Decorative corner bolts */}
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
        <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag"></div>

        <div className="text-center border-b-2 border-trench-sandbag pb-6 mb-8">
          <PepePortrait src={PEPE_ASSETS.apeGeneral} size={80} glowColor="moon" animated className="rounded-full mx-auto mb-4 border-0" />
          <h1 className="font-staatliches text-4xl sm:text-5xl text-white tracking-wider uppercase leading-none">
            TRENCH WAR MANUAL
          </h1>
          <p className="font-mono text-xs text-trench-gasmask font-bold mt-1.5 uppercase tracking-widest">
            OFFICIAL PvP ARENA OPERATIONAL RULES
          </p>
        </div>

        {/* Dynamic Rules Loop */}
        <div className="space-y-6 font-mono text-xs text-trench-gasmask">
          {rules.map((rule, idx) => {
            const Icon = rule.icon;
            return (
              <div 
                key={idx} 
                className={`p-4 border rounded flex gap-4 items-start shadow-inner ${rule.color} hover:scale-[1.01] transition-transform duration-200`}
              >
                <div className="p-2 bg-trench-black border border-trench-sandbag rounded shrink-0">
                  <Icon size={18} />
                </div>
                <div>
                  <h4 className="font-staatliches text-lg sm:text-xl text-white tracking-wide uppercase leading-tight">
                    {rule.title}
                  </h4>
                  <p className="mt-1 leading-relaxed text-[11px] font-semibold text-trench-gasmask/90 uppercase">
                    {rule.desc}
                  </p>
                </div>
              </div>
            );
          })}
        </div>

        {/* Platform Risk Warnings */}
        <div className="mt-8 bg-trench-black border-2 border-dashed border-jeet-red p-5 rounded-lg relative overflow-hidden flex flex-col md:flex-row gap-4 items-center shadow-inner">
          <div className="absolute top-0 right-0 p-2 opacity-5">
            <ShieldAlert size={96} className="text-jeet-red" />
          </div>
          <div className="p-3 bg-jeet-red/10 border border-jeet-red/35 rounded text-jeet-red shrink-0 animate-pulse">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h4 className="font-staatliches text-xl text-jeet-red tracking-wide uppercase leading-none mb-1.5">
              ⚠️ EXTREME VOLATILITY WARNING & COMPLIANCE
            </h4>
            <p className="font-mono text-[9px] text-trench-gasmask uppercase leading-tight font-bold">
              ShitMarket prediction trenches operate under extreme high-risk P2P conditions. Maximum leverage is in effect. Wagers cannot be rescinded or un-signed once locked in on-chain. Deploy only Ammo SOL you are prepared to lose. HQ accepts no liability for rekt accounts.
            </p>
          </div>
        </div>

        {/* Contact info column */}
        <div className="mt-8 border-t-2 border-trench-sandbag pt-6 text-center">
          <span className="font-staatliches text-lg text-white tracking-wider block uppercase mb-1">
            HQ MESS & RADIO FREQUENCY
          </span>
          <p className="font-mono text-xs text-trench-gasmask font-bold uppercase">
            COURIER TRANSMISSIONS DIRECTED TO: <a href="mailto:contact@shitmarket.lol" className="text-neon-moon hover:text-white underline transition-colors">contact@shitmarket.lol</a>
          </p>
        </div>

      </div>

      {/* Degen Quote Banner at bottom */}
      <div className="mt-8">
        <DegenQuoteBanner />
      </div>

    </div>
  );
}
