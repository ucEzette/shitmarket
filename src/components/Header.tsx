'use client';

import React, { useState, useCallback } from 'react';
import Link from 'next/link';
import { useWallet } from '@solana/wallet-adapter-react';
import { useWalletModal } from '@solana/wallet-adapter-react-ui';
import { useAppState } from '@/store/useAppState';
import { PepePortrait, PEPE_ASSETS } from './MemeAssets';
import { LogOut, Loader2, Coins, Menu } from 'lucide-react';
import { NotificationBell } from './NotificationBell';

export const Header: React.FC<{
  isRoomPage?: boolean;
  onMenuToggle?: () => void;
}> = ({ isRoomPage, onMenuToggle }) => {
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
    <header className="sticky top-0 z-[100] w-full border-b-4 border-trench-sandbag bg-black px-3 py-2.5 sm:p-4 retro-panel rounded-none border-t-0 border-l-0 border-r-0">
      <div className="mx-auto flex max-w-7xl flex-row items-center justify-between gap-2">
        {/* Left Aligned branding section */}
        <div className="flex items-center gap-2 sm:gap-4 shrink-0">
          {/* Menu toggle button inside a token room */}
          {isRoomPage && (
            <button
              onClick={onMenuToggle}
              className="flex items-center gap-1.5 px-3 py-1.5 retro-btn text-neon-moon border-2 border-trench-sandbag rounded bg-black hover:border-neon-moon font-staatliches text-xs tracking-wider uppercase transition-colors shrink-0 font-bold"
            >
              <Menu size={14} className="text-neon-moon" />
              <span>MENU</span>
            </button>
          )}
          
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
      </div>

        {/* Wallet Connection / Ammo Status */}
        <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
          <Link href="/?play_intro=true">
            <button className="px-2.5 py-1.5 retro-btn retro-btn-neutral border border-trench-sandbag rounded font-staatliches text-[10px] sm:text-xs tracking-wider uppercase transition-colors shrink-0 font-bold flex items-center gap-1">
              📜 BRIEFING
            </button>
          </Link>
          
          {user && user.wallet ? (
            <div className="flex items-center gap-1 sm:gap-2 bg-black border-2 border-trench-sandbag rounded p-0.5 sm:p-1">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Ammo Display */}
              <div className="flex items-center gap-1 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-trench-mud border border-trench-sandbag rounded-sm">
                <Coins size={12} className="text-moon-gold sm:size-[14px]" />
                <span className="font-mono text-[10px] sm:text-xs font-bold text-moon-gold">
                  AMMO: <span className="glow-gold font-bold">{user.balance.toFixed(2)} SOL</span>
                </span>
              </div>

              {/* User Address with Gas Mask Indicator */}
              <Link
                href="/profile"
                className="flex items-center gap-1 px-1.5 py-0.5 sm:px-3 sm:py-1 bg-trench-sandbag hover:bg-trench-gasmask transition-all rounded-sm text-white retro-btn"
              >
                <PepePortrait src={user.avatarUrl || PEPE_ASSETS.fewUnderstand} size={16} loading="eager" className="rounded-full sm:size-[20px]" />
                <span className="font-mono text-[10px] sm:text-xs font-bold pl-0.5 max-w-[80px] sm:max-w-[120px] truncate block">
                  {user.username || `${user.wallet.substring(0, 4)}...${user.wallet.substring(user.wallet.length - 4)}`}
                </span>
              </Link>

              {/* Disconnect trigger */}
              <button
                onClick={handleDisconnect}
                title="RESERVE FORCES (DISCONNECT)"
                className="p-1 text-white hover:bg-red-500 transition-all rounded retro-btn retro-btn-jeet"
              >
                <LogOut size={14} className="sm:size-[16px]" />
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

