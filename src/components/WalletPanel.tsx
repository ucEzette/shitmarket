'use client';

import React, { useState } from 'react';
import { useWalletContext } from './WalletProvider';
import { useExportWallet } from '@privy-io/react-auth/solana';
import { Copy, Check, QrCode, LogOut, Key, Plus, ChevronDown, ShieldAlert, Sparkles, RefreshCw } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const WalletPanel: React.FC<{ onClose?: () => void }> = ({ onClose }) => {
  const {
    walletType,
    activeWalletAddress,
    balance,
    disconnect,
    embeddedWallets,
    activeEmbeddedWallet,
    setActiveEmbeddedWalletAddress,
    createAdditionalWallet,
    createSessionKey,
    session,
    externalWallets,
    activeExternalWallet,
    setActiveExternalWalletAddress,
    setWalletType,
    linkExternalWallet,
  } = useWalletContext();

  const exportWalletHook = useExportWallet();
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [isCreatingWallet, setIsCreatingWallet] = useState(false);
  const [isCreatingSession, setIsCreatingSession] = useState(false);

  const handleCopy = () => {
    if (activeWalletAddress) {
      navigator.clipboard.writeText(activeWalletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleExport = async () => {
    if (activeWalletAddress && exportWalletHook?.exportWallet) {
      try {
        await exportWalletHook.exportWallet({ address: activeWalletAddress });
      } catch (e) {
        console.error("Failed to export wallet:", e);
      }
    }
  };

  const handleCreateAdditional = async () => {
    setIsCreatingWallet(true);
    try {
      await createAdditionalWallet();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingWallet(false);
      setShowDropdown(false);
    }
  };

  const handleCreateSession = async () => {
    setIsCreatingSession(true);
    try {
      await createSessionKey();
    } catch (e) {
      console.error(e);
    } finally {
      setIsCreatingSession(false);
    }
  };

  if (!activeWalletAddress) return null;

  const displayAddress = `${activeWalletAddress.substring(0, 6)}...${activeWalletAddress.slice(-4)}`;

  return (
    <div className="p-4 bg-trench-black border-4 border-trench-sandbag rounded shadow-2xl space-y-4 max-w-sm w-full scanlines font-mono">
      {/* Wallet Type Badge */}
      <div className="flex justify-between items-center border-b border-trench-sandbag/45 pb-2">
        <span className="font-staatliches tracking-wider text-trench-gasmask text-sm uppercase font-bold">
          TERMINAL ADAPTER
        </span>
        <span className={`text-[9px] font-bold px-2 py-0.5 rounded border uppercase ${
          walletType === 'embedded'
            ? 'bg-neon-moon/15 border-neon-moon text-neon-moon'
            : walletType === 'imported'
            ? 'bg-red-500/15 border-red-500 text-red-500 animate-pulse'
            : 'bg-moon-gold/15 border-moon-gold text-moon-gold'
        }`}>
          {walletType === 'imported' ? '🔥 HOT WALLET' : walletType === 'embedded' ? '⚡ EMBEDDED' : '🔌 EXTERNAL'}
        </span>
      </div>

      {/* Primary Wallet Selector */}
      <div className="space-y-1.5 border-b border-trench-sandbag/30 pb-3">
        <span className="font-bold uppercase tracking-wider text-trench-gasmask block text-[8.5px]">
          DESIGNATED PRIMARY WALLET
        </span>
        <div className="grid grid-cols-3 gap-1">
          {/* Embedded Option */}
          <button
            onClick={() => setWalletType('embedded')}
            disabled={!embeddedWallets.length}
            className={`py-1 rounded text-[7.5px] border font-bold uppercase transition-all cursor-pointer ${
              walletType === 'embedded'
                ? 'bg-neon-moon/20 border-neon-moon text-neon-moon shadow-[0_0_8px_rgba(57,255,20,0.3)] font-extrabold'
                : 'bg-trench-mud border-trench-sandbag/45 text-trench-gasmask hover:text-white disabled:opacity-30 disabled:cursor-not-allowed'
            }`}
            title="Use Privy Embedded Solana Wallet"
          >
            ⚡ Embedded
          </button>

          {/* External Option */}
          {externalWallets.length > 0 ? (
            <button
              onClick={() => setWalletType('external')}
              className={`py-1 rounded text-[7.5px] border font-bold uppercase transition-all cursor-pointer ${
                walletType === 'external'
                  ? 'bg-neon-moon/20 border-neon-moon text-neon-moon shadow-[0_0_8px_rgba(57,255,20,0.3)] font-extrabold'
                  : 'bg-trench-mud border-trench-sandbag/45 text-trench-gasmask hover:text-white'
              }`}
              title="Use Connected External Wallet (e.g. Phantom)"
            >
              🔌 External
            </button>
          ) : (
            <button
              onClick={linkExternalWallet}
              className="py-1 rounded text-[7px] border border-dashed border-neon-moon/30 hover:border-neon-moon/60 text-neon-moon bg-neon-moon/5 hover:bg-neon-moon/10 font-bold uppercase transition-all cursor-pointer"
              title="Link External Solana Wallet"
            >
              + Link Ext
            </button>
          )}

          {/* Imported Option */}
          {localStorage.getItem('shitmarket_imported_pubkey') ? (
            <button
              onClick={() => setWalletType('imported')}
              className={`py-1 rounded text-[7.5px] border font-bold uppercase transition-all cursor-pointer ${
                walletType === 'imported'
                  ? 'bg-neon-moon/20 border-neon-moon text-neon-moon shadow-[0_0_8px_rgba(57,255,20,0.3)] font-extrabold'
                  : 'bg-trench-mud border-trench-sandbag/45 text-trench-gasmask hover:text-white'
              }`}
              title="Use Imported Hot Wallet"
            >
              🔥 Hot Wallet
            </button>
          ) : (
            <span className="py-1 rounded text-[7.5px] border border-trench-sandbag/20 text-trench-gasmask/30 text-center uppercase select-none flex items-center justify-center">
              No Hot Key
            </span>
          )}
        </div>
      </div>

      {/* Address & Balance */}
      <div className="bg-black/60 border border-trench-sandbag/30 rounded p-3 space-y-2">
        <div className="flex justify-between items-center text-xs">
          <span className="text-trench-gasmask uppercase text-[9px] font-bold">Address:</span>
          <div className="flex items-center gap-1.5">
            <span className="text-white font-bold select-all text-[10px]">{displayAddress}</span>
            <button
              onClick={handleCopy}
              className="text-trench-gasmask hover:text-white transition-colors cursor-pointer"
              title="Copy Address"
            >
              {copied ? <Check size={12} className="text-neon-moon" /> : <Copy size={12} />}
            </button>
          </div>
        </div>

        <div className="flex justify-between items-center border-t border-trench-sandbag/20 pt-2 text-xs">
          <span className="text-trench-gasmask uppercase text-[9px] font-bold">Balance:</span>
          <span className="text-moon-gold font-bold glow-gold text-sm">{balance.toFixed(4)} SOL</span>
        </div>
      </div>

      {/* Warning for Hot Wallet */}
      {walletType === 'imported' && (
        <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded text-[8px] leading-normal flex items-start gap-2">
          <ShieldAlert size={14} className="shrink-0 text-red-500 animate-pulse" />
          <span>
            HOT WALLET WARNING: KEYS HELD LOCALLY IN RUNTIME MEMORY. REMOVE OR REPLACE BEFORE CLOSING THIS SESSION.
          </span>
        </div>
      )}

      {/* Session Key Status for Embedded */}
      {walletType === 'embedded' && (
        <div className="flex justify-between items-center bg-black/40 border border-trench-sandbag/25 rounded p-2 text-[9px]">
          <span className="text-trench-gasmask uppercase font-bold">Session Auto-Signing:</span>
          <div className="flex items-center gap-1.5">
            <span className={`font-bold ${session ? 'text-neon-moon' : 'text-yellow-500 animate-pulse'}`}>
              {session ? 'ENABLED (1-CLICK)' : 'NOT AUTHD'}
            </span>
            {!session && (
              <button
                onClick={handleCreateSession}
                disabled={isCreatingSession}
                className="px-1.5 py-0.5 bg-yellow-500 hover:bg-yellow-600 text-black font-bold uppercase rounded text-[8px] cursor-pointer flex items-center gap-0.5"
              >
                {isCreatingSession ? <RefreshCw size={8} className="animate-spin" /> : <Sparkles size={8} />}
                <span>Authorize</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Multi-wallet Dropdown Selector for Embedded */}
      {walletType === 'embedded' && embeddedWallets.length > 1 && (
        <div className="relative">
          <span className="font-bold uppercase tracking-wider text-trench-gasmask block mb-1 text-[8px]">
            SWITCH EMBEDDED ACCOUNT
          </span>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full bg-black hover:bg-black/80 text-white border border-trench-sandbag/40 rounded px-2.5 py-1.5 flex justify-between items-center text-[10px] transition-all cursor-pointer"
          >
            <span>{activeEmbeddedWallet?.address.substring(0, 8)}...{activeEmbeddedWallet?.address.slice(-6)}</span>
            <ChevronDown size={12} className={`text-trench-gasmask transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute left-0 right-0 mt-1 bg-trench-black border border-trench-sandbag rounded shadow-xl z-50 max-h-36 overflow-y-auto"
              >
                {embeddedWallets.map((w) => {
                  const isActive = w.address === activeEmbeddedWallet?.address;
                  return (
                    <button
                      key={w.address}
                      onClick={() => {
                        setActiveEmbeddedWalletAddress(w.address);
                        setShowDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[9px] hover:bg-trench-mud border-b border-trench-sandbag/10 last:border-b-0 flex justify-between items-center transition-colors cursor-pointer ${
                        isActive ? 'text-neon-moon font-bold bg-trench-mud/20' : 'text-trench-gasmask'
                      }`}
                    >
                      <span>{w.address.substring(0, 10)}...{w.address.slice(-8)}</span>
                      {isActive && <Check size={10} />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Multi-wallet Dropdown Selector for External */}
      {walletType === 'external' && externalWallets.length > 1 && (
        <div className="relative">
          <span className="font-bold uppercase tracking-wider text-trench-gasmask block mb-1 text-[8px]">
            SWITCH EXTERNAL ACCOUNT
          </span>
          <button
            onClick={() => setShowDropdown(!showDropdown)}
            className="w-full bg-black hover:bg-black/80 text-white border border-trench-sandbag/40 rounded px-2.5 py-1.5 flex justify-between items-center text-[10px] transition-all cursor-pointer"
          >
            <span>{activeExternalWallet?.address.substring(0, 8)}...{activeExternalWallet?.address.slice(-6)}</span>
            <ChevronDown size={12} className={`text-trench-gasmask transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
          </button>

          <AnimatePresence>
            {showDropdown && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -5 }}
                className="absolute left-0 right-0 mt-1 bg-trench-black border border-trench-sandbag rounded shadow-xl z-50 max-h-36 overflow-y-auto"
              >
                {externalWallets.map((w) => {
                  const isActive = w.address === activeExternalWallet?.address;
                  return (
                    <button
                      key={w.address}
                      onClick={() => {
                        setActiveExternalWalletAddress(w.address);
                        setShowDropdown(false);
                      }}
                      className={`w-full text-left px-3 py-1.5 text-[9px] hover:bg-trench-mud border-b border-trench-sandbag/10 last:border-b-0 flex justify-between items-center transition-colors cursor-pointer ${
                        isActive ? 'text-neon-moon font-bold bg-trench-mud/20' : 'text-trench-gasmask'
                      }`}
                    >
                      <span>{w.address.substring(0, 10)}...{w.address.slice(-8)}</span>
                      {isActive && <Check size={10} />}
                    </button>
                  );
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Action Buttons */}
      <div className="grid grid-cols-2 gap-2">
        {/* Deposit Button */}
        <button
          onClick={() => setShowQr(!showQr)}
          className={`py-1.5 font-staatliches text-xs uppercase rounded cursor-pointer border flex items-center justify-center gap-1 transition-all ${
            showQr
              ? 'bg-neon-moon/20 border-neon-moon text-neon-moon'
              : 'bg-trench-mud hover:bg-trench-mud/80 border-trench-sandbag text-white'
          }`}
        >
          <QrCode size={12} />
          <span>Deposit</span>
        </button>

        {/* Embedded Wallet Additional Tools */}
        {walletType === 'embedded' ? (
          <button
            onClick={handleExport}
            className="py-1.5 font-staatliches text-xs uppercase rounded cursor-pointer border bg-trench-mud hover:bg-trench-mud/80 border-trench-sandbag text-white flex items-center justify-center gap-1 transition-all"
          >
            <Key size={12} />
            <span>Export Key</span>
          </button>
        ) : (
          <button
            onClick={disconnect}
            className="py-1.5 font-staatliches text-xs uppercase rounded cursor-pointer border border-red-500/50 hover:bg-red-500/10 text-red-400 flex items-center justify-center gap-1 transition-all"
          >
            <LogOut size={12} />
            <span>Forget Wallet</span>
          </button>
        )}
      </div>

      {/* Create Additional Wallet for Embedded */}
      {walletType === 'embedded' && (
        <button
          onClick={handleCreateAdditional}
          disabled={isCreatingWallet}
          className="w-full py-1.5 font-staatliches text-xs border border-dashed border-neon-moon/40 hover:border-neon-moon/80 text-neon-moon bg-neon-moon/5 hover:bg-neon-moon/10 rounded cursor-pointer flex items-center justify-center gap-1 transition-all uppercase"
        >
          {isCreatingWallet ? <RefreshCw size={10} className="animate-spin" /> : <Plus size={10} />}
          <span>Generate Additional Account</span>
        </button>
      )}

      {/* Disconnect/LogOut for Embedded */}
      {walletType === 'embedded' && (
        <button
          onClick={disconnect}
          className="w-full py-1.5 font-staatliches text-xs border border-red-500/40 hover:border-red-500/80 text-red-400 bg-red-500/5 hover:bg-red-500/10 rounded cursor-pointer flex items-center justify-center gap-1 transition-all uppercase"
        >
          <LogOut size={12} />
          <span>Disconnect Adapter</span>
        </button>
      )}

      {/* QR Deposit Drawer */}
      <AnimatePresence>
        {showQr && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border border-trench-sandbag/40 bg-black/75 rounded p-3 flex flex-col items-center gap-2 overflow-hidden"
          >
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=150x150&data=${activeWalletAddress}`}
              alt="Deposit QR Code"
              className="w-28 h-28 border border-white/10 rounded"
              loading="lazy"
            />
            <span className="text-[7.5px] text-trench-gasmask text-center max-w-xs break-all leading-normal uppercase">
              Send SOL or Devnet mock tokens to: <strong className="text-white font-bold select-all">{activeWalletAddress}</strong>
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
