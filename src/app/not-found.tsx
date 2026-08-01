'use client';

import React from 'react';
import Link from 'next/link';
import { PixelGasMask } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { AlertOctagon, HelpCircle } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto max-w-xl w-full px-4 py-16 flex-1 flex flex-col justify-center items-center text-center select-none bg-[#A8EEFF] dark:bg-trench-black text-slate-800 dark:text-white transition-colors duration-200">
      
      {/* 404 card container */}
      <div className="bg-white dark:bg-trench-mud p-8 border-2 border-cyan-200 dark:border-4 dark:border-trench-sandbag rounded-2xl shadow-xl dark:shadow-2xl relative dark:scanlines text-slate-800 dark:text-white">
        
        {/* Top badge details */}
        <div className="absolute top-[-18px] left-[50%] -translate-x-[50%] bg-cyan-100 dark:bg-[#5C5244] border-2 border-cyan-300 dark:border-[#8B8B7A] text-slate-900 dark:text-white px-6 py-1 rounded-full font-staatliches text-sm tracking-widest shadow uppercase flex items-center gap-1.5 font-bold">
          <AlertOctagon size={14} className="text-[#C62828] dark:text-jeet-red animate-pulse" />
          <span>PAGE NOT FOUND</span>
        </div>

        <div className="mb-6 mt-4 relative flex justify-center">
          <div className="absolute -inset-1 rounded-full bg-red-500/10 dark:bg-jeet-red/10 blur-xl animate-pulse" />
          <PepePortrait src={PEPE_ASSETS.jeetSkeleton} size={140} glowColor="jeet" animated className="rounded-xl relative z-10" />
        </div>

        <h2 className="font-staatliches text-5xl text-[#C62828] dark:text-jeet-red tracking-wider uppercase leading-none dark:glow-jeet">
          404 - LOST IN THE TRENCHES
        </h2>

        <div className="bg-cyan-50 dark:bg-trench-black border border-cyan-200 dark:border-trench-sandbag p-4 rounded-xl my-6 shadow-inner">
          <p className="font-marker text-sm text-amber-700 dark:text-moon-gold tracking-widest uppercase font-bold">
            &quot;THIS URL GOT DUMPED BY THE DEV.&quot;
          </p>
          <p className="font-mono text-[10px] text-slate-600 dark:text-trench-gasmask mt-2 uppercase font-bold leading-normal">
            The target link has been rugged, Honeypotted, or shelled by artillery fire. We recommend withdrawing forces to safe sectors.
          </p>
        </div>

        {/* Action Button */}
        <Link href="/rooms" className="block w-full">
          <button className="w-full py-3 bg-[#00796B] dark:bg-neon-moon text-white dark:text-black font-staatliches text-xl rounded-lg uppercase shadow-md hover:bg-[#004D40] dark:hover:bg-green-400 font-bold transition-all">
            RETURN TO PREDICTION ARENA
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
