import React from 'react';
import Link from 'next/link';
import { NavButton } from '@/components/ui/NavButton';

interface HeaderPanelProps {
  backHref: string;
  missionHref: string;
  title: string;
  countdown?: string; // optional countdown text
}

export const HeaderPanel: React.FC<HeaderPanelProps> = ({ backHref, missionHref, title, countdown }) => (
  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
    <div className="flex items-center gap-2">
      <NavButton href={backHref}>← {title}</NavButton>
      <NavButton href={missionHref}>📜 MISSION BRIEFING</NavButton>
    </div>
    {countdown && (
      <div className="flex items-center gap-2 bg-red-950/80 border border-red-500/50 text-red-400 px-3 py-1.5 rounded-lg shadow">
        <span className="font-mono text-[9px] text-red-500 font-bold uppercase hidden sm:inline">ARENA CLOSING</span>
        <span className="font-staatliches text-sm tracking-widest text-red-400 bg-red-900/60 px-2 py-0.5 rounded border border-red-700">{countdown}</span>
      </div>
    )}
  </div>
);
