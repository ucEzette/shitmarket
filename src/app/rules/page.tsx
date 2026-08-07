'use client';

import React, { useState, useEffect } from 'react';
import { 
  HelpCircle, 
  Swords, 
  Flame, 
  Coins, 
  ShieldCheck, 
  BookOpen, 
  ArrowLeft,
  ChevronRight,
  ShieldAlert,
  Users,
  Award,
  Hash
} from 'lucide-react';
import Link from 'next/link';

export default function RulesPage() {
  const [activeSection, setActiveSection] = useState<string>('trading');

  // Monitor scrolling to highlight Table of Contents active item
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['trading', 'creation', 'creator-fees', 'settlement', 'fees-gasless', 'referrals', 'risks'];
      const scrollPosition = window.scrollY + 150;

      for (const section of sections) {
        const el = document.getElementById(section);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (scrollPosition >= top && scrollPosition < top + height) {
            setActiveSection(section);
            break;
          }
        }
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleSmoothScroll = (e: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    e.preventDefault();
    const el = document.getElementById(id);
    if (el) {
      window.scrollTo({
        top: el.offsetTop - 80,
        behavior: 'smooth'
      });
      setActiveSection(id);
    }
  };

  const sections = [
    { id: 'trading', label: '1. How to Play (Trading)' },
    { id: 'creation', label: '2. Room Creation & Seeding' },
    { id: 'creator-fees', label: '3. LP Fees & Creator Yield' },
    { id: 'settlement', label: '4. TWAP & Settlement Resolution' },
    { id: 'fees-gasless', label: '5. Fees & Gasless Transactions' },
    { id: 'referrals', label: '6. Referrals & Trench Scores' },
    { id: 'risks', label: '7. Risks & Compliance Manual' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-200">
      
      {/* Top Header / Navigation */}
      <header className="sticky top-0 z-50 bg-white/95 border-b border-slate-200 px-6 py-4 flex flex-row justify-between items-center shadow-sm backdrop-blur-md">
        <div className="flex items-center gap-3">
          <Link href="/" className="flex items-center gap-1.5 hover:opacity-90">
            <img src="/pepes/logo-main.png" alt="ShitMarket Logo" className="h-8 w-auto" />
            <span className="font-sans text-xl tracking-wider font-extrabold text-slate-900">
              SHIT<span className="text-emerald-600">MARKET</span><span className="text-rose-600">.</span>
            </span>
          </Link>
          <span className="text-slate-300">|</span>
          <span className="font-mono text-xs text-slate-500 font-bold uppercase tracking-wider flex items-center gap-1">
            <HelpCircle size={13} className="text-emerald-600" /> Rules & Help Center
          </span>
        </div>

        <Link href="/" className="inline-flex items-center gap-1.5 text-slate-600 hover:text-slate-900 font-mono text-xs uppercase font-bold transition-colors border border-slate-200 px-3 py-1.5 rounded-lg bg-white shadow-sm">
          <ArrowLeft size={13} /> RETREAT TO BASE
        </Link>
      </header>

      {/* Main Grid Wrapper */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* Left Sticky Sidebar (TOC) */}
        <aside className="lg:col-span-3 hidden lg:block">
          <div className="sticky top-24 space-y-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="font-sans font-bold text-xs uppercase text-slate-400 tracking-wider mb-2 border-b border-slate-100 pb-2">
              Help Center Directory
            </div>
            <nav className="space-y-1 font-mono text-xs">
              {sections.map(section => {
                const isActive = activeSection === section.id;
                return (
                  <a
                    key={section.id}
                    href={`#${section.id}`}
                    onClick={(e) => handleSmoothScroll(e, section.id)}
                    className={`group flex items-center justify-between py-2 px-2.5 rounded-lg transition-all ${
                      isActive 
                        ? 'bg-emerald-50 text-emerald-700 font-extrabold border-l-2 border-emerald-500' 
                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                    }`}
                  >
                    <span>{section.label}</span>
                    <ChevronRight size={12} className={`opacity-0 group-hover:opacity-100 transition-opacity ${isActive ? 'text-emerald-600 opacity-100' : ''}`} />
                  </a>
                );
              })}
            </nav>
            
            <div className="pt-4 border-t border-slate-100 text-[10px] font-mono text-slate-400 leading-relaxed">
              <span className="block font-bold uppercase text-slate-500 mb-1">Need direct assistance?</span>
              <p>Email Command HQ at:</p>
              <a href="mailto:contact@shitmarket.lol" className="font-bold text-emerald-600 hover:underline">
                contact@shitmarket.lol
              </a>
            </div>
          </div>
        </aside>

        {/* Main Rules Content Panel */}
        <main className="lg:col-span-9 bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-sm space-y-16 leading-relaxed">
          
          {/* Rules Introduction */}
          <div className="border-b border-slate-200 pb-8 space-y-4">
            <h1 className="font-sans text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              Trench Operational Rules & Guide
            </h1>
            <p className="text-slate-500 font-mono text-xs md:text-sm uppercase tracking-wider">
              A comprehensive handbook explaining prediction mechanics, creator LP yield, TWAP resolution, and transaction structures.
            </p>
            <div className="pt-2">
              <p className="text-slate-600 font-mono text-xs italic leading-relaxed uppercase bg-slate-50 border border-slate-200 rounded-xl p-3">
                ⚠️ NOTICE TO DEGENS: ALL INTERACTIONS AND TRANSACTIONS ARE PERMANENT AND RECORDED ON-CHAIN. READ AND UNDERSTAND THE OPERATIONAL BLUEPRINT BEFORE DEPLOYING CAPITAL.
              </p>
            </div>
          </div>

          {/* Section 1: How to Play (Trading) */}
          <section id="trading" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 1.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Swords className="text-emerald-600" size={20} /> How to Play (Trading)
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              ShitMarket allows you to trade on the binary outcomes of volatile tokens, meme currencies, and social topics. Unlike traditional trading where you own the underlying asset, you are speculating on whether the asset's price will end above a target threshold at a specific time.
            </p>
            <p className="text-slate-600 text-sm md:text-base">
              Traders choose their side:
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-mono text-xs text-slate-700 py-2">
              <div className="border border-emerald-500/20 bg-emerald-500/5 rounded-xl p-4 space-y-1">
                <span className="text-emerald-600 font-bold uppercase text-sm block">🚀 MOON (BULL / YES)</span>
                <p className="text-slate-500">
                  Select MOON if you speculate that the token's final TWAP price will end **ABOVE or EQUAL** to the room's opening/target threshold.
                </p>
              </div>
              <div className="border border-rose-500/20 bg-rose-500/5 rounded-xl p-4 space-y-1">
                <span className="text-rose-600 font-bold uppercase text-sm block">💀 JEET (BEAR / NO)</span>
                <p className="text-slate-500">
                  Select JEET if you speculate that the token's final TWAP price will end **STRICTLY BELOW** the room's opening/target threshold.
                </p>
              </div>
            </div>
            <p className="text-slate-600 text-sm md:text-base">
              **Continuous AMM Swapping & Early Exits:** You buy outcome shares (Moon or Jeet tokens) directly from the room's Constant Product pool. Share prices scale between **$0.01 and $0.99 USDC** based on the pool ratio. You do **not** have to hold until the timer expires; you can swap your shares back to the AMM pool at any time to take profit or cut losses.
            </p>
          </section>

          {/* Section 2: Room Creation & Seeding */}
          <section id="creation" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 2.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Flame className="text-emerald-600" size={20} /> Room Creation & Seeding
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              ShitMarket operates under a fully decentralized, permissionless architecture. Anyone can deploy a new prediction room ("sector") for any asset in seconds.
            </p>
            <div className="space-y-3 font-mono text-xs text-slate-700 bg-slate-50 border border-slate-200 rounded-xl p-4">
              <div className="flex gap-2 items-start">
                <span className="text-emerald-600 font-bold select-none">1.</span>
                <p><strong className="text-slate-900">Scan & Contract Paste:</strong> Paste any active ERC-20 or meme coin token contract address (e.g. from DexScreener) to fetch real-time metadata.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-emerald-600 font-bold select-none">2.</span>
                <p><strong className="text-slate-900">Define Parameters:</strong> Set the target price threshold, set custom resolve durations (5m, 15m, 1h, up to 1 year), and designate resolving oracles.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="text-emerald-600 font-bold select-none">3.</span>
                <p><strong className="text-slate-900">Initial Seeding Requirement:</strong> To prevent spam rooms and initialize the Constant Product AMM curve, the creator must seed the room with initial USDC liquidity. This creates the starting 50/50 probability ($0.50 starting share price).</p>
              </div>
            </div>
          </section>

          {/* Section 3: Creator Yield */}
          <section id="creator-fees" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 3.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Coins className="text-emerald-600" size={20} /> LP Fees & Creator Yield
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              When you create a room and seed it with initial USDC collateral, you act as the primary **Liquidity Provider (LP)**. ShitMarket rewards room creators for facilitating liquidity:
            </p>
            <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-4 font-mono text-xs text-slate-700">
              <div className="flex gap-2.5 items-start">
                <span className="p-1 bg-emerald-50 text-emerald-600 rounded">✓</span>
                <p><strong className="text-slate-900">Swap Fee Collection:</strong> You keep a **0.30% to 1.00% swap fee** on *every single buy and sell transaction* routed through your room's pools.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="p-1 bg-emerald-50 text-emerald-600 rounded">✓</span>
                <p><strong className="text-slate-900">Community Marketing Incentive:</strong> Because room creators profit directly from volume, they are incentivized to promote their room's URL to their community (Telegram, Twitter, Discord), generating a compounding feedback loop of volume and LP fees.</p>
              </div>
              <div className="flex gap-2.5 items-start">
                <span className="p-1 bg-emerald-50 text-emerald-600 rounded">✓</span>
                <p><strong className="text-slate-900">Yield Accrual:</strong> Fees accumulate in real-time in the room's liquidity vault and are paid directly to your wallet upon pool termination or LP liquidity withdrawal.</p>
              </div>
            </div>
          </section>

          {/* Section 4: TWAP & Settlement */}
          <section id="settlement" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 4.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <ShieldCheck className="text-emerald-600" size={20} /> TWAP & Settlement Resolution
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              ShitMarket secures settlements through an aggregated oracle pricing loop, eliminating central admin bias:
            </p>
            <div className="space-y-4 pt-2 font-mono text-xs text-slate-600">
              <div className="flex gap-3 items-start">
                <span className="font-bold text-emerald-600">A.</span>
                <p><strong className="text-slate-900">Aggregated Feeds:</strong> The pricing engine samples spot prices from Pyth, Chainlink, DexScreener, and Birdeye. A 20% outlier filter shield automatically filters abnormal pricing spikes or flash loans.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="font-bold text-emerald-600">B.</span>
                <p><strong className="text-slate-900">TWAP Calculations:</strong> Once the countdown expires, the room is locked. Settlement price is calculated as a Time-Weighted Average Price (TWAP) across the final minutes of the room, preventing price-manipulation attacks.</p>
              </div>
              <div className="flex gap-3 items-start">
                <span className="font-bold text-emerald-600">C.</span>
                <p><strong className="text-slate-900">Challenge Window:</strong> Once the oracle resolutions are posted, a 30-minute public challenge window opens. Anyone can deposit a dispute bond to challenge resolutions, routing arbitrations to UMA's decentralized oracle voters.</p>
              </div>
            </div>
          </section>

          {/* Section 5: Fees & Gasless */}
          <section id="fees-gasless" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 5.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <BookOpen className="text-emerald-600" size={20} /> Fees & Gasless Transactions
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              The protocol enforces an efficient transaction cost model using Account Abstraction (ERC-4337):
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 font-mono text-xs text-slate-700">
              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-1">
                <span className="font-bold text-slate-950 block">EVM Platform Fees</span>
                <p className="text-slate-500">
                  A flat **1.25% fee** is deducted from the total losing pool stakes upon final claim execution. Platform fees support indexer keepers, arbitration contracts, and paymaster gas pools.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 bg-slate-50 space-y-1">
                <span className="font-bold text-slate-950 block">Gasless Sponsoring</span>
                <p className="text-slate-500">
                  All trade signatures are sponsored by platform paymasters. Users sign transactions locally without spending native EVM gas tokens (AVAX/SOL), delivering a seamless Web2-to-Web3 experience.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: Referrals */}
          <section id="referrals" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 6.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <Users className="text-emerald-600" size={20} /> Referrals & Leaderboard Ranks
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              ShitMarket incorporates an on-chain affiliate framework:
            </p>
            <div className="space-y-3 font-mono text-xs text-slate-700">
              <div className="flex gap-2 items-start">
                <span className="p-1 bg-emerald-50 text-emerald-600 rounded">✓</span>
                <p><strong className="text-slate-900">On-Chain Commission:</strong> Invitees generate customized link codes. You automatically earn a percentage of all wagers placed by your referred players, paid directly in real-time.</p>
              </div>
              <div className="flex gap-2 items-start">
                <span className="p-1 bg-emerald-50 text-emerald-600 rounded">✓</span>
                <p><strong className="text-slate-900">Trench Scores (ELO):</strong> Winning wagers increases your ELO points. Climb the global leaderboard rankings from D-tier to the coveted S-tier to gain cosmestic badges and boosts.</p>
              </div>
            </div>
          </section>

          {/* Section 7: Risks */}
          <section id="risks" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-rose-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 7.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2 flex items-center gap-2">
              <ShieldAlert className="text-rose-600" size={20} /> Risks & Compliance Manual
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              Prediction markets carry structural risks. By participating in the ShitMarket protocol, you acknowledge and agree to the following operational parameters:
            </p>
            <div className="bg-rose-50 border border-rose-200 rounded-2xl p-6 space-y-4 font-mono text-[11px] text-rose-950 leading-relaxed">
              <div className="flex gap-3 items-start">
                <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <p><strong className="text-slate-900 uppercase">A. Capital at Risk:</strong> Wagers are locked on-chain and cannot be rescinded once confirmed. Highly leveraged prediction curves mean you can lose 100% of your staked USDC collateral.</p>
              </div>
              <div className="flex gap-3 items-start">
                <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <p><strong className="text-slate-900 uppercase">B. Price Volatility & Oracle Lag:</strong> Micro-cap tokens and meme pools are subject to extreme manipulation, low-liquidity spikes, and network latency. Oracle TWAP queries are calculated in good faith but may suffer delays.</p>
              </div>
              <div className="flex gap-3 items-start">
                <ShieldAlert size={16} className="text-rose-600 shrink-0 mt-0.5" />
                <p><strong className="text-slate-900 uppercase">C. Geographic Exclusions:</strong> ShitMarket is not registered as a betting service. Users are subject to geographical IP blocks (including United States residents). Participation is prohibited where banned by local compliance laws.</p>
              </div>
            </div>
          </section>

          {/* Footer Info */}
          <div className="pt-10 border-t border-slate-200 text-center font-mono text-[10px] text-slate-400 space-y-2">
            <p>
              This manual governs all combat prediction rooms deployed on Fuji and Mainnet controller contracts.
            </p>
            <p>
              © {new Date().getFullYear()} ShitMarket. All rights reserved.
            </p>
          </div>

        </main>
      </div>

      {/* Simplified Light Page Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-center font-mono text-[10px] text-slate-500 flex flex-col sm:flex-row justify-between items-center px-8 gap-2">
        <span>© {new Date().getFullYear()} ShitMarket. Strictly for permissionless speculation.</span>
        <div className="flex gap-4">
          <Link href="/rules" className="hover:text-slate-800 underline">
            Rules & War Manual
          </Link>
          <a href="mailto:contact@shitmarket.lol" className="hover:text-slate-800 underline">
            Contact Command HQ
          </a>
        </div>
      </footer>

    </div>
  );
}
