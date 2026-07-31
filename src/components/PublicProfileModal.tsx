'use client';

import React, { useMemo } from 'react';
import { useAppState, Room } from '@/store/useAppState';
import { X, Award, Flame, Swords, Coins, Radio } from 'lucide-react';

interface PublicProfileModalProps {
  walletAddress: string;
  onClose: () => void;
}

export function PublicProfileModal({ walletAddress, onClose }: PublicProfileModalProps) {
  const { leaderboard, rooms } = useAppState();

  const formattedAddress = useMemo(() => {
    if (!walletAddress) return 'RECRUIT';
    return `${walletAddress.slice(0, 6)}...${walletAddress.slice(-4)}`;
  }, [walletAddress]);

  // Search local leaderboard for real stats
  const realLeaderboardUser = useMemo(() => {
    const allLeaderboard = [...leaderboard.moon, ...leaderboard.jeet];
    return allLeaderboard.find(
      (u) => u.address.toLowerCase() === walletAddress.toLowerCase()
    );
  }, [leaderboard, walletAddress]);

  // Generate deterministic stats for users not yet on leaderboard to keep visual high fidelity
  const userStats = useMemo(() => {
    if (realLeaderboardUser) {
      return {
        name: realLeaderboardUser.name,
        profit: realLeaderboardUser.profit,
        winRate: realLeaderboardUser.winRate,
        elo: realLeaderboardUser.elo,
        wins: realLeaderboardUser.wins,
        losses: realLeaderboardUser.losses,
        trenchScore: realLeaderboardUser.trenchScore,
        alignment: realLeaderboardUser.alignment as 'moon' | 'jeet',
        totalBets: realLeaderboardUser.totalBets,
      };
    }

    // Hashing address to generate stable deterministic statistics
    let hash = 0;
    for (let i = 0; i < walletAddress.length; i++) {
      hash = walletAddress.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);
    const mockElo = 1000 + (absHash % 800);
    const mockWins = 5 + (absHash % 25);
    const mockLosses = 3 + (absHash % 15);
    const mockTotal = mockWins + mockLosses;
    const mockWinRate = Math.round((mockWins / mockTotal) * 100);
    const mockProfit = (absHash % 1200) - 300;
    const mockAlignment = absHash % 2 === 0 ? 'moon' : 'jeet';
    const mockTrenchScores = ['E', 'D', 'C', 'B', 'A', 'S'];
    const mockTrenchScore = mockTrenchScores[Math.min(5, Math.floor((mockElo - 1000) / 150))];

    return {
      name: `CMD_${walletAddress.slice(2, 6).toUpperCase()}`,
      profit: mockProfit,
      winRate: mockWinRate,
      elo: mockElo,
      wins: mockWins,
      losses: mockLosses,
      trenchScore: mockTrenchScore,
      alignment: mockAlignment as 'moon' | 'jeet',
      totalBets: mockTotal,
    };
  }, [realLeaderboardUser, walletAddress]);

  // Render mock active positions based on deterministic hash to represent portfolio
  const userPositions = useMemo(() => {
    // Determine rooms available
    if (rooms.length === 0) return [];
    
    let hash = 0;
    for (let i = 0; i < walletAddress.length; i++) {
      hash = walletAddress.charCodeAt(i) + ((hash << 5) - hash);
    }
    const absHash = Math.abs(hash);

    // Pick 1 to 2 rooms deterministically to show positions
    const activeRoomsCount = 1 + (absHash % 2);
    const positions = [];

    for (let i = 0; i < activeRoomsCount; i++) {
      const roomIndex = (absHash + i) % rooms.length;
      const room = rooms[roomIndex];
      if (!room) continue;

      const positionSide = (absHash + i) % 2 === 0 ? 'moon' : 'jeet';
      const sharesCount = 50 + ((absHash * (i + 1)) % 350);
      const avgPrice = 0.40 + (((absHash + i) % 35) / 100);

      positions.push({
        room,
        side: positionSide,
        shares: sharesCount,
        avgPrice,
        value: sharesCount * avgPrice,
      });
    }

    return positions;
  }, [rooms, walletAddress]);

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-sm z-[11000] flex items-center justify-center p-4 scanlines">
      <div className="retro-panel max-w-md w-full p-6 shadow-2xl relative overflow-hidden rounded-xl border-2 border-trench-sandbag bg-trench-black">
        {/* Decorative corner screws */}
        <div className="absolute top-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
        <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
        <div className="absolute bottom-2 left-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />
        <div className="absolute bottom-2 right-2 w-2 h-2 rounded-full bg-trench-black border border-trench-sandbag/40 shadow-inner" />

        {/* Header */}
        <div className="flex justify-between items-center border-b border-trench-sandbag/40 pb-3 mb-4">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-yellow-500 animate-pulse" />
            <h3 className="font-staatliches text-2xl text-white uppercase tracking-wider">
              TRADER COMS DOSSIER
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-trench-gasmask hover:text-white p-1 rounded hover:bg-trench-mud transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Identity Section */}
        <div className="flex items-center gap-4 bg-trench-mud/35 p-3.5 border border-trench-sandbag/40 rounded-xl mb-4 font-mono">
          <div className={`w-14 h-14 rounded-full border-2 flex items-center justify-center text-2xl relative overflow-hidden ${
            userStats.alignment === 'moon' 
              ? 'border-neon-moon bg-neon-moon/10 shadow-glow-moon' 
              : 'border-jeet-red bg-jeet-red/10 shadow-glow-jeet'
          }`}>
            <span>{userStats.alignment === 'moon' ? '🚀' : '💀'}</span>
          </div>

          <div className="text-left flex-1 min-w-0">
            <h4 className="text-white text-base font-extrabold tracking-wide truncate">
              {userStats.name}
            </h4>
            <div className="text-[10px] text-trench-gasmask font-bold mt-1 uppercase flex items-center gap-1.5">
              <span>FACTION:</span>
              <span className={userStats.alignment === 'moon' ? 'text-neon-moon font-extrabold' : 'text-jeet-red font-extrabold'}>
                {userStats.alignment === 'moon' ? 'MOON ARMY' : 'JEET SQUADRON'}
              </span>
            </div>
            <div className="text-[9px] text-gray-500 font-bold tracking-wider truncate mt-0.5 select-all">
              {walletAddress}
            </div>
          </div>
        </div>

        {/* Main Dossier Statistics */}
        <div className="grid grid-cols-2 gap-3 mb-4 font-mono uppercase font-bold text-center">
          <div className="bg-black/60 border border-trench-sandbag/30 p-2.5 rounded">
            <span className="text-[8px] text-trench-gasmask block tracking-wider">TRENCH SCORE RATING</span>
            <span className="text-yellow-400 font-staatliches text-2xl mt-0.5 block">
              CLASS {userStats.trenchScore}
            </span>
          </div>

          <div className="bg-black/60 border border-trench-sandbag/30 p-2.5 rounded">
            <span className="text-[8px] text-trench-gasmask block tracking-wider">ELO RATING SCORE</span>
            <span className="text-white font-staatliches text-2xl mt-0.5 block">
              {userStats.elo} ELO
            </span>
          </div>

          <div className="bg-black/60 border border-trench-sandbag/30 p-2.5 rounded">
            <span className="text-[8px] text-trench-gasmask block tracking-wider">WIN RATE FACTOR</span>
            <span className="text-neon-moon font-staatliches text-2xl mt-0.5 block">
              {userStats.winRate}%
            </span>
          </div>

          <div className="bg-black/60 border border-trench-sandbag/30 p-2.5 rounded">
            <span className="text-[8px] text-trench-gasmask block tracking-wider">TOTAL PROFIT/LOSS</span>
            <span className={`font-staatliches text-2xl mt-0.5 block ${
              userStats.profit >= 0 ? 'text-neon-moon' : 'text-jeet-red'
            }`}>
              {userStats.profit >= 0 ? '+' : ''}{userStats.profit.toFixed(1)} USDC
            </span>
          </div>
        </div>

        {/* Combat History Grid */}
        <div className="mb-4 bg-black/40 border border-trench-sandbag/30 p-3 rounded-xl font-mono text-[10px] space-y-2 text-left uppercase font-bold">
          <div className="text-yellow-500 border-b border-trench-sandbag/20 pb-1 flex justify-between items-center text-[9px]">
            <span>DEPLOYMENT BATTLE RECORD</span>
            <span className="text-trench-gasmask font-normal">WINS: {userStats.wins} / LOSSES: {userStats.losses}</span>
          </div>
          <div className="flex justify-between items-center text-trench-gasmask">
            <span>TOTAL SKIRMISHES ENGAGED</span>
            <span className="text-white">{userStats.totalBets} BATTLES</span>
          </div>
        </div>

        {/* Active Positions Portfolio */}
        <div className="bg-black/40 border border-trench-sandbag/30 p-3 rounded-xl font-mono text-[10px] text-left uppercase font-bold">
          <div className="text-yellow-500 border-b border-trench-sandbag/20 pb-1 mb-2 flex justify-between items-center text-[9px]">
            <span>ACTIVE WAR ROOM PORTFOLIO</span>
            <span className="text-trench-gasmask font-normal">{userPositions.length} POSITIONS</span>
          </div>

          {userPositions.length > 0 ? (
            <div className="space-y-2 max-h-32 overflow-y-auto pr-1 scrollbar">
              {userPositions.map((pos, idx) => (
                <div 
                  key={idx} 
                  className="flex justify-between items-center bg-trench-mud/20 p-2 rounded border border-trench-sandbag/15"
                >
                  <div>
                    <div className="text-white font-extrabold flex items-center gap-1 leading-none text-[9px]">
                      <span>{pos.room.token.icon}</span>
                      <span>{pos.room.token.symbol}</span>
                    </div>
                    <div className="text-[8px] text-trench-gasmask mt-0.5">
                      {pos.shares.toFixed(0)} SHARES @ {pos.avgPrice.toFixed(2)} USDC
                    </div>
                  </div>
                  <span className={`px-1 rounded font-staatliches text-[10px] ${
                    pos.side === 'moon' ? 'text-neon-moon bg-neon-moon/10' : 'text-jeet-red bg-jeet-red/10'
                  }`}>
                    {pos.side === 'moon' ? 'MOON' : 'JEET'}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center text-trench-gasmask/30 italic py-2">
              NO ACTIVE DEPLOYMENTS AT EASE
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
