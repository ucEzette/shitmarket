'use client';

import React, { useEffect } from 'react';
import { useWalletContext } from './WalletProvider';
import { useAppState } from '@/store/useAppState';

/**
 * WalletAdapterBridge syncs the unified custom wallet state
 * from WalletContext into the Zustand store.
 */
export const WalletAdapterBridge: React.FC = () => {
  const {
    activeWalletAddress,
    sendTransaction,
    setIsModalOpen
  } = useWalletContext();

  const setWalletAddress = useAppState((s) => s.setWalletAddress);
  const setSendTransaction = useAppState((s) => s.setSendTransaction);

  // Sync the wallet address to Zustand store
  useEffect(() => {
    if (activeWalletAddress) {
      setWalletAddress(activeWalletAddress);
    } else {
      setWalletAddress(null);
    }
  }, [activeWalletAddress, setWalletAddress]);

  // Sync the sendTransaction function to Zustand store
  useEffect(() => {
    if (sendTransaction) {
      setSendTransaction(sendTransaction);
    }
  }, [sendTransaction, setSendTransaction]);

  // Listen to custom connect wallet triggers across the app
  useEffect(() => {
    const handleTriggerConnect = () => {
      setIsModalOpen(true);
    };
    window.addEventListener('trigger-wallet-connection', handleTriggerConnect);
    return () => window.removeEventListener('trigger-wallet-connection', handleTriggerConnect);
  }, [setIsModalOpen]);

  return null; // This is a non-visual bridge component
};
