'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAppState } from '@/store/useAppState';
import { PepePortrait, PEPE_ASSETS } from './MemeAssets';
import { LogOut, Loader2, Coins } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

const navItems = [
  { label: 'TRENCHES', href: '/rooms' },
  { label: 'DEPLOY', href: '/create-room' },
  { label: 'PARLAYS', href: '/parlays' },
  { label: 'LEADERBOARD', href: '/leaderboard' },
];

export const Header: React.FC<{
  isRoomPage?: boolean;
  onMenuToggle?: () => void;
}> = ({ isRoomPage, onMenuToggle }) => {
  const pathname = usePathname();
  const { user, disconnectWallet: mockDisconnect } = useAppState();
  const { publicKey, connected, connecting: walletConnecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();
  const [connecting, setConnecting] = useState(false);

  const handleConnect = useCallback(() => {
    setVisible(true);
  }, [setVisible]);

  const handleDisconnect = useCallback(() => {
    disconnect().catch(() => {});
    mockDisconnect();
  }, [disconnect, mockDisconnect]);

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-trench-sandbag bg-black px-2 h-10 sm:h-11 flex items-center retro-panel !overflow-visible rounded-none border-t-0 border-l-0 border-r-0" style={{ overflow: 'visible' }}>
      <div className="w-full mx-auto px-2 sm:px-4 flex flex-row items-center justify-between gap-2">
        {/* Left Aligned branding and navigation section */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-1 group shrink-0">
            <img
              src="/pepes/logo-main.png"
              alt="ShitMarket"
              className="h-[22px] sm:h-[26px] w-auto object-contain group-hover:scale-105 transition-all duration-300"
              loading="eager"
              decoding="sync"
            />
            <span className="font-staatliches text-[13px] sm:text-base tracking-wider font-extrabold flex items-center select-none ml-1">
              <span className="text-white">SHIT</span>
              <span className="text-[#39ff14]">MARKET</span>
              <span className="text-[#ff073a]">.</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-2 ml-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-mono text-[10px] tracking-wider uppercase transition-all px-2 py-0.5 rounded-sm border-b-2 ${
                    isActive
                      ? 'bg-trench-black text-neon-moon border-neon-moon font-extrabold shadow-[0_1px_4px_rgba(57,255,20,0.08)]'
                      : 'text-trench-gasmask border-transparent hover:text-white hover:bg-trench-black/40'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Wallet Connection / Ammo Status */}
        <div className="flex items-center gap-1 sm:gap-2 shrink-0">
          <Link href="/?play_intro=true" className="hidden sm:block">
            <button className="px-1.5 py-0.5 retro-btn retro-btn-neutral border border-trench-sandbag/60 rounded font-staatliches text-[8px] sm:text-[9px] tracking-wider uppercase transition-colors shrink-0 font-bold flex items-center gap-0.5">
              Briefing
            </button>
          </Link>
          
          {user && user.wallet ? (
            <div className="flex items-center gap-1 bg-black border border-trench-sandbag/50 rounded p-0.5">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Ammo Display */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 bg-trench-mud border border-trench-sandbag/40 rounded-sm">
                <Coins size={9} className="text-moon-gold" />
                <span className="font-mono text-[8px] sm:text-[9px] font-bold text-moon-gold">
                  <span className="hidden sm:inline">AMMO: </span><span className="glow-gold font-bold">{user.balance.toFixed(2)} SOL</span>
                </span>
              </div>

              {/* Connected wallet profile image linking to profile */}
              <Link
                href="/profile"
                className="block shrink-0 transition-transform hover:scale-105"
                title={`Trench Pass: ${user.username || user.wallet.substring(0, 6)}`}
              >
                <PepePortrait
                  src={user.avatarUrl || PEPE_ASSETS.fewUnderstand}
                  size={20}
                  glowColor="moon"
                  className="rounded-full"
                />
              </Link>

              {/* Disconnect trigger */}
              <button
                onClick={handleDisconnect}
                title="RESERVE FORCES (DISCONNECT)"
                className="p-0.5 text-trench-gasmask hover:text-white hover:bg-red-500/20 transition-all rounded border border-trench-sandbag/40 bg-trench-black"
              >
                <LogOut size={10} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="relative flex items-center gap-0.5 px-2 py-0.5 sm:px-3 sm:py-1 font-staatliches text-[10px] sm:text-xs tracking-wider uppercase text-black active:translate-y-0.5 transition-all rounded font-bold retro-btn retro-btn-moon"
            >
              {connecting ? (
                <>
                  <Loader2 size={8} className="animate-spin text-white sm:size-[10px]" />
                  <span>Helmetting...</span>
                </>
              ) : (
                <>
                  <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={11} loading="eager" className="rounded-full animate-bounce sm:size-[13px]" />
                  <span>CONNECT</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </header>
  );
};

