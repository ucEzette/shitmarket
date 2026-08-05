'use client';

import React, { useState, useCallback, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWalletContext } from './WalletProvider';
import { WalletPanel } from './WalletPanel';
import { useAppState } from '@/store/useAppState';
import { PepePortrait, PEPE_ASSETS } from './MemeAssets';
import { LogOut, Loader2, Coins, Settings, X, Sun, Moon, Zap } from 'lucide-react';
import { NotificationBell } from './NotificationBell';
import { connection } from '@/utils/solanaClient';
import { usePrivy } from '@privy-io/react-auth';
import { useTheme } from './ThemeProvider';

const navItems = [
  { label: 'WAR ROOM', href: '/rooms' },
  { label: 'PORTFOLIO', href: '/portfolio' },
  { label: 'DEPLOY', href: '/create-room' },
  { label: 'PARLAYS', href: '/parlays' },
  { label: 'LEADERBOARD', href: '/leaderboard' },
];

export const ThemeToggle: React.FC = () => {
  const { theme, toggleTheme } = useTheme();
  return (
    <button
      onClick={toggleTheme}
      className="p-1 bg-cyan-100/70 dark:bg-trench-black border border-cyan-200 dark:border-trench-sandbag/40 rounded hover:bg-cyan-200 dark:hover:bg-trench-mud transition-all flex items-center justify-center cursor-pointer text-slate-700 dark:text-trench-gasmask shrink-0"
      title={theme === 'light' ? 'SWITCH TO DARK MODE (TRENCH)' : 'SWITCH TO LIGHT MODE'}
    >
      {theme === 'light' ? (
        <Moon size={14} className="text-indigo-700 hover:text-indigo-900" />
      ) : (
        <Sun size={14} className="text-amber-400 hover:text-amber-300" />
      )}
    </button>
  );
};

