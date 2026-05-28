import React from 'react';
import Link from 'next/link';
import { Search } from 'lucide-react';

interface CommandBarProps {
  filter: 'ending' | 'biggest' | 'active-bets' | 'expired';
  setFilter: (f: CommandBarProps['filter']) => void;
  search: string;
  setSearch: (s: string) => void;
  top10Tokens: Array<{ name: string; symbol: string; price: string; change: string }>; // optional, not used here
}

export const CommandBar: React.FC<CommandBarProps> = ({ filter, setFilter, search, setSearch }) => (
  <div className="retro-panel p-4 rounded-xl mb-8 flex flex-col lg:flex-row justify-between gap-4 items-center">
    {/* Tactical filter radio tabs */}
    <div className="flex flex-wrap gap-1 bg-trench-black/80 p-1 border border-trench-sandbag rounded shadow-inner">
      <button
        onClick={() => setFilter('ending')}
        className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
          filter === 'ending'
            ? 'bg-trench-sandbag text-neon-moon font-bold shadow-glow-moon'
            : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
        }`}
      >
        ⏳ Ending Soon
      </button>
      <button
        onClick={() => setFilter('biggest')}
        className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
          filter === 'biggest'
            ? 'bg-trench-sandbag text-moon-gold font-bold shadow-glow-gold'
            : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
        }`}
      >
        💰 Biggest Pots
      </button>
      <button
        onClick={() => setFilter('active-bets')}
        className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
          filter === 'active-bets'
            ? 'bg-trench-sandbag text-jeet-red font-bold shadow-glow-jeet'
            : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
        }`}
      >
        🎖️ My Active Bets
      </button>
      <button
        onClick={() => setFilter('expired')}
        className={`px-4 py-1.5 font-staatliches text-xs tracking-wider uppercase transition-all rounded ${
          filter === 'expired'
            ? 'bg-trench-sandbag text-moon-gold font-bold shadow-glow-gold'
            : 'text-trench-gasmask hover:text-white hover:bg-trench-mud/50'
        }`}
      >
        💀 Expired Rooms
      </button>
    </div>
    {/* Search Input */}
    <div className="flex items-center gap-2 bg-trench-black/80 border border-trench-sandbag rounded px-3 py-1.5 shadow-inner">
      <Search className="w-4 h-4 text-neon-moon" />
      <input
        type="text"
        placeholder="Search trenches…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="bg-transparent outline-none font-mono text-sm text-white placeholder:text-trench-gasmask placeholder:opacity-60 w-48"
      />
    </div>
    {/* Create Room CTA */}
    <Link href="/create-room" className="w-full md:w-auto">
      <button className="w-full py-2.5 px-6 font-staatliches text-xl tracking-wider text-black retro-btn retro-btn-moon active:translate-y-1 transition-all flex items-center justify-center gap-2 uppercase font-bold">
        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M12 5v14M5 12h14"/></svg>
        DIG NEW TRENCH
      </button>
    </Link>
  </div>
);
