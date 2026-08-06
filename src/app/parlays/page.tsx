'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAppState, Room, formatCashtag } from '@/store/useAppState';
import { synthSound } from '@/components/ClientWrapper';
import { ShieldAlert, Zap, Layers, AlertCircle, HelpCircle, ArrowLeft, X, Plus, Search, Check } from 'lucide-react';

interface LiveParlayLeg {
  roomId: string;
  tokenSymbol: string;
  tokenImageUrl: string;
  side: 'moon' | 'jeet';
  odds: number;
  moonLabel: string;
  jeetLabel: string;
}

export default function ParlaysPage() {
  const { rooms, roomsLoaded, parlayCart, addLegToParlay, removeLegFromParlay, clearParlayCart } = useAppState();
  const activeRooms = rooms.filter((r) => r.status === 'active' && r.token);

  const getLiveOdds = (room: Room, side: 'moon' | 'jeet'): number => {
    const moon = room.moonPool || 0.1;
    const jeet = room.jeetPool || 0.1;
    const total = moon + jeet;
    const odds = side === 'moon' ? total / moon : total / jeet;
    return Math.max(1.01, Number(odds.toFixed(2)));
  };

  const legs: LiveParlayLeg[] = parlayCart.map((l) => {
    const matchedRoom = rooms.find((r) => r.id === l.roomId);
    return {
      roomId: l.roomId,
      tokenSymbol: matchedRoom?.token.symbol || 'EVENT',
      tokenImageUrl: matchedRoom?.token.icon || '',
      side: l.side,
      odds: matchedRoom ? getLiveOdds(matchedRoom, l.side) : 1.0,
      moonLabel: matchedRoom?.moonLabel || 'YES',
      jeetLabel: matchedRoom?.jeetLabel || 'NO',
    };
  });

  const [stakeAmount, setStakeAmount] = useState<number>(50); // Default stake: 50 USDC
  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedSide, setSelectedSide] = useState<'moon' | 'jeet'>('moon');
  const [searchQuery, setSearchQuery] = useState('');
  const [showSuccessModal, setShowSuccessModal] = useState<boolean>(false);
  const [dispatchedTicket, setDispatchedTicket] = useState<any>(null);

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
    if (!selectedRoom) return;

    addLegToParlay(selectedRoom.id, selectedSide);
    setSelectedRoom(null);
    setSearchQuery('');
    synthSound('bet');
  };

  const handleRemoveLeg = (roomId: string) => {
    removeLegFromParlay(roomId);
    synthSound('bet');
  };

  const handleToggleSide = (roomId: string) => {
    const matchedLeg = parlayCart.find((l) => l.roomId === roomId);
    if (matchedLeg) {
      const nextSide: 'moon' | 'jeet' = matchedLeg.side === 'moon' ? 'jeet' : 'moon';
      addLegToParlay(roomId, nextSide);
      synthSound('bet');
    }
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
      legsSummary: legs.map((l) => `${formatCashtag(l.tokenSymbol)} (${l.side === 'moon' ? l.moonLabel : l.jeetLabel}) x${l.odds}`).join(' • '),
    });
    setShowSuccessModal(true);
  };

  const handleDismissTicket = () => {
    setShowSuccessModal(false);
    setDispatchedTicket(null);
    clearParlayCart();
    synthSound('bet');
  };

  // Filter rooms based on query (name, symbol or contract address)
  const filteredRooms = activeRooms.filter((r) => {
    if (legs.some((l) => l.roomId === r.id)) return false; // Hide already added legs
    const query = searchQuery.toLowerCase().trim();
    if (!query) return false;

    const name = (r.token.name || '').toLowerCase();
    const symbol = (r.token.symbol || '').toLowerCase();
    const address = (r.token.address || r.id || '').toLowerCase();

    return name.includes(query) || symbol.includes(query) || address.includes(query);
  });

  return (
    <div className="mx-auto max-w-5xl w-full px-4 py-8 flex-1 flex flex-col select-none relative">
      {/* Back button */}
      <div className="mb-4">
        <Link href="/rooms" className="inline-flex items-center gap-1.5 text-slate-500 hover:text-slate-900 dark:hover:text-white font-mono text-xs uppercase font-bold">
          <ArrowLeft size={14} /> Back to Markets
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Interactive Multi-Leg UI Simulator (8 cols) */}
        <div className="lg:col-span-8 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative shadow-sm space-y-6">
          
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 bg-emerald-500/10 dark:bg-emerald-500/5 rounded-xl border border-emerald-500/20 overflow-hidden shrink-0 flex items-center justify-center text-emerald-500">
              <Layers size={24} />
            </div>
            <div>
              <h2 className="font-sans text-2xl text-slate-900 dark:text-white tracking-tight font-extrabold uppercase leading-none">
                Multi-Leg Parlays
              </h2>
              <p className="font-sans text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                Assemble multiple prediction room wagers into a single high-multiplier ticket. All legs must settle in your favor to win the ticket!
              </p>
            </div>
          </div>

          {/* Warnings and Info Banners */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl space-y-2">
              <span className="font-sans text-[10px] text-amber-500 font-extrabold uppercase tracking-wide block">
                ⚠️ SIMULATED TRAINING DECK
              </span>
              <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                Atomic parlays run in mock execution environment. Parlay wagers do not trigger on-chain gas operations.
              </p>
            </div>
            <div className="border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/40 p-4 rounded-xl space-y-2">
              <span className="font-sans text-[10px] text-rose-500 font-extrabold uppercase tracking-wide block">
                🚨 ALL OR NOTHING HAZARD
              </span>
              <p className="font-sans text-[11px] text-slate-500 dark:text-slate-400 leading-normal">
                If a single leg in your dispatch ticket settles against you, the entire USDC stake is forfeit.
              </p>
            </div>
          </div>

          {/* Search to select market room */}
          <div className="bg-slate-50 dark:bg-slate-950 p-5 border border-slate-200 dark:border-slate-800 rounded-xl space-y-4">
            <div className="relative">
              <label className="block font-mono text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase mb-2">
                SEARCH MARKET (NAME OR CONTRACT ADDRESS):
              </label>
              
              {!selectedRoom ? (
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 pl-3 flex items-center text-slate-400">
                    <Search size={14} />
                  </span>
                  <input
                    type="text"
                    placeholder="Type name, symbol, or paste contract address..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-900 text-slate-950 dark:text-white border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                  
                  {/* Search Results Dropdown List */}
                  {searchQuery.trim() !== '' && (
                    <div className="absolute left-0 right-0 mt-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-xl max-h-60 overflow-y-auto z-20">
                      {filteredRooms.length === 0 ? (
                        <div className="p-4 text-center text-slate-500 dark:text-slate-400 font-mono text-[11px] uppercase">
                          No matching active rooms found
                        </div>
                      ) : (
                        filteredRooms.map((room) => {
                          const name = room.token.name;
                          const symbol = room.token.symbol || 'EVENT';
                          const address = room.token.address || room.id;
                          return (
                            <div
                              key={room.id}
                              onClick={() => {
                                setSelectedRoom(room);
                                setSearchQuery('');
                                synthSound('bet');
                              }}
                              className="px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-950/80 cursor-pointer border-b border-slate-100 dark:border-slate-800/50 last:border-b-0 flex items-center justify-between gap-4"
                            >
                              <div className="min-w-0">
                                <span className="font-sans text-sm font-extrabold text-slate-800 dark:text-white block truncate uppercase">
                                  {name}
                                </span>
                                <span className="font-mono text-[10px] text-slate-400 block truncate">
                                  {symbol} • {address.substring(0, 14)}...
                                </span>
                              </div>
                              <span className="shrink-0 font-mono text-[10px] bg-slate-100 dark:bg-slate-850 px-2 py-0.5 rounded text-slate-500 dark:text-slate-400">
                                POOL: {((room.moonPool || 0) + (room.jeetPool || 0)).toFixed(0)} USDC
                              </span>
                            </div>
                          );
                        })
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* Selected Room Indicator Badge */
                <div className="p-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <span className="font-mono text-[9px] text-emerald-500 font-extrabold uppercase tracking-wide block">
                      SELECTED MARKET
                    </span>
                    <span className="font-sans text-sm font-extrabold text-slate-850 dark:text-white block uppercase">
                      {selectedRoom.token.name}
                    </span>
                    <span className="font-mono text-[10px] text-slate-400 block">
                      SYMBOL: ${selectedRoom.token.symbol}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedRoom(null);
                      synthSound('bet');
                    }}
                    className="p-1.5 hover:bg-slate-100 dark:hover:bg-slate-850 rounded-lg text-slate-400 hover:text-rose-500 transition-colors"
                  >
                    <X size={16} />
                  </button>
                </div>
              )}
            </div>

            {selectedRoom && (
              <div className="flex flex-col md:flex-row items-center gap-4 pt-2 animate-fadeIn">
                <div className="w-full md:w-auto flex-1">
                  <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 block uppercase font-bold mb-2">
                    SELECT DIRECTION:
                  </span>
                  <div className="flex border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden bg-white dark:bg-slate-900 p-1 w-full md:w-60">
                    <button
                      type="button"
                      onClick={() => { setSelectedSide('moon'); synthSound('bet'); }}
                      className={`flex-1 py-2 font-sans text-xs uppercase font-extrabold tracking-wide rounded-lg transition-all ${
                        selectedSide === 'moon' 
                          ? 'bg-emerald-500 text-white' 
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {selectedRoom.moonLabel || 'YES'}
                    </button>
                    <button
                      type="button"
                      onClick={() => { setSelectedSide('jeet'); synthSound('bet'); }}
                      className={`flex-1 py-2 font-sans text-xs uppercase font-extrabold tracking-wide rounded-lg transition-all ${
                        selectedSide === 'jeet' 
                          ? 'bg-rose-500 text-white' 
                          : 'text-slate-500 hover:text-slate-800 dark:hover:text-white'
                      }`}
                    >
                      {selectedRoom.jeetLabel || 'NO'}
                    </button>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleAddLeg}
                  className="w-full md:w-auto px-6 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl font-mono text-xs uppercase font-bold tracking-wide transition-all shadow-sm shadow-emerald-500/10 cursor-pointer self-end md:mb-1.5"
                >
                  ADD TO TICKET
                </button>
              </div>
            )}
          </div>

          {/* Parlay Legs List Container */}
          <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-inner">
            <div className="flex justify-between border-b border-slate-200 dark:border-slate-800 pb-2.5 font-mono text-[10px] text-slate-400 uppercase font-bold">
              <span>TARGET ROOM</span>
              <span className="text-center">DIRECTION</span>
              <span className="text-right">MULTIPLIER</span>
            </div>

            {legs.length === 0 ? (
              <div className="text-center py-8 text-slate-400 dark:text-slate-500 font-sans text-xs uppercase font-extrabold tracking-wider">
                NO ACTIVE LEGS ADDED. SEARCH & SELECT A MARKET ABOVE!
              </div>
            ) : (
              legs.map((leg) => (
                <div key={leg.roomId} className="flex justify-between items-center bg-white dark:bg-slate-900 p-4 border border-slate-200 dark:border-slate-800 rounded-xl font-mono text-xs font-bold uppercase transition-all hover:border-slate-300 dark:hover:border-slate-700 relative group">
                  <div className="flex items-center gap-3">
                    <div className="w-6 h-6 bg-slate-100 dark:bg-slate-950 rounded-lg overflow-hidden flex items-center justify-center border border-slate-200 dark:border-slate-850">
                      {leg.tokenImageUrl ? (
                        <img src={leg.tokenImageUrl} alt={leg.tokenSymbol} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-[10px] text-slate-500">{leg.tokenSymbol.slice(0, 2)}</span>
                      )}
                    </div>
                    <div>
                      <span className="text-slate-800 dark:text-white block font-bold">{formatCashtag(leg.tokenSymbol)}</span>
                      <span className="text-[9px] text-slate-400 block font-bold">ID: {leg.roomId.substring(0, 8).toUpperCase()}</span>
                    </div>
                  </div>

                  <div>
                    <button
                      type="button"
                      onClick={() => handleToggleSide(leg.roomId)}
                      className={`px-3 py-1.5 rounded-lg text-[10px] font-extrabold border cursor-pointer select-none transition-all hover:scale-105 active:scale-95 ${
                        leg.side === 'moon' 
                          ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-600 dark:text-emerald-400' 
                          : 'bg-rose-50/20 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/20 text-rose-600 dark:text-rose-450'
                      }`}
                      title="Click to toggle side"
                    >
                      {leg.side === 'moon' ? leg.moonLabel : leg.jeetLabel} 🔄
                    </button>
                  </div>

                  <div className="flex items-center gap-4">
                    <span className="text-emerald-500 font-mono font-extrabold text-sm">x{leg.odds.toFixed(2)}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveLeg(leg.roomId)}
                      className="text-slate-400 hover:text-rose-500 p-1 rounded-lg transition-colors cursor-pointer"
                      title="Remove Leg"
                    >
                      <X size={15} />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Quick Stake actions */}
          <div className="flex justify-between items-center font-mono text-xs font-bold uppercase pt-2 text-slate-500">
            <span>STAKE AMOUNT (USDC):</span>
            <div className="flex gap-2">
              {[10, 50, 100, 250].map((val) => (
                <button
                  key={val}
                  onClick={() => handleQuickStake(val)}
                  className={`px-3.5 py-1.5 border rounded-lg transition-all cursor-pointer font-bold ${
                    stakeAmount === val 
                      ? 'bg-emerald-500 text-white border-emerald-500 shadow-sm' 
                      : 'bg-white dark:bg-slate-900 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-800 hover:border-slate-350 hover:text-slate-800'
                  }`}
                >
                  {val} USDC
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Aggregation Consoles & Dispatch Slip (4 cols) */}
        <div className="lg:col-span-4 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 relative shadow-sm flex flex-col justify-between min-h-[340px] lg:h-[430px]">
          <div>
            <h3 className="font-sans text-base text-slate-900 dark:text-white tracking-tight font-extrabold mb-5 flex items-center gap-2 uppercase border-b border-slate-100 dark:border-slate-800/80 pb-2">
              SLIP SLATE
            </h3>

            {/* Aggregated details */}
            <div className="space-y-4 font-mono text-xs font-bold uppercase text-slate-500 dark:text-slate-400">
              <div className="flex justify-between items-center">
                <span>COMBINED WEIGHTS</span>
                <span className="text-slate-900 dark:text-white font-extrabold">{legs.length} LEGS</span>
              </div>
              <div className="flex justify-between items-center">
                <span>USDC STAKE DEPLOYED</span>
                <span className="text-slate-900 dark:text-white font-extrabold">{stakeAmount} USDC</span>
              </div>
              <div className="flex justify-between items-center border-t border-slate-100 dark:border-slate-800/80 pt-3">
                <span>POTENTIATE ODDS</span>
                <span className="text-emerald-500 font-mono text-base font-extrabold">x{calculateMultiplier().toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div>
            {/* USDC Payout Banner */}
            <div className="bg-slate-50 dark:bg-slate-950 p-4 border border-slate-200 dark:border-slate-800 rounded-xl text-center my-6">
              <span className="font-mono text-[9px] text-slate-500 dark:text-slate-400 block uppercase font-bold">POTENTIAL PAYOUT (USDC)</span>
              <span className="font-mono text-xl text-emerald-500 block mt-1 font-extrabold">
                {calculatePayout().toFixed(2)} USDC
              </span>
            </div>

            <button
              onClick={handleDispatchTicket}
              disabled={legs.length === 0}
              className={`w-full py-3.5 font-mono text-xs uppercase tracking-wider rounded-xl font-extrabold transition-all duration-200 ${
                legs.length > 0
                  ? 'bg-emerald-500 text-white cursor-pointer hover:bg-emerald-600 shadow-md shadow-emerald-500/10'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-650 cursor-not-allowed'
              }`}
            >
              <span>DISPATCH CONQUER TICKET ⚔️</span>
            </button>
          </div>
        </div>
      </div>

      {/* Success Modal Overlay */}
      {showSuccessModal && dispatchedTicket && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-slate-900 border-2 border-emerald-500 p-6 rounded-2xl max-w-lg w-full relative shadow-[0_0_30px_rgba(16,185,129,0.2)]">
            
            <div className="flex items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-3.5 mb-4">
              <div className="w-10 h-10 bg-emerald-500/10 rounded-xl flex items-center justify-center text-emerald-500">
                <Check size={20} />
              </div>
              <div>
                <h3 className="font-sans text-lg font-extrabold text-slate-950 dark:text-white uppercase leading-none">TACTICAL TICKET DISPATCHED</h3>
                <span className="font-mono text-[9px] text-slate-400 uppercase font-bold block mt-1">STATUS: SECURED IN ARENA STATE</span>
              </div>
            </div>

            <div className="font-mono text-xs text-slate-500 dark:text-slate-400 space-y-3.5 uppercase my-6">
              <div>
                <span className="text-slate-800 dark:text-white font-bold block">TRANSACTION SIGNATURE:</span>
                <span className="text-emerald-500 font-bold break-all select-all block bg-slate-50 dark:bg-slate-950/60 p-2.5 border border-slate-200 dark:border-slate-800 rounded-lg mt-1 font-bold">
                  {dispatchedTicket.sig}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-4 border-y border-slate-150 dark:border-slate-800 py-3.5">
                <div>
                  <span className="block font-bold text-[9px]">TOTAL LEGS STRIKE:</span>
                  <span className="text-slate-800 dark:text-white text-base font-extrabold block">{dispatchedTicket.legsCount} TARGETS</span>
                </div>
                <div>
                  <span className="block font-bold text-[9px]">USDC STAKE:</span>
                  <span className="text-slate-800 dark:text-white text-base font-extrabold block">{dispatchedTicket.stake} USDC</span>
                </div>
                <div>
                  <span className="block font-bold text-[9px]">COMBINED ODDS:</span>
                  <span className="text-emerald-500 text-base font-extrabold block">X{dispatchedTicket.multiplier.toFixed(2)}</span>
                </div>
                <div>
                  <span className="block font-bold text-[9px]">ESTIMATED PAYOUT:</span>
                  <span className="text-emerald-500 text-base font-extrabold block">{dispatchedTicket.payout.toFixed(2)} USDC</span>
                </div>
              </div>
              <div>
                <span className="text-slate-800 dark:text-white font-bold block">COMBAT CORPS MATRIX:</span>
                <p className="text-[10px] normal-case bg-slate-50 dark:bg-slate-950/40 p-2.5 rounded-lg border border-slate-200 dark:border-slate-800 text-slate-650 dark:text-slate-355 italic mt-1 leading-normal">
                  {dispatchedTicket.legsSummary}
                </p>
              </div>
            </div>

            <button
              onClick={handleDismissTicket}
              className="w-full py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-mono text-xs font-bold rounded-xl uppercase transition-all shadow-md shadow-emerald-500/10"
            >
              DISMISS COMMAND TICKET
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
