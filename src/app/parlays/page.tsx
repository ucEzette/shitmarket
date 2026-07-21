'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppState, Room, formatCashtag } from '@/store/useAppState';
import { PixelCrackedHelmet, PixelGasMask, PixelBarbedWire } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS, DegenQuoteBanner } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { ShieldAlert, Zap, Layers, AlertCircle, HelpCircle, ArrowLeft, X, Plus } from 'lucide-react';

interface LiveParlayLeg {
  roomId: string;
  tokenSymbol: string;
  tokenImageUrl: string;
  side: 'moon' | 'jeet';
  odds: number;
}

export default function ParlaysPage() {
  const { rooms, roomsLoaded, user, connectWallet } = useAppState();
  const activeRooms = rooms.filter((r) => r.status === 'active' && r.token && r.token.name && r.token.name !== 'Unknown Token' && r.token.symbol !== 'UNKNOWN' && r.token.symbol !== 'UNKNWN');

  const getLiveOdds = (room: Room, side: 'moon' | 'jeet'): number => {
    const moon = room.moonPool || 0.1;
    const jeet = room.jeetPool || 0.1;
    const total = moon + jeet;
    const odds = side === 'moon' ? total / moon : total / jeet;
    return Math.max(1.01, Number(odds.toFixed(2)));
  };

  const [legs, setLegs] = useState<LiveParlayLeg[]>([]);
  const [stakeAmount, setStakeAmount] = useState<number>(0.5); // SOL
  const [selectedRoomId, setSelectedRoomId] = useState<string>('');
  const [selectedSide, setSelectedSide] = useState<'moon' | 'jeet'>('moon');
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [dispatchedTicket, setDispatchedTicket] = useState<any>(null);

  // Pre-populate with first 3 active rooms if legs are empty and rooms load
  useEffect(() => {
    if (roomsLoaded && activeRooms.length > 0 && legs.length === 0) {
      const initialLegs: LiveParlayLeg[] = activeRooms.slice(0, 3).map((r, idx) => {
        const side = idx % 2 === 0 ? 'moon' : 'jeet';
        return {
          roomId: r.id,
          tokenSymbol: r.token.symbol,
          tokenImageUrl: r.token.icon || '',
          side,
          odds: getLiveOdds(r, side),
        };
      });
      setLegs(initialLegs);
    }
  }, [roomsLoaded, rooms]);

  // Keep odds synchronized with live pools if they change in state
  useEffect(() => {
    if (legs.length > 0) {
      const updated = legs.map((leg) => {
        const matchedRoom = rooms.find((r) => r.id === leg.roomId);
        if (matchedRoom) {
          return {
            ...leg,
            odds: getLiveOdds(matchedRoom, leg.side),
          };
        }
        return leg;
      });
      // Simple equality check to prevent infinite loops
      const hasChanged = updated.some((ul, idx) => ul.odds !== legs[idx]?.odds);
      if (hasChanged) {
        setLegs(updated);
      }
    }
  }, [rooms, legs]);

  const calculateMultiplier = () => {
    return legs.reduce((acc, leg) => acc * leg.odds, 1);
  };

  const calculatePayout = () => {
    return calculateMultiplier() * stakeAmount;
  };

  const handleQuickStake = (val: number) => {
    setStakeAmount(val);
    synthSound('bet');
  };

  const handleAddLeg = () => {
    if (!selectedRoomId) return;
    const targetRoom = activeRooms.find((r) => r.id === selectedRoomId);
    if (!targetRoom) return;

    const odds = getLiveOdds(targetRoom, selectedSide);
    const newLeg: LiveParlayLeg = {
      roomId: targetRoom.id,
      tokenSymbol: targetRoom.token.symbol,
      tokenImageUrl: targetRoom.token.icon || '',
      side: selectedSide,
      odds,
    };

    setLegs([...legs, newLeg]);
    setSelectedRoomId('');
    synthSound('bet');
  };

  const handleRemoveLeg = (roomId: string) => {
    setLegs(legs.filter((l) => l.roomId !== roomId));
    synthSound('bet');
  };

  const handleToggleSide = (roomId: string) => {
    const updated = legs.map((l) => {
      if (l.roomId === roomId) {
        const nextSide: 'moon' | 'jeet' = l.side === 'moon' ? 'jeet' : 'moon';
        const targetRoom = rooms.find((r) => r.id === roomId);
        const odds = targetRoom ? getLiveOdds(targetRoom, nextSide) : l.odds;
        return { ...l, side: nextSide, odds };
      }
      return l;
    });
    setLegs(updated);
    synthSound('bet');
  };

  const handleDispatchTicket = () => {
    if (legs.length === 0) return;
    synthSound('bet');
    const simSig = Array.from({ length: 32 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
    setDispatchedTicket({
      sig: `sim_tx_${simSig}`,
      legsCount: legs.length,
      multiplier: calculateMultiplier(),
      stake: stakeAmount,
      payout: calculatePayout(),
      legsSummary: legs.map((l) => `${formatCashtag(l.tokenSymbol)} (${l.side.toUpperCase()}) x${l.odds}`).join(' • '),
    });
    setShowSuccessModal(true);
  };

  const handleDismissTicket = () => {
    setShowSuccessModal(false);
    setDispatchedTicket(null);
    setLegs([]);
    synthSound('bet');
  };

  return (
    <div className="mx-auto max-w-4xl w-full px-4 py-8 flex-1 flex flex-col select-none relative">
      {/* Back button */}
      <div className="mb-4">
        <Link href="/rooms" className="inline-flex items-center gap-1 text-trench-gasmask hover:text-white font-mono text-xs uppercase font-bold">
          <ArrowLeft size={14} /> Back to War Table
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Multi-Leg UI Simulator (7 cols) */}
        <div className="lg:col-span-8 bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 relative shadow-lg scanlines">
          <div className="absolute top-[-18px] left-[50%] -translate-x-[50%] bg-[#5C5244] border-2 border-[#8B8B7A] text-white px-6 py-1 rounded font-staatliches text-sm tracking-widest shadow uppercase flex items-center gap-1.5 font-bold z-10">
            <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={20} className="rounded-full animate-pulse" />
            <span>LIVE SIMULATOR</span>
          </div>

          <div className="mb-6 mt-4 flex items-center gap-4">
            <PepePortrait src={PEPE_ASSETS.neonWojak} size={52} glowColor="moon" animated className="rounded-lg shrink-0" />
            <div>
              <h2 className="font-staatliches text-4xl text-white tracking-wider flex items-center gap-2 uppercase leading-none">
                MULTIPLY DEGEN: PvP PARLAYS
              </h2>
              <p className="font-mono text-xs text-trench-gasmask uppercase font-bold mt-1.5">
                Assemble multiple active arena room wagers into a single tactical strike. All targets must settle in your favor to claim the aggregated multiplier!
              </p>
            </div>
          </div>

          {/* Simulated Training Deck Alert Banner */}
          <div className="mb-4 border border-yellow-500/40 bg-yellow-500/5 p-3 rounded text-[9px] font-mono text-yellow-500 uppercase font-bold tracking-wider animate-pulse flex items-center gap-2">
            <span>⚠️</span>
            <span>SIMULATED TRAINING DECK: ATOMIC PARLAYS RUN IN MOCK ENVIRONMENT. MULTI-LEG PVP PREDICTIONS DO NOT EXECUTE ON-CHAIN TRANSACTIONS ON MAINNET.</span>
          </div>

          {/* Warning badge */}
          <div className="mb-6 flex gap-2.5 p-3.5 bg-yellow-500/5 border-2 border-dashed border-yellow-500/20 rounded text-trench-gasmask items-center">
            <PepePortrait src={PEPE_ASSETS.jeetSkeleton} size={36} glowColor="jeet" className="rounded-full shrink-0" />
            <div>
              <span className="font-staatliches text-lg text-moon-gold tracking-wide block uppercase leading-none">HIGH LEVERAGE HAZARD ZONE</span>
              <p className="font-mono text-[9px] uppercase font-bold mt-1 leading-normal">
                If a single prediction on your parlay ticket settles against your side, the entire ammunition stake is forfeit to the PvP pool.
              </p>
            </div>
          </div>

          {/* Selector to add new legs */}
          <div className="bg-trench-black/40 p-4 border border-trench-sandbag/80 rounded-lg mb-6 flex flex-col md:flex-row items-center gap-3">
            <div className="flex-1 w-full">
              <span className="font-mono text-[9px] text-trench-gasmask block uppercase font-bold mb-1">CHOOSE TARGET POSITION:</span>
              <select
                value={selectedRoomId}
                onChange={(e) => setSelectedRoomId(e.target.value)}
                className="w-full bg-trench-black text-white border border-trench-sandbag rounded px-3 py-2 font-mono text-xs uppercase font-bold outline-none cursor-pointer"
              >
                <option value="">-- SELECT ACTIVE ARENA ROOM --</option>
                {activeRooms
                  .filter((ar) => !legs.some((l) => l.roomId === ar.id))
                  .map((ar) => (
                    <option key={ar.id} value={ar.id}>
                      {formatCashtag(ar.token.symbol)} (Pool: {(ar.moonPool + ar.jeetPool).toFixed(1)} SOL)
                    </option>
                  ))}
              </select>
            </div>
            
            <div className="w-full md:w-auto shrink-0 flex flex-col items-center">
              <span className="font-mono text-[9px] text-trench-gasmask block uppercase font-bold mb-1 align-self-start">SIDE:</span>
              <div className="flex border border-trench-sandbag rounded overflow-hidden w-full md:w-auto">
                <button
                  type="button"
                  onClick={() => { setSelectedSide('moon'); synthSound('bet'); }}
                  className={`px-4 py-2 font-staatliches text-sm uppercase flex-1 md:flex-initial ${selectedSide === 'moon' ? 'bg-neon-moon text-black font-bold' : 'bg-trench-black text-trench-gasmask hover:text-white'}`}
                >
                  MOON
                </button>
                <button
                  type="button"
                  onClick={() => { setSelectedSide('jeet'); synthSound('bet'); }}
                  className={`px-4 py-2 font-staatliches text-sm uppercase flex-1 md:flex-initial ${selectedSide === 'jeet' ? 'bg-jeet-red text-white font-bold' : 'bg-trench-black text-trench-gasmask hover:text-white'}`}
                >
                  JEET
                </button>
              </div>
            </div>

            <button
              type="button"
              disabled={!selectedRoomId}
              onClick={handleAddLeg}
              className={`w-full md:w-auto px-5 py-2.5 rounded font-staatliches text-base uppercase shrink-0 transition-all ${
                selectedRoomId 
                  ? 'bg-moon-gold text-black border border-moon-gold cursor-pointer hover:scale-[1.03] active:scale-[0.98]' 
                  : 'bg-trench-black text-trench-gasmask/40 border border-trench-sandbag/40 cursor-not-allowed'
              }`}
            >
              Add Leg
            </button>
          </div>

          {/* Parlay ticket list builder preview */}
          <div className="space-y-3 bg-trench-black/60 p-4 border border-trench-sandbag rounded-lg shadow-inner mb-6">
            <div className="flex justify-between border-b border-trench-sandbag/40 pb-2 font-mono text-[10px] text-trench-gasmask uppercase font-bold">
              <span>TARGET ROOM</span>
              <span className="text-center">DEPLOYED DIRECTION</span>
              <span className="text-right">LIVE MULTIPLIER</span>
            </div>

            {legs.length === 0 ? (
              <div className="text-center py-6 text-trench-gasmask font-mono text-xs uppercase font-bold tracking-wider">
                🚨 NO ACTIVE LEGS STACKED. SELECT A TARGET POSITION ABOVE! 🚨
              </div>
            ) : (
              legs.map((leg) => (
                <div key={leg.roomId} className="flex justify-between items-center bg-trench-black p-3 border border-trench-sandbag/65 rounded font-mono text-xs font-bold uppercase transition-all hover:border-trench-sandbag relative group">
                  <div className="flex items-center gap-2">
                    <div className="p-0.5 bg-trench-mud border border-trench-sandbag rounded overflow-hidden">
                      <PepePortrait src={leg.side === 'moon' ? PEPE_ASSETS.chadBull : PEPE_ASSETS.jeetSkeleton} size={24} className="rounded" />
                    </div>
                    <div>
                      <span className="text-white block font-bold">{formatCashtag(leg.tokenSymbol)}</span>
                      <span className="text-[9px] text-trench-gasmask block font-bold">SECTOR: {leg.roomId.substring(0, 8).toUpperCase()}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggleSide(leg.roomId)}
                      className={`px-3 py-1 rounded text-[10px] border cursor-pointer select-none transition-all hover:scale-105 active:scale-95 ${
                        leg.side === 'moon' 
                          ? 'bg-neon-moon/10 border-neon-moon text-neon-moon hover:bg-neon-moon/20' 
                          : 'bg-jeet-red/10 border-jeet-red text-jeet-red hover:bg-jeet-red/20'
                      }`}
                      title="Click to toggle bet side"
                    >
                      {leg.side.toUpperCase()} 🔄
                    </button>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="text-moon-gold font-staatliches text-lg">x{leg.odds.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLeg(leg.roomId)}
                      className="text-trench-gasmask hover:text-jeet-red p-1 rounded transition-colors cursor-pointer"
                      title="Remove Leg"
                    >
                      <X size={14} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick actions for mock legs */}
          <div className="flex justify-between items-center font-mono text-xs font-bold uppercase border-t border-trench-sandbag/40 pt-4 text-trench-gasmask">
            <span>STAKE DIAL:</span>
            <div className="flex gap-2">
              {[0.1, 0.5, 1.0, 2.5].map((val) => (
                <button
                  key={val}
                  onClick={() => handleQuickStake(val)}
                  className={`px-3 py-1 border rounded transition-all cursor-pointer ${
                    stakeAmount === val ? 'bg-moon-gold text-black border-moon-gold' : 'bg-trench-black text-trench-gasmask border-trench-sandbag hover:text-white'
                  }`}
                >
                  {val} SOL
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Dynamic Aggregation Console (5 cols) */}
        <div className="lg:col-span-4 bg-trench-mud border-4 border-trench-sandbag rounded-lg p-6 relative shadow-lg scanlines flex flex-col justify-between min-h-[340px] lg:h-[430px]">
          <div>
            <h3 className="font-staatliches text-2xl text-white tracking-wider mb-6 flex items-center gap-2 uppercase border-b border-trench-sandbag/40 pb-2">
              <PepePortrait src={PEPE_ASSETS.apeGeneral} size={24} className="rounded-full" />
              SLIP SLATE
            </h3>

            {/* Aggregated details */}
            <div className="space-y-4 font-mono text-xs font-bold uppercase text-trench-gasmask">
              <div className="flex justify-between items-center">
                <span>COMBINED WEIGHTS</span>
                <span className="text-white font-bold">{legs.length} SECTOR LEGS</span>
              </div>
              <div className="flex justify-between items-center">
                <span>AMMO STAKE DEPLOYED</span>
                <span className="text-white font-bold">{stakeAmount} SOL</span>
              </div>
              <div className="flex justify-between items-center border-t border-trench-sandbag/40 pt-3">
                <span>POTENTIATE ODDS</span>
                <span className="text-moon-gold font-staatliches text-2xl tracking-wider">x{calculateMultiplier().toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            {/* Massive Payout Banner */}
            <div className="bg-trench-black p-4 border border-trench-sandbag rounded text-center my-6 shadow-inner">
              <span className="font-mono text-[9px] text-trench-gasmask block uppercase font-bold">POTENTIAL PVP PAYOUT (SOL)</span>
              <span className="font-staatliches text-4xl text-neon-moon tracking-widest glow-moon block mt-1 font-bold">
                {calculatePayout().toFixed(3)} SOL
              </span>
            </div>

            <button
              onClick={handleDispatchTicket}
              disabled={legs.length === 0}
              className={`w-full py-3.5 font-staatliches text-xl rounded uppercase border-b-4 transition-all ${
                legs.length > 0
                  ? 'bg-neon-moon text-black border-trench-black cursor-pointer hover:scale-[1.02] active:scale-[0.98]'
                  : 'bg-trench-sandbag text-trench-gasmask border-trench-black cursor-not-allowed opacity-50'
              }`}
            >
              <span>DISPATCH CONQUER TICKET ⚔️</span>
            </button>
          </div>
        </div>
      </div>

      {/* Degen Quote Banner */}
      <div className="mb-6">
        <DegenQuoteBanner />
      </div>

      <div className="my-8">
        <PixelBarbedWire height={16} />
      </div>

      {/* Success Modal Overlay */}
      {showSuccessModal && dispatchedTicket && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-trench-black border-4 border-neon-moon p-6 rounded-lg max-w-lg w-full relative scanlines shadow-[0_0_30px_#16A34A]">
            <div className="flex items-center gap-3 border-b-2 border-neon-moon pb-3 mb-4">
              <PepePortrait src={PEPE_ASSETS.chadBull} size={48} glowColor="moon" className="rounded-lg" />
              <div>
                <h3 className="font-staatliches text-3xl text-neon-moon tracking-widest uppercase leading-none">TACTICAL TICKET DISPATCHED</h3>
                <span className="font-mono text-[9px] text-trench-gasmask uppercase font-bold block mt-1">STATUS: SECURED IN ARENA STATE</span>
              </div>
            </div>

            <div className="font-mono text-xs text-trench-gasmask space-y-3.5 uppercase my-6">
              <div>
                <span className="text-white font-bold block">TRANSACTION SIGNATURE:</span>
                <span className="text-neon-moon font-bold break-all select-all block bg-trench-mud/50 p-2 border border-trench-sandbag/40 rounded mt-1">
                  {dispatchedTicket.sig}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-y border-trench-sandbag/30 py-3">
                <div>
                  <span className="block font-bold text-[9px]">TOTAL LEGS STRIKE:</span>
                  <span className="text-white text-lg font-staatliches font-bold block">{dispatchedTicket.legsCount} TARGETS</span>
                </div>
                <div>
                  <span className="block font-bold text-[9px]">SOL STAKE:</span>
                  <span className="text-white text-lg font-staatliches font-bold block">{dispatchedTicket.stake} SOL</span>
                </div>
                <div>
                  <span className="block font-bold text-[9px]">COMBINED ODDS:</span>
                  <span className="text-moon-gold text-lg font-staatliches font-bold block">X{dispatchedTicket.multiplier.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block font-bold text-[9px]">ESTIMATED PAYOUT:</span>
                  <span className="text-neon-moon text-lg font-staatliches font-bold block">{dispatchedTicket.payout.toFixed(3)} SOL</span>
                </div>
              </div>
              <div>
                <span className="text-white font-bold block">COMBAT CORPS MATRIX:</span>
                <p className="text-[10px] normal-case bg-trench-mud/30 p-2 rounded border border-trench-sandbag/20 text-white italic mt-1">
                  {dispatchedTicket.legsSummary}
                </p>
              </div>
            </div>

            <button
              onClick={handleDismissTicket}
              className="w-full py-3 bg-neon-moon text-black font-staatliches text-xl rounded uppercase border-b-4 border-trench-black cursor-pointer hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              DISMISS COMMAND TICKET
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
