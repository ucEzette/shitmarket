'use client';

import React, { useState, useEffect } from 'react';
import { 
  BookOpen, 
  HelpCircle, 
  Settings, 
  ShieldCheck, 
  Users, 
  Calculator, 
  Compass, 
  TrendingUp, 
  ChevronRight,
  TrendingDown,
  Coins,
  ShieldAlert,
  ArrowRight,
  CheckCircle,
  Hash,
  Activity,
  Award
} from 'lucide-react';
import Link from 'next/link';

export default function PresentationPage() {
  const [calcVolume, setCalcVolume] = useState<number>(50000);
  const [calcFeeRate, setCalcFeeRate] = useState<number>(1.0);
  const [activeSection, setActiveSection] = useState<string>('intro');

  // Monitor scrolling to highlight Table of Contents
  useEffect(() => {
    const handleScroll = () => {
      const sections = ['intro', 'problems', 'solution', 'creator-yield', 'mechanics', 'referrals', 'roadmap'];
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
    { id: 'intro', label: '1. Executive Summary & Core Thesis' },
    { id: 'problems', label: '2. The Traditional Bottlenecks' },
    { id: 'solution', label: '3. The ShitMarket Protocol' },
    { id: 'creator-yield', label: '4. Creator Yield & Swap Fees' },
    { id: 'mechanics', label: '5. AMM & Settlement Mechanics' },
    { id: 'referrals', label: '6. Referral Flywheels & Progression' },
    { id: 'roadmap', label: '7. Development Roadmap' }
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 selection:bg-emerald-100 selection:text-emerald-900 transition-colors duration-200">
      
      {/* Top Banner / Breadcrumb Header */}
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
            <BookOpen size={13} className="text-emerald-600" /> Protocol Whitepaper & Technical Specification
          </span>
        </div>

        <Link href="/rooms" className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-mono text-xs font-bold hover:bg-emerald-500 transition-all flex items-center gap-1 shadow-sm">
          ENTER ARENA <ArrowRight size={12} />
        </Link>
      </header>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 md:px-8 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8 relative">
        
        {/* Left Sticky Sidebar (Table of Contents) */}
        <aside className="lg:col-span-3 hidden lg:block">
          <div className="sticky top-24 space-y-4 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
            <div className="font-sans font-bold text-xs uppercase text-slate-400 tracking-wider mb-2 border-b border-slate-100 pb-2">
              Table of Contents
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
            
            <div className="pt-4 border-t border-slate-100 text-[10px] font-mono text-slate-400 leading-normal">
              <span className="block font-bold uppercase text-slate-500 mb-1">Contract Deployment:</span>
              <span className="font-bold text-emerald-600">Avalanche Fuji Testnet</span>
              <span className="block mt-1 truncate">0x554Ed...02C26</span>
            </div>
          </div>
        </aside>

        {/* Main Document Body */}
        <main className="lg:col-span-9 bg-white border border-slate-200 rounded-3xl p-6 md:p-10 shadow-sm space-y-16 leading-relaxed">
          
          {/* Document Cover Header */}
          <div className="border-b border-slate-200 pb-8 space-y-4">
            <h1 className="font-sans text-3xl md:text-5xl font-black tracking-tight text-slate-900 leading-tight">
              ShitMarket Core Protocol Specification
            </h1>
            <p className="text-slate-500 font-mono text-xs md:text-sm uppercase tracking-wider">
              A Permissionless, Two-Sided CPMM Prediction Protocol & Creator Swap Fee Yield Framework
            </p>
            <div className="flex flex-wrap gap-4 pt-2 font-mono text-[10px] text-slate-400">
              <span>**Version:** 1.0.0-fuji</span>
              <span>•</span>
              <span>**Status:** Sandbox Validation</span>
              <span>•</span>
              <span>**Audience:** Trench Speculators & Community Organizers</span>
            </div>
          </div>

          {/* Section 1: Executive Summary */}
          <section id="intro" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 1.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2">
              Executive Summary & Core Thesis
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              Prediction markets represent one of the most powerful decentralized mechanisms for aggregating information and computing probabilities. By pricing outcomes through financial incentives, they cut through media bias and public noise to surface collective intelligence. 
            </p>
            <p className="text-slate-600 text-sm md:text-base">
              However, first-generation prediction protocols suffer from curation gates, capital extraction, and liquidity bottlenecks. **ShitMarket** is built to decentralize the space entirely. Deployed on high-performance EVM networks (specifically the Avalanche C-Chain), ShitMarket is a chain-agnostic prediction platform built for high-speed speculation on trending meme coins, micro-cap tokens, cultural arguments, and trending internet topics.
            </p>
            <p className="text-slate-600 text-sm md:text-base">
              At its core, ShitMarket introduces **Permissionless Prediction Sectors** matched with a **Two-Sided Constant Product AMM**. Instead of relying on central gatekeepers to list markets or wait for counterparty order books, any user can deploy a prediction market, seed liquidity, and operate as the primary liquidity provider, capturing trading swap fees in real-time.
            </p>
          </section>

          {/* Section 2: The Core Problems */}
          <section id="problems" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-rose-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 2.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2">
              The Traditional Bottlenecks
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              To understand the necessity of ShitMarket, we must evaluate the four structural design failures of traditional, centralized prediction market platforms:
            </p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-2">
                <span className="text-rose-600 font-bold text-sm block">1. Centralized Curation Gatekeepers</span>
                <p className="text-slate-500 font-mono text-[11px] leading-relaxed">
                  Platforms like Polymarket choose which markets to deploy. Micro-cap coins, trending community debates, local sports, or sudden internet arguments are filtered out, denying users local wagering options.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-2">
                <span className="text-rose-600 font-bold text-sm block">2. Value Extraction & Fee Leakage</span>
                <p className="text-slate-500 font-mono text-[11px] leading-relaxed">
                  Influencers, community builders, and content creators do 100% of the promotion to drive users to prediction rooms. Yet, they capture 0% of trading fees, which leak entirely to the protocol operators.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-2">
                <span className="text-rose-600 font-bold text-sm block">3. Capital Inefficiency & Empty Order Books</span>
                <p className="text-slate-500 font-mono text-[11px] leading-relaxed">
                  Traditional order-book matching is highly illiquid for niche topics. Spreads are wide, orders remain unmatched, and traders are forced to hold until expiration, rendering early exit hedging impossible.
                </p>
              </div>

              <div className="border border-slate-200 rounded-2xl p-5 bg-slate-50 space-y-2">
                <span className="text-rose-600 font-bold text-sm block">4. Resolution Arbitrage & Centralization Risk</span>
                <p className="text-slate-500 font-mono text-[11px] leading-relaxed">
                  Settlements are resolved by a single administrative key or private keeper scripts, leading to conflicts of interest, delays, and potential platform exit-rugs of active user stakes.
                </p>
              </div>
            </div>
          </section>

          {/* Section 3: The ShitMarket Solution */}
          <section id="solution" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 3.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2">
              The ShitMarket Protocol
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              ShitMarket addresses these problems by combining advanced decentralized wallet onboarding, on-chain automated market makers, and permissionless pool deployment:
            </p>

            <div className="space-y-4 pt-2">
              <div className="flex gap-4 items-start">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                  <Compass size={18} />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-slate-900 text-sm">100% Permissionless Market Creation</h4>
                  <p className="font-mono text-xs text-slate-500 mt-1">
                    No approval flow, no curation gates. Any user can deploy a prediction pool for any contract address, asset price, or cultural event. Setting up target prices, time-frames, and resolving criteria is done on-chain instantly.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                  <Coins size={18} />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-slate-900 text-sm">Continuous CPMM AMM Liquidity</h4>
                  <p className="font-mono text-xs text-slate-500 mt-1">
                    Powered by a Constant Product formula, ShitMarket outcome pools provide immediate, continuous liquidity. Traders can enter, exit, or take profits at any time prior to room expiry, without waiting for counterparties.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                  <Users size={18} />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-slate-900 text-sm">Gasless, Social-First UX</h4>
                  <p className="font-mono text-xs text-slate-500 mt-1">
                    Onboards Web2 and Web3 users seamlessly via social logins (Google, X, Email) powered by Privy. Relayers sponsor gas fees via Account Abstraction Paymasters, allowing users to sign trades without owning native gas tokens.
                  </p>
                </div>
              </div>

              <div className="flex gap-4 items-start">
                <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg shrink-0">
                  <TrendingUp size={18} />
                </div>
                <div>
                  <h4 className="font-sans font-bold text-slate-900 text-sm">Multi-Chain Universal Deposits</h4>
                  <p className="font-mono text-xs text-slate-500 mt-1">
                    Integrated Circle Cross-Chain Transfer Protocol (CCTP) and Relay intents allow players to deposit funds directly from Ethereum, Base, Arbitrum, or Solana, converting automatically into Avalanche Fuji USDC in one click.
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Section 4: Creator Economics */}
          <section id="creator-yield" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 4.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2">
              Creator Yield & Swap Fees
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              Traditional prediction markets struggle with the "cold-start" problem—launching a market does not guarantee anyone will trade in it. ShitMarket solves this by aligning community growth with creator incentives. By seeding liquidity, creators receive continuous passive income.
            </p>
            
            <div className="border border-slate-200 rounded-2xl p-5 space-y-3 font-mono text-xs text-slate-700 bg-slate-50">
              <div className="flex gap-2 items-start">
                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p><strong className="text-slate-900">Direct Swap Fees:</strong> Keep **0.30% to 1.00%** of all trading volume routed through your room's outcome pools.</p>
              </div>
              <div className="flex gap-2 items-start">
                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p><strong className="text-slate-900">Zero Cold Start:</strong> Creators actively market their prediction rooms to their own community (Telegram, Discord, Twitter) to drive volume and capture fees.</p>
              </div>
              <div className="flex gap-2 items-start">
                <CheckCircle size={14} className="text-emerald-600 shrink-0 mt-0.5" />
                <p><strong className="text-slate-900">Dual-Sided Yield:</strong> Profit from both buy trades and sell trades as degens speculate on outcome ratios.</p>
              </div>
            </div>

            <p className="text-slate-600 text-sm md:text-base pt-2">
              Unlike traditional setups where the platform eats the volume spread, ShitMarket room creators act as the liquidity providers. You deploy the capital, you set the fee rate, you promote the room, and you harvest the yield. Below is an interactive projection tool to calculate potential creator earnings:
            </p>

            {/* Light Mode Yield Calculator Card */}
            <div className="border border-slate-200 rounded-2xl p-6 bg-slate-50 shadow-sm max-w-2xl mx-auto space-y-4 font-mono text-xs text-slate-700">
              <div className="flex justify-between items-center border-b border-slate-200 pb-2">
                <span className="font-sans font-bold text-slate-900 text-sm flex items-center gap-1.5"><Calculator size={15} className="text-emerald-600" /> Creator Yield Projection Tool</span>
                <span className="text-[10px] text-slate-400">INPUT METRICS</span>
              </div>

              <div className="space-y-4 py-2">
                <div>
                  <div className="flex justify-between text-[11px] mb-1">
                    <span className="text-slate-500 font-bold">Estimated Daily Volume:</span>
                    <span className="text-slate-900 font-bold">${calcVolume.toLocaleString()} USDC</span>
                  </div>
                  <input 
                    type="range" 
                    min="5000" 
                    max="1000000" 
                    step="5000"
                    value={calcVolume} 
                    onChange={(e) => setCalcVolume(parseInt(e.target.value))}
                    className="w-full h-1.5 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-emerald-600" 
                  />
                </div>

                <div className="flex justify-between items-center text-[11px]">
                  <span className="text-slate-500 font-bold">Creator LP Swap Fee Rate:</span>
                  <div className="flex gap-2">
                    {[0.3, 0.5, 1.0].map((rate) => (
                      <button 
                        key={rate} 
                        onClick={() => setCalcFeeRate(rate)}
                        className={`px-3 py-1 text-[10px] font-bold rounded-lg border transition-all ${
                          calcFeeRate === rate 
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm' 
                            : 'border-slate-300 bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                      >
                        {rate}%
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div className="bg-white border border-slate-200 rounded-xl p-4 text-center space-y-1">
                <span className="text-[10px] text-slate-400 block uppercase tracking-wider">PROJECTED LP REVENUE ACCRUAL:</span>
                <span className="text-3xl font-sans font-black text-emerald-600 tracking-tight block">
                  ${((calcVolume * calcFeeRate) / 100).toFixed(2)} USDC <span className="text-xs font-mono font-normal text-slate-500">/ Day</span>
                </span>
                <span className="text-[10px] text-slate-500 block font-bold pt-1 border-t border-slate-100">
                  Approx. ${(((calcVolume * calcFeeRate) / 100) * 30).toLocaleString(undefined, {maximumFractionDigits: 0})} USDC / Month in passive yield
                </span>
              </div>
            </div>
          </section>

          {/* Section 5: Technical Mechanics */}
          <section id="mechanics" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 5.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2">
              AMM & Settlement Mechanics
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              The ShitMarket Core protocol manages outcome pool pricing, share backing, and dispute resolutions directly inside decentralized Solidity smart contracts. The mechanical flow is structured as follows:
            </p>

            <div className="space-y-6 pt-2 font-mono text-xs text-slate-700">
              <div className="border-l-4 border-emerald-500 pl-4 space-y-1.5">
                <h4 className="font-sans font-bold text-slate-900 text-sm uppercase">1:1 Backed ERC-1155 Positions</h4>
                <p className="leading-relaxed text-slate-500">
                  Wagered collateral is escrowed inside the main core smart contract. When 1 USDC is deposited as liquidity or bet collateral, the contract mints **1 MOON (YES outcome)** share and **1 JEET (NO outcome)** share. Every outstanding share is 100% collateralized, guaranteeing that the vault remains solvent under all market conditions.
                </p>
              </div>

              <div className="border-l-4 border-emerald-500 pl-4 space-y-1.5">
                <h4 className="font-sans font-bold text-slate-900 text-sm uppercase">Constant Product Outcome Pricing</h4>
                <p className="leading-relaxed text-slate-500">
                  Traditional order-matching models are replaced by a continuous AMM formula:
                  <span className="block my-2 text-center text-slate-900 font-bold text-sm bg-slate-50 py-2 border border-slate-200 rounded-lg">x * y = k</span>
                  Where **x** is the reserves of MOON shares, **y** is the reserves of JEET shares, and **k** is the invariant. This model calculates outcome probability prices scaled between **$0.01 and $0.99 USDC** dynamically based on trade volume ratios:
                  <span className="block my-2 text-center text-slate-900 font-bold text-sm bg-slate-50 py-2 border border-slate-200 rounded-lg">P_moon = Reserves_USDC / Reserves_MOON</span>
                  Traders are free to buy or sell shares back to the AMM pool at any point, allowing dynamic exits to secure gains.
                </p>
              </div>

              <div className="border-l-4 border-emerald-500 pl-4 space-y-1.5">
                <h4 className="font-sans font-bold text-slate-900 text-sm uppercase">Aggregated TWAP Settlement</h4>
                <p className="leading-relaxed text-slate-500">
                  To eliminate oracle single-point-of-failure risks, the settlement prices are synced via keepers that query and aggregate data across **Pyth Network, Chainlink, DexScreener, and Birdeye**. A 20% outlier protection shield is active, discarding flash loan spikes.
                </p>
              </div>

              <div className="border-l-4 border-emerald-500 pl-4 space-y-1.5">
                <h4 className="font-sans font-bold text-slate-900 text-sm uppercase">Resolution Challenge Windows & dispute slasher</h4>
                <p className="leading-relaxed text-slate-500">
                  Once a market resolves, a 30-minute public dispute window opens. Anyone can challenge the keeper's resolution by posting a **Dispute Bond** (in USDC). If the challenge is validated, the original resolving entity's fees are slashed and distributed to the challenger. Disputes are escalated to UMA's decentralized Data Verification Mechanism (DVM) for ultimate vote arbitration, resolving rugs.
                </p>
              </div>
            </div>
          </section>

          {/* Section 6: Referral Flywheels */}
          <section id="referrals" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 6.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2">
              Referral Flywheels & Progression
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              The protocol encodes growth incentives directly on-chain through a permissionless affiliate fee model, creating a viral loop:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2 font-mono text-xs text-slate-700">
              <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                <span className="font-sans font-bold text-slate-900 flex items-center gap-1.5"><Users size={14} className="text-emerald-600" /> On-Chain Referral Affiliate System</span>
                <p className="text-slate-500 leading-normal">
                  Generate your custom referral code and share it with traders. Our smart contracts distribute a percentage of all wagers placed by your referred users directly to your wallet in real-time. No middlemen, no dashboard withdrawals.
                </p>
              </div>

              <div className="border border-slate-200 rounded-xl p-4 space-y-2">
                <span className="font-sans font-bold text-slate-900 flex items-center gap-1.5"><Award size={14} className="text-emerald-600" /> Trench Scores & Leaderboards</span>
                <p className="text-slate-500 leading-normal">
                  Wagers and accurate predictions feed ELO points into your profile. Build accuracy streaks to increase your rank from D-tier to the coveted S-tier to unlock cosmic badges and boosts.
                </p>
              </div>
            </div>
          </section>

          {/* Section 7: Roadmap */}
          <section id="roadmap" className="space-y-4 scroll-mt-24">
            <div className="flex items-center gap-2 font-mono text-xs text-emerald-600 font-bold uppercase tracking-widest">
              <Hash size={14} /> Section 7.0
            </div>
            <h2 className="font-sans text-2xl md:text-3xl font-bold text-slate-900 border-b border-slate-100 pb-2">
              Development Roadmap
            </h2>
            <p className="text-slate-600 text-sm md:text-base">
              The roll-out schedule of ShitMarket is segmented into four sequential phases, ensuring contract audits, liquidity scaling, and cross-chain functionality are complete prior to mainnet launch:
            </p>

            <div className="relative border-l border-slate-200 ml-4 pl-6 space-y-8 py-2 font-mono text-xs text-slate-600">
              <div className="relative">
                <span className="absolute -left-[31px] top-0.5 bg-emerald-500 border-4 border-white w-4.5 h-4.5 rounded-full" />
                <h4 className="font-sans font-bold text-slate-900 text-sm uppercase">Phase 1: Fuji Testnet Sandbox (Active)</h4>
                <p className="text-slate-500 mt-1 leading-normal">
                  EVM Hardhat compiler testing, indexing keeper synchronization, and Privy smart account Paymaster gas sponsoring loops.
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[31px] top-0.5 bg-slate-300 border-4 border-white w-4.5 h-4.5 rounded-full" />
                <h4 className="font-sans font-bold text-slate-900 text-sm uppercase">Phase 2: Dispute Escrows & Oracle Slasher</h4>
                <p className="text-slate-500 mt-1 leading-normal">
                  Integration of UMA optimistic oracle contracts on Fuji C-Chain, implementing on-chain dispute bond staking and resolving slasher logic.
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[31px] top-0.5 bg-slate-300 border-4 border-white w-4.5 h-4.5 rounded-full" />
                <h4 className="font-sans font-bold text-slate-900 text-sm uppercase">Phase 3: Multi-Chain Deposit intents</h4>
                <p className="text-slate-500 mt-1 leading-normal">
                  Circle CCTP bridging contracts and Relay protocol API integration to allow direct Base and Mainnet USDC deposits without leaving the interface.
                </p>
              </div>

              <div className="relative">
                <span className="absolute -left-[31px] top-0.5 bg-slate-300 border-4 border-white w-4.5 h-4.5 rounded-full" />
                <h4 className="font-sans font-bold text-slate-900 text-sm uppercase">Phase 4: Mainnet Deployment & TGE</h4>
                <p className="text-slate-500 mt-1 leading-normal">
                  Audits completion by security groups, contract locks setup, deployment of main core controller on Avalanche C-Chain mainnet.
                </p>
              </div>
            </div>
          </section>

          {/* Footer Info */}
          <div className="pt-10 border-t border-slate-200 text-center font-mono text-[10px] text-slate-400 space-y-2">
            <p>
              This documentation acts as a live, decentralized specification sheet for ShitMarket Protocol.
            </p>
            <p>
              © {new Date().getFullYear()} ShitMarket. Created for degenerate commanders. All rights reserved.
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
