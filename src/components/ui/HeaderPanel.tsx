import React from 'react';
import Link from 'next/link';
import { NavButton } from '@/components/ui/NavButton';
import { Bookmark } from 'lucide-react';

interface HeaderPanelProps {
  backHref: string;
  missionHref: string;
  title: string;
  countdown?: string; // optional countdown text
  isBookmarked?: boolean;
  onToggleBookmark?: () => void;
}

export const HeaderPanel: React.FC<HeaderPanelProps> = ({ 
  backHref, 
  missionHref, 
  title, 
  countdown,
  isBookmarked,
  onToggleBookmark
}) => (
  <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 mb-4 w-full">
    <div className="flex items-center gap-2 w-full sm:w-auto">
      <NavButton href={backHref} className="flex-1 sm:flex-initial">← {title}</NavButton>
      <NavButton href={missionHref} className="flex-1 sm:flex-initial">📜 BRIEFING</NavButton>
      {onToggleBookmark && (
        <button
          onClick={onToggleBookmark}
          className={`px-3 py-1.5 retro-btn font-staatliches text-xs sm:text-sm tracking-wider uppercase transition-all flex items-center justify-center gap-1.5 h-8 sm:h-9 ${
            isBookmarked
              ? 'bg-neon-moon/15 text-neon-moon border-neon-moon font-bold shadow-glow-moon border-2'
              : 'bg-black text-white hover:text-neon-moon border-2 border-transparent hover:border-neon-moon'
          }`}
          title={isBookmarked ? "Remove Bookmark" : "Bookmark Room"}
        >
          <Bookmark size={12} className={isBookmarked ? "fill-neon-moon text-neon-moon" : ""} />
          <span>{isBookmarked ? 'BOOKMARKED' : 'BOOKMARK'}</span>
        </button>
      )}
    </div>
    {countdown && (
      <div className="flex items-center justify-between sm:justify-start gap-2 bg-red-950/80 border border-red-500/50 text-red-400 px-3 py-1.5 rounded-lg shadow w-full sm:w-auto shrink-0">
        <span className="font-mono text-[9px] text-red-500 font-bold uppercase hidden sm:inline">ARENA CLOSING</span>
        <span className="font-staatliches text-sm tracking-widest text-red-400 bg-red-900/60 px-2 py-0.5 rounded border border-red-700 w-full sm:w-auto text-center">{countdown}</span>
      </div>
    )}
  </div>
);
