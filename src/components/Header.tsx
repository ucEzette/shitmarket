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
  { label: 'HQ LANDING', href: '/' },
  { label: 'WAR TABLE', href: '/rooms' },
  { label: 'DEPLOY MISSION', href: '/create-room' },
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
    // Open the Solana wallet modal to let user choose a wallet
    setVisible(true);
  }, [setVisible]);

  const handleDisconnect = useCallback(() => {
    disconnect().catch(() => {});
    mockDisconnect();
  }, [disconnect, mockDisconnect]);

  return (
    <header className="sticky top-0 z-[100] w-full border-b-4 border-trench-sandbag bg-black px-3 py-2.5 sm:p-4 retro-panel !overflow-visible rounded-none border-t-0 border-l-0 border-r-0" style={{ overflow: 'visible' }}>
      <div className="mx-auto flex max-w-full px-4 md:px-8 flex-row items-center justify-between gap-2">
        {/* Left Aligned branding and navigation section */}
        <div className="flex items-center gap-2 sm:gap-6 shrink-0">
          {/* Logo and Tagline */}
          <Link href="/" className="flex items-center gap-2 sm:gap-3 group shrink-0">
            <div className="flex flex-col">
              <img
                src="/pepes/screen (1).png"
                alt="ShitMarket"
                className="h-[32px] sm:h-[44px] w-auto object-contain group-hover:scale-105 transition-all duration-300"
                loading="eager"
                decoding="sync"
              />
              <p className="hidden sm:block font-mono text-[9px] text-trench-gasmask uppercase tracking-widest mt-1 font-bold pl-2 stencil-shadow">
                PvP Meme Trenches • 1.25% Settle Fee
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-3 ml-4">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-staatliches text-base tracking-wider uppercase transition-all px-2.5 py-1.5 rounded ${
                    isActive
                      ? 'bg-trench-black text-neon-moon border-b-2 border-neon-moon shadow-[0_3px_10px_rgba(57,255,20,0.15)] font-bold'
                      : 'text-trench-gasmask hover:text-white hover:bg-trench-black/20'
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
            <button className="px-2.5 py-1.5 retro-btn retro-btn-neutral border border-trench-sandbag rounded font-staatliches text-[10px] sm:text-xs tracking-wider uppercase transition-colors shrink-0 font-bold flex items-center gap-1">
              📜 BRIEFING
            </button>
          </Link>
          
          {user && user.wallet ? (
            <div className="flex items-center gap-2 bg-black border-2 border-trench-sandbag rounded p-0.5 sm:p-1">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Ammo Display */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-trench-mud border border-trench-sandbag rounded-sm">
                <Coins size={12} className="text-moon-gold sm:size-[14px]" />
                <span className="font-mono text-[10px] sm:text-xs font-bold text-moon-gold">
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
                  size={32}
                  glowColor="moon"
                  className="rounded-full"
                />
              </Link>

              {/* Disconnect trigger */}
              <button
                onClick={handleDisconnect}
                title="RESERVE FORCES (DISCONNECT)"
                className="p-2 text-trench-gasmask hover:text-white hover:bg-red-500/20 transition-all rounded border border-trench-sandbag bg-trench-black"
              >
                <LogOut size={16} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              disabled={connecting}
              className="relative flex items-center gap-1.5 px-3 py-1.5 sm:px-6 sm:py-2.5 font-staatliches text-xs sm:text-lg tracking-wider uppercase text-black active:translate-y-1 transition-all rounded font-bold retro-btn retro-btn-moon"
            >
              {connecting ? (
                <>
                  <Loader2 size={12} className="animate-spin text-white sm:size-[18px]" />
                  <span>SECURING HELMET...</span>
                </>
              ) : (
                <>
                  <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={18} loading="eager" className="rounded-full animate-bounce sm:size-[24px]" />
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

