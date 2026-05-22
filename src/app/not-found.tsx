'use client';

import React from 'react';
import Link from 'next/link';
import { PixelGasMask } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { AlertOctagon, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl w-full px-4 py-16 flex-1 flex flex-col justify-center items-center text-center select-none bg-trench-black">
      
      {/* 404 card container */}
      <div className="bg-trench-mud p-8 border-4 border-trench-sandbag rounded-lg shadow-2xl relative scanlines">
        
        {/* Binder Clip top details */}
        <div className="absolute top-[-18px] left-[50%] -translate-x-[50%] bg-[#5C5244] border-2 border-[#8B8B7A] text-white px-6 py-1 rounded font-staatliches text-sm tracking-widest shadow uppercase flex items-center gap-1.5 font-bold">
          <AlertOctagon size={14} className="text-jeet-red animate-pulse" />
          <span>TACTICAL FAILURE</span>
        </div>

        <div className="mb-6 mt-4 relative">
          <div className="absolute -inset-1 rounded-full bg-jeet-red/10 blur-xl animate-pulse" />
          <PepePortrait src={PEPE_ASSETS.jeetSkeleton} size={140} glowColor="jeet" animated className="rounded-xl relative z-10" />
        </div>

        <h2 className="font-staatliches text-5xl text-jeet-red tracking-wider uppercase leading-none glow-jeet">
          404 - SECTOR RUGGED
        </h2>

        <div className="bg-trench-black border border-trench-sandbag p-4 rounded my-6 shadow-inner">
          <p className="font-marker text-sm text-moon-gold tracking-widest uppercase">
            "THIS URL GOT DUMPED BY THE DEV."
          </p>
          <p className="font-mono text-[10px] text-trench-gasmask mt-2 uppercase font-bold leading-normal">
            The target link has been rugged, Honeypotted, or shelled by artillery fire. We recommend withdrawing forces to safe sectors.
          </p>
        </div>

        {/* Action Button */}
        <Link href="/rooms" className="block w-full">
          <button className="w-full py-3 btn-wood text-xl rounded uppercase">
            RETREAT TO FRONTLINES (WAR TABLE) 💣
          </button>
        </Link>

        {/* Degen Quote */}
        <div className="mt-4">
          <DegenQuoteBanner />
        </div>

      </div>

    </div>
  );
}
