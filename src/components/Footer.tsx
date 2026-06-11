'use client';

import React from 'react';
import Link from 'next/link';
import { useAppState } from '@/store/useAppState';
import { PixelBarbedWire } from './PixelArt';
import { ShieldAlert, MessageSquareCode, Flame, HelpCircle } from 'lucide-react';

export const Footer: React.FC = () => {
  const { rooms } = useAppState();
  const activeRooms = rooms.filter(r => r.status === 'active').length;

  return (
    <footer className="relative mt-auto w-full bg-trench-black border-t-4 border-trench-sandbag pb-8 pt-4">
      {/* Barbed Wire Divider */}
      <div className="absolute -top-[10px] left-0 right-0 w-full overflow-hidden z-10 pointer-events-none">
        <PixelBarbedWire height={16} />
      </div>

      <div className="mx-auto max-w-full px-4 md:px-8 pt-4 flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Info Column */}
        <div className="flex flex-col items-center md:items-start text-center md:text-left gap-2">
          <div className="flex items-center gap-2">
            <img
              src="/pepes/screen (1).png"
              alt="ShitMarket"
              className="h-[28px] w-auto object-contain"
            />
            <span className="font-staatliches text-lg text-neon-moon tracking-wider">
              • COMBAT HQ
            </span>
          </div>
          <p className="font-mono text-xs text-trench-gasmask">
            NO RUGS. JUST BETS. PURE DEGEN DEFI WARFARE.
          </p>
          <div className="flex items-center gap-1.5 mt-2 bg-trench-mud border border-trench-sandbag rounded px-2.5 py-1">
            <ShieldAlert size={12} className="text-jeet-red animate-pulse" />
            <span className="font-mono text-[10px] text-jeet-red font-bold uppercase tracking-wider">
              Warning: 100% Leverage, zero seatbelts. Stake at your own peril.
            </span>
          </div>
        </div>

        {/* Dynamic Status Badges */}
        <div className="flex flex-wrap justify-center gap-2">
          <div className="bg-trench-mud border border-trench-sandbag rounded px-3 py-1 text-center shadow-md">
            <p className="font-mono text-[9px] text-trench-gasmask font-bold">ACTIVE TRENCHES</p>
            <p className="font-staatliches text-xl text-neon-moon tracking-wide">{activeRooms} FIGHTING</p>
          </div>
          <div className="bg-trench-mud border border-trench-sandbag rounded px-3 py-1 text-center shadow-md">
            <p className="font-mono text-[9px] text-trench-gasmask font-bold">COMMISSION FEE</p>
            <p className="font-staatliches text-xl text-moon-gold tracking-wide">1.25% PER ROOM</p>
          </div>
          <div className="bg-trench-mud border border-trench-sandbag rounded px-3 py-1 text-center shadow-md">
            <p className="font-mono text-[9px] text-trench-gasmask font-bold">SETTLEMENT ENGINE</p>
            <p className="font-staatliches text-xl text-jeet-red tracking-wide">SECURE PvP</p>
          </div>
        </div>

        {/* Social / Trench Art Links */}
        <div className="flex flex-col items-center gap-2">
          <p className="font-mono text-[10px] text-trench-gasmask font-bold tracking-widest uppercase">
            Recruit Channel
          </p>
          <div className="flex gap-2">
            <a
              href="https://x.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-trench-mud border-2 border-trench-sandbag hover:border-neon-moon text-trench-gasmask hover:text-neon-moon transition-all rounded shadow-inner"
              title="X (Twitter) Frontlines"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24">
                <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
              </svg>
            </a>
            <a
              href="https://discord.com"
              target="_blank"
              rel="noreferrer"
              className="p-2 bg-trench-mud border-2 border-trench-sandbag hover:border-neon-moon text-trench-gasmask hover:text-neon-moon transition-all rounded shadow-inner"
              title="Discord Bunker Chat"
            >
              <MessageSquareCode size={16} />
            </a>
            <Link
              href="/rules"
              className="p-2 bg-trench-mud border-2 border-trench-sandbag hover:border-neon-moon text-trench-gasmask hover:text-neon-moon transition-all rounded shadow-inner"
              title="War Manual"
            >
              <HelpCircle size={16} />
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-full px-4 md:px-8 mt-6 text-center border-t border-trench-sandbag/40 pt-4">
        <p className="font-mono text-[10px] text-neon-moon uppercase tracking-wider font-bold mb-1.5">
          HQ RADIO COURIER: <a href="mailto:contact@shitmarket.lol" className="underline hover:text-white transition-colors">contact@shitmarket.lol</a>
        </p>
        <p className="font-mono text-[9px] text-trench-gasmask/60">
          © {new Date().getFullYear()} ShitMarket. Created by and for degenerate trench commanders. Built with no corporate support whatsoever.
        </p>
      </div>
    </footer>
  );
};
