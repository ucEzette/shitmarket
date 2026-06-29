'use client';

import React from 'react';
import Link from 'next/link';
import { PixelBarbedWire } from './PixelArt';
import { ShieldAlert, MessageSquareCode, HelpCircle } from 'lucide-react';

export const Footer: React.FC = () => {
  return (
    <footer className="relative mt-auto w-full bg-trench-black border-t-4 border-trench-sandbag pb-6 pt-4">
      {/* Barbed Wire Divider */}
      <div className="absolute -top-[10px] left-0 right-0 w-full overflow-hidden z-10 pointer-events-none">
        <PixelBarbedWire height={16} />
      </div>

      <div className="mx-auto max-w-full px-4 md:px-8 pt-2 flex flex-col lg:flex-row items-center justify-between gap-4">
        {/* Info Column */}
        <div className="flex flex-col items-center lg:items-start text-center lg:text-left gap-1">
          <div className="flex items-center gap-1">
            <img
              src="/pepes/logo-main.png"
              alt="ShitMarket"
              className="h-[22px] w-auto object-contain"
            />
            <span className="font-staatliches text-base tracking-wider font-extrabold flex items-center select-none ml-1">
              <span className="text-white">SHIT</span>
              <span className="text-[#39ff14]">MARKET</span>
              <span className="text-[#ff073a]">.</span>
            </span>
            <span className="font-staatliches text-base text-neon-moon tracking-wider ml-1">
              • COMBAT HQ
            </span>
          </div>
          <p className="font-mono text-[10px] text-trench-gasmask">
            NO RUGS. JUST BETS. PURE DEGEN DEFI WARFARE.
          </p>
        </div>

        {/* Dynamic Status Badges / Settlement Engine */}
        <div className="flex items-center gap-2 bg-trench-mud border border-trench-sandbag/60 rounded px-3 py-1 shadow-md">
          <div className="w-1.5 h-1.5 rounded-full bg-jeet-red animate-pulse" />
          <span className="font-mono text-[9px] text-trench-gasmask font-bold uppercase">SETTLEMENT ENGINE:</span>
          <span className="font-staatliches text-sm text-jeet-red tracking-wider">SECURE PvP</span>
        </div>

        {/* Warning Banner */}
        <div className="flex items-center gap-1.5 bg-trench-mud/40 border border-trench-sandbag/30 rounded px-2.5 py-1 max-w-xs sm:max-w-md">
          <ShieldAlert size={10} className="text-jeet-red animate-pulse shrink-0" />
          <span className="font-mono text-[9px] text-jeet-red/90 font-bold uppercase tracking-wider text-center lg:text-left">
            Warning: 100% Leverage, zero seatbelts. Stake at your own peril.
          </span>
        </div>

        {/* Social / Recruit Links */}
        <div className="flex items-center gap-3">
          <span className="font-mono text-[9px] text-trench-gasmask font-bold tracking-wider uppercase hidden xl:inline">
            RECRUIT CHANNELS:
          </span>
          <div className="flex items-center gap-2">
            {/* Mobile App Coming Soon Status */}
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-trench-mud border border-trench-sandbag/60 rounded font-mono text-[9.5px] font-bold text-trench-gasmask shadow-inner select-none">
              <span>MOBILE CLIENT:</span>
              <span className="text-neon-moon flex items-center gap-1">
                COMING SOON
                <span className="w-1.5 h-1.5 rounded-full bg-neon-moon animate-pulse" />
              </span>
            </div>

            <a
              href="https://x.com/shitmarketlol"
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1.5 px-2.5 py-1 bg-trench-mud border border-trench-sandbag hover:border-neon-moon text-trench-gasmask hover:text-neon-moon transition-all rounded font-mono text-[9.5px] font-bold"
              title="X (Twitter)"
            >
              <svg className="w-3 h-3 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
              <span>@shitmarketlol</span>
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noreferrer"
              className="p-1.5 bg-trench-mud border border-trench-sandbag hover:border-neon-moon text-trench-gasmask hover:text-neon-moon transition-all rounded shadow-inner"
              title="Discord Bunker Chat"
            >
              <MessageSquareCode size={13} />
            </a>
            <Link
              href="/rules"
              className="p-1.5 bg-trench-mud border border-trench-sandbag hover:border-neon-moon text-trench-gasmask hover:text-neon-moon transition-all rounded shadow-inner"
              title="War Manual"
            >
              <HelpCircle size={13} />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-full px-4 md:px-8 mt-4 text-center border-t border-trench-sandbag/20 pt-3">
        <p className="font-mono text-[9px] text-neon-moon uppercase tracking-wider font-bold mb-1">
          HQ RADIO COURIER: <a href="mailto:contact@shitmarket.lol" className="underline hover:text-white transition-colors">contact@shitmarket.lol</a>
        </p>
        <p className="font-mono text-[8px] text-trench-gasmask/50">
          © {new Date().getFullYear()} ShitMarket. Created by and for degenerate trench commanders. Built with no corporate support whatsoever.
        </p>
      </div>
    </footer>
  );
};
