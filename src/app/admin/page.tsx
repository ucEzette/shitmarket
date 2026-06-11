'use client';
import { INDEXER_URL } from "@/utils/config";

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWallet } from '@solana/wallet-adapter-react';
import { useAppState } from '@/store/useAppState';
import { PixelShovel, PixelGasMask } from '@/components/PixelArt';
import { PepePortrait, PEPE_ASSETS } from '@/components/MemeAssets';
import { synthSound } from '@/components/ClientWrapper';
import { 
  ShieldAlert, ShieldCheck, Settings, RefreshCw, Landmark, 
  Coins, Download, AlertTriangle, Play, HelpCircle, Server, CheckCircle, Clock, Loader2
} from 'lucide-react';
import bs58 from 'bs58';

interface UnclaimedRoom {
  roomPubkey: string;
  tokenMint: string;
  tokenName: string | null;
  tokenSymbol: string | null;
  tokenImageUrl: string | null;
  expiry: string;
  escrowPda: string;
  escrowBalanceSOL: number;
  escrowBalanceLamports: number;
  totalUnclaimedSOL: number;
  totalUnclaimedLamports: string;
  coolingOffEnds: string;
  isEligibleForSweep: boolean;
  unclaimedPayouts: Array<{
    wallet: string;
    amountSOL: number;
    amountLamports: string;
  }>;
}

interface AdminStats {
  timestamp: string;
  rooms: {
    active: number;
    settled: number;
    total: number;
  };
  bets: {
    count: number;
    volumeLamports: number;
    volumeSOL: number;
  };
  revenue: {
    platformFeesLamports: number;
    platformFeesSOL: number;
  };
  unclaimed: {
    count: number;
    amountLamports: number;
    amountSOL: number;
  };
  solvency: {
    assetsLamports: number;
    assetsSOL: number;
    ratio: number;
    status: 'solvent' | 'insolvent';
  };
  config: {
    admin: string;
    treasury: string;
    keeper: string;
    platformFeeBps: number;
    paused: boolean;
    minimumLiquidity: string;
    twapWindowSeconds: number;
    coolingOffSeconds: number;
  } | null;
}

interface SystemHealth {
  status: 'ok' | 'degraded' | 'error';
  ts: string;
  uptime: number;
  services: {
    database: { status: 'ok' | 'error'; latencyMs: number };
    databaseReplica?: { status: 'ok' | 'error' | 'unconfigured'; latencyMs: number };
    redis: { status: 'ok' | 'error'; latencyMs: number };
    solanaRpc: { status: 'ok' | 'degraded' | 'error'; circuitState: string; isPrimary: boolean; slot?: number };
  };
}

