'use client';

import React, { useState, useEffect } from 'react';
import { useWalletContext } from './WalletProvider';
import { X, Key, AlertTriangle, Eye, EyeOff, Loader2, Shield, Ghost, Globe, Mail, AtSign } from 'lucide-react';
import { motion } from 'framer-motion';

export const WalletSelectionModal: React.FC = () => {
  const {
    isModalOpen,
    setIsModalOpen,
    activeWalletAddress,
    connectEmbedded,
    connectExternal,
    unlockWallet,
    forgetWallet,
    isImportedWalletLocked,
  } = useWalletContext();

  const [unlockPassword, setUnlockPassword] = useState('');
  const [unlockError, setUnlockError] = useState<string | null>(null);
  const [isUnlocking, setIsUnlocking] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [hasAutoOpenedPrivy, setHasAutoOpenedPrivy] = useState(false);

  useEffect(() => {
    if (!isModalOpen) {
      setUnlockPassword('');
      setUnlockError(null);
      setShowPassword(false);
      setHasAutoOpenedPrivy(false);
    }
  }, [isModalOpen]);

  useEffect(() => {
    if (!isModalOpen || isImportedWalletLocked || hasAutoOpenedPrivy) return;
    setHasAutoOpenedPrivy(true);
    connectEmbedded().catch((err) => {
      console.error('Auto-opening Privy login failed:', err);
    });
  }, [isModalOpen, isImportedWalletLocked, hasAutoOpenedPrivy, connectEmbedded]);

  if (!isModalOpen) return null;

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
        initial={{ opacity: 0, y: 20, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 20, scale: 0.98 }}
        transition={{ duration: 0.18 }}
        className="w-full max-w-lg bg-[#050507] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
      >
        <div className="flex items-center justify-between px-6 py-5 border-b border-white/10">
          <div>
            <p className="text-[10px] uppercase tracking-[0.35em] text-slate-400 font-semibold">
              Continue with
            </p>
            <h2 className="mt-2 text-3xl font-black uppercase tracking-[0.22em] text-white">
              Login or Sign Up
            </h2>
          </div>
          <button
            onClick={() => setIsModalOpen(false)}
            className="text-slate-400 hover:text-white"
            aria-label="Close wallet modal"
          >
            <X size={22} />
          </button>
        </div>

        {isImportedWalletLocked ? (
          <form onSubmit={handleUnlock} className="px-6 py-8 space-y-5">
            <div className="rounded-3xl border border-yellow-500/20 bg-yellow-500/5 p-4 text-sm text-yellow-200">
              <div className="flex items-center gap-2 font-bold uppercase tracking-[0.2em] text-yellow-100 mb-2">
                <AlertTriangle size={16} />
                HOT WALLET LOCKED
              </div>
              Unlock the encrypted wallet for {activeWalletAddress?.slice(0, 4)}...{activeWalletAddress?.slice(-4)}.
            </div>

            <div>
              <label className="block text-xs uppercase tracking-[0.3em] text-slate-400 font-semibold mb-2">
                Wallet password
              </label>
              <div className="relative rounded-2xl border border-white/10 bg-white/5">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={unlockPassword}
                  onChange={(e) => setUnlockPassword(e.target.value)}
                  placeholder="Enter password"
                  className="w-full rounded-2xl bg-transparent px-4 py-3 text-sm text-white outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-white"
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {unlockError && (
              <p className="text-xs uppercase tracking-[0.2em] text-rose-400 font-semibold">
                {unlockError}
              </p>
            )}

            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={forgetWallet}
                className="rounded-2xl border border-white/10 bg-white/5 py-3 text-sm uppercase tracking-[0.2em] text-slate-300 hover:bg-white/10"
              >
                Forget wallet
              </button>
              <button
                type="submit"
                disabled={isUnlocking}
                className="rounded-2xl bg-white text-black py-3 text-sm uppercase tracking-[0.2em] font-semibold hover:bg-slate-100 disabled:opacity-60"
              >
                {isUnlocking ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 size={18} className="animate-spin" /> Unlocking...
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-2">
                    <Key size={18} /> Unlock
                  </span>
                )}
              </button>
            </div>
          </form>
        ) : (
          <div className="px-6 py-8">
            <p className="text-sm text-slate-400 mb-6 max-w-lg">
              Sign in or sign up with your wallet provider to access your account and start trading predictions.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <button
                type="button"
                onClick={() => void connectEmbedded()}
                className="group flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-[#22c55e] hover:bg-[#22c55e]/10"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0f1720] text-[#22c55e] transition group-hover:bg-[#22c55e]/15">
                  <Globe size={28} />
                </div>
                <span className="text-sm uppercase tracking-[0.25em] text-white font-semibold">Google</span>
              </button>

              <button
                type="button"
                onClick={() => void connectEmbedded()}
                className="group flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-[#3b82f6] hover:bg-[#3b82f6]/10"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0f1720] text-[#3b82f6] transition group-hover:bg-[#3b82f6]/15">
                  <Mail size={28} />
                </div>
                <span className="text-sm uppercase tracking-[0.25em] text-white font-semibold">Email</span>
              </button>

              <button
                type="button"
                onClick={() => void connectEmbedded()}
                className="group flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-[#1d9bf0] hover:bg-[#1d9bf0]/10"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#0f1720] text-[#1d9bf0] transition group-hover:bg-[#1d9bf0]/15">
                  <AtSign size={28} />
                </div>
                <span className="text-sm uppercase tracking-[0.25em] text-white font-semibold">Twitter</span>
              </button>

              <button
                type="button"
                onClick={() => void connectEmbedded()}
                className="group flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-[#8b5cf6] hover:bg-[#8b5cf6]/10"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#111827] text-[#8b5cf6] transition group-hover:bg-[#8b5cf6]/15">
                  <Ghost size={28} />
                </div>
                <span className="text-sm uppercase tracking-[0.25em] text-white font-semibold">Discord</span>
              </button>

              <button
                type="button"
                onClick={() => void connectExternal()}
                className="col-span-2 group flex flex-col items-center justify-center gap-3 rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-[#f59e0b] hover:bg-[#f59e0b]/10"
              >
                <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-[#1f1f1f] text-[#f59e0b] transition group-hover:bg-[#f59e0b]/15">
                  <Shield size={28} />
                </div>
                <span className="text-sm uppercase tracking-[0.25em] text-white font-semibold">Continue with Wallet</span>
              </button>
            </div>

            <div className="mt-8 border-t border-white/10 pt-6 text-center">
              <p className="text-[10px] uppercase tracking-[0.3em] text-slate-500">
                Can’t access your wallet?
              </p>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="mt-3 text-sm text-white underline underline-offset-4 decoration-white/20 hover:text-[#7c3aed]"
              >
                Use an alternate sign in method
              </button>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  );
};