export const HeaderSettings: React.FC = () => {
  const { settings, updateSettings } = useAppState();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [estimatedFees, setEstimatedFees] = useState<{ low: number; medium: number; high: number; turbo: number } | null>(null);
  const [congestionStatus, setCongestionStatus] = useState<'LOW' | 'NORMAL' | 'CONGESTED' | 'CRITICAL'>('NORMAL');
  const [isFetchingFees, setIsFetchingFees] = useState(false);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleToggle = () => setIsOpen(!isOpen);

  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    const fetchFees = async () => {
      setIsFetchingFees(true);
      try {
        const recentFees = await connection.getRecentPrioritizationFees();
        if (!active) return;
        if (recentFees && recentFees.length > 0) {
          const sorted = recentFees.map(f => f.prioritizationFee).sort((a, b) => b - a);
          const maxFee = sorted[0] || 0;
          const avgFee = sorted.reduce((sum, f) => sum + f, 0) / sorted.length;
          
          const estLow = Math.max(5_000, Math.round(avgFee * 0.5));
          const estMed = Math.max(50_000, Math.round(avgFee));
          const estHigh = Math.max(250_000, Math.round(avgFee * 2));
          const estTurbo = Math.max(2_000_000, Math.round(maxFee * 1.5));
          
          setEstimatedFees({
            low: estLow,
            medium: estMed,
            high: estHigh,
            turbo: estTurbo
          });
          
          if (maxFee > 5_000_000) {
            setCongestionStatus('CRITICAL');
          } else if (maxFee > 1_000_000) {
            setCongestionStatus('CONGESTED');
          } else if (avgFee > 50_000) {
            setCongestionStatus('NORMAL');
          } else {
            setCongestionStatus('LOW');
          }
        }
      } catch (err) {
        console.warn("Failed to fetch live priority fees:", err);
      } finally {
        if (active) setIsFetchingFees(false);
      }
    };
    fetchFees();
    return () => { active = false; };
  }, [isOpen]);

  const getPriorityLabel = (key: string) => {
    if (!estimatedFees || key === 'custom') {
      if (key === 'low') return 'LOW';
      if (key === 'medium') return 'MED';
      if (key === 'high') return 'HIGH';
      if (key === 'turbo') return 'TURBO';
      return 'CUSTOM';
    }
    const val = estimatedFees[key as keyof typeof estimatedFees];
    let displayVal = '';
    if (val >= 1_000_000) {
      displayVal = `${(val / 1_000_000).toFixed(1)}M`;
    } else if (val >= 1_000) {
      displayVal = `${(val / 1_000).toFixed(0)}K`;
    } else {
      displayVal = `${val}`;
    }
    return `${key.toUpperCase()} (${displayVal})`;
  };

  const getSlippageWarning = (slip: number) => {
    if (slip < 0.5) {
      return {
        type: 'warning',
        text: 'LOW SLIPPAGE: BET MIGHT FAIL DURING HIGH VOLATILITY.'
      };
    }
    if (slip > 10.0) {
      return {
        type: 'danger',
        text: 'HIGH SLIPPAGE: EXPOSES WAGER TO SANDWICH ATTACK FRONTRUNS.'
      };
    }
    return null;
  };

  const priorityPresets = [
    { label: getPriorityLabel('low'), value: 'low' },
    { label: getPriorityLabel('medium'), value: 'medium' },
    { label: getPriorityLabel('high'), value: 'high' },
    { label: getPriorityLabel('turbo'), value: 'turbo' },
    { label: getPriorityLabel('custom'), value: 'custom' }
  ];

  const slippagePresets = [
    { label: '0.5%', value: 0.5 },
    { label: '1.0%', value: 1.0 },
    { label: '3.0%', value: 3.0 },
    { label: 'CUSTOM', value: 'custom' }
  ];

  const [customFeeVal, setCustomFeeVal] = useState(settings.customPriorityFee.toString());
  const [customSlipVal, setCustomSlipVal] = useState(settings.slippage.toString());
  const [isCustomSlip, setIsCustomSlip] = useState(![0.5, 1.0, 3.0].includes(settings.slippage));

  const handlePrioritySelect = (type: any) => {
    updateSettings({ priorityFeeType: type });
  };

  const handleSlippageSelect = (val: any) => {
    if (val === 'custom') {
      setIsCustomSlip(true);
    } else {
      setIsCustomSlip(false);
      updateSettings({ slippage: val });
    }
  };

  const handleCustomFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomFeeVal(val);
    const num = parseInt(val);
    if (!isNaN(num) && num >= 0) {
      updateSettings({ customPriorityFee: num });
    }
  };

  const handleCustomSlipChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setCustomSlipVal(val);
    const num = parseFloat(val);
    if (!isNaN(num) && num >= 0 && num <= 100) {
      updateSettings({ slippage: num });
    }
  };

  return (
    <div className="relative shrink-0 flex items-center" ref={dropdownRef}>
      <button 
        onClick={handleToggle}
        className="p-1 bg-cyan-100/70 dark:bg-trench-black border border-cyan-200 dark:border-trench-sandbag/40 rounded hover:bg-cyan-200 dark:hover:bg-trench-mud transition-all flex items-center justify-center cursor-pointer"
        title="TACTICAL CONFIG"
      >
        <Settings size={14} className={`text-slate-700 dark:text-trench-gasmask ${isOpen ? 'rotate-45 text-teal-600 dark:text-neon-moon' : ''} transition-all`} />
      </button>

      {isOpen && (
        <div className="absolute right-0 top-8 mt-2 w-72 bg-white dark:bg-trench-black border-2 border-cyan-200 dark:border-4 dark:border-trench-sandbag rounded-xl shadow-2xl z-[9999] p-4 dark:scanlines text-slate-800 dark:text-white">
          <div className="flex justify-between items-center border-b border-cyan-200 dark:border-trench-sandbag/45 pb-2 mb-3">
            <span className="font-staatliches tracking-wider text-teal-700 dark:text-neon-moon text-lg uppercase font-bold">TACTICAL CONTROLS</span>
            <button onClick={() => setIsOpen(false)} className="text-slate-500 hover:text-slate-800 dark:text-trench-gasmask dark:hover:text-white cursor-pointer">
              <X size={16} />
            </button>
          </div>

          <div className="space-y-4 font-mono text-[10px] text-slate-800 dark:text-white">
            {/* Network Congestion Widget */}
            <div className="flex justify-between items-center bg-cyan-50 dark:bg-trench-mud border border-cyan-200 dark:border-trench-sandbag/30 rounded p-1.5 mb-2">
              <span className="text-[8px] text-slate-500 dark:text-trench-gasmask uppercase font-bold">NETWORK CONGESTION:</span>
              <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${
                congestionStatus === 'LOW' ? 'bg-green-500/20 text-green-700 dark:text-green-400' :
                congestionStatus === 'NORMAL' ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400' :
                congestionStatus === 'CONGESTED' ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-400' :
                'bg-red-500/20 text-red-700 dark:text-red-400 animate-pulse'
              }`}>
                {congestionStatus} {isFetchingFees && '🔄'}
              </span>
            </div>

            {/* Priority Fee Section */}
            <div>
              <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-trench-gasmask block mb-2 text-[8px]">AMMUNITION SPEED (PRIORITY FEE)</span>
              <div className="grid grid-cols-5 gap-1">
                {priorityPresets.map((preset) => {
                  const isActive = settings.priorityFeeType === preset.value;
                  return (
                    <button
                      key={preset.value}
                      onClick={() => handlePrioritySelect(preset.value)}
                      className={`py-1 rounded text-[6.5px] border font-bold uppercase transition-all cursor-pointer ${
                        isActive
                          ? 'bg-teal-600/10 dark:bg-neon-moon/20 border-teal-600 dark:border-neon-moon text-teal-700 dark:text-neon-moon shadow-sm dark:shadow-[0_0_8px_rgba(57,255,20,0.3)]'
                          : 'bg-cyan-50 dark:bg-trench-mud border-cyan-200 dark:border-trench-sandbag/45 text-slate-600 dark:text-trench-gasmask hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {settings.priorityFeeType === 'custom' && (
                <div className="mt-2 flex items-center gap-2 bg-cyan-50 dark:bg-trench-mud border border-cyan-200 dark:border-trench-sandbag/40 rounded p-1.5">
                  <span className="text-[8px] text-slate-600 dark:text-trench-gasmask uppercase font-bold shrink-0">Micro-lamports:</span>
                  <input
                    type="number"
                    value={customFeeVal}
                    onChange={handleCustomFeeChange}
                    className="flex-1 min-w-0 bg-white dark:bg-black text-teal-700 dark:text-neon-moon font-mono text-[10px] px-1 py-0.5 border border-cyan-300 dark:border-trench-sandbag rounded focus:outline-none focus:border-teal-600 dark:focus:border-neon-moon"
                  />
                </div>
              )}
            </div>

            {/* Slippage Tolerance Section */}
            <div>
              <span className="font-bold uppercase tracking-wider text-slate-600 dark:text-trench-gasmask block mb-2 text-[8px]">TARGET VARIANCE (SLIPPAGE LIMIT)</span>
              <div className="grid grid-cols-4 gap-1">
                {slippagePresets.map((preset) => {
                  const isActive = preset.value === 'custom' ? isCustomSlip : (!isCustomSlip && settings.slippage === preset.value);
                  return (
                    <button
                      key={String(preset.value)}
                      onClick={() => handleSlippageSelect(preset.value)}
                      className={`py-1 rounded text-[7px] border font-bold uppercase transition-all cursor-pointer ${
                        isActive
                          ? 'bg-teal-600/10 dark:bg-neon-moon/20 border-teal-600 dark:border-neon-moon text-teal-700 dark:text-neon-moon shadow-sm dark:shadow-[0_0_8px_rgba(57,255,20,0.3)]'
                          : 'bg-cyan-50 dark:bg-trench-mud border-cyan-200 dark:border-trench-sandbag/45 text-slate-600 dark:text-trench-gasmask hover:text-slate-900 dark:hover:text-white'
                      }`}
                    >
                      {preset.label}
                    </button>
                  );
                })}
              </div>
              {isCustomSlip && (
                <div className="mt-2 flex items-center gap-2 bg-cyan-50 dark:bg-trench-mud border border-cyan-200 dark:border-trench-sandbag/40 rounded p-1.5">
                  <span className="text-[8px] text-slate-600 dark:text-trench-gasmask uppercase font-bold shrink-0">Max Slippage %:</span>
                  <input
                    type="number"
                    step="0.1"
                    min="0"
                    max="100"
                    value={customSlipVal}
                    onChange={handleCustomSlipChange}
                    className="flex-1 min-w-0 bg-white dark:bg-black text-teal-700 dark:text-neon-moon font-mono text-[10px] px-1 py-0.5 border border-cyan-300 dark:border-trench-sandbag rounded focus:outline-none focus:border-teal-600 dark:focus:border-neon-moon"
                  />
                </div>
              )}
              {/* Slippage Warning Alert Box */}
              {getSlippageWarning(settings.slippage) && (
                <div className={`mt-2 p-1.5 rounded border text-[7px] font-bold leading-normal uppercase ${
                  getSlippageWarning(settings.slippage)?.type === 'danger'
                    ? 'bg-red-500/10 border-red-500/40 text-red-600 dark:text-red-400'
                    : 'bg-yellow-500/10 border-yellow-500/40 text-yellow-700 dark:text-yellow-400'
                }`}>
                  {getSlippageWarning(settings.slippage)?.text}
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-cyan-200 dark:border-trench-sandbag/30 text-[8px] text-slate-500 dark:text-trench-gasmask uppercase leading-relaxed font-bold">
              Config adjustments persist locally on this terminal console deck.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const Header: React.FC<{
  isRoomPage?: boolean;
  onMenuToggle?: () => void;
}> = ({ isRoomPage, onMenuToggle }) => {
  const pathname = usePathname();
  const { user } = useAppState();
  const { walletType, activeWalletAddress, balance, setIsModalOpen, isImportedWalletLocked, disconnect } = useWalletContext();
  const { login } = usePrivy();
  const [showWalletPanel, setShowWalletPanel] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  // Click outside to close WalletPanel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        setShowWalletPanel(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleConnect = useCallback(() => {
    if (isImportedWalletLocked) {
      setIsModalOpen(true);
    } else {
      login();
    }
  }, [isImportedWalletLocked, setIsModalOpen, login]);

  const handleDisconnect = useCallback(() => {
    disconnect().catch(() => {});
  }, [disconnect]);

  return (
    <header className="sticky top-0 z-[100] w-full border-b border-[var(--border-color)] bg-[var(--card-bg)] px-4 h-14 flex items-center shadow-sm" style={{ overflow: 'visible' }}>
      <div className="w-full mx-auto flex flex-row items-center justify-between gap-2 relative animate-fadeIn" style={{ overflow: 'visible' }}>
        {/* Left Aligned branding and navigation section */}
        <div className="flex items-center gap-4 sm:gap-6 shrink-0">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group shrink-0">
            <img
              src="/pepes/logo-main.png"
              alt="ShitMarket"
              className="h-8 w-auto object-contain transition-transform duration-300 group-hover:scale-105"
              loading="eager"
              decoding="sync"
            />
            <span className="font-sans text-base tracking-wider font-extrabold flex items-center select-none">
              <span className="text-[var(--text-primary)]">SHIT</span>
              <span className="text-[#10b981]">MARKET</span>
              <span className="text-[#ef4444]">.</span>
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden lg:flex items-center gap-3 ml-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`font-mono text-[11px] tracking-wider uppercase transition-all px-3 py-1.5 rounded-lg border font-bold ${
                    isActive
                      ? 'bg-[var(--card-secondary)] text-[#10b981] border-[var(--border-color)] font-extrabold shadow-sm'
                      : 'text-[var(--text-secondary)] border-transparent hover:text-[var(--text-primary)] hover:bg-[var(--card-secondary)]'
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
          {/* Theme Toggle Button */}
          <ThemeToggle />
          
          {activeWalletAddress ? (
            <div className="flex items-center gap-1 bg-cyan-50 dark:bg-black border border-cyan-200 dark:border-trench-sandbag/50 rounded p-0.5">
              {/* Notification Bell */}
              <NotificationBell />

              {/* Settings Dropdown */}
              <HeaderSettings />

              {/* Ammo Display (Click toggles WalletPanel) */}
              <div className="flex items-center gap-1">
                <button
                  onClick={() => setShowWalletPanel(!showWalletPanel)}
                  className="flex items-center gap-1 px-1.5 py-0.5 bg-amber-50 dark:bg-trench-mud hover:bg-amber-100 dark:hover:bg-trench-mud/85 border border-amber-200 dark:border-trench-sandbag/40 rounded-sm cursor-pointer transition-all active:translate-y-0.5"
                >
                  <Coins size={9} className="text-amber-600 dark:text-moon-gold font-bold" />
                  <span className="font-mono text-[8px] sm:text-[9px] font-bold text-amber-800 dark:text-moon-gold">
                    <span className="hidden sm:inline">AMMO: </span><span className="glow-gold font-bold">{(user?.balance ?? balance).toFixed(2)} {process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche' || useAppState.getState().isEvm ? 'USDC' : 'SOL'}</span>
                  </span>
                </button>
                {process.env.NEXT_PUBLIC_CORE_CHAIN === 'avalanche' && (
                  <button
                    onClick={() => useAppState.getState().mintTestnetUsdc(1000)}
                    className="hidden sm:inline-block px-1.5 py-0.5 bg-teal-600/20 hover:bg-teal-600 dark:bg-neon-moon/20 dark:hover:bg-neon-moon text-teal-700 hover:text-white dark:text-neon-moon dark:hover:text-black border border-teal-600/50 dark:border-neon-moon/50 font-mono text-[8px] font-bold uppercase rounded-sm cursor-pointer transition-all active:translate-y-0.5"
                    title="Get 1,000 Free Testnet USDC"
                  >
                    +1K USDC
                  </button>
                )}
                <button
                  onClick={() => useAppState.getState().openRelayDepositModal()}
                  className="hidden md:inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-[#00796B]/15 dark:bg-neon-moon/20 hover:bg-[#00796B] dark:hover:bg-neon-moon text-[#00796B] hover:text-white dark:text-neon-moon dark:hover:text-black border border-[#00796B]/50 dark:border-neon-moon/50 font-mono text-[8px] font-extrabold uppercase rounded-sm cursor-pointer transition-all active:translate-y-0.5"
                  title="Deposit from Base, Arbitrum, Mainnet, etc. via Relay Protocol"
                >
                  <span>+ DEPOSIT</span>
                </button>
              </div>

              {/* Connected wallet profile image linking to profile */}
              <Link
                href="/profile"
                className="block shrink-0 transition-transform hover:scale-105"
                title={`Trench Pass: ${user?.username || activeWalletAddress.substring(0, 6)}`}
              >
                <PepePortrait
                  src={user?.avatarUrl || PEPE_ASSETS.fewUnderstand}
                  size={20}
                  glowColor="moon"
                  className="rounded-full"
                />
              </Link>

              {/* Disconnect trigger */}
              <button
                onClick={handleDisconnect}
                title="RESERVE FORCES (DISCONNECT)"
                className="p-0.5 text-slate-600 dark:text-trench-gasmask hover:text-red-600 dark:hover:text-white hover:bg-red-500/20 transition-all rounded border border-cyan-200 dark:border-trench-sandbag/40 bg-white dark:bg-trench-black cursor-pointer"
              >
                <LogOut size={10} />
              </button>
            </div>
          ) : (
            <button
              onClick={handleConnect}
              className="relative flex items-center gap-1 px-2 py-0.5 sm:px-3 sm:py-1 font-staatliches text-[10px] sm:text-xs tracking-wider uppercase text-white dark:text-black active:translate-y-0.5 transition-all rounded font-bold retro-btn retro-btn-moon cursor-pointer"
            >
              <PepePortrait src={PEPE_ASSETS.fewUnderstand} size={11} loading="eager" className="rounded-full animate-bounce sm:size-[13px]" />
              <span>SIGN IN / SIGN UP</span>
            </button>
          )}
        </div>

        {/* Dropdown WalletPanel */}
        {showWalletPanel && activeWalletAddress && (
          <div ref={panelRef} className="absolute right-4 top-10 z-[1000] w-72">
            <WalletPanel onClose={() => setShowWalletPanel(false)} />
          </div>
        )}
      </div>
    </header>
  );
};

