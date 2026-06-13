'use client';

import React, { useState, useEffect } from 'react';
import { useWalletContext } from './WalletProvider';
import { X, Sparkles, Key, AlertTriangle, Eye, EyeOff, Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { PepePortrait, PEPE_ASSETS } from './MemeAssets';

export const WalletSelectionModal: React.FC = () => {
  const {
    isModalOpen,
    setIsModalOpen,
    walletType,
    activeWalletAddress,
    connectEmbedded,
    connectExternal,
    importPrivateKeyOrMnemonic,
    unlockWallet,
    forgetWallet,
    isImportedWalletLocked,
  } = useWalletContext();

  const [activeTab, setActiveTab] = useState<'create' | 'connect' | 'import'>('create');
  
  // Input fields for import
  const [importInput, setImportInput] = useState('');
  const [saveEncrypted, setSaveEncrypted] = useState(false);
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Input field for unlock
  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Reset state on open/close
  useEffect(() => {
    if (!isModalOpen) {
      setImportInput('');
      setSaveEncrypted(false);
      setPassword('');
      setImportError(null);
      setUnlockPassword('');
      setUnlockError(null);
    }
  }, [isModalOpen]);

  if (!isModalOpen) return null;

  const handleImport = async (e: React.FormEvent) => {
    e.preventDefault();
    setImportError(null);
    if (!importInput.trim()) {
      setImportError('Please enter a private key or seed phrase.');
      return;
    }
    if (saveEncrypted && !password) {
      setImportError('Password is required when "Save Encrypted" is enabled.');
      return;
    }

    setIsImporting(true);
    try {
      await importPrivateKeyOrMnemonic(importInput, saveEncrypted, password);
    } catch (err: any) {
      setImportError(err.message || 'Import failed.');
    } finally {
      setIsImporting(false);
    }
  };

  const handleUnlock = async (e: React.FormEvent) => {
    e.preventDefault();
    setUnlockError(null);
    if (!unlockPassword) {
      setUnlockError('Password is required.');
      return;
    }

    setIsUnlocking(true);
    try {
      const success = await unlockWallet(unlockPassword);
      if (!success) {
        setUnlockError('Incorrect password. Please try again.');
      }
    } catch (err) {
      setUnlockError('Unlock failed.');
    } finally {
      setIsUnlocking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/85 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md bg-trench-black border-4 border-trench-sandbag rounded shadow-2xl relative overflow-hidden flex flex-col scanlines"
      >
        {/* Header */}
        <div className="flex justify-between items-center border-b border-trench-sandbag/45 p-4">
          <span className="font-staatliches tracking-widest text-neon-moon text-2xl uppercase font-bold">
            {isImportedWalletLocked ? 'UNLOCK TRENCH WALLET' : 'ENTER THE TRENCHES'}
          </span>
          <button
            onClick={() => setIsModalOpen(false)}
            className="text-trench-gasmask hover:text-white cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {isImportedWalletLocked ? (
          /* Unlock Saved Hot Wallet Screen */
          <form onSubmit={handleUnlock} className="p-6 space-y-4">
            <div className="bg-yellow-500/10 border-2 border-yellow-500/40 text-yellow-400 p-3 rounded text-xs font-mono leading-normal">
              <div className="flex items-center gap-2 font-bold mb-1">
                <AlertTriangle size={14} className="shrink-0" />
                <span>HOT WALLET DETECTED</span>
              </div>
              Your local wallet key ({activeWalletAddress?.substring(0, 6)}...{activeWalletAddress?.slice(-4)}) is encrypted on this terminal. Enter your password to unlock.
            </div>

            <div className="space-y-1.5">
              <label className="font-staatliches text-sm tracking-wider text-trench-gasmask block uppercase">
                Wallet Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Enter password..."
                  className="w-full bg-black text-white font-mono text-xs px-3 py-2 border-2 border-trench-sandbag/60 rounded focus:outline-none focus:border-neon-moon pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-trench-gasmask hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {unlockError && (
              <div className="text-red-500 text-xs font-mono uppercase font-bold animate-pulse">
                ⚠️ {unlockError}
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <button
                type="button"
                onClick={forgetWallet}
                className="flex-1 py-2 font-staatliches text-sm border-2 border-red-500/50 hover:bg-red-500/10 text-red-400 transition-colors uppercase rounded cursor-pointer font-bold"
              >
                Forget Wallet
              </button>
              <button
                type="submit"
                disabled={isUnlocking}
                className="flex-1 py-2 font-staatliches text-sm text-black bg-neon-moon hover:bg-neon-moon/90 transition-colors uppercase rounded cursor-pointer font-bold flex items-center justify-center gap-1"
              >
                {isUnlocking ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>Unlocking...</span>
                  </>
                ) : (
                  <>
                    <Key size={14} />
                    <span>Unlock Wallet</span>
                  </>
                )}
              </button>
            </div>
          </form>
        ) : (
          /* Normal Wallet Selection Screen */
          <div className="flex flex-col flex-1">
            {/* Tabs */}
            <div className="grid grid-cols-3 border-b border-trench-sandbag/30 text-center font-staatliches text-xs tracking-wider uppercase">
              <button
                onClick={() => { setActiveTab('create'); setImportError(null); }}
                className={`py-2.5 transition-all border-b-4 cursor-pointer font-bold ${
                  activeTab === 'create'
                    ? 'border-neon-moon text-neon-moon bg-trench-mud/30'
                    : 'border-transparent text-trench-gasmask hover:text-white'
                }`}
              >
                1. Create Wallet
              </button>
              <button
                onClick={() => { setActiveTab('connect'); setImportError(null); }}
                className={`py-2.5 transition-all border-b-4 cursor-pointer font-bold ${
                  activeTab === 'connect'
                    ? 'border-neon-moon text-neon-moon bg-trench-mud/30'
                    : 'border-transparent text-trench-gasmask hover:text-white'
                }`}
              >
                2. Connect External
              </button>
              <button
                onClick={() => { setActiveTab('import'); setImportError(null); }}
                className={`py-2.5 transition-all border-b-4 cursor-pointer font-bold ${
                  activeTab === 'import'
                    ? 'border-neon-moon text-neon-moon bg-trench-mud/30'
                    : 'border-transparent text-trench-gasmask hover:text-white'
                }`}
              >
                3. Import Hot
              </button>
            </div>

            {/* Tab Contents */}
            <div className="p-6 flex-1 flex flex-col justify-between">
              {activeTab === 'create' && (
                <div className="space-y-4">
                  <div className="text-center py-4 space-y-2">
                    <div className="inline-flex p-1 bg-neon-moon/10 rounded-full border border-neon-moon/30 text-neon-moon animate-pulse">
                      <PepePortrait
                        src={PEPE_ASSETS.fewUnderstand}
                        size={64}
                        glowColor="moon"
                        className="rounded-full"
                      />
                    </div>
                    <h3 className="font-staatliches text-lg text-white tracking-wide uppercase font-bold">
                      Deploy Instant Sandbox Wallet
                    </h3>
                    <p className="font-mono text-[10px] text-trench-gasmask max-w-xs mx-auto leading-relaxed">
                      Auto-generate a secure, non-custodial embedded Solana wallet via social auth (Google, Discord, Twitter) or Email. Features one-click session keys.
                    </p>
                  </div>
                  <button
                    onClick={connectEmbedded}
                    className="w-full py-2.5 font-staatliches text-sm text-black bg-neon-moon hover:bg-neon-moon/90 transition-colors uppercase rounded cursor-pointer font-bold"
                  >
                    Generate Wallet (Social / Email)
                  </button>
                </div>
              )}

              {activeTab === 'connect' && (
                <div className="space-y-4">
                  <div className="text-center py-4 space-y-2">
                    <div className="inline-flex p-1 bg-moon-gold/10 rounded-full border border-moon-gold/30 text-moon-gold">
                      <PepePortrait
                        src={PEPE_ASSETS.fewUnderstand}
                        size={64}
                        glowColor="gold"
                        className="rounded-full"
                      />
                    </div>
                    <h3 className="font-staatliches text-lg text-white tracking-wide uppercase font-bold">
                      Connect Hardware or Browser Wallet
                    </h3>
                    <p className="font-mono text-[10px] text-trench-gasmask max-w-xs mx-auto leading-relaxed">
                      Link your Phantom, Solflare, Backpack, or other external wallets. Requires manual confirmation prompts for every transaction.
                    </p>
                  </div>
                  <button
                    onClick={connectExternal}
                    className="w-full py-2.5 font-staatliches text-sm text-black bg-moon-gold hover:bg-moon-gold/90 transition-colors uppercase rounded cursor-pointer font-bold"
                  >
                    Connect Hardware Wallet
                  </button>
                </div>
              )}

              {activeTab === 'import' && (
                <form onSubmit={handleImport} className="space-y-4">
                  <div className="space-y-1.5">
                    <label className="font-staatliches text-xs tracking-wider text-trench-gasmask block uppercase font-bold">
                      Solana Private Key or Seed Phrase
                    </label>
                    <textarea
                      value={importInput}
                      onChange={(e) => setImportInput(e.target.value)}
                      placeholder="Paste base58 private key or 12/24 word mnemonic seed phrase..."
                      rows={3}
                      className="w-full bg-black text-white font-mono text-[10px] px-3 py-2 border-2 border-trench-sandbag/60 rounded focus:outline-none focus:border-neon-moon resize-none"
                    />
                  </div>

                  <div className="flex items-center gap-2 py-1 select-none">
                    <input
                      type="checkbox"
                      id="saveEncrypted"
                      checked={saveEncrypted}
                      onChange={(e) => setSaveEncrypted(e.target.checked)}
                      className="accent-neon-moon w-3.5 h-3.5 cursor-pointer rounded bg-black"
                    />
                    <label
                      htmlFor="saveEncrypted"
                      className="font-staatliches text-xs tracking-wider text-white uppercase cursor-pointer"
                    >
                      Save encrypted to this browser local storage
                    </label>
                  </div>

                  {saveEncrypted && (
                    <div className="space-y-1.5 animate-fadeIn">
                      <label className="font-staatliches text-xs tracking-wider text-trench-gasmask block uppercase font-bold">
                        Set Password to Encrypt Local Key
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Create strong wallet password..."
                          className="w-full bg-black text-white font-mono text-[10px] px-3 py-2 border-2 border-trench-sandbag/60 rounded focus:outline-none focus:border-neon-moon pr-10"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-trench-gasmask hover:text-white cursor-pointer"
                        >
                          {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                        </button>
                      </div>
                    </div>
                  )}

                  {importError && (
                    <div className="text-red-500 text-[10px] font-mono uppercase font-bold leading-normal">
                      ⚠️ {importError}
                    </div>
                  )}

                  <div className="bg-red-500/10 border border-red-500/30 text-red-400 p-2.5 rounded text-[8px] font-mono leading-normal flex items-start gap-2">
                    <AlertTriangle size={14} className="shrink-0 text-red-500 animate-pulse" />
                    <span>
                      WARNING: THIS IS A HOT WALLET INTEGRATION. ALL KEYS RESIDE ENTIRELY ON THIS CLIENT browser context. NEVER IMPORT WALLETS CONTAINING LARGE CAPITAL RESERVES.
                    </span>
                  </div>

                  <button
                    type="submit"
                    disabled={isImporting}
                    className="w-full py-2.5 font-staatliches text-sm text-black bg-neon-moon hover:bg-neon-moon/90 transition-colors uppercase rounded cursor-pointer font-bold flex items-center justify-center gap-1"
                  >
                    {isImporting ? (
                      <>
                        <Loader2 size={14} className="animate-spin" />
                        <span>Importing...</span>
                      </>
                    ) : (
                      <>
                        <Key size={14} />
                        <span>Deploy Hot Wallet</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