export default function AdminDashboardPage() {
  const { publicKey, signMessage } = useWallet();
  const { user, connectWallet } = useAppState();

  const [activeTab, setActiveTab] = useState<'stats' | 'sweeper' | 'config' | 'ledger' | 'monitor'>('stats');
  
  // Data State
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [unclaimedRooms, setUnclaimedRooms] = useState<UnclaimedRoom[]>([]);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  
  // Loading & Action State
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [authError, setAuthError] = useState<string | null>(null);
  const [devBypass, setDevBypass] = useState(false);

  // Config Form State
  const [feeBps, setFeeBps] = useState<number>(125);
  const [treasury, setTreasury] = useState<string>('');
  const [keeper, setKeeper] = useState<string>('');
  const [minLiquidity, setMinLiquidity] = useState<string>('');
  const [twapWindow, setTwapWindow] = useState<number>(60);
  const [coolingOffDays, setCoolingOffDays] = useState<number>(14);

  const indexerUrl = INDEXER_URL;

  // Live timer tick for cooling off countdowns
  const [, setTick] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  // Generate Verification Headers using Solana Wallet signature
  const getAuthHeaders = useCallback(async () => {
    if (devBypass) {
      return {
        'Content-Type': 'application/json',
        'x-admin-bypass': 'true'
      };
    }

    if (!publicKey || !signMessage) {
      throw new Error("Solana wallet not connected or does not support message signing.");
    }

    const timestamp = Date.now().toString();
    const message = `ShitMarket Admin Verification: ${timestamp}`;
    const messageBytes = new TextEncoder().encode(message);
    const signatureBytes = await signMessage(messageBytes);
    const signature = bs58.encode(signatureBytes);

    return {
      'Content-Type': 'application/json',
      'Authorization': `${publicKey.toBase58()}:${signature}:${timestamp}`
    };
  }, [publicKey, signMessage, devBypass]);

  // Load public metrics and system health (no wallet auth required for reads)
  const loadDashboardData = useCallback(async () => {
    setLoading(true);
    setAuthError(null);
    try {
      // 1. Fetch Stats
      const statsRes = await fetch(`${indexerUrl}/api/admin/stats`);
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        if (statsData.success) {
          setStats(statsData.data);
          // Set form fields if stats.config is loaded
          if (statsData.data.config) {
            setFeeBps(statsData.data.config.platformFeeBps);
            setTreasury(statsData.data.config.treasury);
            setKeeper(statsData.data.config.keeper);
            setMinLiquidity((Number(statsData.data.config.minimumLiquidity) / 1e9).toString());
            setTwapWindow(statsData.data.config.twapWindowSeconds);
            setCoolingOffDays(statsData.data.config.coolingOffSeconds / 86400);
          }
        }
      }

      // 2. Fetch Unclaimed Rooms & Payouts
      const unclaimedRes = await fetch(`${indexerUrl}/api/admin/unclaimed`);
      if (unclaimedRes.ok) {
        const unclaimedData = await unclaimedRes.json();
        if (unclaimedData.success) {
          setUnclaimedRooms(unclaimedData.data);
        }
      }

      // 3. Fetch Health
      const healthRes = await fetch(`${indexerUrl}/api/health`);
      if (healthRes.ok) {
        const healthData = await healthRes.json();
        setHealth(healthData);
      }
    } catch (err: any) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [indexerUrl]);

  // Periodic health check auto-monitoring
  useEffect(() => {
    loadDashboardData();
    const monitorInterval = setInterval(async () => {
      try {
        const healthRes = await fetch(`${indexerUrl}/api/health`);
        if (healthRes.ok) {
          const healthData = await healthRes.json();
          setHealth(healthData);
        }
      } catch (err) {
        console.warn('System monitor polling failed:', err);
      }
    }, 10000); // monitor every 10 seconds

    return () => clearInterval(monitorInterval);
  }, [loadDashboardData, indexerUrl]);

  // Handle single room sweep on-chain
  const handleSweepRoom = async (roomPubkey: string) => {
    synthSound('bet');
    setActionLoading(`sweep-${roomPubkey}`);
    setAuthError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${indexerUrl}/api/admin/sweep`, {
        method: 'POST',
        headers: headers as any,
        body: JSON.stringify({ roomPubkey })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`🎉 SWEEP SUCCESSFUL!\nTx Signature: ${data.tx}\nRecovered: ${data.balanceSweptSOL.toFixed(4)} SOL`);
        loadDashboardData();
      } else {
        setAuthError(data.error || 'Failed to execute sweep on-chain.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Signature request rejected or endpoint unreachable.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle sweep all eligible escrows
  const handleSweepAll = async () => {
    synthSound('bet');
    setActionLoading('sweep-all');
    setAuthError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${indexerUrl}/api/admin/sweep-all`, {
        method: 'POST',
        headers: headers as any
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`🧹 BULK SWEEP COMPLETE!\nSwept Count: ${data.sweptCount}\nRecovered: ${data.totalSOLSwept.toFixed(4)} SOL`);
        loadDashboardData();
      } else {
        setAuthError(data.error || 'Bulk sweep action failed.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Signature rejected or endpoint unreachable.');
    } finally {
      setActionLoading(null);
    }
  };

  // Handle on-chain PlatformConfig updates
  const handleUpdateConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    synthSound('bet');
    setActionLoading('update-config');
    setAuthError(null);
    try {
      const headers = await getAuthHeaders();
      const res = await fetch(`${indexerUrl}/api/admin/config/update`, {
        method: 'POST',
        headers: headers as any,
        body: JSON.stringify({
          feeBps,
          treasury,
          keeper,
          minLiquidity: Math.round(parseFloat(minLiquidity) * 1e9).toString(),
          twapWindow,
          coolingOffSeconds: coolingOffDays * 86400
        })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        alert(`✅ CONFIGURATION UPDATED ON-CHAIN!\nTx Signature: ${data.tx}`);
        loadDashboardData();
      } else {
        setAuthError(data.error || 'Failed to update configuration.');
      }
    } catch (err: any) {
      console.error(err);
      setAuthError(err.message || 'Signature rejected or endpoint unreachable.');
    } finally {
      setActionLoading(null);
    }
  };

  // Client-Side CSV Export
  const exportLedgerCSV = () => {
    synthSound('victory');
    const flatRecords: any[] = [];
    unclaimedRooms.forEach(room => {
      room.unclaimedPayouts.forEach(p => {
        flatRecords.push({
          Room: room.roomPubkey,
          Token: room.tokenSymbol || room.tokenName || 'Unknown',
          Escrow: room.escrowPda,
          Winner: p.wallet,
          AmountSOL: p.amountSOL,
          Expiry: room.expiry,
          CoolingOffEnds: room.coolingOffEnds
        });
      });
    });

    if (flatRecords.length === 0) {
      alert("No unclaimed records found to export.");
      return;
    }

    const csvHeader = 'Room_Pubkey,Token,Escrow_PDA,Winner_Wallet,Amount_SOL,Room_Expiry,Cooling_Off_Ends\n';
    const csvRows = flatRecords.map(r => 
      `"${r.Room}","${r.Token}","${r.Escrow}","${r.Winner}",${r.AmountSOL},"${r.Expiry}","${r.CoolingOffEnds}"`
    ).join('\n');

    const blob = new Blob([csvHeader + csvRows], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `unclaimed-winnings-ledger-${new Date().toISOString().slice(0,10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Client-Side JSON Export
  const exportLedgerJSON = () => {
    synthSound('victory');
    const blob = new Blob([JSON.stringify(unclaimedRooms, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `unclaimed-winnings-ledger-${new Date().toISOString().slice(0,10)}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Utility: get cooling off badge & status
  const getCoolingOffStatus = (expiryDateStr: string, endsDateStr: string) => {
    const ends = new Date(endsDateStr);
    const now = new Date();
    const diff = ends.getTime() - now.getTime();
    
    if (diff <= 0) {
      return { label: '🟢 SWEEP ELIGIBLE', style: 'text-neon-moon bg-neon-moon/10 border-neon-moon' };
    } else {
      const days = Math.floor(diff / 86400000);
      const hours = Math.floor((diff % 86400000) / 3600000);
      const minutes = Math.floor((diff % 3600000) / 60000);
      const seconds = Math.floor((diff % 60000) / 1000);
      
      let timerStr = '';
      if (days > 0) timerStr += `${days}D `;
      timerStr += `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
      
      return { label: `⏳ cooling off: ${timerStr}`, style: 'text-jeet-red bg-jeet-red/10 border-jeet-red animate-pulse' };
    }
  };

  const isLoaded = stats !== null;
  const isAuthorized = devBypass || (
    stats?.config && 
    publicKey && 
    (publicKey.toBase58() === stats.config.admin || publicKey.toBase58() === stats.config.keeper)
  );

  if (!isLoaded && loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center min-h-[60vh] select-none">
        <Loader2 className="animate-spin text-neon-moon mb-4" size={48} />
        <span className="font-staatliches text-2xl text-white tracking-widest uppercase animate-pulse">
          SECURING STATION TELEMETRIES...
        </span>
      </div>
    );
  }

  if (!isAuthorized) {
    return (
      <div className="mx-auto max-w-2xl w-full px-4 py-12 flex-1 flex flex-col justify-center select-none animate-fadeIn">
        <div className="bg-black border-4 border-jeet-red rounded-xl p-8 shadow-[0_0_30px_rgba(255,42,77,0.15)] scanlines relative overflow-hidden text-center">
          
          <div className="absolute top-4 right-4 flex items-center gap-1.5 px-2.5 py-1 bg-jeet-red/10 border border-jeet-red text-jeet-red rounded text-[10px] font-mono font-bold uppercase animate-pulse">
            <span className="w-2 h-2 rounded-full bg-jeet-red animate-ping animate-pulse" />
            SECURE ACCESS BLOCKED
          </div>

          <div className="mx-auto w-16 h-16 rounded-full border-4 border-jeet-red flex items-center justify-center text-jeet-red mb-6 shadow-glow-jeet-strong animate-bounce">
            <ShieldAlert size={36} />
          </div>

          <h1 className="font-staatliches text-4xl text-white tracking-wider uppercase mb-2">
            RESTRICTED MILITARY SECTOR
          </h1>
          <p className="font-mono text-xs text-trench-gasmask uppercase tracking-wider mb-6 font-bold">
            LEVEL 4 PLATFORM TELEMETRIES REQUIRE ADMINISTRATOR SIGNATURE
          </p>

          <div className="bg-trench-mud border-2 border-trench-sandbag rounded p-4 mb-6 text-left space-y-3 font-mono text-xs">
            <div className="flex justify-between border-b border-trench-sandbag/40 pb-2">
              <span className="text-trench-gasmask uppercase font-bold">REQUIRED ADMIN:</span>
              <span className="text-white font-bold select-text">
                {stats?.config?.admin ? `${stats.config.admin.slice(0, 8)}...${stats.config.admin.slice(-8)}` : 'RETRIEVING CONFIG...'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-trench-gasmask uppercase font-bold">CONNECTED WALLET:</span>
              <span className={`font-bold select-text ${publicKey ? 'text-jeet-red' : 'text-trench-gasmask'}`}>
                {publicKey ? `${publicKey.toBase58().slice(0, 8)}...${publicKey.toBase58().slice(-8)}` : 'DISCONNECTED'}
              </span>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            {!publicKey ? (
              <button
                onClick={connectWallet}
                className="px-6 py-3 bg-jeet-red hover:bg-red-500 text-white font-staatliches text-lg tracking-wider uppercase rounded transition-colors font-bold shadow-glow-jeet flex items-center gap-2"
              >
                🔌 CONNECT ADMIN WALLET
              </button>
            ) : (
              <button
                onClick={connectWallet}
                className="px-6 py-3 bg-trench-sandbag border border-trench-gasmask/30 hover:border-white text-white font-staatliches text-lg tracking-wider uppercase rounded transition-colors font-bold flex items-center gap-2"
              >
                🔄 SWITCH WALLET
              </button>
            )}

            <button
              onClick={() => setDevBypass(true)}
              className="px-4 py-2 bg-transparent text-trench-gasmask hover:text-white font-staatliches text-xs tracking-wider uppercase transition-colors"
            >
              🔓 DEVELOPMENT BYPASS
            </button>
          </div>

        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-7xl w-full px-4 py-8 flex-1 flex flex-col select-none">
      
      {/* 1. RETRO CRT WAR ROOM HEADER */}
      <div className="bg-black border-4 border-trench-sandbag rounded-xl p-6 mb-8 flex flex-col md:flex-row justify-between items-center gap-6 relative shadow-[0_0_20px_rgba(22,163,74,0.05)] scanlines overflow-hidden">
        <div className="flex items-center gap-4">
          <PepePortrait src={PEPE_ASSETS.apeGeneral} size={56} glowColor="gold" animated className="rounded-lg shrink-0 border-2 border-moon-gold" />
          <div>
            <div className="flex items-center gap-2">
              <h1 className="font-staatliches text-3xl sm:text-4xl text-white tracking-widest uppercase leading-none">
                BATTLE STATION ADMIN CONTROL
              </h1>
              <span className="bg-jeet-red text-black font-staatliches text-xs px-2 py-0.5 rounded border border-black font-bold uppercase animate-pulse shrink-0">
                LEVEL 4 SECURITY
              </span>
            </div>
            <p className="font-mono text-xs text-trench-gasmask uppercase mt-2 font-bold max-w-2xl">
              Escrow liquidity verification, platform-fee configurations, automated sweep commands, and continuous server monitoring diagnostics.
            </p>
          </div>
        </div>

        {/* Right Action: Wallet connection / Auth Override */}
        <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0">
          <button 
            onClick={() => { synthSound('victory'); loadDashboardData(); }} 
            disabled={loading}
            className="px-4 py-2.5 bg-trench-sandbag border border-trench-gasmask/30 rounded text-white font-staatliches text-sm tracking-wider uppercase hover:bg-trench-sandbag/70 hover:border-white transition-colors font-bold flex items-center gap-2"
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
            REFRESH STATION
          </button>
          
          <button
            onClick={() => {
              synthSound('bet');
              setDevBypass(!devBypass);
            }}
            className={`px-3 py-2.5 rounded font-staatliches text-xs tracking-wider uppercase font-bold border ${
              devBypass 
                ? 'bg-neon-moon text-black border-neon-moon shadow-glow-moon' 
                : 'bg-black text-trench-gasmask border-trench-sandbag hover:border-neon-moon/50'
            }`}
          >
            {devBypass ? '🟢 DEV AUTH BYPASS: ACTIVE' : '🔴 LOCAL BYPASS: OFF'}
          </button>
        </div>
      </div>

      {/* 2. ERROR DISPLAY */}
      {authError && (
        <div className="bg-jeet-red/15 border-2 border-jeet-red rounded-lg p-4 mb-6 flex items-start gap-3 text-jeet-red scanlines">
          <AlertTriangle className="shrink-0 mt-0.5" size={18} />
          <div>
            <span className="font-staatliches text-lg tracking-wider uppercase font-bold block">
              AUTHORIZATION COMMAND DENIED
            </span>
            <span className="font-mono text-xs font-bold leading-normal block">
              Reason: {authError}
            </span>
          </div>
        </div>
      )}

      {/* 3. CORE ADM TABS SELECTION */}
      <div className="grid grid-cols-2 md:grid-cols-5 border-4 border-trench-sandbag rounded-xl p-1 mb-8 bg-black">
        <button
          onClick={() => { setActiveTab('stats'); synthSound('bet'); }}
          className={`py-3 font-staatliches text-lg tracking-wider transition-all rounded uppercase ${
            activeTab === 'stats'
              ? 'bg-trench-sandbag text-neon-moon font-bold glow-moon border border-neon-moon/30'
              : 'text-trench-gasmask hover:text-white'
          }`}
        >
          📈 PLATFORM STATS
        </button>
        <button
          onClick={() => { setActiveTab('sweeper'); synthSound('bet'); }}
          className={`py-3 font-staatliches text-lg tracking-wider transition-all rounded uppercase ${
            activeTab === 'sweeper'
              ? 'bg-trench-sandbag text-neon-moon font-bold glow-moon border border-neon-moon/30'
              : 'text-trench-gasmask hover:text-white'
          }`}
        >
          🧹 PDA ESCROW SWEEPER
        </button>
        <button
          onClick={() => { setActiveTab('ledger'); synthSound('bet'); }}
          className={`py-3 font-staatliches text-lg tracking-wider transition-all rounded uppercase ${
            activeTab === 'ledger'
              ? 'bg-trench-sandbag text-neon-moon font-bold glow-moon border border-neon-moon/30'
              : 'text-trench-gasmask hover:text-white'
          }`}
        >
          📋 UNCLAIMED LEDGER
        </button>
        <button
          onClick={() => { setActiveTab('config'); synthSound('bet'); }}
          className={`py-3 font-staatliches text-lg tracking-wider transition-all rounded uppercase ${
            activeTab === 'config'
              ? 'bg-trench-sandbag text-neon-moon font-bold glow-moon border border-neon-moon/30'
              : 'text-trench-gasmask hover:text-white'
          }`}
        >
          ⚙️ CONFIG CONTROL
        </button>
        <button
          onClick={() => { setActiveTab('monitor'); synthSound('bet'); }}
          className={`py-3 font-staatliches text-lg tracking-wider transition-all rounded uppercase ${
            activeTab === 'monitor'
              ? 'bg-trench-sandbag text-neon-moon font-bold glow-moon border border-neon-moon/30'
              : 'text-trench-gasmask hover:text-white'
          }`}
        >
          🖥️ SERVER MONITOR
        </button>
      </div>

      {/* 4. TAB PANELS */}
      <div className="flex-1 flex flex-col">
        
        {/* STATS PANEL */}
        {activeTab === 'stats' && (
          <div className="space-y-8 animate-fadeIn">
            {/* SOLVENCY BANNER */}
            {stats && (
              <div className={`border-4 rounded-xl p-6 relative shadow-lg scanlines flex flex-col md:flex-row items-center justify-between gap-6 ${
                stats.solvency.status === 'solvent' 
                  ? 'border-neon-moon bg-neon-moon/5' 
                  : 'border-jeet-red bg-jeet-red/5'
              }`}>
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg border-2 ${
                    stats.solvency.status === 'solvent' ? 'border-neon-moon text-neon-moon' : 'border-jeet-red text-jeet-red'
                  }`}>
                    {stats.solvency.status === 'solvent' ? <ShieldCheck size={36} /> : <ShieldAlert size={36} />}
                  </div>
                  <div>
                    <span className="font-staatliches text-2xl text-white tracking-wider uppercase block leading-none">
                      SOLVENCY STATUS: {stats.solvency.status.toUpperCase()}
                    </span>
                    <span className="font-mono text-xs text-trench-gasmask mt-2 block font-bold">
                      Platform Assets on-chain cover 100% of unclaimed win liabilities.
                    </span>
                  </div>
                </div>

                <div className="flex gap-8 items-center">
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-trench-gasmask block font-bold uppercase">
                      ON-CHAIN ASSETS:
                    </span>
                    <span className="font-staatliches text-3xl text-white block leading-none mt-1">
                      {stats.solvency.assetsSOL.toFixed(4)} SOL
                    </span>
                  </div>
                  <div className="h-10 w-1 bg-trench-sandbag" />
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-trench-gasmask block font-bold uppercase">
                      UNCLAIMED LIABILITIES:
                    </span>
                    <span className="font-staatliches text-3xl text-jeet-red block leading-none mt-1">
                      {stats.unclaimed.amountSOL.toFixed(4)} SOL
                    </span>
                  </div>
                  <div className="h-10 w-1 bg-trench-sandbag" />
                  <div className="text-right">
                    <span className="font-mono text-[10px] text-trench-gasmask block font-bold uppercase">
                      SOLVENCY RATIO:
                    </span>
                    <span className={`font-staatliches text-3xl block leading-none mt-1 ${
                      stats.solvency.status === 'solvent' ? 'text-neon-moon' : 'text-jeet-red'
                    }`}>
                      {(stats.solvency.ratio * 100).toFixed(1)}%
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STATS TILES GRID */}
            {stats ? (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                
                {/* Rooms Card */}
                <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-5 scanlines">
                  <span className="font-staatliches text-lg text-trench-gasmask tracking-wider uppercase block">
                    TOTAL ROOMS CREATED
                  </span>
                  <div className="flex justify-between items-end mt-4">
                    <span className="font-staatliches text-5xl text-white block leading-none">
                      {stats.rooms.total}
                    </span>
                    <span className="font-mono text-xs text-trench-gasmask font-bold">
                      {stats.rooms.active} Active | {stats.rooms.settled} Settled
                    </span>
                  </div>
                </div>

                {/* Bets count */}
                <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-5 scanlines">
                  <span className="font-staatliches text-lg text-trench-gasmask tracking-wider uppercase block">
                    TOTAL BETS VOLUME
                  </span>
                  <div className="flex justify-between items-end mt-4">
                    <span className="font-staatliches text-5xl text-white block leading-none">
                      {stats.bets.count}
                    </span>
                    <span className="font-mono text-xs text-neon-moon font-bold glow-moon">
                      {stats.bets.volumeSOL.toFixed(1)} SOL Total
                    </span>
                  </div>
                </div>

                {/* Fees Card */}
                <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-5 scanlines">
                  <span className="font-staatliches text-lg text-trench-gasmask tracking-wider uppercase block">
                    PLATFORM REVENUE
                  </span>
                  <div className="flex justify-between items-end mt-4">
                    <span className="font-staatliches text-5xl text-moon-gold glow-gold block leading-none">
                      {stats.revenue.platformFeesSOL.toFixed(3)} SOL
                    </span>
                    <span className="font-mono text-xs text-trench-gasmask font-bold uppercase">
                      1.25% Settle Fee
                    </span>
                  </div>
                </div>

                {/* Unclaimed Wallets Card */}
                <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-5 scanlines">
                  <span className="font-staatliches text-lg text-trench-gasmask tracking-wider uppercase block">
                    UNCLAIMED WALLETS
                  </span>
                  <div className="flex justify-between items-end mt-4">
                    <span className="font-staatliches text-5xl text-jeet-red block leading-none">
                      {stats.unclaimed.count}
                    </span>
                    <span className="font-mono text-xs text-jeet-red font-bold">
                      {stats.unclaimed.amountSOL.toFixed(2)} SOL Owed
                    </span>
                  </div>
                </div>

              </div>
            ) : (
              <div className="text-center py-12 border-4 border-dashed border-trench-sandbag rounded-xl">
                <span className="font-mono text-sm text-trench-gasmask font-bold animate-pulse">
                  STATION METRICS STANDING BY — RETRIEVING LOGS...
                </span>
              </div>
            )}
          </div>
        )}

        {/* ESCROW SWEEPER PANEL */}
        {activeTab === 'sweeper' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex justify-between items-center mb-2">
              <div>
                <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase leading-none">
                  PDA ESCROW RECOVERY MANAGER
                </h3>
                <p className="font-mono text-[10px] text-trench-gasmask uppercase mt-1.5 font-bold">
                  Sweep unclaimed prize pools of rooms past the 14-day cooling-off period into the treasury.
                </p>
              </div>
              
              <button
                onClick={handleSweepAll}
                disabled={actionLoading === 'sweep-all' || unclaimedRooms.filter(r => r.isEligibleForSweep).length === 0}
                className="px-5 py-3 bg-jeet-red text-white font-staatliches text-base tracking-wider uppercase rounded hover:bg-red-500 transition-colors font-bold disabled:opacity-40 flex items-center gap-2"
              >
                {actionLoading === 'sweep-all' ? <RefreshCw className="animate-spin" size={16} /> : <AlertTriangle size={16} />}
                SWEEP ALL ELIGIBLE ESCROWS
              </button>
            </div>

            <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl overflow-hidden scanlines">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-mono text-xs text-left">
                  <thead>
                    <tr className="bg-black text-trench-gasmask border-b-2 border-trench-sandbag uppercase font-bold">
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider">ROOM DETAILS</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider">ESCROW PDA</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider text-right">LOCKED SOL</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider text-right">UNCLAIMED SOL</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider">COOLING OFF PERIOD</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider text-right">ACTION</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-trench-sandbag/40">
                    {unclaimedRooms.length > 0 ? (
                      unclaimedRooms.map((room) => {
                        const statusInfo = getCoolingOffStatus(room.expiry, room.coolingOffEnds);
                        const isSweeping = actionLoading === `sweep-${room.roomPubkey}`;

                        return (
                          <tr key={room.roomPubkey} className="hover:bg-black/30 font-bold uppercase transition-colors">
                            {/* Token / Mint */}
                            <td className="py-4 px-4">
                              <div className="flex items-center gap-3">
                                {room.tokenImageUrl ? (
                                  <img src={room.tokenImageUrl} alt="" className="w-8 h-8 rounded-full border border-trench-sandbag" />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-trench-sandbag border border-trench-gasmask/20 flex items-center justify-center font-staatliches text-lg text-white">
                                    {room.tokenSymbol?.slice(0, 1) || '?'}
                                  </div>
                                )}
                                <div>
                                  <span className="text-white block font-bold text-sm">
                                    {room.tokenSymbol || room.tokenName || 'Unknown Token'}
                                  </span>
                                  <span className="text-[10px] text-trench-gasmask block font-mono">
                                    ROOM: {room.roomPubkey.slice(0,6)}...{room.roomPubkey.slice(-6)}
                                  </span>
                                </div>
                              </div>
                            </td>

                            {/* Escrow PDA Address */}
                            <td className="py-4 px-4">
                              <span className="font-mono text-xs text-white block select-text font-medium">
                                {room.escrowPda.slice(0, 8)}...{room.escrowPda.slice(-8)}
                              </span>
                              <span className="font-mono text-[9px] text-trench-gasmask block uppercase font-bold mt-0.5">
                                Seed: escrow + room_pubkey
                              </span>
                            </td>

                            {/* Locked SOL */}
                            <td className="py-4 px-4 text-right">
                              <span className="font-staatliches text-lg text-white block leading-none">
                                {room.escrowBalanceSOL.toFixed(4)} SOL
                              </span>
                            </td>

                            {/* Unclaimed Liability */}
                            <td className="py-4 px-4 text-right">
                              <span className="font-staatliches text-lg text-jeet-red block leading-none">
                                {room.totalUnclaimedSOL.toFixed(4)} SOL
                              </span>
                              <span className="font-mono text-[9px] text-trench-gasmask block mt-0.5">
                                {room.unclaimedPayouts.length} WALLETS
                              </span>
                            </td>

                            {/* Cooling off status */}
                            <td className="py-4 px-4">
                              <span className={`px-2 py-1 rounded font-staatliches text-[11px] border leading-none font-bold uppercase inline-block ${statusInfo.style}`}>
                                {statusInfo.label}
                              </span>
                            </td>

                            {/* Action Sweep button */}
                            <td className="py-4 px-4 text-right">
                              <button
                                onClick={() => handleSweepRoom(room.roomPubkey)}
                                disabled={isSweeping || !room.isEligibleForSweep}
                                className="px-3 py-1.5 bg-neon-moon hover:bg-green-600 disabled:opacity-40 disabled:hover:bg-neon-moon text-black font-staatliches text-xs tracking-wider uppercase rounded transition-colors font-bold flex items-center gap-1.5 ml-auto"
                              >
                                {isSweeping ? <RefreshCw className="animate-spin" size={12} /> : <Play size={12} />}
                                SWEEP ESCROW
                              </button>
                            </td>

                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan={6} className="py-12 text-center text-trench-gasmask font-mono font-bold uppercase">
                          ✅ All Escrows Swept. No Unclaimed Funds Locked On-Chain.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* UNCLAIMED WINNINGS LEDGER */}
        {activeTab === 'ledger' && (
          <div className="space-y-6 animate-fadeIn">
            <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
              <div>
                <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase leading-none">
                  UNCLAIMED WINNINGS AUDIT TRAIL
                </h3>
                <p className="font-mono text-[10px] text-trench-gasmask uppercase mt-1.5 font-bold">
                  Complete registry of winner wallets that have not claimed their SOL earnings. Export reports for offline transfers.
                </p>
              </div>

              {/* Exports */}
              <div className="flex gap-3 shrink-0">
                <button
                  onClick={exportLedgerCSV}
                  className="px-4 py-2 bg-trench-sandbag border border-trench-gasmask/30 rounded text-white font-staatliches text-xs tracking-wider uppercase hover:border-white transition-colors font-bold flex items-center gap-2"
                >
                  <Download size={12} />
                  EXPORT CSV REPORT
                </button>
                <button
                  onClick={exportLedgerJSON}
                  className="px-4 py-2 bg-trench-sandbag border border-trench-gasmask/30 rounded text-white font-staatliches text-xs tracking-wider uppercase hover:border-white transition-colors font-bold flex items-center gap-2"
                >
                  <Download size={12} />
                  EXPORT JSON REPORT
                </button>
              </div>
            </div>

            {/* LEDGER TABLE */}
            <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl overflow-hidden scanlines">
              <div className="overflow-x-auto">
                <table className="w-full border-collapse font-mono text-xs text-left">
                  <thead>
                    <tr className="bg-black text-trench-gasmask border-b-2 border-trench-sandbag uppercase font-bold">
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider">WINNER WALLET</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider">TOKEN MARKETS</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider text-right">ENTITLED WINNINGS</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider">ROOM EXPIRED AT</th>
                      <th className="py-4 px-4 font-staatliches text-base tracking-wider">COOLING OFF LIMIT</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-trench-sandbag/40">
                    {(() => {
                      const flatLedger = unclaimedRooms.flatMap((room) =>
                        room.unclaimedPayouts.map((payout) => ({
                          roomPubkey: room.roomPubkey,
                          tokenSymbol: room.tokenSymbol,
                          tokenName: room.tokenName,
                          escrowPda: room.escrowPda,
                          expiry: room.expiry,
                          coolingOffEnds: room.coolingOffEnds,
                          wallet: payout.wallet,
                          amountSOL: payout.amountSOL,
                          amountLamports: payout.amountLamports,
                        }))
                      ).sort((a, b) => a.escrowPda.localeCompare(b.escrowPda));

                      if (flatLedger.length > 0) {
                        return flatLedger.map((item, index) => (
                          <tr key={`${item.roomPubkey}-${item.wallet}-${index}`} className="hover:bg-black/30 font-bold uppercase transition-colors">
                            {/* Winner Wallet */}
                            <td className="py-4 px-4">
                              <span className="font-mono text-sm text-white block select-text font-bold">
                                {item.wallet}
                              </span>
                              <span className="font-mono text-[9px] text-trench-gasmask block mt-0.5">
                                PDA ESCROW: {item.escrowPda.slice(0, 10)}...{item.escrowPda.slice(-10)}
                              </span>
                            </td>

                            {/* Token market details */}
                            <td className="py-4 px-4">
                              <span className="text-white block font-bold text-sm">
                                {item.tokenSymbol || 'Unknown'}
                              </span>
                              <span className="font-mono text-[10px] text-trench-gasmask block font-medium">
                                ROOM: {item.roomPubkey.slice(0, 6)}...
                              </span>
                            </td>

                            {/* Winnings amount */}
                            <td className="py-4 px-4 text-right">
                              <span className="font-staatliches text-lg text-neon-moon block leading-none">
                                {item.amountSOL.toFixed(5)} SOL
                              </span>
                              <span className="font-mono text-[9px] text-trench-gasmask block mt-0.5">
                                {item.amountLamports} LAMPORTS
                              </span>
                            </td>

                            {/* Room Expiry */}
                            <td className="py-4 px-4 text-trench-gasmask">
                              <span>{new Date(item.expiry).toLocaleString()}</span>
                            </td>

                            {/* Cooling Off Limit */}
                            <td className="py-4 px-4 text-white">
                              <span>{new Date(item.coolingOffEnds).toLocaleString()}</span>
                            </td>
                          </tr>
                        ));
                      } else {
                        return (
                          <tr>
                            <td colSpan={5} className="py-12 text-center text-trench-gasmask font-mono font-bold uppercase">
                              ✅ Perfect Ledger. All Winners Have Fully Claimed Their SOL.
                            </td>
                          </tr>
                        );
                      }
                    })()}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* PLATFORM CONFIG CONTROL PANEL */}
        {activeTab === 'config' && (
          <div className="space-y-6 max-w-3xl mx-auto animate-fadeIn">
            <div>
              <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase leading-none">
                PLATFORM CONFIGURATION EDITOR
              </h3>
              <p className="font-mono text-[10px] text-trench-gasmask uppercase mt-1.5 font-bold">
                Update core parameter limits directly on-chain. Requires Solana wallet signature verification.
              </p>
            </div>

            <form onSubmit={handleUpdateConfig} className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-6 space-y-6 scanlines">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                
                {/* Platform Fee */}
                <div>
                  <label className="font-staatliches text-base text-trench-gasmask block mb-2">
                    PLATFORM FEE BPS
                  </label>
                  <input
                    type="number"
                    value={feeBps}
                    onChange={(e) => setFeeBps(parseInt(e.target.value, 10))}
                    className="w-full bg-black border-2 border-trench-sandbag rounded px-3 py-2 text-white font-mono text-sm focus:border-neon-moon outline-none font-bold"
                    min={0}
                    max={1000}
                    required
                  />
                  <span className="font-mono text-[10px] text-trench-gasmask mt-1.5 block">
                    Basis points (e.g. 125 = 1.25%). Capped at 1000 (10.0%).
                  </span>
                </div>

                {/* Cooling-off period */}
                <div>
                  <label className="font-staatliches text-base text-trench-gasmask block mb-2">
                    COOLING-OFF PERIOD (DAYS)
                  </label>
                  <input
                    type="number"
                    value={coolingOffDays}
                    onChange={(e) => setCoolingOffDays(parseFloat(e.target.value))}
                    className="w-full bg-black border-2 border-trench-sandbag rounded px-3 py-2 text-white font-mono text-sm focus:border-neon-moon outline-none font-bold"
                    min={0}
                    step={0.1}
                    required
                  />
                  <span className="font-mono text-[10px] text-trench-gasmask mt-1.5 block">
                    Duration required before platform can sweep unclaimed funds.
                  </span>
                </div>

                {/* Treasury Wallet */}
                <div className="md:col-span-2">
                  <label className="font-staatliches text-base text-trench-gasmask block mb-2">
                    TREASURY ADDRESS (RECIPIENT OF FEES & SWEEPS)
                  </label>
                  <input
                    type="text"
                    value={treasury}
                    onChange={(e) => setTreasury(e.target.value)}
                    className="w-full bg-black border-2 border-trench-sandbag rounded px-3 py-2 text-white font-mono text-sm focus:border-neon-moon outline-none font-bold"
                    required
                  />
                  <span className="font-mono text-[10px] text-trench-gasmask mt-1.5 block">
                    Public key recipient wallet for all platform fees and swept unclaimed escrows.
                  </span>
                </div>

                {/* Keeper Wallet */}
                <div className="md:col-span-2">
                  <label className="font-staatliches text-base text-trench-gasmask block mb-2">
                    AUTHORIZED KEEPER ACCOUNT
                  </label>
                  <input
                    type="text"
                    value={keeper}
                    onChange={(e) => setKeeper(e.target.value)}
                    className="w-full bg-black border-2 border-trench-sandbag rounded px-3 py-2 text-white font-mono text-sm focus:border-neon-moon outline-none font-bold"
                    required
                  />
                  <span className="font-mono text-[10px] text-trench-gasmask mt-1.5 block">
                    The bot/operator wallet authorized to trigger TWAP calls and settle prediction rooms.
                  </span>
                </div>

                {/* Min Liquidity */}
                <div>
                  <label className="font-staatliches text-base text-trench-gasmask block mb-2">
                    MINIMUM SOL LIQUIDITY TO CREATE ROOM
                  </label>
                  <input
                    type="number"
                    value={minLiquidity}
                    onChange={(e) => setMinLiquidity(e.target.value)}
                    className="w-full bg-black border-2 border-trench-sandbag rounded px-3 py-2 text-white font-mono text-sm focus:border-neon-moon outline-none font-bold"
                    step={0.01}
                    required
                  />
                  <span className="font-mono text-[10px] text-trench-gasmask mt-1.5 block">
                    In SOL. Minimum starting bet volume required to open a new trench.
                  </span>
                </div>

                {/* TWAP window */}
                <div>
                  <label className="font-staatliches text-base text-trench-gasmask block mb-2">
                    TWAP PRICE SAMPLING WINDOW (SECONDS)
                  </label>
                  <input
                    type="number"
                    value={twapWindow}
                    onChange={(e) => setTwapWindow(parseInt(e.target.value, 10))}
                    className="w-full bg-black border-2 border-trench-sandbag rounded px-3 py-2 text-white font-mono text-sm focus:border-neon-moon outline-none font-bold"
                    min={10}
                    required
                  />
                  <span className="font-mono text-[10px] text-trench-gasmask mt-1.5 block">
                    Duration used to average prices at expired room settlement.
                  </span>
                </div>

              </div>

              {/* Submit update */}
              <div className="pt-4 flex items-center justify-between border-t-2 border-trench-sandbag/40">
                <div className="flex items-center gap-2">
                  {publicKey ? (
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-trench-gasmask font-bold">
                        Connected Admin Wallet:
                      </span>
                      <span className="font-mono text-xs text-white font-bold select-text">
                        {publicKey.toBase58().slice(0, 6)}...{publicKey.toBase58().slice(-6)}
                      </span>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={connectWallet}
                      className="px-3 py-1.5 bg-black border border-moon-gold text-moon-gold font-staatliches text-xs tracking-wider uppercase rounded hover:bg-moon-gold/10 font-bold"
                    >
                      🔌 CONNECT ADMIN WALLET
                    </button>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={actionLoading === 'update-config' || (!publicKey && !devBypass)}
                  className="px-6 py-3 bg-neon-moon hover:bg-green-600 disabled:opacity-40 disabled:hover:bg-neon-moon text-black font-staatliches text-base tracking-wider uppercase rounded transition-colors font-bold flex items-center gap-2"
                >
                  {actionLoading === 'update-config' ? <RefreshCw className="animate-spin" size={16} /> : <Settings size={16} />}
                  UPDATE CONFIG ON-CHAIN
                </button>
              </div>
            </form>
          </div>
        )}

        {/* SYSTEM Health Monitor */}
        {activeTab === 'monitor' && (
          <div className="space-y-6 animate-fadeIn">
            <div>
              <h3 className="font-staatliches text-2xl text-white tracking-wider uppercase leading-none">
                DIAGNOSTICS & SYSTEM PERFORMANCE MONITOR
              </h3>
              <p className="font-mono text-[10px] text-trench-gasmask uppercase mt-1.5 font-bold">
                Automated status reporting for critical core microservices, databases, caches, and RPC channels.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              
              {/* Service Health State */}
              <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-6 space-y-6 scanlines">
                <h4 className="font-staatliches text-lg text-white border-b-2 border-trench-sandbag/40 pb-2 flex items-center gap-2">
                  <Server size={16} className="text-neon-moon" />
                  STATION SERVICE STATUS
                </h4>

                <div className="space-y-4">
                  {/* Database */}
                  <div className="flex justify-between items-center bg-black/40 border border-trench-sandbag/60 rounded p-3">
                    <span className="font-mono text-xs font-bold text-white uppercase">
                      PostgreSQL Primary Database
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-trench-gasmask font-bold">
                        {health?.services.database.latencyMs ? `${health.services.database.latencyMs}ms` : '--'}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-staatliches border rounded font-bold uppercase leading-none ${
                        health?.services.database.status === 'ok' 
                          ? 'text-neon-moon border-neon-moon/30 bg-neon-moon/10' 
                          : 'text-jeet-red border-jeet-red/30 bg-jeet-red/10'
                      }`}>
                        {health?.services.database.status === 'ok' ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  {/* Replica Database */}
                  <div className="flex justify-between items-center bg-black/40 border border-trench-sandbag/60 rounded p-3">
                    <span className="font-mono text-xs font-bold text-white uppercase">
                      PostgreSQL Replica (Read)
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-trench-gasmask font-bold">
                        {health?.services.databaseReplica?.latencyMs ? `${health.services.databaseReplica.latencyMs}ms` : '--'}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-staatliches border rounded font-bold uppercase leading-none ${
                        health?.services.databaseReplica?.status === 'ok' 
                          ? 'text-neon-moon border-neon-moon/30 bg-neon-moon/10'
                          : health?.services.databaseReplica?.status === 'unconfigured'
                          ? 'text-trench-gasmask border-trench-sandbag bg-trench-mud'
                          : 'text-jeet-red border-jeet-red/30 bg-jeet-red/10'
                      }`}>
                        {health?.services.databaseReplica?.status.toUpperCase() || 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  {/* Redis */}
                  <div className="flex justify-between items-center bg-black/40 border border-trench-sandbag/60 rounded p-3">
                    <span className="font-mono text-xs font-bold text-white uppercase">
                      Redis Memory Cache / PubSub
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-trench-gasmask font-bold">
                        {health?.services.redis.latencyMs ? `${health.services.redis.latencyMs}ms` : '--'}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-staatliches border rounded font-bold uppercase leading-none ${
                        health?.services.redis.status === 'ok' 
                          ? 'text-neon-moon border-neon-moon/30 bg-neon-moon/10' 
                          : 'text-jeet-red border-jeet-red/30 bg-jeet-red/10'
                      }`}>
                        {health?.services.redis.status === 'ok' ? 'ONLINE' : 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  {/* Solana RPC Node */}
                  <div className="flex justify-between items-center bg-black/40 border border-trench-sandbag/60 rounded p-3">
                    <span className="font-mono text-xs font-bold text-white uppercase flex flex-col">
                      <span>Solana RPC Gateway</span>
                      <span className="font-mono text-[8px] text-trench-gasmask font-bold mt-0.5 normal-case">
                        State: {health?.services.solanaRpc.circuitState || '--'}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-[10px] text-trench-gasmask font-bold">
                        Slot: {health?.services.solanaRpc.slot || '--'}
                      </span>
                      <span className={`px-2 py-0.5 text-[10px] font-staatliches border rounded font-bold uppercase leading-none ${
                        health?.services.solanaRpc.status === 'ok' 
                          ? 'text-neon-moon border-neon-moon/30 bg-neon-moon/10'
                          : health?.services.solanaRpc.status === 'degraded'
                          ? 'text-moon-gold border-moon-gold/30 bg-moon-gold/10'
                          : 'text-jeet-red border-jeet-red/30 bg-jeet-red/10'
                      }`}>
                        {health?.services.solanaRpc.status.toUpperCase() || 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                </div>
              </div>

              {/* Server Performance Metrics */}
              <div className="bg-trench-mud border-4 border-trench-sandbag rounded-xl p-6 space-y-6 scanlines">
                <h4 className="font-staatliches text-lg text-white border-b-2 border-trench-sandbag/40 pb-2 flex items-center gap-2">
                  <CheckCircle size={16} className="text-neon-moon" />
                  UPTIME & MEMORY STATS
                </h4>

                {health ? (
                  <div className="space-y-4 font-mono text-xs font-bold text-trench-gasmask">
                    <div className="flex justify-between border-b border-trench-sandbag/40 pb-2">
                      <span className="uppercase">Station Uptime:</span>
                      <span className="text-white">{(health.uptime / 3600).toFixed(2)} Hours</span>
                    </div>
                    <div className="flex justify-between border-b border-trench-sandbag/40 pb-2">
                      <span className="uppercase">API Node Version:</span>
                      <span className="text-white">v18.18.0</span>
                    </div>
                    <div className="flex justify-between border-b border-trench-sandbag/40 pb-2">
                      <span className="uppercase">Solana Connection:</span>
                      <span className="text-white">{health.services.solanaRpc.isPrimary ? 'Primary Endpoint' : 'Secondary Fallback'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="uppercase">Last Diagnostic Check:</span>
                      <span className="text-white">{new Date(health.ts).toLocaleTimeString()}</span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6 text-trench-gasmask uppercase font-bold animate-pulse">
                    Monitoring data pending...
                  </div>
                )}
              </div>

            </div>
          </div>
        )}

      </div>
    </div>
  );
}
